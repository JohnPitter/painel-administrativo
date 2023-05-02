import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-adicionar-registro-financeiro-modal',
  templateUrl: './adicionar-registro-financeiro-modal.component.html',
  styleUrls: ['./adicionar-registro-financeiro-modal.component.scss'],
})
export class AdicionarRegistroFinanceiroModalComponent implements OnInit {
  transactionDate: string | undefined;
  transactionDescription: string | undefined;
  transactionType! : string;
  transactionValue! : number;

  constructor(private modalController: ModalController) { }

  ngOnInit() { }

  dismissModal() {
    this.modalController.dismiss();
  }

  saveTransaction() {
    // Aqui você pode implementar a lógica para salvar a transação, por exemplo, adicionando-a a um array
    const newTransaction = {
      date: this.transactionDate,
      description: this.transactionDescription,
      type: this.transactionType,
      amount: this.transactionValue,
    };

    this.modalController.dismiss(newTransaction);
  }
}
