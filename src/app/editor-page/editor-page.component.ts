import { Component, computed, inject } from '@angular/core';
import { GraphEditorComponent } from '../features/graph-editor/graph-editor.component';
import {
  GRAPH_EDITOR_CONFIG,
  mergeWithDefaults,
} from '../features/graph-editor/config/graph-editor-config';

/** Demo page: graph editor with toolbar visible. */
@Component({
  selector: 'app-editor-page',
  standalone: true,
  imports: [GraphEditorComponent],
  providers: [
    {
      provide: GRAPH_EDITOR_CONFIG,
      useFactory: () => inject(EditorPageComponent).effectiveConfig,
    },
  ],
  template: `
    <app-graph-editor [config]="demoConfig" />
  `,
})
export class EditorPageComponent {
  readonly demoConfig = { toolbar: { visible: true } };

  readonly effectiveConfig = computed(() => mergeWithDefaults(this.demoConfig));
}
