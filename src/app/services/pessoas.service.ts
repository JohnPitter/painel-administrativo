import { Injectable } from "@angular/core";
import { NumericValueAccessor } from "@ionic/angular";

@Injectable({
  providedIn: "root",
})
export class PessoasService {
  listaPessoas = [
    {
      nome: "Maria Nunes",
      cargo: "Senior Developer",
      idade: "21",
      lvl: "10",
      img: "https://picsum.photos/200/200",
      dataEntrada: "01/02/2020",
      funcao: "Diretoria",
      tech: "Java",
    },
    {
      nome: "Thiago Genro",
      cargo: "Júnior Developer",
      idade: "23",
      lvl: "12",
      img: "https://picsum.photos/200/200",
      dataEntrada: "01/02/2020",
      funcao: "Dev",
      tech: "Angular",
    },
    {
      nome: "Rebeca Gomes",
      cargo: "Trainee",
      idade: "18",
      lvl: "14",
      img: "https://picsum.photos/200/200",
      dataEntrada: "01/02/2020",
      funcao: "Marketing",
      tech: "JavaScript",
    },
    {
      nome: "Junior Fernando",
      cargo: "Trainee",
      idade: "21",
      lvl: "14",
      img: "https://picsum.photos/200/200",
      dataEntrada: "01/02/2020",
      funcao: "Pessoal",
      tech: "Angular",
    },
    {
      nome: "Junior Fernando",
      cargo: "Trainee",
      idade: "21",
      lvl: "14",
      img: "https://picsum.photos/200/200",
      dataEntrada: "01/02/2020",
      funcao: "Pessoal",
      tech: "Angular",
    },
    {
      nome: "Junior Fernando",
      cargo: "Trainee",
      idade: "21",
      lvl: "14",
      img: "https://picsum.photos/200/200",
      dataEntrada: "01/02/2020",
      funcao: "Pessoal",
      tech: "Angular",
    },
    {
      nome: "Junior Fernando",
      cargo: "Trainee",
      idade: "21",
      lvl: "14",
      img: "https://picsum.photos/200/200",
      dataEntrada: "01/02/2020",
      funcao: "Pessoal",
      tech: "Angular",
    },
  ];

  storyPoints = [
    {
      ano: "2019",
      jan: "25",
      fev: "12",
      mar: "50",
      abr: "70",
      mai: "34",
      jun: "50",
      jul: "60",
      ago: "45",
      set: "67",
      out: "54",
      nov: "37",
      dez: "40",
    },
  ];

  constructor() {}
}
