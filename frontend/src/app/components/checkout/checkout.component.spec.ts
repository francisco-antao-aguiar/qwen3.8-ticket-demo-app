import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { CheckoutComponent } from './checkout.component';
import { ConcertService } from '../../services/concert.service';
import { OrderService } from '../../services/order.service';
import { PaymentService } from '../../services/payment.service';
import { Concert, OrderResponse, Seat } from '../../models';

describe('CheckoutComponent', () => {
  let component: CheckoutComponent;
  let fixture: ComponentFixture<CheckoutComponent>;
  let concertService: jasmine.SpyObj<ConcertService>;
  let orderService: jasmine.SpyObj<OrderService>;
  let paymentService: jasmine.SpyObj<PaymentService>;
  let router: Router;

  const concert: Concert = {
    id: 5,
    title: 'Skyline Live',
    artistId: 1,
    artistName: 'Aurora Sky',
    date: '2026-10-15T20:00:00',
    venue: 'Riverside Arena',
    basePrice: 45
  };
  // seat 2 is NOT part of the requested selection and must be filtered out
  const seatMapSeats: Seat[] = [
    { id: 1, rowLetter: 'A', seatNumber: 1, zone: 'VIP', price: 90, status: 'AVAILABLE' },
    { id: 2, rowLetter: 'A', seatNumber: 2, zone: 'VIP', price: 90, status: 'AVAILABLE' },
    { id: 3, rowLetter: 'D', seatNumber: 1, zone: 'PREMIUM', price: 67.5, status: 'AVAILABLE' }
  ];
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
    concertService = jasmine.createSpyObj('ConcertService', ['getSeatMap']);
    concertService.getSeatMap.and.returnValue(of({ concert, seats: seatMapSeats }));
    orderService = jasmine.createSpyObj('OrderService', ['createOrder']);
    paymentService = jasmine.createSpyObj('PaymentService', ['processPayment']);

    const fakeActivatedRoute = {
      snapshot: {
        paramMap: { get: (key: string) => (key === 'concertId' ? '5' : null) },
        queryParamMap: { get: (key: string) => (key === 'seats' ? '1,3' : null) }
      }
    } as unknown as ActivatedRoute;

    fixture = TestBed.configureTestingModule({
      imports: [CheckoutComponent, RouterTestingModule],
      providers: [
        { provide: ConcertService, useValue: concertService },
        { provide: OrderService, useValue: orderService },
        { provide: PaymentService, useValue: paymentService },
        { provide: ActivatedRoute, useValue: fakeActivatedRoute }
      ]
    }).createComponent(CheckoutComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  function fillValidForm(): void {
    component.buyerName = 'Jane Doe';
    component.buyerEmail = 'jane@example.com';
    component.cardNumber = '4242 4242 4242 4242';
    component.cardExpiry = '12/29';
    component.cardCvv = '123';
  }

  it('loads the ticket for the selected seats only and totals their price', () => {
    fixture.detectChanges();

    expect(concertService.getSeatMap).toHaveBeenCalledWith(5);
    expect(component.concert).toBe(concert);
    expect(component.seats.map((seat) => seat.id)).toEqual([1, 3]);
    expect(component.total).toBeCloseTo(157.5);
  });

  it('renders the seat list on the ticket', () => {
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('.seat-list li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Row A, seat 1');
    expect(items[1].textContent).toContain('Row D, seat 1');
    expect(fixture.nativeElement.querySelector('.total-line')).not.toBeNull();
  });

  it('onCardNumberInput() keeps only digits and groups them in fours', () => {
    component.onCardNumberInput('4242424242424242');
    expect(component.cardNumber).toBe('4242 4242 4242 4242');

    component.onCardNumberInput('4242-4242');
    expect(component.cardNumber).toBe('4242 4242');

    component.onCardNumberInput('abcdefghijkl');
    expect(component.cardNumber).toBe('');
  });

  it('onExpiryInput() formats MM/YY', () => {
    component.onExpiryInput('1229');
    expect(component.cardExpiry).toBe('12/29');

    component.onExpiryInput('12');
    expect(component.cardExpiry).toBe('12');
  });

  it('onCvvInput() keeps up to 4 digits', () => {
    component.onCvvInput('12a34');
    expect(component.cardCvv).toBe('1234');

    component.onCvvInput('12345');
    expect(component.cardCvv).toBe('1234');
  });

  it('submit() with invalid name and email marks the fields and calls no service', () => {
    fixture.detectChanges();

    component.buyerName = '';
    component.buyerEmail = 'not-an-email';
    component.cardNumber = '4242 4242 4242 4242';
    component.cardExpiry = '12/29';
    component.cardCvv = '123';
    component.submit();
    fixture.detectChanges();

    expect(component.nameValid).toBeFalse();
    expect(component.emailValid).toBeFalse();
    expect(component.cardNumberValid).toBeTrue();
    expect(component.cardExpiryValid).toBeTrue();
    expect(component.cardCvvValid).toBeTrue();
    expect(component.paying).toBeFalse();
    expect(paymentService.processPayment).not.toHaveBeenCalled();
    expect(orderService.createOrder).not.toHaveBeenCalled();

    // exactly the two invalid fields show their hint
    const fieldErrors = fixture.nativeElement.querySelectorAll('.field-error');
    expect(fieldErrors.length).toBe(2);
  });

  it('submit() rejects a badly formatted card number', () => {
    fillValidForm();
    component.cardNumber = '123';
    component.cardExpiry = '13/29'; // month 13 is invalid
    component.cardCvv = '12';

    component.submit();

    expect(component.cardNumberValid).toBeFalse();
    expect(component.cardExpiryValid).toBeFalse();
    expect(component.cardCvvValid).toBeFalse();
    expect(paymentService.processPayment).not.toHaveBeenCalled();
  });

  it('a declined payment shows the decline reason and never creates an order', () => {
    fixture.detectChanges();
    fillValidForm();
    paymentService.processPayment.and.returnValue(
      of({
        paymentId: null,
        status: 'DECLINED',
        last4: '0000',
        declineReason: 'Card declined by issuer (test decline card).'
      })
    );

    component.submit();
    fixture.detectChanges();

    expect(paymentService.processPayment).toHaveBeenCalledWith({
      buyerName: 'Jane Doe',
      cardNumber: '4242 4242 4242 4242',
      cardExpiry: '12/29',
      cardCvv: '123'
    });
    expect(component.paying).toBeFalse();
    expect(component.serverError).toContain('Card declined by issuer');
    expect(orderService.createOrder).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.error').textContent).toContain('Card declined');
  });

  it('a payment service failure shows the connectivity message', () => {
    fixture.detectChanges();
    fillValidForm();
    paymentService.processPayment.and.returnValue(throwError(() => new Error('boom')));

    component.submit();
    fixture.detectChanges();

    expect(component.paying).toBeFalse();
    expect(component.serverError).toContain('Could not reach the payment service');
    expect(orderService.createOrder).not.toHaveBeenCalled();
  });

  it('an approved payment places the order and redirects to the confirmation page', () => {
    fixture.detectChanges();
    fillValidForm();
    const navigateSpy = spyOn(router, 'navigate');
    paymentService.processPayment.and.returnValue(
      of({ paymentId: 'pay_abc', status: 'APPROVED', last4: '4242', declineReason: null })
    );
    orderService.createOrder.and.returnValue(of(sampleOrder));

    component.submit();

    expect(orderService.createOrder).toHaveBeenCalledWith({
      buyerName: 'Jane Doe',
      buyerEmail: 'jane@example.com',
      concertId: 5,
      seatIds: [1, 3]
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/confirmation', 'TCK-8FK2MQ']);
  });

  it('an order failure surfaces the backend error message', () => {
    fixture.detectChanges();
    fillValidForm();
    const navigateSpy = spyOn(router, 'navigate');
    paymentService.processPayment.and.returnValue(
      of({ paymentId: 'pay_abc', status: 'APPROVED', last4: '4242', declineReason: null })
    );
    orderService.createOrder.and.returnValue(
      throwError(() => ({ error: { error: 'Seat(s) already sold: [1]' } }))
    );

    component.submit();
    fixture.detectChanges();

    expect(component.paying).toBeFalse();
    expect(component.serverError).toContain('already sold');
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
