import { Component, input, computed } from '@angular/core';
import {
  Diagram,
  GroupNode,
  Link,
  Node,
  Port,
} from '../../../../graph-core';
import { GraphGroupNodeComponent } from './graph-group-node.component';

/**
 * Wrapper for GraphGroupNodeComponent stories. Builds a GroupNode with child nodes and link.
 */
@Component({
  selector: 'app-graph-group-node-story-wrapper',
  standalone: true,
  imports: [GraphGroupNodeComponent],
  template: `
    <svg width="800" height="600" viewBox="0 0 800 600">
      <g
        app-graph-group-node
        [node]="groupNode()"
        [diagram]="diagram()"
        [renderTick]="renderTick()"
        [selected]="selected()"
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
export class GraphGroupNodeStoryWrapperComponent {
  readonly selected = input<boolean>(false);
  readonly renderTick = input<number>(0);
  readonly showPlaceholder = input<boolean>(false);

  protected readonly groupNode = computed(() => {
    const n1 = new Node({
      id: 'c1',
      x: 20,
      y: 40,
      width: 80,
      height: 40,
      label: 'A',
      ports: [
        new Port({ id: 'c1-out', nodeId: 'c1', side: 'right', offset: 20, type: 'output' }),
      ],
    });
    const n2 = new Node({
      id: 'c2',
      x: 140,
      y: 40,
      width: 80,
      height: 40,
      label: 'B',
      ports: [
        new Port({ id: 'c2-in', nodeId: 'c2', side: 'left', offset: 20, type: 'input' }),
      ],
    });
    const link = new Link({
      id: 'l1',
      sourcePortId: 'c1-out',
      targetPortId: 'c2-in',
    });
    const group = new GroupNode({
      id: 'g1',
      x: 100,
      y: 100,
      width: 280,
      height: 200,
      label: 'Group',
      childNodeIds: ['c1', 'c2'],
      childLinkIds: ['l1'],
      childNodes: [n1, n2],
      childLinks: [link],
      originalPositions: new Map([
        ['c1', { x: 20, y: 40 }],
        ['c2', { x: 140, y: 40 }],
      ]),
    });
    group.addPort(
      new Port({ id: 'g1-ext-c1-out', nodeId: 'g1', side: 'left', offset: 50, type: 'output' })
    );
    group.addPort(
      new Port({ id: 'g1-ext-c2-in', nodeId: 'g1', side: 'right', offset: 50, type: 'input' })
    );
    group.updateScale();
    if (this.showPlaceholder()) {
      group.scale = 0.1;
    }
    return group;
  });

  protected readonly diagram = computed(() => {
    const d = new Diagram();
    d.addNode(this.groupNode());
    return d;
  });
}
