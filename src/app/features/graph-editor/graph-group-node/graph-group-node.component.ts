import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import type { GroupNode, Port, Diagram, Link, Node } from '../../../../graph-core';
import type { NodeShape } from '../../../../graph-core';

/** Emitted when user interacts with the group node body. */
export interface GroupNodePointerEvent {
  node: GroupNode;
  event: PointerEvent;
  shiftKey: boolean;
}

/** Emitted when user pointer-downs on a port. */
export interface GroupPortPointerEvent {
  port: Port;
  node: GroupNode;
  event: PointerEvent;
}

/** Emitted on group node context menu (right-click). */
export interface GroupNodeContextMenuEvent {
  node: GroupNode;
  event: MouseEvent;
}

/** Emitted when user starts resizing the group. */
export interface ResizeHandlePointerEvent {
  node: GroupNode;
  handle: ResizeHandle;
  event: PointerEvent;
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Presentational component for a group node. Renders container, preview, ports, and resize handles. */
@Component({
  selector: 'g[app-graph-group-node]',
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
  templateUrl: './graph-group-node.component.html',
  styleUrl: './graph-group-node.component.scss',
})
export class GraphGroupNodeComponent {
  readonly node = input.required<GroupNode>();
  readonly diagram = input.required<Diagram>();
  readonly renderTick = input<number>(0);
  readonly selected = input<boolean>(false);

  readonly nodePointerDown = output<GroupNodePointerEvent>();
  readonly nodePointerMove = output<GroupNodePointerEvent>();
  readonly nodePointerUp = output<GroupNodePointerEvent>();
  readonly nodeContextMenu = output<GroupNodeContextMenuEvent>();
  readonly portPointerDown = output<GroupPortPointerEvent>();
  readonly resizeHandlePointerDown = output<ResizeHandlePointerEvent>();

  /** SVG transform: translate to node position (groups don't rotate). */
  protected readonly transformValue = computed(() => {
    this.renderTick();
    const n = this.node();
    return `translate(${n.x},${n.y})`;
  });

