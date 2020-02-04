import { Component } from '@angular/core';
import { PessoasService } from 'src/pessoasService/pessoas.service';

@Component({
  selector: 'app-levels',
  templateUrl: 'levels.page.html',
  styleUrls: ['levels.page.scss']
})
export class LevelsPage {

  listaPessoas : any[];

  constructor(pessoasDados : PessoasService) {
    this.listaPessoas = pessoasDados.listaPessoas;
  }

  mostraCargo(cargo : String){

    if(cargo == "Senior"){
      return true;
    }
    return false;
  }

}
