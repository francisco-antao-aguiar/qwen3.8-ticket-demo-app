import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConcertService } from './concert.service';
import { Artist, Concert, SeatMap } from '../models';

describe('ConcertService', () => {
  let service: ConcertService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ConcertService]
    });
    service = TestBed.inject(ConcertService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getArtists() issues GET /artists and emits the artist list', () => {
    const artists: Artist[] = [
      { id: 1, name: 'Aurora Sky' },
      { id: 2, name: 'The Midnight Waves' }
    ];
    const received: Artist[] = [];

    service.getArtists().subscribe((value) => received.push(...value));

    const req = httpMock.expectOne('http://localhost:8080/api/artists');
    expect(req.request.method).toBe('GET');
    req.flush(artists);

    expect(received).toEqual(artists);
  });

  it('getConcerts() issues GET /concerts without params when no artist is given', () => {
    const concerts: Concert[] = [];
    const received: Concert[] = [];

    service.getConcerts().subscribe((value) => received.push(...value));

    const req = httpMock.expectOne('http://localhost:8080/api/concerts');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('artistId')).toBeNull();
    req.flush(concerts);

    expect(received).toEqual(concerts);
  });

  it('getConcerts(artistId) sends the artistId query param', () => {
    service.getConcerts(7).subscribe();

    const req = httpMock.expectOne(
      (request) =>
        request.url === 'http://localhost:8080/api/concerts' &&
        request.params.get('artistId') === '7'
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getSeatMap(concertId) issues GET /concerts/:id/seats', () => {
    const map: SeatMap = {
      concert: {
        id: 9,
        title: 'Skyline Live',
        artistId: 1,
        artistName: 'Aurora Sky',
        date: '2026-10-15T20:00:00',
        venue: 'Riverside Arena',
        basePrice: 45
      },
      seats: []
    };
    const received: SeatMap[] = [];

    service.getSeatMap(9).subscribe((value) => received.push(value));

    const req = httpMock.expectOne('http://localhost:8080/api/concerts/9/seats');
    expect(req.request.method).toBe('GET');
    req.flush(map);

    expect(received).toEqual([map]);
  });
});