  /** Emit nodePointerDown if target is not a port or resize handle. */
  protected onNodePointerDown(event: PointerEvent): void {
    const target = event.target as Element;
    if (target.closest('[data-port-id]') || target.closest('[data-resize-handle]')) {
      return;
    }
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

  /** Emit nodeContextMenu if target is not a port or resize handle. */
  protected onNodeContextMenu(event: MouseEvent): void {
    const target = event.target as Element;
    if (target.closest('[data-port-id]') || target.closest('[data-resize-handle]')) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.nodeContextMenu.emit({ node: this.node(), event });
  }

  /** Emit portPointerDown and stop propagation. */
  protected onPortPointerDown(port: Port, event: PointerEvent): void {
    event.stopPropagation();
    this.portPointerDown.emit({ port, node: this.node(), event });
  }

  /** Emit resizeHandlePointerDown and stop propagation. */
  protected onResizeHandlePointerDown(handle: ResizeHandle, event: PointerEvent): void {
    event.stopPropagation();
    this.resizeHandlePointerDown.emit({ node: this.node(), handle, event });
  }

  /** Port position relative to node origin (for template). */
  protected getPortPosition(port: Port): { x: number; y: number } {
    const node = this.node();
    const pos = port.getAbsolutePosition(node.getRect());
    return { x: pos.x - node.x, y: pos.y - node.y };
  }

  /** Get resize handle positions. */
  protected getResizeHandles(): Array<{ handle: ResizeHandle; x: number; y: number; cursor: string }> {
    const n = this.node();
    const w = n.width;
    const h = n.height;
    const handleSize = 8;

    return [
      { handle: 'nw', x: -handleSize / 2, y: -handleSize / 2, cursor: 'nwse-resize' },
      { handle: 'n', x: w / 2 - handleSize / 2, y: -handleSize / 2, cursor: 'ns-resize' },
      { handle: 'ne', x: w - handleSize / 2, y: -handleSize / 2, cursor: 'nesw-resize' },
      { handle: 'e', x: w - handleSize / 2, y: h / 2 - handleSize / 2, cursor: 'ew-resize' },
      { handle: 'se', x: w - handleSize / 2, y: h - handleSize / 2, cursor: 'nwse-resize' },
      { handle: 's', x: w / 2 - handleSize / 2, y: h - handleSize / 2, cursor: 'ns-resize' },
      { handle: 'sw', x: -handleSize / 2, y: h - handleSize / 2, cursor: 'nesw-resize' },
      { handle: 'w', x: -handleSize / 2, y: h / 2 - handleSize / 2, cursor: 'ew-resize' },
    ];
  }

  /** Get child nodes for preview rendering. */
  protected getChildNodes(): Node[] {
    return this.node().getStoredChildNodes();
  }

  /** Get child links for preview rendering (internal links only). */
  protected getChildLinks(): Link[] {
    return this.node().getStoredChildLinks();
  }

  /** Build SVG path d for a link in preview (content coordinates). */
  protected getLinkPathD(link: Link): string {
    const groupNode = this.node();
    const children = groupNode.getStoredChildNodes();
    const getPortPos = (portId: string): { x: number; y: number } | null => {
      for (const n of children) {
        const port = n.getPort(portId);
        if (!port) continue;
        const pos = groupNode.getOriginalPosition(n.id) ?? { x: n.x, y: n.y };
        const rect = { x: pos.x, y: pos.y, width: n.width, height: n.height };
        const p = port.getAbsolutePosition(rect);
        return { x: p.x, y: p.y };
      }
      return null;
    };
    const source = getPortPos(link.sourcePortId);
    const target = getPortPos(link.targetPortId);
    if (!source || !target) return '';

    const pts: Array<{ x: number; y: number }> = [source];
    for (const p of link.points) {
      pts.push({ x: p.x, y: p.y });
    }
    pts.push(target);

    const parts = [`M ${pts[0].x} ${pts[0].y}`];
    for (let i = 1; i < pts.length; i++) {
      parts.push(`L ${pts[i].x} ${pts[i].y}`);
    }
    return parts.join(' ');
  }

  /** Shape points/path for preview node (same logic as graph-node). */
  protected getPreviewShapePoints(shape: NodeShape, w: number, h: number): string {
    switch (shape) {
      case 'diamond':
        return `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
      case 'triangle':
        return `${w / 2},0 ${w},${h} 0,${h}`;
      case 'hexagon':
        return `${w / 2},0 ${w},${h / 4} ${w},${(3 * h) / 4} ${w / 2},${h} 0,${(3 * h) / 4} 0,${h / 4}`;
      case 'parallelogram': {
        const s = w * 0.2;
        return `${s},0 ${w},0 ${w - s},${h} 0,${h}`;
      }
      case 'pentagon':
        return `${w / 2},0 ${w},${h * 0.4} ${w * 0.8},${h} ${w * 0.2},${h} 0,${h * 0.4}`;
      default:
        return '';
    }
  }

  protected getPreviewShapePath(shape: NodeShape, w: number, h: number): string {
    if (shape !== 'cross') return '';
    const vx1 = w * 0.4;
    const vx2 = w * 0.6;
    const hy1 = h * 0.4;
    const hy2 = h * 0.6;
    return `M ${vx1} 0 L ${vx2} 0 L ${vx2} ${h} L ${vx1} ${h} Z M 0 ${hy1} L ${w} ${hy1} L ${w} ${hy2} L 0 ${hy2} Z`;
  }

  /** Preview area: padding and vertical space for label. */
  private static readonly PREVIEW_PADDING = 20;
  private static readonly PREVIEW_TOP = 30;
  private static readonly PREVIEW_BOTTOM = 50;

  /** Calculate preview transform: fit full bounds, centered in preview area. */
  protected getPreviewTransform(): string {
    const groupNode = this.node();
    const bounds = groupNode.getBounds();
    const scale = groupNode.scale;
    const p = GraphGroupNodeComponent.PREVIEW_PADDING;
    const top = GraphGroupNodeComponent.PREVIEW_TOP;
    const availableWidth = groupNode.width - 2 * p;
    const availableHeight = groupNode.height - GraphGroupNodeComponent.PREVIEW_BOTTOM - top;

    // Center scaled content in preview area
    const offsetX = p + (availableWidth - bounds.width * scale) / 2 - bounds.x * scale;
    const offsetY = top + (availableHeight - bounds.height * scale) / 2 - bounds.y * scale;

    return `translate(${offsetX}, ${offsetY}) scale(${scale})`;
  }

  /** Whether to show generic placeholder instead of detailed preview (scale too small). */
  protected showPlaceholder(): boolean {
    return this.node().shouldShowPlaceholder();
  }

  /** Get label for external port (shows original port info). */
  protected getPortLabel(port: Port): string {
    // Extract label from port ID (e.g., "g1-ext-n2-out" -> "n2-out")
    const parts = port.id.split('-ext-');
    if (parts.length > 1) {
      return parts[1];
    }
    return port.id;
  }
}
