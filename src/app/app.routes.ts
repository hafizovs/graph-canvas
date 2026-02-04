import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./editor-page/editor-page.component').then((m) => m.EditorPageComponent),
  },
];
