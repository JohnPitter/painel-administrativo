import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})

export class PessoasService {

  listaPessoas = [{
    nome: "Maria Nunes",
    cargo: "Senior Developer",
    idade: "21",
    lvl: "10",
    img: "https://picsum.photos/200/200",
    dataEntrada: "01/02/2020",
    funcao: "Diretoria",
    tech: "Java"
  }, {
    nome: "Thiago Genro",
    cargo: "Júnior Developer",
    idade: "23",
    lvl: "12",
    img: "https://picsum.photos/200/200",
    dataEntrada: "01/02/2020",
    funcao: "Dev",
    tech: "Angular"
  }, {
    nome: "Rebeca Gomes",
    cargo: "Trainee",
    idade: "18",
    lvl: "14",
    img: "https://picsum.photos/200/200",
    dataEntrada: "01/02/2020",
    funcao: "Marketing",
    tech: "JavaScript"
  }, {
    nome: "Junior Fernando",
    cargo: "Trainee",
    idade: "21",
    lvl: "14",
    img: "https://picsum.photos/200/200",
    dataEntrada: "01/02/2020",
    funcao: "Pessoal",
    tech: "Angular"
  }];

  constructor() { }
}
