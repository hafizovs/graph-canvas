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

/** Emitted on node body context menu (right-click). Used for rotate menu. */
export interface NodeContextMenuEvent {
  node: Node;
  event: MouseEvent;
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
    '(contextmenu)': 'onNodeContextMenu($event)',
  },
  templateUrl: './graph-node.component.html',
  styleUrl: './graph-node.component.scss',
})
export class GraphNodeComponent {
  readonly node = input.required<Node>();
  /** When diagram is mutated in place (e.g. rotation), bump this so transform recomputes. */
  readonly renderTick = input<number>(0);
  readonly selected = input<boolean>(false);

  readonly nodePointerDown = output<NodePointerEvent>();
  readonly nodePointerMove = output<NodePointerEvent>();
  readonly nodePointerUp = output<NodePointerEvent>();
  readonly nodeContextMenu = output<NodeContextMenuEvent>();
  readonly portPointerDown = output<PortPointerEvent>();

  /** SVG transform: translate to node center, rotate, translate back so content rotates around center. */
  protected readonly transformValue = computed(() => {
    this.renderTick(); // depend on tick so in-place mutations (e.g. rotation) trigger re-render
    const n = this.node();
    const cx = n.x + n.width / 2;
    const cy = n.y + n.height / 2;
    const angle = n.rotation ?? 0;
    return `translate(${cx},${cy}) rotate(${angle}) translate(${-n.width / 2},${-n.height / 2})`;
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

  /** Emit nodeContextMenu if target is not a port (so parent can show rotate menu). */
  protected onNodeContextMenu(event: MouseEvent): void {
    if ((event.target as Element).closest('[data-port-id]')) return;
    event.preventDefault();
    event.stopPropagation();
    this.nodeContextMenu.emit({ node: this.node(), event });
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

  protected getDiamondPoints(): string {
    const w = this.node().width;
    const h = this.node().height;
    return `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
  }

  protected getTrianglePoints(): string {
    const w = this.node().width;
    const h = this.node().height;
    return `${w / 2},0 ${w},${h} 0,${h}`;
  }

  protected getHexagonPoints(): string {
    const w = this.node().width;
    const h = this.node().height;
    return `${w / 2},0 ${w},${h / 4} ${w},${(3 * h) / 4} ${w / 2},${h} 0,${(3 * h) / 4} 0,${h / 4}`;
  }

  protected getParallelogramPoints(): string {
    const w = this.node().width;
    const h = this.node().height;
    const s = w * 0.2;
    return `${s},0 ${w},0 ${w - s},${h} 0,${h}`;
  }

  protected getPentagonPoints(): string {
    const w = this.node().width;
    const h = this.node().height;
    return `${w / 2},0 ${w},${h * 0.4} ${w * 0.8},${h} ${w * 0.2},${h} 0,${h * 0.4}`;
  }

  protected getCrossPath(): string {
    const w = this.node().width;
    const h = this.node().height;
    const vx1 = w * 0.4;
    const vx2 = w * 0.6;
    const hy1 = h * 0.4;
    const hy2 = h * 0.6;
    return `M ${vx1} 0 L ${vx2} 0 L ${vx2} ${h} L ${vx1} ${h} Z M 0 ${hy1} L ${w} ${hy1} L ${w} ${hy2} L 0 ${hy2} Z`;
  }

  protected getCustomShapeHref(): string {
    const id = this.node().customShapeId;
    return id != null ? `/assets/${id}` : '';
  }
}
