import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app.routing';
import { AppConfig } from './app.config';
import { ApiService} from '../../services/api.service'

import { HomeComponent } from '../home/home.component';
import { AboutComponent } from '../about/about.component';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    AboutComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule
  ],
  providers: [
    ApiService,
    { provide: AppConfig, useValue: require('../../client.config.json') }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
