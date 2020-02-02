import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'home',
        children: [
          {
            path: '',
            loadChildren: () =>
              import('../home/home.module').then(m => m.HomePageModule)
          }
        ]
      },
      {
        path: 'pessoas',
        children: [
          {
            path: '',
            loadChildren: () =>
              import('../pessoas/pessoas.module').then(m => m.PessoasPageModule)
          }
        ]
      },
      {
        path: 'levels',
        children: [
          {
            path: '',
            loadChildren: () =>
              import('../levels/levels.module').then(m => m.LevelsPageModule)
          }
        ]
      },
      {
        path: 'trilha',
        children: [
          {
            path: '',
            loadChildren: () =>
              import('../trilha/trilha.module').then(m => m.TrilhaPageModule)
          }
        ]
      },
      {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: '/tabs/home',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})

export class TabsPageRoutingModule {}
