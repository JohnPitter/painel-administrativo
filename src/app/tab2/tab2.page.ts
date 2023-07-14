import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import * as moment from 'moment';
import { TransactionsService } from 'src/app/services/transactions.service';
import * as XLSX from 'xlsx';
import { AdicionarRegistroFinanceiroModalComponent } from '../componentes/adicionar-registro-financeiro-modal/adicionar-registro-financeiro-modal.component';
import { Transaction } from '../model/transaction.model';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss']
})
export class Tab2Page implements OnInit {

  totalEntradas: number = 0;
  totalSaidas: number = 0;
  saldoFinal: number = 0;

  months = [
    { label: 'Janeiro', value: 1 },
    { label: 'Fevereiro', value: 2 },
    { label: 'Março', value: 3 },
    { label: 'Abril', value: 4 },
    { label: 'Maio', value: 5 },
    { label: 'Junho', value: 6 },
    { label: 'Julho', value: 7 },
    { label: 'Agosto', value: 8 },
    { label: 'Setembro', value: 9 },
    { label: 'Outubro', value: 10 },
    { label: 'Novembro', value: 11 },
    { label: 'Dezembro', value: 12 },
  ];

  selectedMonth: number;
  transactions: Transaction[] = [];
  filtredTransactions: Transaction[] = [];

  constructor(private modalController: ModalController,
    private transactionService: TransactionsService,
    private cdr: ChangeDetectorRef) {
    // Define o mês atual como selecionado por padrão
    this.selectedMonth = new Date().getMonth() + 1;
  }

  ngOnInit() {
    this.loadDataAndTotals();
  }

  eraseTotals() {
    this.totalEntradas = 0;
    this.totalSaidas = 0;
    this.saldoFinal = 0;
  }

  loadDataAndTotals() {
    this.eraseTotals();

    this.transactionService.getTransactions().then((transactions: Transaction[]) => {
      this.transactions = this.sortTransactionsByDate(transactions);
      this.filtredTransactions = this.transactions;
      this.calculateTotals();
    });
  }

  sortTransactionsByDate(transactions: Transaction[]): Transaction[] {
    return transactions.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);

      return dateA.getTime() - dateB.getTime();
    });
  }

  calculateTotals() {
    this.filtredTransactions.forEach(this.updateTotals);
  }

  updateTotals = (transaction: Transaction) => {
    if (transaction.type === 'Entrada') {
      this.totalEntradas += Number(transaction.amount);
    } else if (transaction.type === 'Saida') {
      this.totalSaidas += Number(transaction.amount);
    }

    this.saldoFinal = this.totalEntradas - this.totalSaidas;
  }

  monthChanged() {
    const filtredTransactions = this.transactions.filter((transaction: Transaction) => {
      const date = moment(transaction.date);
      return date.month() + 1 === this.selectedMonth;
    });

    this.filtredTransactions = filtredTransactions;
    this.eraseTotals();
    this.calculateTotals();
  }

  async addTransaction() {
    const modal = await this.modalController.create({
      component: AdicionarRegistroFinanceiroModalComponent,
    });

    modal.onDidDismiss().then((result) => {
      if (result.data) {
        const newTransactions: Transaction[] = result.data.transactions;
        const invoices = result.data.invoices;

        if (newTransactions.length > 0) {
          newTransactions.forEach(transaction => {
            this.transactionService.addTransaction(transaction).then(() => {
              this.atualizarInformacoes();
            });
            this.updateTotals(transaction);
          });

          if (invoices) {
            this.transactionService.uploadImages(invoices).then((sucess) => { console.log(sucess); });
          }
        }
      }
    });

    return await modal.present();
  }

  atualizarInformacoes() {
    this.loadDataAndTotals();
    this.cdr.detectChanges();
  }

  removeTransaction(transaction: Transaction) {
    this.transactionService.removeTransaction(transaction).then(() => {
      this.atualizarInformacoes();
    });
  }

  exportToExcel() {
    const data = [
      ['Data', 'Descrição', 'Tipo', 'Valor'],
      ...this.filtredTransactions.map((transaction: Transaction) => [
        transaction.date,
        transaction.description,
        transaction.type,
        transaction.amount
      ])
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Entradas e Saídas');

    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'binary' });
    function s2ab(s: string) {
      const buf = new ArrayBuffer(s.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < s.length; i++) {
        view[i] = s.charCodeAt(i) & 0xff;
      }
      return buf;
    }

    const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = 'entradas_e_saidas.xlsx';
    link.click();
  }
}
