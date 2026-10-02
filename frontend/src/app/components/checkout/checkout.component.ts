import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ConcertService } from '../../services/concert.service';
import { OrderService } from '../../services/order.service';
import { PaymentService } from '../../services/payment.service';
import { Concert, Seat } from '../../models';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-head">
      <p class="kicker">Almost there</p>
      <h1>Checkout</h1>
    </div>

    <ng-container *ngIf="concert as concert; else loadingBlock">
      <div class="ticket glass">
        <div class="perf" aria-hidden="true"></div>

        <div class="ticket-left">
          <p class="kicker pink">Admit {{ seats.length }}</p>
          <h2>{{ concert.title }}</h2>
          <p class="artist">{{ concert.artistName }}</p>
          <p class="meta">
            📅 {{ concert.date | date: 'EEE, dd MMM yyyy' }} &nbsp;·&nbsp; 📍 {{ concert.venue }}
          </p>
          <ul class="seat-list">
            <li *ngFor="let seat of seats">
              Row {{ seat.rowLetter }}, seat {{ seat.seatNumber }} ({{ seat.zone }}) —
              {{ seat.price | number: '1.2-2' }} USD
            </li>
          </ul>
          <div class="total-line">
            <span>Total</span>
            <strong>{{ total | number: '1.2-2' }} USD</strong>
          </div>
        </div>

        <div class="ticket-right">
          <form class="checkout-form" (ngSubmit)="submit()">
            <label>
              Full name
              <input
                name="buyerName"
                [(ngModel)]="buyerName"
                placeholder="Jane Doe"
                [class.invalid]="!nameValid"
                [disabled]="paying"
                required
              />
              <span *ngIf="!nameValid" class="field-error">Please enter your full name.</span>
            </label>

            <label>
              Email
              <input
                name="buyerEmail"
                type="email"
                [(ngModel)]="buyerEmail"
                placeholder="jane@example.com"
                [class.invalid]="!emailValid"
                [disabled]="paying"
                required
              />
              <span *ngIf="!emailValid" class="field-error">Please enter a valid email address.</span>
            </label>

            <div class="pay-divider"><span>Payment</span></div>

            <label>
              Card number
              <input
                name="cardNumber"
                [(ngModel)]="cardNumber"
                (ngModelChange)="onCardNumberInput($event)"
                inputmode="numeric"
                autocomplete="cc-number"
                placeholder="4242 4242 4242 4242"
                [class.invalid]="!cardNumberValid"
                [disabled]="paying"
              />
              <span *ngIf="!cardNumberValid" class="field-error">Enter a valid card number (13–19 digits).</span>
            </label>

            <div class="card-row">
              <label>
                Expiry
                <input
                  name="cardExpiry"
                  [(ngModel)]="cardExpiry"
                  (ngModelChange)="onExpiryInput($event)"
                  inputmode="numeric"
                  autocomplete="cc-exp"
                  placeholder="MM/YY"
                  [class.invalid]="!cardExpiryValid"
                  [disabled]="paying"
                />
                <span *ngIf="!cardExpiryValid" class="field-error">Use MM/YY.</span>
              </label>

              <label>
                CVV
                <input
                  name="cardCvv"
                  [(ngModel)]="cardCvv"
                  (ngModelChange)="onCvvInput($event)"
                  inputmode="numeric"
                  autocomplete="cc-csc"
                  placeholder="123"
                  [class.invalid]="!cardCvvValid"
                  [disabled]="paying"
                />
                <span *ngIf="!cardCvvValid" class="field-error">3–4 digits.</span>
              </label>
            </div>

            <p class="test-hint">
              🔒 Mock payment — nothing is really charged.
              <b>4242 4242 4242 4242</b> is approved; any card ending in <b>0000</b> declines.
            </p>

            <p *ngIf="serverError" class="error" role="alert">{{ serverError }}</p>

            <div class="actions">
              <button class="btn primary" type="submit" [disabled]="paying">
                {{ paying ? 'Processing payment…' : 'Pay ' + (total | number: '1.2-2') + ' USD 🎟️' }}
              </button>
              <a class="btn" [routerLink]="['/concert', concert.id]" [class.disabled]="paying">
                Back to seat map
              </a>
            </div>
          </form>
        </div>
      </div>
    </ng-container>

    <ng-template #loadingBlock>
      <p class="muted">Loading checkout…</p>
    </ng-template>
  `,
  styles: `
    .page-head h1 {
      margin: 6px 0 18px;
      color: #fff;
    }

    .kicker.pink {
      color: #ff2d95;
    }

    .ticket {
      position: relative;
      display: flex;
    }

    .ticket-left,
    .ticket-right {
      padding: 22px 26px;
    }

    .ticket-left {
      flex: 1 1 44%;
    }

    .ticket-right {
      flex: 1 1 56%;
    }

    .perf {
      position: absolute;
      top: 18px;
      bottom: 18px;
      left: 44%;
      width: 0;
      border-left: 2px dashed rgba(255, 255, 255, 0.28);
    }

    .perf::before,
    .perf::after {
      content: '';
      position: absolute;
      left: -12px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #070b14;
    }

    .perf::before {
      top: -12px;
    }

    .perf::after {
      bottom: -12px;
    }

    .ticket-left h2 {
      margin: 6px 0 4px;
      color: #fff;
      font-size: 20px;
    }

    .ticket-left .artist {
      color: #ff9ecb;
      font-weight: 700;
      margin: 0 0 10px;
      font-size: 12px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }

    .ticket-left .meta {
      color: var(--muted);
      font-size: 13px;
      margin: 0 0 14px;
    }

    .seat-list {
      margin: 0 0 14px;
      padding-left: 18px;
      font-size: 14px;
    }

    .seat-list li {
      margin: 3px 0;
    }

    .total-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px dashed rgba(255, 255, 255, 0.2);
      padding-top: 12px;
      font-size: 15px;
    }

    .total-line strong {
      font-family: 'Unbounded', sans-serif;
      font-size: 18px;
      background: var(--grad);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .checkout-form label {
      display: block;
      margin-bottom: 13px;
      font-weight: 600;
      font-size: 13px;
      color: var(--text);
      letter-spacing: 0.3px;
    }

    .checkout-form input {
      display: block;
      width: 100%;
      margin-top: 6px;
      padding: 11px 12px;
      font-size: 14px;
      color: var(--text);
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border);
      border-radius: 10px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .checkout-form input::placeholder {
      color: #5d6b8f;
    }

    .checkout-form input:focus {
      outline: none;
      border-color: var(--cyan);
      box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.25);
    }

    .checkout-form input.invalid {
      border-color: #f87171;
      box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.2);
    }

    .checkout-form input:disabled {
      opacity: 0.6;
    }

    .field-error {
      display: block;
      margin-top: 4px;
      color: #fca5a5;
      font-weight: 400;
      font-size: 12px;
    }

    .pay-divider {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 18px 0 14px;
      color: var(--muted);
      font-family: 'Unbounded', sans-serif;
      font-size: 10px;
      letter-spacing: 2.5px;
      text-transform: uppercase;
    }

    .pay-divider::before,
    .pay-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(255, 255, 255, 0.15);
    }

    .card-row {
      display: flex;
      gap: 12px;
    }

    .card-row label {
      flex: 1;
    }

    .test-hint {
      font-size: 12px;
      color: var(--muted);
      background: rgba(34, 211, 238, 0.07);
      border: 1px solid rgba(34, 211, 238, 0.2);
      border-radius: 10px;
      padding: 8px 12px;
      margin: 4px 0 12px;
    }

    .test-hint b {
      color: #67e8f9;
      font-family: monospace;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 6px;
    }

    .actions .btn.primary {
      flex: 1;
      white-space: nowrap;
    }

    .actions .btn.disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    @media (max-width: 720px) {
      .ticket {
        flex-direction: column;
      }

      .perf {
        top: auto;
        bottom: auto;
        left: 18px;
        right: 18px;
        width: auto;
        height: 0;
        border-left: none;
        border-top: 2px dashed rgba(255, 255, 255, 0.28);
      }

      .perf::before {
        left: -12px;
        top: -12px;
      }

      .perf::after {
        left: auto;
        right: -12px;
        top: -12px;
        bottom: auto;
      }
    }
  `
})
export class CheckoutComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private concertService = inject(ConcertService);
  private orderService = inject(OrderService);
  private paymentService = inject(PaymentService);

  concert: Concert | null = null;
  seats: Seat[] = [];

  buyerName = '';
  buyerEmail = '';
  nameValid = true;
  emailValid = true;

  cardNumber = '';
  cardExpiry = '';
  cardCvv = '';
  cardNumberValid = true;
  cardExpiryValid = true;
  cardCvvValid = true;

  paying = false;
  serverError: string | null = null;

  ngOnInit(): void {
    const concertId = Number(this.route.snapshot.paramMap.get('concertId'));
    const seatsParam = this.route.snapshot.queryParamMap.get('seats') ?? '';
    const seatIds = seatsParam.split(',').filter(Boolean).map(Number);

    this.concertService.getSeatMap(concertId).subscribe({
      next: (map) => {
        this.concert = map.concert;
        this.seats = map.seats.filter((seat) => seatIds.includes(seat.id));
      }
    });
  }

  get total(): number {
    return this.seats.reduce((sum, seat) => sum + seat.price, 0);
  }

  onCardNumberInput(value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 19);
    this.cardNumber = digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  }

  onExpiryInput(value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    this.cardExpiry = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  }

  onCvvInput(value: string): void {
    this.cardCvv = value.replace(/\D/g, '').slice(0, 4);
  }

  submit(): void {
    this.nameValid = this.buyerName.trim().length > 0;
    this.emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.buyerEmail.trim());

    const cardDigits = this.cardNumber.replace(/\s/g, '');
    this.cardNumberValid = /^\d{13,19}$/.test(cardDigits);
    this.cardExpiryValid = /^(0[1-9]|1[0-2])\/\d{2}$/.test(this.cardExpiry);
    this.cardCvvValid = /^\d{3,4}$/.test(this.cardCvv);

    if (!this.nameValid || !this.emailValid || !this.cardNumberValid || !this.cardExpiryValid || !this.cardCvvValid) {
      return;
    }
    if (!this.concert) {
      return;
    }

    this.paying = true;
    this.serverError = null;

    this.paymentService
      .processPayment({
        buyerName: this.buyerName.trim(),
        cardNumber: this.cardNumber,
        cardExpiry: this.cardExpiry,
        cardCvv: this.cardCvv
      })
      .subscribe({
        next: (payment) => {
          if (payment.status !== 'APPROVED') {
            this.paying = false;
            this.serverError = payment.declineReason ?? 'Payment declined. Please try another card.';
            return;
          }
          this.placeOrder();
        },
        error: () => {
          this.paying = false;
          this.serverError = 'Could not reach the payment service. Is the backend running on port 8080?';
        }
      });
  }

  private placeOrder(): void {
    if (!this.concert) {
      return;
    }
    this.orderService
      .createOrder({
        buyerName: this.buyerName.trim(),
        buyerEmail: this.buyerEmail.trim(),
        concertId: this.concert.id,
        seatIds: this.seats.map((seat) => seat.id)
      })
      .subscribe({
        next: (order) => {
          this.router.navigate(['/confirmation', order.reference]);
        },
        error: (err) => {
          this.paying = false;
          const message = err?.error?.error;
          this.serverError =
            typeof message === 'string' && message.length > 0
              ? message
              : 'Something went wrong while placing your order. Please try again.';
        }
      });
  }
}
