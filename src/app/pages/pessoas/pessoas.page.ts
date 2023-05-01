import { Component } from '@angular/core';
import { PessoasService } from 'src/app/services/pessoas.service';

@Component({
  selector: 'app-pessoas',
  templateUrl: 'pessoas.page.html',
  styleUrls: ['pessoas.page.scss']
})
export class PessoasPage {

  listaPessoas : any[];

  constructor(pessoasDados : PessoasService) {
    this.listaPessoas = pessoasDados.listaPessoas;
  }

  verificaCargo(lvl : String){
    if(lvl == "10"){
      return "Senior";
    } else if (lvl == "12") {
      return "Junior";
    } else if(lvl == "14") {
      return "Trainne";
    } else {
      return "Not Found";
    }
  }
}
