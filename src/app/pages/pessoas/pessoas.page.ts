import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { AdicionarRegistroFinanceiroModalComponent } from '../componentes/adicionar-registro-financeiro-modal/adicionar-registro-financeiro-modal.component';
import * as XLSX from 'xlsx';
import * as moment from 'moment';
import { Transaction } from 'firebase/firestore';
import { TransactionsService } from 'src/app/services/transactions.service';

@Component({
  selector: 'app-pessoas',
  templateUrl: 'pessoas.page.html',
  styleUrls: ['pessoas.page.scss']
})
export class PessoasPage implements OnInit {

  totalEntradas = 0;
  totalSaidas = 0;
  saldoFinal = 0;

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
  transactions: any;
  filtredTransactions: any;

  constructor(private modalController: ModalController,
    private transactionService: TransactionsService) {
    // Define o mês atual como selecionado por padrão
    this.selectedMonth = new Date().getMonth() + 1;
  }

  ngOnInit() {
    this.loadData();
    this.calculateTotals();
  }

  eraseTotals() {
    this.totalEntradas = 0;
    this.totalSaidas = 0;
    this.saldoFinal = 0;
  }

  loadData() {
    this.transactions = new Array<Transaction>();
    this.transactions = this.transactionService.getTransactions('trasactions');
    this.filtredTransactions = this.transactions;
  }

  calculateTotals() {
    this.filtredTransactions.forEach((transaction) => {
      if (transaction.type === 'Entrada') {
        this.totalEntradas += transaction.amount;
      } else if (transaction.type === 'Saida') {
        this.totalSaidas += transaction.amount;
      }
    });

    this.saldoFinal = this.totalEntradas - this.totalSaidas;
  }

  monthChanged() {
    let filtredTransactions = this.transactions.filter((transaction) => {
      const date = moment(transaction.date)
      return date.month() + 1 === this.selectedMonth
    })

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
        this.transactions.push(result.data)
        this.transactionService.addTransaction('transactions', result.data);
        this.calculateTotals();
      }
    });

    return await modal.present();
  }

  exportToExcel() {
    // Aqui você pode criar uma matriz com os dados da tabela
    // Substitua este exemplo pelo conteúdo real da tabela
    const data = [
      ['Data', 'Descrição', 'Tipo', 'Valor'],
      ...this.filtredTransactions.map(transaction => [
        transaction.date,
        transaction.description,
        transaction.type,
        transaction.amount
      ])
    ];

    // Cria a planilha a partir da matriz de dados
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Cria um novo livro e adiciona a planilha
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Entradas e Saídas');

    // Exporta o livro como um arquivo .xlsx
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'binary' });

    // Função auxiliar para converter de string binária para um array de 8 bits
    function s2ab(s) {
      const buf = new ArrayBuffer(s.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < s.length; i++) {
        view[i] = s.charCodeAt(i) & 0xff;
      }
      return buf;
    }

    // Salva o arquivo no dispositivo do usuário
    const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = 'entradas_e_saidas.xlsx';
    link.click();
  }
}
