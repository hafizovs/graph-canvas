import { Component, input, computed } from '@angular/core';
import { Node, Port } from '../../../../graph-core';
import type { NodeShape } from '../../../../graph-core';
import { GraphNodeComponent } from './graph-node.component';

/**
 * Wrapper for GraphNodeComponent stories. Builds a Node instance (with ports) so it can be
 * passed to the presentation component inside an SVG.
 */
@Component({
  selector: 'app-graph-node-story-wrapper',
  standalone: true,
  imports: [GraphNodeComponent],
  template: `
    <svg width="800" height="600" viewBox="0 0 800 600">
      <g
        app-graph-node
        [node]="node()"
        [renderTick]="renderTick()"
        [selected]="selected()"
        (nodePointerDown)="onNodePointerDown($event)"
        (nodePointerMove)="onNodePointerMove($event)"
        (nodePointerUp)="onNodePointerUp($event)"
        (nodeContextMenu)="onNodeContextMenu($event)"
        (portPointerDown)="onPortPointerDown($event)"
      />
    </svg>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      svg {
        border: 1px solid #ccc;
      }
    `,
  ],
})
export class GraphNodeStoryWrapperComponent {
  readonly shape = input<NodeShape>('rectangle');
  readonly selected = input<boolean>(false);
  readonly renderTick = input<number>(0);
  readonly label = input<string>('Node');
  readonly customShapeId = input<string | undefined>(undefined);

  private readonly ports: Port[] = [
    new Port({ id: 'p-in', nodeId: 'n1', side: 'left', offset: 30, type: 'input' }),
    new Port({ id: 'p-out', nodeId: 'n1', side: 'right', offset: 30, type: 'output' }),
  ];

  protected readonly node = computed(() => {
    const shape = this.shape();
    return new Node({
      id: 'n1',
      x: 100,
      y: 100,
      width: 120,
      height: 60,
      label: this.label(),
      shape,
      customShapeId: shape === 'custom' ? this.customShapeId() ?? 'shapes/star.svg' : undefined,
      ports: this.ports,
    });
  });

  onNodePointerDown(_e: unknown): void {}
  onNodePointerMove(_e: unknown): void {}
  onNodePointerUp(_e: unknown): void {}
  onNodeContextMenu(_e: unknown): void {}
  onPortPointerDown(_e: unknown): void {}
}
