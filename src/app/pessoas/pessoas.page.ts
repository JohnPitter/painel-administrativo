import { Component } from '@angular/core';
import { PessoasService } from 'src/pessoasService/pessoas.service';

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

}
