import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { ConcertDetailComponent } from './concert-detail.component';
import { ConcertService } from '../../services/concert.service';
import { Concert, Seat } from '../../models';

describe('ConcertDetailComponent', () => {
  let component: ConcertDetailComponent;
  let fixture: ComponentFixture<ConcertDetailComponent>;
  let concertService: jasmine.SpyObj<ConcertService>;

  const concert: Concert = {
    id: 5,
    title: 'Skyline Live',
    artistId: 1,
    artistName: 'Aurora Sky',
    date: '2026-10-15T20:00:00',
    venue: 'Riverside Arena',
    basePrice: 45
  };
  const seats: Seat[] = [
    { id: 1, rowLetter: 'A', seatNumber: 1, zone: 'VIP', price: 90, status: 'AVAILABLE' },
    { id: 2, rowLetter: 'A', seatNumber: 2, zone: 'VIP', price: 90, status: 'SOLD' },
    { id: 3, rowLetter: 'D', seatNumber: 1, zone: 'PREMIUM', price: 67.5, status: 'AVAILABLE' },
    { id: 4, rowLetter: 'D', seatNumber: 2, zone: 'PREMIUM', price: 67.5, status: 'AVAILABLE' },
    { id: 5, rowLetter: 'G', seatNumber: 1, zone: 'STANDARD', price: 45, status: 'AVAILABLE' },
    { id: 6, rowLetter: 'G', seatNumber: 2, zone: 'STANDARD', price: 45, status: 'AVAILABLE' }
  ];

  beforeEach(() => {
    concertService = jasmine.createSpyObj('ConcertService', ['getSeatMap']);
    concertService.getSeatMap.and.returnValue(of({ concert, seats }));

    const fakeActivatedRoute = {
      snapshot: {
        paramMap: { get: (key: string) => (key === 'id' ? '5' : null) }
      }
    } as unknown as ActivatedRoute;

    fixture = TestBed.configureTestingModule({
      imports: [ConcertDetailComponent, RouterTestingModule],
      providers: [
        { provide: ConcertService, useValue: concertService },
        { provide: ActivatedRoute, useValue: fakeActivatedRoute }
      ]
    }).createComponent(ConcertDetailComponent);
    component = fixture.componentInstance;
  });

  it('requests the seat map for the concert id from the route', () => {
    fixture.detectChanges();

    expect(concertService.getSeatMap).toHaveBeenCalledWith(5);
    expect(component.concert).toBe(concert);
    expect(component.loading).toBeFalse();
  });

  it('renders one seat button per seat and disables sold seats', () => {
    fixture.detectChanges();

    const seatButtons = fixture.nativeElement.querySelectorAll('button.seat');
    expect(seatButtons.length).toBe(6);

    const soldButtons = fixture.nativeElement.querySelectorAll('button.seat.sold');
    expect(soldButtons.length).toBe(1);
    expect(soldButtons[0].disabled).toBeTrue();
  });

  it('toggleSeat() selects an available seat, accumulates the total, and deselects on the second call', () => {
    fixture.detectChanges();

    component.toggleSeat(seats[0]);
    expect(component.selectedIds).toEqual([1]);
    expect(component.total).toBe(90);
    expect(component.isSelected(seats[0])).toBeTrue();

    component.toggleSeat(seats[0]);
    expect(component.selectedIds).toEqual([]);
    expect(component.total).toBe(0);
    expect(component.isSelected(seats[0])).toBeFalse();
  });

  it('ignores clicks on sold seats', () => {
    fixture.detectChanges();

    component.toggleSeat(seats[1]); // id 2 is SOLD

    expect(component.selectedIds).toEqual([]);
    expect(component.selectionMessage).toBeNull();
  });

  it('blocks a fifth seat and explains the limit', () => {
    fixture.detectChanges();

    component.toggleSeat(seats[0]);
    component.toggleSeat(seats[2]);
    component.toggleSeat(seats[3]);
    component.toggleSeat(seats[4]);
    expect(component.selectedIds.length).toBe(4);

    component.toggleSeat(seats[5]);

    expect(component.selectedIds.length).toBe(4);
    expect(component.selectionMessage).toBe('You can select at most 4 seats per order.');

    // deselecting one seat frees the limit again
    component.toggleSeat(seats[0]);
    component.toggleSeat(seats[5]);
    expect(component.selectedIds.length).toBe(4);
    expect(component.selectionMessage).toBeNull();
  });

  it('counts available seats per zone and total sold seats for the legend', () => {
    fixture.detectChanges();

    expect(component.vipCount).toBe(1);
    expect(component.premiumCount).toBe(2);
    expect(component.standardCount).toBe(2);
    expect(component.soldCount).toBe(1);
  });

  it('tooltip() formats row, seat, zone and price', () => {
    fixture.detectChanges();

    expect(component.tooltip(seats[0])).toBe('Row A, seat 1 · VIP · 90.00 USD');
  });

  it('selectedSeats are sorted by row letter and seat number', () => {
    fixture.detectChanges();

    component.toggleSeat(seats[4]); // G1
    component.toggleSeat(seats[2]); // D1
    component.toggleSeat(seats[0]); // A1

    expect(component.selectedSeats.map((seat) => seat.id)).toEqual([1, 3, 5]);
  });

  it('shows the buy stub with a checkout link carrying the selected seat ids', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a.buy')).toBeNull();

    component.toggleSeat(seats[0]); // id 1
    component.toggleSeat(seats[2]); // id 3
    fixture.detectChanges();

    const buyLink = fixture.nativeElement.querySelector('a.buy');
    expect(buyLink).not.toBeNull();

    const href = buyLink.getAttribute('href');
    expect(href).toContain('/checkout/5');
    expect(decodeURIComponent(href)).toContain('seats=1,3');

    expect(component.total).toBe(157.5);
  });

  it('shows the not-found block when the seat map request fails', () => {
    concertService.getSeatMap.and.returnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();

    expect(component.loading).toBeFalse();
    expect(component.concert).toBeNull();
    expect(fixture.nativeElement.querySelector('.error').textContent).toContain('Concert not found');
  });
});
