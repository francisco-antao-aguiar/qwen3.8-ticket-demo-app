import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PaymentService } from './payment.service';
import { PaymentRequest, PaymentResponse } from '../models';

describe('PaymentService', () => {
  let service: PaymentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PaymentService]
    });
    service = TestBed.inject(PaymentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('processPayment() POSTs the card details to /payments', () => {
    const request: PaymentRequest = {
      buyerName: 'Jane Doe',
      cardNumber: '4242 4242 4242 4242',
      cardExpiry: '12/29',
      cardCvv: '123'
    };
    const response: PaymentResponse = {
      paymentId: 'pay_abc123',
      status: 'APPROVED',
      last4: '4242',
      declineReason: null
    };
    const received: PaymentResponse[] = [];

    service.processPayment(request).subscribe((value) => received.push(value));

    const req = httpMock.expectOne('http://localhost:8080/api/payments');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(response);

    expect(received).toEqual([response]);
  });
});
