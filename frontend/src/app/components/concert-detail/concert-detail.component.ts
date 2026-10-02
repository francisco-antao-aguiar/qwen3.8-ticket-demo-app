import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ConcertService } from '../../services/concert.service';
import { Concert, Seat } from '../../models';

interface SeatRow {
  letter: string;
  seats: Seat[];
}

@Component({
  selector: 'app-concert-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <ng-container *ngIf="!loading; else loadingBlock">
      <ng-container *ngIf="concert as concert; else notFoundBlock">
        <div class="detail-page">
          <a class="back-link" routerLink="/">← All concerts</a>

          <div class="head-card glass">
            <div>
              <p class="kicker">{{ concert.artistName }}</p>
              <h1>{{ concert.title }}</h1>
              <p class="meta">📅 {{ concert.date | date: 'EEE, dd MMM yyyy' }} &nbsp;·&nbsp; 📍 {{ concert.venue }}</p>
            </div>
            <div class="head-price">
              <span class="muted">from</span>
              <strong>{{ concert.basePrice | number: '1.2-2' }} USD</strong>
            </div>
          </div>

          <div class="map-panel glass">
            <div class="stage-wrap">
              <div class="beam beam-a" aria-hidden="true"></div>
              <div class="beam beam-b" aria-hidden="true"></div>
              <div class="stage">🎤 STAGE</div>
            </div>

            <div class="seatmap-scroll">
              <div class="seatmap-inner">
                <div class="seat-row" *ngFor="let row of rows">
                  <div class="row-label" aria-hidden="true">{{ row.letter }}</div>
                  <ng-container *ngFor="let seat of row.seats; let i = index">
                    <button
                      class="seat"
                      [class.zone-vip]="seat.zone === 'VIP'"
                      [class.zone-premium]="seat.zone === 'PREMIUM'"
                      [class.zone-standard]="seat.zone === 'STANDARD'"
                      [class.sold]="seat.status === 'SOLD'"
                      [class.selected]="isSelected(seat)"
                      [disabled]="seat.status === 'SOLD'"
                      [attr.aria-pressed]="isSelected(seat) || null"
                      [attr.aria-label]="'Row ' + seat.rowLetter + ', seat ' + seat.seatNumber + ', ' + seat.zone + ', ' + seat.price + ' USD' + (seat.status === 'SOLD' ? ', sold' : ', available')"
                      [attr.data-tip]="tooltip(seat)"
                      (click)="toggleSeat(seat)"
                    >
                      {{ seat.seatNumber }}
                    </button>
                    <div class="aisle" *ngIf="i === 9" aria-hidden="true"></div>
                  </ng-container>
                </div>
              </div>
            </div>

            <div class="legend">
              <span class="pill"><span class="dot dot-vip"></span>VIP <b>{{ vipCount }}</b></span>
              <span class="pill"><span class="dot dot-premium"></span>Premium <b>{{ premiumCount }}</b></span>
              <span class="pill"><span class="dot dot-standard"></span>Standard <b>{{ standardCount }}</b></span>
              <span class="pill"><span class="dot dot-you"></span>Yours <b>{{ selectedIds.length }}</b></span>
              <span class="pill"><span class="dot dot-sold"></span>Sold <b>{{ soldCount }}</b></span>
            </div>
          </div>

          <section class="selection glass">
            <h2>
              Your selection
              <span class="count">{{ selectedIds.length }}/{{ maxSeats }}</span>
            </h2>
            <p *ngIf="selectedSeats.length === 0" class="muted">
              Tap the glowing seats to lock them in — max {{ maxSeats }} per order.
            </p>
            <ul *ngIf="selectedSeats.length > 0" class="selected-list">
              <li *ngFor="let seat of selectedSeats">
                Row {{ seat.rowLetter }}, seat {{ seat.seatNumber }} ({{ seat.zone }}) —
                <span class="price-inline">{{ seat.price | number: '1.2-2' }} USD</span>
              </li>
            </ul>
            <p *ngIf="selectionMessage" class="warn" aria-live="polite">{{ selectionMessage }}</p>
          </section>

          <div class="stub" *ngIf="selectedIds.length > 0" role="region" aria-label="Your ticket selection">
            <div class="stub-inner">
              <div class="stub-seats">
                <span class="muted small">Your seats</span>
                <span class="stub-chip" *ngFor="let seat of selectedSeats">
                  {{ seat.rowLetter }}{{ seat.seatNumber }}
                </span>
              </div>
              <div class="stub-total">
                <span class="muted small">Total</span>
                <strong>{{ total | number: '1.2-2' }} USD</strong>
              </div>
              <a
                class="btn primary buy"
                [routerLink]="['/checkout', concert.id]"
                [queryParams]="{ seats: selectedIds.join(',') }"
              >
                Buy tickets 🎟️
              </a>
            </div>
          </div>
        </div>
      </ng-container>
    </ng-container>

    <ng-template #loadingBlock>
      <p class="muted">Loading seat map…</p>
    </ng-template>
    <ng-template #notFoundBlock>
      <p class="error">
        Concert not found. <a routerLink="/">Back to the list</a>
      </p>
    </ng-template>
  `,
  styles: `
    .detail-page {
      padding-bottom: 140px; /* room for the pinned stub bar */
    }

    .back-link {
      display: inline-block;
      margin: 4px 0 14px;
      color: var(--cyan);
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
    }

    .back-link:hover {
      text-decoration: underline;
    }

    .head-card {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      justify-content: space-between;
      align-items: center;
      padding: 18px 22px;
      margin-bottom: 18px;
    }

    .head-card .kicker {
      color: var(--pink);
    }

    .head-card h1 {
      margin: 4px 0 8px;
      font-size: clamp(22px, 4vw, 30px);
      line-height: 1.2;
    }

    .head-card .meta {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
    }

    .head-price {
      text-align: right;
    }

    .head-price .muted {
      display: block;
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .head-price strong {
      font-family: "Unbounded", sans-serif;
      font-size: 20px;
      background: var(--grad);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    /* ---------- stage + spotlights ---------- */

    .map-panel {
      padding: 18px;
      margin-bottom: 18px;
    }

    .stage-wrap {
      position: relative;
      margin-bottom: 16px;
    }

    .stage {
      clip-path: polygon(10% 0, 90% 0, 100% 100%, 0 100%);
      background: linear-gradient(90deg, #312e81, #8b5cf6 35%, #ff2d95 70%, #8b5cf6 92%);
      padding: 10px 0 7px;
      text-align: center;
      font-family: "Unbounded", sans-serif;
      font-size: 13px;
      letter-spacing: 8px;
      color: #fff;
      text-shadow: 0 0 14px rgba(255, 255, 255, 0.55);
    }

    .beam {
      position: absolute;
      top: 72%;
      width: 130px;
      height: 180px;
      clip-path: polygon(44% 0, 56% 0, 100% 100%, 0 100%);
      background: linear-gradient(to bottom, rgba(34, 211, 238, 0.30), transparent 78%);
      transform-origin: top center;
      animation: beam-sweep 5.5s ease-in-out infinite alternate;
      pointer-events: none;
    }

    .beam-a {
      left: 24%;
    }

    .beam-b {
      left: 56%;
      background: linear-gradient(to bottom, rgba(255, 45, 149, 0.30), transparent 78%);
      animation-delay: -2.75s;
    }

    @keyframes beam-sweep {
      from { transform: rotate(-14deg); }
      to { transform: rotate(14deg); }
    }

    /* ---------- seats ---------- */

    .seatmap-scroll {
      overflow-x: auto;
    }

    .seatmap-inner {
      min-width: 640px;
      padding-bottom: 34px; /* room for tooltips */
    }

    .seat-row {
      display: grid;
      grid-template-columns: 1.4rem repeat(10, minmax(1.2rem, 1fr)) 1.6rem repeat(10, minmax(1.2rem, 1fr));
      gap: 5px;
      margin-bottom: 5px;
      align-items: center;
    }

    .row-label {
      text-align: center;
      font-family: "Unbounded", sans-serif;
      font-size: 11px;
      color: var(--muted);
    }

    .seat {
      position: relative;
      width: 100%;
      max-width: 2.4rem;
      aspect-ratio: 1.25;
      margin: 0 auto;
      padding: 0;
      border-radius: 9px;
      border: 1px solid transparent;
      font-size: 10px;
      font-weight: 800;
      cursor: pointer;
      transition: transform 0.12s ease;
    }

    .zone-vip:not(:disabled) {
      background: linear-gradient(150deg, #fde68a, #f59e0b);
      color: #451a03;
      border-color: rgba(251, 191, 36, 0.8);
      box-shadow: 0 2px 10px rgba(245, 158, 11, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.65);
    }

    .zone-premium:not(:disabled) {
      background: linear-gradient(150deg, #d8b4fe, #8b5cf6);
      color: #2e1065;
      border-color: rgba(167, 139, 250, 0.8);
      box-shadow: 0 2px 10px rgba(139, 92, 246, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.55);
    }

    .zone-standard:not(:disabled) {
      background: linear-gradient(150deg, #a5f3fc, #06b6d4);
      color: #083344;
      border-color: rgba(34, 211, 238, 0.7);
      box-shadow: 0 2px 10px rgba(34, 211, 238, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.55);
    }

    .seat:hover:not(:disabled) {
      transform: translateY(-2px) scale(1.12);
    }

    .seat:disabled,
    .seat.sold {
      background: #141a2b;
      border-color: #232d49;
      color: #59678a;
      box-shadow: none;
      cursor: not-allowed;
    }

    .seat.selected {
      z-index: 2;
      box-shadow: 0 0 0 3px #fff, 0 0 20px 5px rgba(255, 45, 149, 0.7);
      animation:
        seat-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
        seat-pulse 1.8s ease-in-out 0.35s infinite;
    }

    .seat:focus-visible {
      outline: 3px solid var(--cyan);
      outline-offset: 2px;
    }

    @keyframes seat-pop {
      0% { transform: scale(1); }
      45% { transform: scale(1.3); }
      100% { transform: scale(1); }
    }

    @keyframes seat-pulse {
      0%, 100% {
        box-shadow: 0 0 0 3px #fff, 0 0 12px 2px rgba(255, 45, 149, 0.55);
      }
      50% {
        box-shadow: 0 0 0 3px #fff, 0 0 26px 9px rgba(255, 45, 149, 0.9);
      }
    }

    .seat:hover:not(:disabled)::after,
    .seat:focus-visible::after {
      content: attr(data-tip);
      position: absolute;
      top: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      background: rgba(10, 14, 26, 0.95);
      border: 1px solid rgba(34, 211, 238, 0.5);
      color: #fff;
      padding: 5px 9px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 500;
      white-space: nowrap;
      z-index: 30;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
    }

    /* ---------- legend ---------- */

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 5px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      font-size: 12px;
    }

    .pill b {
      color: #fff;
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .dot-vip { background: #fbbf24; box-shadow: 0 0 8px #fbbf24; }
    .dot-premium { background: #a78bfa; box-shadow: 0 0 8px #a78bfa; }
    .dot-standard { background: #22d3ee; box-shadow: 0 0 8px #22d3ee; }
    .dot-you { background: #ff2d95; box-shadow: 0 0 8px #ff2d95; }
    .dot-sold { background: #3a4661; }

    /* ---------- selection ---------- */

    .selection {
      padding: 18px 22px;
    }

    .selection h2 {
      margin: 0 0 10px;
      font-size: 18px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .count {
      font-size: 12px;
      color: var(--pink);
      border: 1px solid rgba(255, 45, 149, 0.45);
      padding: 2px 10px;
      border-radius: 999px;
    }

    .selected-list {
      margin: 0 0 8px;
      padding-left: 18px;
      font-size: 14px;
    }

    .selected-list li {
      margin: 4px 0;
    }

    .price-inline {
      color: #fde68a;
      font-weight: 700;
    }

    /* ---------- sticky ticket stub ---------- */

    .stub {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 55;
      background: rgba(10, 14, 26, 0.85);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      border-top: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.5);
      animation: stub-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    @keyframes stub-in {
      from { transform: translateY(100%); }
      to { transform: none; }
    }

    .stub-inner {
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 16px;
    }

    .stub-seats {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      min-width: 0;
    }

    .stub-chip {
      font-family: "Unbounded", sans-serif;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      background: var(--grad);
      padding: 4px 11px;
      border-radius: 999px;
      box-shadow: 0 2px 12px rgba(255, 45, 149, 0.45);
    }

    .stub-total {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      line-height: 1.2;
    }

    .stub-total strong {
      font-family: "Unbounded", sans-serif;
      font-size: 18px;
      color: #fff;
    }

    .buy {
      white-space: nowrap;
      font-size: 15px;
      padding: 12px 20px;
    }

    @media (max-width: 560px) {
      .stub-seats .muted {
        display: none;
      }

      .stub-total .muted {
        display: none;
      }

      .stub-inner {
        gap: 10px;
      }
    }
  `
})
export class ConcertDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private concertService = inject(ConcertService);

  concert: Concert | null = null;
  seats: Seat[] = [];
  rows: SeatRow[] = [];
  selectedIds: number[] = [];
  selectionMessage: string | null = null;
  loading = true;
  readonly maxSeats = 4;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.concertService.getSeatMap(id).subscribe({
      next: (map) => {
        this.concert = map.concert;
        this.seats = map.seats;
        this.rows = this.buildRows(map.seats);
        this.loading = false;
      },
      error: () => (this.loading = false)
    });
  }

  get selectedSeats(): Seat[] {
    return this.seats
      .filter((seat) => this.selectedIds.includes(seat.id))
      .sort((a, b) => a.rowLetter.localeCompare(b.rowLetter) || a.seatNumber - b.seatNumber);
  }

  get total(): number {
    return this.seats
      .filter((seat) => this.selectedIds.includes(seat.id))
      .reduce((sum, seat) => sum + seat.price, 0);
  }

  get vipCount(): number {
    return this.availableInZone('VIP');
  }

  get premiumCount(): number {
    return this.availableInZone('PREMIUM');
  }

  get standardCount(): number {
    return this.availableInZone('STANDARD');
  }

  get soldCount(): number {
    return this.seats.filter((seat) => seat.status === 'SOLD').length;
  }

  isSelected(seat: Seat): boolean {
    return this.selectedIds.includes(seat.id);
  }

  tooltip(seat: Seat): string {
    return `Row ${seat.rowLetter}, seat ${seat.seatNumber} · ${seat.zone} · ${seat.price.toFixed(2)} USD`;
  }

  toggleSeat(seat: Seat): void {
    if (seat.status === 'SOLD') {
      return;
    }
    const index = this.selectedIds.indexOf(seat.id);
    if (index >= 0) {
      this.selectedIds = this.selectedIds.filter((id) => id !== seat.id);
      this.selectionMessage = null;
      return;
    }
    if (this.selectedIds.length >= this.maxSeats) {
      this.selectionMessage = `You can select at most ${this.maxSeats} seats per order.`;
      return;
    }
    this.selectedIds = [...this.selectedIds, seat.id];
    this.selectionMessage = null;
  }

  private availableInZone(zone: string): number {
    return this.seats.filter((seat) => seat.zone === zone && seat.status === 'AVAILABLE').length;
  }

  private buildRows(seats: Seat[]): SeatRow[] {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    return letters
      .map((letter) => ({
        letter,
        seats: seats
          .filter((seat) => seat.rowLetter === letter)
          .sort((a, b) => a.seatNumber - b.seatNumber)
      }))
      .filter((row) => row.seats.length > 0);
  }
}
