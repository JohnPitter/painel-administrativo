import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { AdicionarRegistroFinanceiroModalModule } from './componentes/adicionar-registro-financeiro-modal/adicionar-registro-financeiro-modal.module';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';



//IMPORT OFFICIAL ANGULAR FIRE AND THE ENVIRONMENT TO LOAD FIREBASE.
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { initializeApp } from '@firebase/app';
import { environment } from '../environments/environment';

initializeApp(environment.firebaseConfig);

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, IonicModule.forRoot(), AppRoutingModule,
    BrowserModule,
    FormsModule,       // Adicione estas linhas
    ReactiveFormsModule,
    AdicionarRegistroFinanceiroModalModule],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }],
  bootstrap: [AppComponent],
})
export class AppModule { }
