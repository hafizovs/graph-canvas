import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/graph-editor/graph-editor.component').then(
        (m) => m.GraphEditorComponent
      ),
  },
];
