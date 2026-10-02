import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./components/concert-list/concert-list.component').then((m) => m.ConcertListComponent)
  },
  {
    path: 'concert/:id',
    loadComponent: () =>
      import('./components/concert-detail/concert-detail.component').then((m) => m.ConcertDetailComponent)
  },
  {
    path: 'checkout/:concertId',
    loadComponent: () =>
      import('./components/checkout/checkout.component').then((m) => m.CheckoutComponent)
  },
  {
    path: 'confirmation/:reference',
    loadComponent: () =>
      import('./components/order-confirmation/order-confirmation.component').then((m) => m.OrderConfirmationComponent)
  },
  { path: '**', redirectTo: '' }
];
