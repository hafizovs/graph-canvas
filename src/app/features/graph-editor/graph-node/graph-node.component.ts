import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import type { Node, Port } from '../../../../graph-core';

/** Emitted when user interacts with the node body (not a port). Used for drag and click selection. */
export interface NodePointerEvent {
  node: Node;
  event: PointerEvent;
  shiftKey: boolean;
}

/** Emitted when user pointer-downs on a port. Used to start link drag from output port. */
export interface PortPointerEvent {
  port: Port;
  node: Node;
  event: PointerEvent;
}

/** Presentational component for one graph node. Renders label and ports; delegates pointer events to parent. */
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

  /** SVG transform string: translate(node.x, node.y). */
  protected readonly transformValue = computed(() => {
    const n = this.node();
    return `translate(${n.x},${n.y})`;
  });

  /** Emit nodePointerDown if target is not a port. */
  protected onNodePointerDown(event: PointerEvent): void {
    if ((event.target as Element).closest('[data-port-id]')) return;
    this.nodePointerDown.emit({ node: this.node(), event, shiftKey: event.shiftKey });
  }

  /** Forward pointer move to parent (for drag). */
  protected onNodePointerMove(event: PointerEvent): void {
    this.nodePointerMove.emit({ node: this.node(), event, shiftKey: event.shiftKey });
  }

  /** Forward pointer up to parent (end drag or apply click selection). */
  protected onNodePointerUp(event: PointerEvent): void {
    this.nodePointerUp.emit({ node: this.node(), event, shiftKey: event.shiftKey });
  }

  /** Emit portPointerDown and stop propagation (start link from output). */
  protected onPortPointerDown(port: Port, event: PointerEvent): void {
    event.stopPropagation();
    this.portPointerDown.emit({ port, node: this.node(), event });
  }

  /** Port position relative to node origin (for template). */
  protected getPortPosition(port: Port): { x: number; y: number } {
    const node = this.node();
    const pos = port.getAbsolutePosition(node.getRect());
    return { x: pos.x - node.x, y: pos.y - node.y };
  }
}
