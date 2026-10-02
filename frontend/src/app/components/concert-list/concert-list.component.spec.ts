import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { ConcertListComponent } from './concert-list.component';
import { ConcertService } from '../../services/concert.service';
import { Artist, Concert } from '../../models';

describe('ConcertListComponent', () => {
  let component: ConcertListComponent;
  let fixture: ComponentFixture<ConcertListComponent>;
  let concertService: jasmine.SpyObj<ConcertService>;

  const artists: Artist[] = [
    { id: 1, name: 'Aurora Sky' },
    { id: 2, name: 'The Midnight Waves' }
  ];
  const concerts: Concert[] = [
    {
      id: 10,
      title: 'Skyline Live',
      artistId: 1,
      artistName: 'Aurora Sky',
      date: '2026-10-15T20:00:00',
      venue: 'Riverside Arena',
      basePrice: 45
    },
    {
      id: 11,
      title: 'Waves After Dark',
      artistId: 2,
      artistName: 'The Midnight Waves',
      date: '2026-10-17T20:00:00',
      venue: 'The Dome',
      basePrice: 60
    }
  ];

  beforeEach(() => {
    concertService = jasmine.createSpyObj('ConcertService', ['getArtists', 'getConcerts']);
    fixture = TestBed.configureTestingModule({
      imports: [ConcertListComponent, RouterTestingModule],
      providers: [{ provide: ConcertService, useValue: concertService }]
    }).createComponent(ConcertListComponent);
    component = fixture.componentInstance;
  });

  function loadSuccessfully(): void {
    concertService.getArtists.and.returnValue(of(artists));
    concertService.getConcerts.and.returnValue(of(concerts));
    fixture.detectChanges();
  }

  it('renders a card per concert with its title and a link to the seat map', () => {
    loadSuccessfully();

    const cards = fixture.nativeElement.querySelectorAll('.concert-card');
    expect(cards.length).toBe(2);

    expect(cards[0].querySelector('h3').textContent).toContain('Skyline Live');
    expect(cards[1].querySelector('h3').textContent).toContain('Waves After Dark');

    const link = cards[0].querySelector('a.btn.primary');
    expect(link.getAttribute('href')).toBe('/concert/10');
    expect(link.textContent).toContain('Choose seats');
  });

  it('renders the "All artists" option plus one option per artist', () => {
    loadSuccessfully();

    const options = fixture.nativeElement.querySelectorAll('#artist-filter option');
    expect(options.length).toBe(3);
    expect(options[0].textContent).toContain('All artists');
    expect(options[1].textContent).toContain('Aurora Sky');
  });

  it('onArtistChange() reloads the concerts filtered by the selected artist', () => {
    loadSuccessfully();
    expect(concertService.getConcerts).toHaveBeenCalledWith(undefined);

    component.selectedArtistId = 2;
    component.onArtistChange();
    fixture.detectChanges();

    expect(concertService.getConcerts).toHaveBeenCalledWith(2);
  });

  it('shows an error message when the concert request fails', () => {
    concertService.getArtists.and.returnValue(of(artists));
    concertService.getConcerts.and.returnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();

    expect(component.error).toContain('Could not load concerts');
    expect(fixture.nativeElement.querySelector('.error').textContent).toContain('Could not load concerts');
  });
});
