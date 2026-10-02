import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="topbar">
      <a routerLink="/" [routerLinkActive]="['active']" class="logo">
        <span class="logo-word">TicketShop</span>
      </a>
    </header>
    <main class="container">
      <div class="page" [class.enter]="pageEnter">
        <router-outlet></router-outlet>
      </div>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
    }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 60;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 14px 16px;
      background: rgba(7, 11, 20, 0.6);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
    }

    .logo {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      font-family: "Unbounded", sans-serif;
      font-weight: 700;
      font-size: 18px;
    }

    .logo-word {
      background: var(--grad);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      filter: drop-shadow(0 0 12px rgba(255, 45, 149, 0.35));
    }

    .logo::before {
      content: "";
      width: 24px;
      height: 24px;
      border-radius: 7px;
      background: var(--grad);
      display: inline-block;
      box-shadow: 0 0 14px rgba(255, 45, 149, 0.6);
    }

    .page.enter {
      animation: page-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    @keyframes page-in {
      from {
        opacity: 0;
        transform: translateY(16px) scale(0.995);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  `
})
export class AppComponent {
  private router = inject(Router);

  /** Toggled on every successful navigation to retrigger the page transition. */
  pageEnter = false;

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.pageEnter = false;
        requestAnimationFrame(() => (this.pageEnter = true));
      });
  }
}
