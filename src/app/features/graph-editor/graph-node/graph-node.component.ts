import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import type { Node, Port } from '../../../../graph-core';

export interface NodePointerEvent {
  node: Node;
  event: PointerEvent;
}

export interface PortPointerEvent {
  port: Port;
  node: Node;
  event: PointerEvent;
}

@Component({
  selector: 'g[app-graph-node]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [NO_ERRORS_SCHEMA],
  host: {
    '[attr.transform]': 'transformValue()',
    '(pointerdown)': 'onNodePointerDown($event)',
    '(pointermove)': 'onNodePointerMove($event)',
    '(pointerup)': 'onNodePointerUp($event)',
    '(pointerleave)': 'onNodePointerUp($event)',
  },
  templateUrl: './graph-node.component.html',
  styleUrl: './graph-node.component.scss',
})
export class GraphNodeComponent {
  readonly node = input.required<Node>();
  readonly selected = input<boolean>(false);

  readonly nodePointerDown = output<NodePointerEvent>();
  readonly nodePointerMove = output<NodePointerEvent>();
  readonly nodePointerUp = output<NodePointerEvent>();
  readonly portPointerDown = output<PortPointerEvent>();

  protected readonly transformValue = computed(() => {
    const n = this.node();
    return `translate(${n.x},${n.y})`;
  });

  protected onNodePointerDown(event: PointerEvent): void {
    if ((event.target as Element).closest('[data-port-id]')) return;
    this.nodePointerDown.emit({ node: this.node(), event });
  }

  protected onNodePointerMove(event: PointerEvent): void {
    this.nodePointerMove.emit({ node: this.node(), event });
  }

  protected onNodePointerUp(event: PointerEvent): void {
    this.nodePointerUp.emit({ node: this.node(), event });
  }

  protected onPortPointerDown(port: Port, event: PointerEvent): void {
    event.stopPropagation();
    this.portPointerDown.emit({ port, node: this.node(), event });
  }

  protected getPortPosition(port: Port): { x: number; y: number } {
    const node = this.node();
    const pos = port.getAbsolutePosition(node.getRect());
    return { x: pos.x - node.x, y: pos.y - node.y };
  }
}
