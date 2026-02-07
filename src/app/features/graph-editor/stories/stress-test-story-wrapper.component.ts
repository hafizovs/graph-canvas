import { Component, input, computed } from '@angular/core';
import { createStressTestDiagram } from '../../../../graph-core';
import { GraphEditorComponent } from '../graph-editor.component';
import { StressPerformanceOverlayComponent } from './stress-performance-overlay.component';

@Component({
  selector: 'app-stress-test-story-wrapper',
  standalone: true,
  imports: [GraphEditorComponent, StressPerformanceOverlayComponent],
  template: `
    <div class="wrapper">
      <app-graph-editor [config]="editorConfig()" />
      <app-stress-performance-overlay [metrics]="metrics()" />
    </div>
  `,
  styles: [
    `
      .wrapper {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 400px;
      }
    `,
  ],
})
export class StressTestStoryWrapperComponent {
  readonly nodeCount = input.required<number>();

  protected readonly result = computed(() => {
    const n = this.nodeCount();
    return createStressTestDiagram(n, { logToConsole: true });
  });

  protected readonly editorConfig = computed(() => ({
    toolbar: { visible: true } as const,
    palette: { visible: false } as const,
    initialDiagram: this.result().diagram,
  }));

  protected readonly metrics = computed(() => this.result().metrics);
}
