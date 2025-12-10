import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { enviroment } from '../../enviroments/enviroment';

@Injectable({
  providedIn: 'root'
})
export class RifaService {
  private myAppUrl: string;
  private myAPIUrl: string = 'api/rifa';

  constructor(private http: HttpClient) { 
    this.myAppUrl = enviroment.endpoint;
  }

   numRadom() {
    const url = `${this.myAppUrl}${this.myAPIUrl}`;
    return this.http.get(url, { withCredentials: true });
  }
}
