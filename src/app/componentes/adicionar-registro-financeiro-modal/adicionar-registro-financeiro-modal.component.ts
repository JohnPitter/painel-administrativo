import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-adicionar-registro-financeiro-modal',
  templateUrl: './adicionar-registro-financeiro-modal.component.html',
  styleUrls: ['./adicionar-registro-financeiro-modal.component.scss'],
})
export class AdicionarRegistroFinanceiroModalComponent implements OnInit {

  transactionsForm = this.fb.group({
    transactions: this.fb.array([])
  });

  selectedImageFiles!: FileList;
  imageURLs: string[] = [];

  uploadFiles(event: any) {
    this.selectedImageFiles = event.target.files;
  }

  get transactionsFormArray() {
    return this.transactionsForm.get('transactions') as FormArray;
  }

  constructor(private fb: FormBuilder, private modalController: ModalController) { }

  ngOnInit() {
    this.addTransactionFormGroup(); // Adds an initial form group when the modal loads
  }

  addTransactionFormGroup() {
    this.transactionsFormArray.push(this.fb.group({
      date: ['', Validators.required],
      description: ['', Validators.required],
      type: ['', Validators.required],
      amount: ['', [Validators.required, Validators.min(0), Validators.max(100000)]]
    }));
  }

  public dateValidator(control: AbstractControl): ValidationErrors | null {
    const date = new Date(control.value);
    if (date && (date.getFullYear() < 0 || date.getFullYear() > 2099)) {
      return { 'dateOutOfRange': true };
    }
    return null;
  }

  removeTransactionFormGroup(index: number) {
    this.transactionsFormArray.removeAt(index);
  }

  onSubmit() {
    if (this.transactionsForm.valid) {
      const transactions = this.transactionsForm.value.transactions;

      let modelTransactions: any

      if (this.selectedImageFiles) {
        modelTransactions = {
          transactions: transactions,
          invoices: this.selectedImageFiles
        }
      } else {
        modelTransactions = {
          transactions: transactions
        }
      }

      this.modalController.dismiss(modelTransactions);
    }
  }

  dismissModal() {
    this.modalController.dismiss();
  }
}
