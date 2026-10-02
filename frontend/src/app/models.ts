export interface Artist {
  id: number;
  name: string;
}

export interface Concert {
  id: number;
  title: string;
  artistId: number;
  artistName: string;
  date: string;
  venue: string;
  basePrice: number;
}

export type SeatStatus = 'AVAILABLE' | 'SOLD';

export type Zone = 'VIP' | 'PREMIUM' | 'STANDARD';

export interface Seat {
  id: number;
  rowLetter: string;
  seatNumber: number;
  zone: Zone;
  price: number;
  status: SeatStatus;
}

export interface SeatMap {
  concert: Concert;
  seats: Seat[];
}

export interface CreateOrderRequest {
  buyerName: string;
  buyerEmail: string;
  concertId: number;
  seatIds: number[];
}

export interface PaymentRequest {
  buyerName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
}

export interface PaymentResponse {
  paymentId: string | null;
  status: 'APPROVED' | 'DECLINED';
  last4: string | null;
  declineReason: string | null;
}

export interface OrderSeatView {
  id: number;
  rowLetter: string;
  seatNumber: number;
  zone: Zone;
  price: number;
}

export interface OrderConcertView {
  id: number;
  title: string;
  artistName: string;
  date: string;
  venue: string;
}

export interface OrderResponse {
  id: number;
  reference: string;
  buyerName: string;
  buyerEmail: string;
  createdAt: string;
  totalAmount: number;
  concert: OrderConcertView;
  seats: OrderSeatView[];
}
