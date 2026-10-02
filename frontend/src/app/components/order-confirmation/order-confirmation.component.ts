import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OrderService } from '../../services/order.service';
import { OrderResponse } from '../../models';

interface ConfettiPiece {
  left: number;
  size: number;
  round: boolean;
  color: string;
  duration: number;
  delay: number;
  opacity: number;
}

const CONFETTI_COLORS = ['#8b5cf6', '#ff2d95', '#22d3ee', '#fbbf24', '#4ade80'];

@Component({
  selector: 'app-order-confirmation',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="confetti" aria-hidden="true">
      <span
        *ngFor="let piece of confetti"
        [style.left.%]="piece.left"
        [style.width.px]="piece.size"
        [style.height.px]="piece.round ? piece.size : piece.size * 1.7"
        [style.background]="piece.color"
        [style.border-radius]="piece.round ? '50%' : '2px'"
        [style.animation-duration.s]="piece.duration"
        [style.animation-delay.s]="piece.delay"
        [style.opacity]="piece.opacity"
      ></span>
    </div>

    <div *ngIf="order; else loadingBlock" class="confirmation">
      <p class="kicker">Tickets secured</p>
      <h1>
        You're going to <span class="grad-text">{{ order.concert.title }}</span>! 🎉
      </h1>
      <p class="sub">Your seats are locked in. Show the reference below at the door.</p>

      <div class="order-ticket glass">
        <div class="ot-head">
          <div>
            <p class="ot-label">Order reference</p>
            <p class="ot-ref">{{ order.reference }}</p>
          </div>
          <div class="barcode" aria-hidden="true"></div>
        </div>

        <div class="ot-body">
          <div class="ot-col">
            <p class="ot-label">Concert</p>
            <p class="ot-title">{{ order.concert.title }} — {{ order.concert.artistName }}</p>
            <p>📅 {{ order.concert.date }} &nbsp;·&nbsp; 📍 {{ order.concert.venue }}</p>
          </div>
          <div class="ot-col">
            <p class="ot-label">Buyer</p>
            <p>{{ order.buyerName }}</p>
            <p>{{ order.buyerEmail }}</p>
            <p class="muted small">Placed at {{ order.createdAt }}</p>
          </div>
          <div class="ot-col ot-seats">
            <p class="ot-label">Your seats</p>
            <span class="ot-seat" *ngFor="let seat of order.seats">
              {{ seat.rowLetter }}{{ seat.seatNumber }} · {{ seat.zone }}
            </span>
          </div>
        </div>

        <div class="ot-foot">
          <span class="ot-label">Total paid</span>
          <strong class="ot-total">{{ order.totalAmount | number: '1.2-2' }} USD</strong>
        </div>
      </div>

      <a class="btn primary" routerLink="/">Browse more concerts ✨</a>
    </div>

    <ng-template #loadingBlock>
      <p *ngIf="error" class="error">{{ error }}</p>
      <p *ngIf="!error" class="muted">Loading order…</p>
    </ng-template>
  `,
  styles: `
    .confetti {
      position: fixed;
      inset: 0;
      z-index: 40;
      pointer-events: none;
      overflow: hidden;
    }

    .confetti span {
      position: absolute;
      top: -24px;
      display: block;
      animation-name: confetti-fall;
      animation-timing-function: linear;
      animation-iteration-count: infinite;
    }

    @keyframes confetti-fall {
      to {
        transform: translateY(115vh) rotate(720deg);
      }
    }

    .confirmation {
      text-align: center;
      padding: 34px 0;
    }

    .confirmation h1 {
      font-size: clamp(26px, 4.5vw, 40px);
      line-height: 1.25;
      margin: 10px 0 12px;
    }

    .confirmation .sub {
      color: var(--muted);
      margin: 0 0 30px;
    }

    .order-ticket {
      max-width: 560px;
      margin: 0 auto 28px;
      text-align: left;
      padding: 22px 26px;
      box-shadow: 0 20px 60px rgba(139, 92, 246, 0.25);
    }

    .ot-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding-bottom: 16px;
      border-bottom: 2px dashed rgba(255, 255, 255, 0.25);
    }

    .ot-label {
      font-family: "Unbounded", sans-serif;
      font-size: 10px;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: var(--muted);
      margin: 0 0 6px;
    }

    .ot-ref {
      font-family: "Unbounded", sans-serif;
      font-size: 20px;
      margin: 0;
      background: var(--grad);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .barcode {
      width: 110px;
      height: 44px;
      flex: 0 0 auto;
      background: repeating-linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.92) 0 2px,
        transparent 2px 4px,
        rgba(255, 255, 255, 0.92) 4px 6px,
        transparent 6px 10px,
        rgba(255, 255, 255, 0.92) 10px 13px,
        transparent 13px 15px
      );
      opacity: 0.9;
    }

    .ot-body {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      padding: 16px 0;
      border-bottom: 2px dashed rgba(255, 255, 255, 0.25);
    }

    .ot-body p {
      margin: 2px 0;
      font-size: 14px;
    }

    .ot-title {
      font-weight: 700;
      color: #fff;
    }

    .ot-seats {
      grid-column: 1 / -1;
    }

    .ot-seat {
      display: inline-block;
      margin: 3px 5px 3px 0;
      font-family: "Unbounded", sans-serif;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      background: rgba(139, 92, 246, 0.25);
      border: 1px solid rgba(139, 92, 246, 0.5);
      border-radius: 999px;
      padding: 4px 11px;
    }

    .ot-foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 16px;
    }

    .ot-total {
      font-family: "Unbounded", sans-serif;
      font-size: 22px;
      color: #fde68a;
      text-shadow: 0 0 18px rgba(251, 191, 36, 0.4);
    }

    @media (max-width: 560px) {
      .ot-body {
        grid-template-columns: 1fr;
      }

      .ot-head {
        flex-direction: column-reverse;
      }
    }
  `
})
export class OrderConfirmationComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private orderService = inject(OrderService);

  order: OrderResponse | null = null;
  error: string | null = null;

  /** Deterministic pseudo-random confetti so every render looks lively but stable. */
  readonly confetti: ConfettiPiece[] = Array.from({ length: 48 }, (_, i) => ({
    left: (i * 61) % 100,
    size: 7 + (i % 5) * 2,
    round: i % 3 === 0,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    duration: 2.8 + ((i * 37) % 40) / 10,
    delay: -((i * 53) % 30) / 10,
    opacity: 0.7 + ((i * 13) % 30) / 100
  }));

  ngOnInit(): void {
    const reference = this.route.snapshot.paramMap.get('reference') ?? '';
    this.orderService.getOrder(reference).subscribe({
      next: (order) => (this.order = order),
      error: () => (this.error = 'Order not found. It may have expired (the demo DB is in memory).')
    });
  }
}
