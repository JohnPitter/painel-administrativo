import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { AdicionarRegistroFinanceiroModalModule } from './pages/componentes/adicionar-registro-financeiro-modal/adicionar-registro-financeiro-modal.module';

import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { ChartsModule } from 'ng2-charts';
import { TransactionsService } from 'src/app/services/transactions.service';
import { AdicionarRegistroFinanceiroModalComponent } from './pages/componentes/adicionar-registro-financeiro-modal/adicionar-registro-financeiro-modal.component';

//IMPORT OFFICIAL ANGULAR FIRE AND THE ENVIRONMENT TO LOAD FIREBASE.
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { environment } from 'src/environments/environment';

@NgModule({
  declarations: [AppComponent],
  entryComponents: [AdicionarRegistroFinanceiroModalComponent],
  imports: [BrowserModule, IonicModule.forRoot(), AppRoutingModule, ChartsModule, AdicionarRegistroFinanceiroModalModule,
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideFirestore(() => getFirestore())],
  providers: [
    TransactionsService,
    StatusBar,
    SplashScreen,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
