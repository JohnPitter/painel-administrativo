import { Injectable } from '@angular/core';
import { collection as collectionFn, addDoc, getDocs, Firestore } from '@angular/fire/firestore';

@Injectable({
  providedIn: "root",
})
export class TransactionsService {
  constructor(private firestore: Firestore) { }

  // Exemplo de método para adicionar um documento
  async addTransaction(collection: string, data: any) {
    try {
      const docRef = await addDoc(collectionFn(this.firestore, collection), data);
      console.log("Document written with ID: ", docRef.id);
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  }

  // Exemplo de método para recuperar documentos
  async getTransactions(collection: string) {
    const querySnapshot = await getDocs(collectionFn(this.firestore, collection));
    querySnapshot.forEach((doc) => {
      console.log(`${doc.id} => ${doc.data()}`);
    });

    return querySnapshot;
  }
}
