import { Component, ViewChild } from '@angular/core';
import { NavController } from '@ionic/angular';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss']
})

export class HomePage {

  @ViewChild('barCanvas', { static: true }) barCanvas;
  @ViewChild('lineCanvas', { static: true }) lineCanvas;
  @ViewChild('pieCanvas', { static: true }) pieCanvas;
  @ViewChild('doughnutCanvas', { static: true }) doughnutCanvas;

  barChart: any;
  lineChart: any;
  pieChart: any;
  doughnutChart: any;

  constructor(public navCtrl: NavController) { }

  ngAfterViewInit() {
    setTimeout(() => {
      this.barChart = this.getBarChart();
      this.lineChart = this.getLineChart();
    }, 150)
    setTimeout(() => {
      this.pieChart = this.getPieChart();
      this.doughnutChart = this.getDoughnutChart();
    }, 250)
  }

  getChart(context, chartType, data, options?) {
    return new Chart(context, {
      data,
      options,
      type: chartType
    })
  }


  getBarChart() {
    const data = {
      labels: ['Diretoria', 'Desenvolvedores', 'Marketing', 'Pessoal'],
      datasets: [{
        label: 'Número de membros',
        data: [5, 5, 1, 1],
        backgroundColor: [
          'rgb(255, 0, 0)',
          'rgb(20, 0, 255)',
          'rgb(255, 230, 0)',
          'rgb(0, 255, 10)'
        ],
        borderWidth: 1
      }]
    };

    const options = {
      scales: {
        yAxes: [{
          ticks: {
            beginAtZero: true
          }
        }]
      }
    }

    return this.getChart(this.barCanvas.nativeElement, 'bar', data, options);
  }

  getLineChart() {
    const data = {
      labels: ['Primeiro Semestre', 'Segundo Semestre'],
      datasets: [{
        label: 'Scrum Points - 1S',
        fill: false,
        lineTension: 0.1,
        backgroundColor: 'rgb(0, 178, 255)',
        borderColor: 'rgb(231, 205, 35)',
        borderCapStyle: 'butt',
        borderJoinStyle: 'miter',
        pointRadius: 1,
        pointHitRadius: 10,
        data: [30, 50, 25, 10, 25, 12],
        scanGaps: false,
      }, {
        label: 'Scrum Points - 2S',
        fill: false,
        lineTension: 0.1,
        backgroundColor: 'rgb(117, 0, 49)',
        borderColor: 'rgb(51, 50, 46)',
        borderCapStyle: 'butt',
        borderJoinStyle: 'miter',
        pointRadius: 1,
        pointHitRadius: 10,
        data: [29, 135, 50, 70, 25, 12],
        scanGaps: false,
      }
      ]
    }

    return this.getChart(this.lineCanvas.nativeElement, 'line', data)
  }

  getPieChart() {
    const data = {
      labels: ['Senior', 'Júnior', 'Trainee'],
      datasets: [{
        data: [5, 2, 1],
        backgroundColor: ['rgb(200, 6, 0)', 'rgb(36, 0, 255)', 'rgb(242, 255, 0)']
      }]
    }

    return this.getChart(this.pieCanvas.nativeElement, 'pie', data);
  }

  getDoughnutChart() {
    const data = {
      labels: ['Java', 'Angular', 'JavaScript'],
      datasets: [{
        label: 'Teste Chart',
        data: [10, 7, 7],
        backgroundColor: [
          'rgb(0, 244, 97)',
          'rgb(37, 39, 43)',
          'rgb(255, 207, 0)'
        ]
      }]
    }

    return this.getChart(this.doughnutCanvas.nativeElement, 'doughnut', data);
  }

}