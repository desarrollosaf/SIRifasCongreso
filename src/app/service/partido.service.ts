import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { enviroment } from '../../enviroments/enviroment';

@Injectable({
  providedIn: 'root'
})
export class PartidoService {
  private myAppUrl: string;
  private myAPIUrl: string = 'api/partido';

  constructor(private http: HttpClient) {
    this.myAppUrl = enviroment.endpoint;
  }

  getGanadores(): Observable<any> {
    return this.http.get<any>(`${this.myAppUrl}${this.myAPIUrl}/ganadores`);
  }

  getParticipantes(): Observable<any> {
    return this.http.get<any>(`${this.myAppUrl}${this.myAPIUrl}/participantes`);
  }

  realizarSorteo(): Observable<any> {
    return this.http.post<any>(`${this.myAppUrl}${this.myAPIUrl}/sorteo`, {});
  }

  resetSorteo(): Observable<any> {
    return this.http.post<any>(`${this.myAppUrl}${this.myAPIUrl}/reset`, {});
  }

  removerGanador(id: number): Observable<any> {
    return this.http.post<any>(`${this.myAppUrl}${this.myAPIUrl}/remover/${id}`, {});
  }

  reportePDF(): Observable<Blob> {
    return this.http.get(`${this.myAppUrl}${this.myAPIUrl}/reporte`, { responseType: 'blob' });
  }
}
