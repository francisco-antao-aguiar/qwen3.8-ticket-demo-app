import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Artist, Concert, SeatMap } from '../models';

@Injectable({ providedIn: 'root' })
export class ConcertService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:8080/api';

  getArtists(): Observable<Artist[]> {
    return this.http.get<Artist[]>(`${this.baseUrl}/artists`);
  }

  getConcerts(artistId?: number): Observable<Concert[]> {
    let params = new HttpParams();
    if (artistId !== undefined) {
      params = params.set('artistId', artistId.toString());
    }
    return this.http.get<Concert[]>(`${this.baseUrl}/concerts`, { params });
  }

  getSeatMap(concertId: number): Observable<SeatMap> {
    return this.http.get<SeatMap>(`${this.baseUrl}/concerts/${concertId}/seats`);
  }
}
