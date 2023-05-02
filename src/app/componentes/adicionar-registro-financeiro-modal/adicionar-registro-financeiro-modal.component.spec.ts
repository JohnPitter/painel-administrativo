import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { AdicionarRegistroFinanceiroModalComponent } from './adicionar-registro-financeiro-modal.component';

describe('AdicionarRegistroFinanceiroModalComponent', () => {
  let component: AdicionarRegistroFinanceiroModalComponent;
  let fixture: ComponentFixture<AdicionarRegistroFinanceiroModalComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ AdicionarRegistroFinanceiroModalComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(AdicionarRegistroFinanceiroModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
