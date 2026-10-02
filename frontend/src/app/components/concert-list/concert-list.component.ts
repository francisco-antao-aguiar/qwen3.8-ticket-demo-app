import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConcertService } from '../../services/concert.service';
import { Artist, Concert } from '../../models';

@Component({
  selector: 'app-concert-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="hero">
      <p class="kicker">Live · This season</p>
      <h1>
        Feel the <span class="grad-text">bass drop</span>.<br />
        Grab your spot.
      </h1>
      <p class="sub">
        Fresh shows every week. Pick your concert, claim your seats — done before the opener walks on.
      </p>
    </section>

    <div class="filter-row">
      <label for="artist-filter">Artist</label>
      <select id="artist-filter" [(ngModel)]="selectedArtistId" (ngModelChange)="onArtistChange()">
        <option [ngValue]="null">All artists</option>
        <option *ngFor="let artist of artists" [ngValue]="artist.id">{{ artist.name }}</option>
      </select>
    </div>

    <p *ngIf="error" class="error" role="alert">{{ error }}</p>

    <div *ngIf="loading" class="muted">Loading concerts…</div>

    <div class="concert-grid" *ngIf="!loading">
      <div class="concert-card glass" *ngFor="let concert of concerts">
        <span class="artist-chip">{{ concert.artistName }}</span>
        <h3>{{ concert.title }}</h3>
        <p class="card-meta">📅 {{ concert.date | date: 'EEE, dd MMM yyyy' }}</p>
        <p class="card-meta">📍 {{ concert.venue }}</p>
        <p class="price-chip">from {{ concert.basePrice | number: '1.2-2' }} USD</p>
        <a class="btn primary" [routerLink]="['/concert', concert.id]">Choose seats ✨</a>
      </div>
    </div>

    <p *ngIf="!loading && concerts.length === 0" class="muted">No concerts found.</p>
  `,
  styles: `
    .hero {
      position: relative;
      padding: 30px 0 6px;
    }

    .hero::before {
      content: "";
      position: absolute;
      inset: -50px -80px auto -80px;
      height: 240px;
      background:
        radial-gradient(620px 200px at 18% 45%, rgba(139, 92, 246, 0.38), transparent 65%),
        radial-gradient(520px 180px at 82% 60%, rgba(255, 45, 149, 0.30), transparent 65%);
      filter: blur(34px);
      animation: hero-breathe 6s ease-in-out infinite;
      pointer-events: none;
      z-index: -1;
    }

    @keyframes hero-breathe {
      0%, 100% { opacity: 0.65; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.07); }
    }

    .hero h1 {
      font-size: clamp(28px, 5vw, 44px);
      line-height: 1.15;
      margin: 10px 0 12px;
    }

    .hero .sub {
      color: var(--muted);
      max-width: 540px;
      margin: 0;
      font-size: 15px;
    }

    .filter-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 26px 0;
    }

    .filter-row label {
      font-family: "Unbounded", sans-serif;
      font-size: 11px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--muted);
    }

    .filter-row select {
      flex: 1;
      max-width: 280px;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: rgba(13, 19, 34, 0.9);
      color: var(--text);
      font-size: 14px;
      cursor: pointer;
    }

    .concert-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 16px;
    }

    .concert-card {
      position: relative;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      overflow: hidden;
      transition: transform 0.18s ease, box-shadow 0.25s ease, border-color 0.25s ease;
    }

    .concert-card::after {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(300px 120px at 50% -20%, rgba(139, 92, 246, 0.25), transparent 70%);
      opacity: 0;
      transition: opacity 0.25s ease;
      pointer-events: none;
    }

    .concert-card:hover {
      transform: translateY(-6px) scale(1.02);
      border-color: rgba(255, 45, 149, 0.55);
      box-shadow:
        0 16px 44px rgba(255, 45, 149, 0.22),
        0 6px 24px rgba(139, 92, 246, 0.2);
    }

    .concert-card:hover::after {
      opacity: 1;
    }

    .concert-card h3 {
      margin: 4px 0 6px;
      font-size: 17px;
      line-height: 1.3;
    }

    .artist-chip {
      align-self: flex-start;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #ff9ecb;
      background: rgba(255, 45, 149, 0.14);
      border: 1px solid rgba(255, 45, 149, 0.4);
      padding: 3px 10px;
      border-radius: 999px;
    }

    .card-meta {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
    }

    .price-chip {
      margin: 4px 0 0;
      font-weight: 800;
      font-size: 15px;
      background: var(--grad);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .concert-card .btn {
      margin-top: 12px;
      align-self: flex-start;
    }
  `
})
export class ConcertListComponent implements OnInit {
  private concertService = inject(ConcertService);

  artists: Artist[] = [];
  concerts: Concert[] = [];
  selectedArtistId: number | null = null;
  loading = false;
  error: string | null = null;

  ngOnInit(): void {
    this.concertService.getArtists().subscribe({
      next: (artists) => (this.artists = artists),
      error: () => (this.error = 'Could not load artists from the server.')
    });
    this.loadConcerts();
  }

  onArtistChange(): void {
    this.loadConcerts();
  }

  private loadConcerts(): void {
    this.loading = true;
    this.error = null;
    this.concertService.getConcerts(this.selectedArtistId ?? undefined).subscribe({
      next: (concerts) => {
        this.concerts = concerts;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Could not load concerts. Is the backend running on port 8080?';
      }
    });
  }
}
