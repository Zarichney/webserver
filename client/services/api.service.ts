import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfig } from '../components/app/app.config';
import * as models from 'server/models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly apiUrl: string;

  constructor(
    private readonly http: HttpClient,
    config: AppConfig
  ) {
    this.apiUrl = config.apiUrl;
  }

  getTest(): Observable<models.MyModel[]> {
    return this.http.get<models.MyModel[]>(`${this.apiUrl}/api/test`);
  }
}
