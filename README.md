# TicketShop — concert ticket selling demo

A complete, runnable concert-ticket-selling web application:

- **Backend** — Java 17, Spring Boot 3 (Web + Data JPA), in-memory H2 database, transactional order creation with a double-booking guard, mock payment processor, and real SMTP confirmation emails.
- **Frontend** — Angular 17 standalone components & routing, dark neon "live music" theme: glassmorphism cards, an interactive 10×20 seat map with zone pricing, a ticket-shaped checkout with a mock card payment, and a confetti order confirmation.

Everything runs locally; no external services, accounts or cloud providers needed.

---

## Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │              your browser                    │
                    └──────┬───────────────────────────┬───────────┘
                           │ :4200                     │ :8080
                           ▼                           ▼
        ┌─────────────────────────────┐   ┌──────────────────────────────┐
        │  frontend (Angular 17)      │   │  backend (Spring Boot 3)     │
        │  dev server, hot reload     │   │  REST /api/**  ·  H2 in-mem  │
        │  standalone components      │   │  (re-seeded on every start)  │
        └─────────────────────────────┘   └───────┬──────────────┬───────┘
                                                  │ :1025 SMTP   │
                                                  ▼              │
                              ┌─────────────────────────────┐   │
                              │  mailpit (local mail server)│◄──┘  (async, fire-and-forget)
                              │  UI + API on :8025          │
                              └─────────────────────────────┘
```

Notes:

- The **browser** talks to the backend directly (`http://localhost:8080/api`); CORS is enabled for `http://localhost:4200` in `backend/src/main/java/com/ticketshop/config/WebConfig.java`.
- The backend "sends" confirmation emails over **SMTP to a local Mailpit container** — the emails are real SMTP messages you can open in Mailpit's web UI at http://localhost:8025. No real mailbox is ever touched.
- The H2 database lives **in memory** and is **re-seeded on every backend start** (fresh concerts, fresh seats). Restarting = clean slate by design.

---

## Quick start

### Option A — Docker Compose (recommended: everything in one command)

Prerequisite: Docker Desktop (or any Docker with the Compose v2 plugin).

```powershell
docker compose up --build
```

First run pulls images and builds the backend jar (~2–5 min); later runs are fast.
Wait for `Started TicketShopApplication` in the `backend` logs and a few more seconds for the Angular dev server (`npm ci` runs inside the container).

Then open:

| URL | What it is |
|---|---|
| http://localhost:4200 | The app (Angular) |
| http://localhost:8025 | Mailpit — read the "sent" confirmation emails |
| http://localhost:8080/api/artists | Backend API (JSON) |
| http://localhost:8080/h2-console | H2 web console (JDBC URL `jdbc:h2:mem:ticketshop`, user `sa`, empty password) |

Stop everything: `docker compose down` (add `-v` if you ever add named volumes).

The frontend source is bind-mounted into the container, so `ng serve` **hot-reloads** your edits (file watching on Docker Desktop for Windows is generally reliable; if a change doesn't apply, `docker compose restart frontend`).

### Option B — local development, no Docker for the app

Prerequisites: JDK 17+, Maven 3.9+, Node.js 18+ (20+ recommended), and Docker **only** for the mail server.

**1. Mail server** (for the real SMTP emails):

```powershell
docker run -d --name mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit
# ...or MailHog:
# docker run -d --name mailhog -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

**2. Backend** (terminal 1):

```powershell
cd backend
mvn spring-boot:run
```

Wait for `Started TicketShopApplication` (port 8080).

**3. Frontend** (terminal 2):

```powershell
cd frontend
npm install
npm start
```

Open http://localhost:4200.

---

## What's seeded on every start

`DataSeeder` (runs at startup, idempotent) creates:

- **5 artists** with **2–3 concerts each** (12 total), dates spread over the following ~3 weeks.
- **200 seats per concert** — 10 rows (A–J) × 20 seats, with an aisle gap after seat 10.
- **Zones & pricing** (price = `basePrice` × zone multiplier):

  | Zone | Rows | Multiplier |
  |---|---|---|
  | VIP | A–C | 2× |
  | PREMIUM | D–F | 1.5× |
  | STANDARD | G–J | 1× |

- **~15% of seats pre-sold** (random), so the map shows realistic SOLD seats on first load.

---

## REST API reference

Base URL: `http://localhost:8080/api`

| Method & path | Description | Success | Errors |
|---|---|---|---|
| `GET /artists` | All artists | 200 | — |
| `GET /concerts` | All concerts, ordered by date | 200 | — |
| `GET /concerts?artistId=1` | Concerts of one artist | 200 | — |
| `GET /concerts/{id}/seats` | Full seat map (200 seats + concert) | 200 | 404 unknown concert |
| `POST /orders` | Create an order (max 4 seats) | 200 | 400 invalid payload / >4 seats, 404 unknown concert, **409 seats already sold** |
| `POST /payments` | Mock payment processor | 200 | 400 missing fields |
| `GET /orders/{reference}` | Look up an order by its reference | 200 | 404 unknown reference |

### `POST /orders`

```json
{
  "buyerName": "Jane Doe",
  "buyerEmail": "jane@example.com",
  "concertId": 1,
  "seatIds": [12, 13]
}
```

Returns the created order (reference like `TCK-8FK2MQ`, concert, seats with row/zone/price, total). The creation is **transactional**: seats are locked (`SELECT … FOR UPDATE`) and re-checked, so two parallel requests for the same seat end with one `200` and one `409 {"error":"Seat(s) already sold: …"}`.

### `POST /payments` (mock)

```json
{
  "buyerName": "Jane Doe",
  "cardNumber": "4242 4242 4242 4242",
  "cardExpiry": "12/29",
  "cardCvv": "123"
}
```

```json
{ "paymentId": "pay_9f2c…", "status": "APPROVED", "last4": "4242" }
```

Rules (all deterministic, nothing is persisted, no real charge):

- Card number: 13–19 digits (spaces/dashes ignored) → otherwise `DECLINED` "Card number is invalid."
- **Any card ending in `0000` is DECLINED** by "issuer" — use it to test the failure path in the UI.
- Expiry must be `MM/YY` and not in the past; CVV 3–4 digits.
- Processing is delayed ~1.1 s so the UI can show a real "Processing payment…" state.

The checkout UI calls `/payments` **first**; only on `APPROVED` does it call `/orders`. A `DECLINED` shows the issuer's reason and keeps the user on the form.

### Error format

All errors are JSON: `{"error": "…"}` with the status codes above.

---

## Confirmation emails (real SMTP, local delivery)

On every successful order, the backend sends a branded **HTML email** asynchronously (a mail failure is logged but never fails the order):

- **From**: `TicketShop <no-reply@ticketshop.local>`
- **To**: the buyer's email typed at checkout
- **Bcc**: the watch address configured in `backend/src/main/resources/application.properties` (`ticketshop.mail.bcc=watch@ticketshop.local` — change it to whatever you like; with local Mailpit any address works)
- **Subject**: `🎟️ Your tickets are confirmed — TCK-XXXXXX`
- **Body**: event, artist, date, venue, order reference, buyer, per-seat breakdown and total.

Read the emails in Mailpit's UI at **http://localhost:8025** (or its REST API, `GET /api/v1/messages`).

### Switching to a real provider later

Override the properties (env vars or your own `application.properties`), e.g. Gmail:

```properties
spring.mail.host=smtp.gmail.com
spring.mail.port=587
spring.mail.username=you@gmail.com
spring.mail.password=<app-password>
spring.mail.properties.mail.smtp.auth=true
spring.mail.properties.mail.smtp.starttls.enable=true
ticketshop.mail.from=TicketShop <you@gmail.com>
```

(For Gmail, create an App Password at https://myaccount.google.com/apppasswords.)

---

## Manual walkthrough

1. **Browse** — open http://localhost:4200: a grid of 12 concerts (title, artist, date, venue, "From …" base price).
2. **Filter** — pick an artist in the dropdown; only that artist's concerts remain.
3. **Seat map** — click **Choose seats** on any concert. A 10×20 grid appears (rows A–J, seats 1–20, aisle after 10) with zone-colored seats (gold VIP / purple Premium / cyan Standard), a legend with live counts, and a price tooltip on hover.
4. **Select seats** — click up to 4 seats: they pop, glow and pulse. A sticky ticket-stub bar shows the seat chips, running total and the **Buy tickets 🎟️** button. Clicking a 5th seat shows a warning; clicking SOLD seats does nothing.
5. **Checkout + mock payment** — on the ticket-shaped form, enter name, email and the mock card `4242 4242 4242 4242` / `12/29` / `123`, then **Pay … 🎟️**. Watch the "Processing payment…" state. (Use a card ending in `0000` to see the DECLINED error path.)
6. **Confirmation** — confetti, "You're going to {concert}! 🎉" and the order as a stylized ticket: reference, buyer, event, seat chips, total and a CSS barcode.
7. **Email arrived** — open http://localhost:8025 (Mailpit): To = the email you typed, Bcc = the watch address, full HTML order body.
8. **Seats now sold** — go back to the seat map: your 4 seats are now SOLD and can't be selected.
9. **Double-booking guard (API level)** — in DevTools send `POST /api/orders` twice in parallel with the same AVAILABLE seat: one gets `200`, the other **409**. You can also fetch an order with `GET /api/orders/TCK-XXXXXX`.

---

## Automated smoke test

`smoke-test.ps1` in the project root automates the whole flow: artists, filter, seat map (200 seats, VIP 2× pricing), payment approve **and** decline, order creation, sold-on-reload, 409 double-booking, 400 for 5 seats, order lookup, and a Mailpit email-delivery check (soft-skipped if the mail server isn't running).

Run it any time the backend is up (compose or local):

```powershell
powershell -ExecutionPolicy Bypass -File smoke-test.ps1
```

Expected final line: `ALL SMOKE TESTS PASSED`.

---

## Unit & integration tests

**Backend** — JUnit 5 + Mockito + Spring Boot Test (H2, no external services). 53 tests in six suites under `backend/src/test/`:

| Suite | What it covers |
|---|---|
| `PaymentServiceTest` | approve, `0000`-suffix decline, invalid card/expiry/CVV, missing fields |
| `OrderServiceTest` | order creation (reference format `TCK-…`), unknown concert → 404, missing/cross-concert/sold seats, lookup, seat sorting |
| `EmailServiceTest` | recipients (To + BCC), subject/body, HTML escaping, mail failure never blocks the order |
| `DataSeederTest` | 5 artists, 12 concerts, 10×20 seats, zone multipliers, ~15% pre-sold, future dates, idempotency |
| `GlobalExceptionHandlerTest` | 400/404/404/409 → `{"error": "…"}` bodies, joined per-field validation errors |
| `ApiIntegrationTest` | full REST API via MockMvc against the real seeded H2 DB: every endpoint, zone pricing, pay-then-order flow, async confirmation email, and a concurrent double-booking test (two parallel orders for the same seat → one `200`, one `409`) |

```powershell
cd backend
mvn test
```

**Frontend** — Karma + Jasmine in headless Chrome, 34 specs in seven files (three service specs asserting the exact `/api` URLs, methods, query params and POST bodies via `HttpTestingController`; four component specs for the concert list, seat map, checkout and confirmation page — seat selection limit, tooltip, card formatters, validation, declined-payment and error paths).

```powershell
cd frontend
npm install
npm run test        # one-shot, headless Chrome
npm run test:watch  # re-run on change in a visible browser
```

---

## Project structure

```
.
├── docker-compose.yml            # one-command full stack
├── .dockerignore
├── smoke-test.ps1                # automated end-to-end API test
├── backend/
│   ├── Dockerfile                # multi-stage: maven build → JRE runtime
│   ├── .dockerignore
│   ├── pom.xml
│   ├── src/main/
│   └── src/test/java/com/ticketshop/     # 6 test suites (mvn test)
│       ├── java/com/ticketshop/
│       │   ├── TicketShopApplication.java  # @SpringBootApplication + @EnableAsync
│       │   ├── config/
│       │   │   ├── WebConfig.java          # CORS for localhost:4200
│       │   │   └── DataSeeder.java         # artists, concerts, seats, ~15% pre-sold
│       │   ├── controller/                 # REST endpoints
│       │   │   ├── ArtistController.java
│       │   │   ├── ConcertController.java
│       │   │   ├── OrderController.java
│       │   │   └── PaymentController.java
│       │   ├── service/
│       │   │   ├── OrderService.java       # transactional order + lock + re-check → 409
│       │   │   ├── PaymentService.java     # mock gateway (approve / 0000 → decline)
│       │   │   └── EmailService.java       # @Async HTML confirmation via SMTP
│       │   ├── repository/                 # Spring Data JPA
│       │   ├── model/                      # Artist, Concert, Seat, Order, OrderSeat, Zone, SeatStatus
│       │   ├── dto/                        # request/response records
│       │   └── exception/                  # 400 / 404 / 409 handlers
│       └── resources/application.properties  # H2, CORS-adjacent, mail (SMTP + BCC)
└── frontend/
    ├── angular.json                # + karma "test" target
    ├── tsconfig.spec.json
    └── src/                        # *.spec.ts live next to each service/component
        ├── index.html                # Google Fonts (Unbounded + Inter), theme-color
        ├── styles.css                # dark neon theme: variables, glass, glow, buttons
        └── app/
            ├── app.component.ts      # top bar + page transitions
            ├── app.routes.ts         # '' | concert/:id | checkout/:concertId | confirmation/:reference
            ├── models.ts             # shared TS types (incl. PaymentRequest/Response)
            ├── services/             # concert, order, payment (HttpClient → :8080/api)
            └── components/
                ├── concert-list/     # hero + glass concert cards
                ├── concert-detail/   # seat map: stage, zone chips, legend, sticky ticket stub
                ├── checkout/         # ticket-shaped form + mock card payment
                └── order-confirmation/ # confetti + ticket + CSS barcode
```

---

## Configuration

Key entries in `backend/src/main/resources/application.properties`:

| Property | Default | Purpose |
|---|---|---|
| `spring.mail.host` / `spring.mail.port` | `localhost` / `1025` | SMTP server (Mailpit/MailHog). Compose sets `SPRING_MAIL_HOST=mailpit` automatically. |
| `spring.mail.properties.mail.smtp.auth` | `false` | Local mail servers need no auth; set `true` + credentials for real providers. |
| `ticketshop.mail.from` | `TicketShop <no-reply@ticketshop.local>` | Display name + sender address. |
| `ticketshop.mail.bcc` | `watch@ticketshop.local` | Watch address BCC'd on every confirmation (empty = no BCC). |
| `spring.h2.console.*` | enabled at `/h2-console` | Browser access to the in-memory DB. |

Frontend API base: hardcoded to `http://localhost:8080/api` in `frontend/src/app/services/*.ts` (change all three services if you move the backend).

---

## Troubleshooting

- **"Port 8080/4200 already in use"** — a local instance (or the old stack) is still running. `docker compose down`, and stop stray processes: `Get-NetTCPConnection -LocalPort 8080 -State Listen` shows the owning PID.
- **No email in Mailpit** — check `docker compose ps` (mailpit must be healthy), and the backend log for `EmailService` errors. If Mailpit is down, orders still succeed; the mail failure is only logged.
- **CORS errors in the browser console** — the backend only allows `http://localhost:4200`. Keep the frontend on port 4200 (or extend `WebConfig.java` for another origin).
- **Hot reload not picking up changes in Compose** — restart the frontend container; bind-mount file watching can be flaky on Docker Desktop.
- **Data "disappeared"** — by design: H2 is in-memory, every backend start re-seeds the DB.
- **`409` while testing** — expected: the seat was sold (pre-sold, by you, or by the other parallel request).
- **First `docker compose up --build` is slow** — it downloads Maven/Node images and builds the jar; subsequent runs use the image cache.
