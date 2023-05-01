import { Component } from '@angular/core';
import { PessoasService } from 'src/app/services/transactions.service';

@Component({
  selector: 'app-levels',
  templateUrl: 'levels.page.html',
  styleUrls: ['levels.page.scss']
})
export class LevelsPage {

  listaPessoas : any[];
  listaSenior : any[];
  listaJunior : any[];
  listaTrainee : any[];

  constructor(pessoasDados : PessoasService) {
    this.listaPessoas = pessoasDados.listaPessoas;
    this.verificaSenior();
  }

  verificaSenior(){
    this.listaPessoas.forEach( pessoa => {
      if(pessoa.lvl == "10"){
        this.listaSenior = this.listaSenior || [];
        this.listaSenior.push(pessoa);
      } else if (pessoa.lvl == "12") {
        this.listaJunior = this.listaJunior || [];
        this.listaJunior.push(pessoa);
      } else if(pessoa.lvl == "14") {
        this.listaTrainee = this.listaTrainee || [];
        this.listaTrainee.push(pessoa);
      }else{
        return;
      }
    })
  }

}
