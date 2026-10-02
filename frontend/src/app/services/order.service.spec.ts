import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OrderService } from './order.service';
import { CreateOrderRequest, OrderResponse } from '../models';

describe('OrderService', () => {
  let service: OrderService;
  let httpMock: HttpTestingController;

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
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [OrderService]
    });
    service = TestBed.inject(OrderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('createOrder() POSTs the request body to /orders', () => {
    const request: CreateOrderRequest = {
      buyerName: 'Jane Doe',
      buyerEmail: 'jane@example.com',
      concertId: 5,
      seatIds: [1, 3]
    };
    const received: OrderResponse[] = [];

    service.createOrder(request).subscribe((value) => received.push(value));

    const req = httpMock.expectOne('http://localhost:8080/api/orders');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(sampleOrder);

    expect(received).toEqual([sampleOrder]);
  });

  it('getOrder(reference) issues GET /orders/:reference', () => {
    const received: OrderResponse[] = [];

    service.getOrder('TCK-8FK2MQ').subscribe((value) => received.push(value));

    const req = httpMock.expectOne('http://localhost:8080/api/orders/TCK-8FK2MQ');
    expect(req.request.method).toBe('GET');
    req.flush(sampleOrder);

    expect(received).toEqual([sampleOrder]);
  });
});
