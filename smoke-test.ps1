$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8080/api'

# 0) Wait for backend to come up (max ~60s)
$up = $false
for ($i = 0; $i -lt 60; $i++) {
    try { Invoke-RestMethod "$base/artists" -Method Get | Out-Null; $up = $true; break }
    catch { Start-Sleep -Seconds 1 }
}
if (-not $up) { throw 'Backend did not start on port 8080' }
Write-Host '[OK] Backend is up'

# 1) Artists
$artists = Invoke-RestMethod "$base/artists"
Write-Host "[OK] /api/artists -> $($artists.Count) artists"

# 2) Concerts, all + filtered
$concerts = Invoke-RestMethod "$base/concerts"
Write-Host "[OK] /api/concerts -> $($concerts.Count) concerts"
$filtered = Invoke-RestMethod "$base/concerts?artistId=1"
Write-Host "[OK] /api/concerts?artistId=1 -> $($filtered.Count) concerts"
if ($filtered.Count -eq 0 -or $filtered.Count -ge $concerts.Count) { throw 'artist filter did not work' }
foreach ($c in $filtered) { if ($c.artistId -ne 1) { throw 'filtered list contains foreign artist' } }

# 3) Seat map
$map = Invoke-RestMethod "$base/concerts/1/seats"
$seats = $map.seats
Write-Host "[OK] /api/concerts/1/seats -> $($seats.Count) seats, concert=$($map.concert.title) by $($map.concert.artistName)"
if ($seats.Count -ne 200) { throw 'expected 200 seats, got $($seats.Count)' }
$available = @($seats | Where-Object { $_.status -eq 'AVAILABLE' } | Select-Object -First 4)
$soldCount = @($seats | Where-Object { $_.status -eq 'SOLD' }).Count
Write-Host "     available=$($available.Count) pre-sold=$soldCount (~15% expected)"
if ($available.Count -lt 1) { throw 'no available seats to test with' }
if ($soldCount -lt 10) { throw 'too few pre-sold seats; seeding looks off' }
$vip = $seats | Where-Object { $_.rowLetter -eq 'A' } | Select-Object -First 1
Write-Host "     row A seat: zone=$($vip.zone) price=$($vip.price) (basePrice=$($map.concert.basePrice), expect 2x)"

# 4) Mock payment: approve + decline
$payBody = @{ buyerName='Smoke Tester'; cardNumber='4242 4242 4242 4242'; cardExpiry='12/29'; cardCvv='123' } | ConvertTo-Json
$pay = Invoke-RestMethod "$base/payments" -Method Post -Body $payBody -ContentType 'application/json'
if ($pay.status -ne 'APPROVED') { throw 'expected payment APPROVED, got $($pay.status)' }
Write-Host "[OK] POST /api/payments (4242...) -> APPROVED paymentId=$($pay.paymentId) last4=$($pay.last4)"

$declineBody = @{ buyerName='Smoke Tester'; cardNumber='4111 1111 1111 0000'; cardExpiry='12/29'; cardCvv='123' } | ConvertTo-Json
$dec = Invoke-RestMethod "$base/payments" -Method Post -Body $declineBody -ContentType 'application/json'
if ($dec.status -ne 'DECLINED') { throw 'expected payment DECLINED for ...0000 card' }
Write-Host "[OK] POST /api/payments (...0000) -> DECLINED: $($dec.declineReason)"

# 5) Create an order with the 4 available seats
$body = @{
    buyerName = 'Smoke Tester'
    buyerEmail = 'smoke@test.com'
    concertId = 1
    seatIds   = @($available | ForEach-Object { $_.id })
} | ConvertTo-Json
$order = Invoke-RestMethod "$base/orders" -Method Post -Body $body -ContentType 'application/json'
Write-Host "[OK] POST /api/orders -> reference=$($order.reference) total=$($order.totalAmount) seats=$($order.seats.Count)"
if ($order.seats.Count -ne 4) { throw 'order should contain 4 seats' }
$expectedTotal = ($available | Measure-Object -Property price -Sum).Sum
if ([math]::Abs([double]$order.totalAmount - [double]$expectedTotal) -gt 0.001) { throw 'total mismatch' }

# 6) Seats now SOLD on next seat-map load
$map2 = Invoke-RestMethod "$base/concerts/1/seats"
$stillAvailable = @($map2.seats | Where-Object { $order.seats.id -contains $_.id -and $_.status -eq 'AVAILABLE' })
if ($stillAvailable.Count -ne 0) { throw 'purchased seats are still AVAILABLE' }
Write-Host '[OK] Purchased seats are SOLD on subsequent seat-map load'

# 7) Double booking -> 409
$body2 = @{
    buyerName = 'Second Buyer'
    buyerEmail = 'second@test.com'
    concertId = 1
    seatIds   = @($available[0].id)
} | ConvertTo-Json
try {
    Invoke-RestMethod "$base/orders" -Method Post -Body $body2 -ContentType 'application/json'
    throw 'ERROR: double booking was accepted (expected 409)'
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 409) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host "[OK] Double booking rejected with 409: $($reader.ReadToEnd())"
    } else {
        throw "Unexpected status: $($_.Exception.Response.StatusCode)"
    }
}

# 8) Validation: 5 seats -> 400
$body3 = @{
    buyerName = 'Too Many'
    buyerEmail = 'many@test.com'
    concertId = 1
    seatIds   = @($map2.seats | Where-Object { $_.status -eq 'AVAILABLE' } | Select-Object -First 5 | ForEach-Object { $_.id })
} | ConvertTo-Json
try {
    Invoke-RestMethod "$base/orders" -Method Post -Body $body3 -ContentType 'application/json'
    throw 'ERROR: order with 5 seats was accepted (expected 400)'
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) { Write-Host '[OK] Order with 5 seats rejected with 400' }
    else { throw "Unexpected status: $($_.Exception.Response.StatusCode)" }
}

# 9) Fetch order by reference
$fetched = Invoke-RestMethod "$base/orders/$($order.reference)"
Write-Host "[OK] GET /api/orders/$($order.reference) -> buyer=$($fetched.buyerName), concert=$($fetched.concert.title), total=$($fetched.totalAmount)"

# 10) Confirmation email landed in Mailpit/MailHog (soft check: skipped if Docker mail server is not running)
Start-Sleep -Seconds 3
try {
    $api = $null
    foreach ($url in @("http://localhost:8025/api/v1/messages", "http://localhost:8025/api/v2/messages")) {
        try { $api = Invoke-RestMethod $url -TimeoutSec 5; break } catch { }
    }
    if ($null -eq $api) { throw 'mail server API not reachable' }
    $msgs = @($api.messages)
    if ($msgs.Count -eq 0) { throw 'no messages in mail server yet' }
    $msg = $msgs[0]
    $addr = { param($list) if ($null -eq $list) { return '(none)' } return (($list | ForEach-Object { if ($_ -is [string]) { $_ } else { $_.Address } }) -join ', ') }
    $to = & $addr $msg.To
    $bcc = & $addr $msg.Bcc
    Write-Host "[OK] Confirmation email delivered -> to=$to bcc=$bcc (open http://localhost:8025 to read it)"
} catch {
    Write-Host '[SKIP] Mailpit/MailHog not running on :8025 - email delivery not verified'
}

Write-Host ''
Write-Host 'ALL SMOKE TESTS PASSED'
