import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { OrderConfirmationComponent } from './order-confirmation.component';
import { OrderService } from '../../services/order.service';
import { OrderResponse } from '../../models';

describe('OrderConfirmationComponent', () => {
  let component: OrderConfirmationComponent;
  let fixture: ComponentFixture<OrderConfirmationComponent>;
  let orderService: jasmine.SpyObj<OrderService>;

  const sampleOrder: OrderResponse = {
    id: 7,
    reference: 'TCK-8FK2MQ',
    buyerName: 'Jane Doe',
    buyerEmail: 'jane@example.com',
    createdAt: '2026-10-01T12:00:00Z',
    totalAmount: 157.5,
    concert: {
      id: 5,
      title: 'Skyline Live',
      artistName: 'Aurora Sky',
      date: '2026-10-15T20:00:00',
      venue: 'Riverside Arena'
    },
    seats: [
      { id: 1, rowLetter: 'A', seatNumber: 1, zone: 'VIP', price: 90 },
      { id: 3, rowLetter: 'D', seatNumber: 1, zone: 'PREMIUM', price: 67.5 }
    ]
  };

  beforeEach(() => {
    orderService = jasmine.createSpyObj('OrderService', ['getOrder']);

    const fakeActivatedRoute = {
      snapshot: {
        paramMap: { get: (key: string) => (key === 'reference' ? 'TCK-8FK2MQ' : null) }
      }
    } as unknown as ActivatedRoute;

    fixture = TestBed.configureTestingModule({
      imports: [OrderConfirmationComponent, RouterTestingModule],
      providers: [
        { provide: OrderService, useValue: orderService },
        { provide: ActivatedRoute, useValue: fakeActivatedRoute }
      ]
    }).createComponent(OrderConfirmationComponent);
    component = fixture.componentInstance;
  });

  it('loads the order for the reference from the route and renders all details', () => {
    orderService.getOrder.and.returnValue(of(sampleOrder));
    fixture.detectChanges();

    expect(orderService.getOrder).toHaveBeenCalledWith('TCK-8FK2MQ');
    expect(component.order).toBe(sampleOrder);

    const el = fixture.nativeElement;
    expect(el.querySelector('.ot-ref').textContent).toContain('TCK-8FK2MQ');
    expect(el.querySelector('h1').textContent).toContain('Skyline Live');
    expect(el.querySelector('.ot-title').textContent).toContain('Skyline Live — Aurora Sky');
    expect(el.textContent).toContain('Jane Doe');
    expect(el.textContent).toContain('jane@example.com');

    const chips = el.querySelectorAll('.ot-seat');
    expect(chips.length).toBe(2);
    expect(chips[0].textContent).toContain('A1 · VIP');
    expect(chips[1].textContent).toContain('D1 · PREMIUM');
  });

  it('shows the error block when the order cannot be loaded', () => {
    orderService.getOrder.and.returnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();

    expect(component.order).toBeNull();
    expect(component.error).toContain('Order not found');
    expect(fixture.nativeElement.querySelector('.error').textContent).toContain('Order not found');
  });
});
