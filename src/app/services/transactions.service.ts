import { Injectable } from '@angular/core';
import { Firestore, collection, getDocs, getFirestore } from '@firebase/firestore';
import { addDoc, deleteDoc, doc } from 'firebase/firestore';
import { FirebaseStorage, getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { Transaction } from '../model/transaction.model';

@Injectable({
  providedIn: "root",
})
export class TransactionsService {

  private firestore: Firestore;
  private storage: FirebaseStorage;

  constructor() {
    this.firestore = getFirestore();
    this.storage = getStorage();
  }

  async uploadImages(files: File[]): Promise<string[]> {
    const downloadURLs: string[] = [];

    let dataAtual = new Date();
    let opcoes = { year: 'numeric', month: '2-digit' } as const;  // use "as const" para garantir que os tipos são corretos
    let dataFormatada = dataAtual.toLocaleDateString('pt-BR', opcoes);

    for (const file of files) {
      const filePath = `comprovantes/${dataFormatada}/${file.name}`;
      const storageRef = ref(this.storage, filePath);

      await uploadBytes(storageRef, file);

      const downloadURL = await getDownloadURL(storageRef);
      downloadURLs.push(downloadURL);
    }

    return downloadURLs;
  }

  // Exemplo de método para adicionar um documento
  async addTransaction(transaction: Transaction): Promise<void> {
    const transactionsCollection = collection(this.firestore, 'transactions');
    await addDoc(transactionsCollection, transaction);
  }

  // Exemplo de método para recuperar documentos
  async getTransactions(): Promise<Transaction[]> {
    const transactionsCollection = collection(this.firestore, 'transactions');
    const querySnapshot = await getDocs(transactionsCollection);
    const transactions: Transaction[] = [];

    querySnapshot.forEach((doc) => {
      const transaction = doc.data() as Transaction;
      transaction.id = doc.id; // Adicionada esta linha para incluir o ID da transação
      transactions.push(transaction);
    });

    return transactions;
  }

  async removeTransaction(transaction: Transaction): Promise<void> {
    if (!transaction.id) {
      throw new Error('Transaction must have an ID to be removed.');
    }

    const transactionDoc = doc(this.firestore, 'transactions', transaction.id);
    await deleteDoc(transactionDoc);
  }
}
