import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  computed,
  signal,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import type { Diagram, Link, PointLike } from '../../../../graph-core';
import { GraphLinkGeometryService } from '../services/graph-link-geometry.service';

export interface WaypointPointerPayload {
  link: Link;
  pointIndex: number;
  event: PointerEvent;
}

export interface PathPointerPayload {
  link: Link;
  event: PointerEvent;
}

export interface SegmentMidpointPayload {
  link: Link;
  insertIndex: number;
  x: number;
  y: number;
  event: PointerEvent;
}

/** Presentational component for one graph link. Renders SVG path; supports preview, waypoint handles, path hit area. */
@Component({
  selector: 'g[app-graph-link]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './graph-link.component.html',
  styleUrl: './graph-link.component.scss',
})
export class GraphLinkComponent {
  private readonly linkGeometry = inject(GraphLinkGeometryService);

  readonly link = input.required<Link>();
  readonly diagram = input.required<Diagram>();
  readonly previewTarget = input<PointLike | null>(null);
  /** When diagram is mutated in place (e.g. node rotation), bump so path recomputes. */
  readonly renderTick = input<number>(0);
  readonly selected = input<boolean>(false);
  /** Which waypoint index is selected (for this link); null if none. */
  readonly selectedWaypointIndex = input<number | null>(null);

  /** True when the pointer is over the link (path or handles). */
  protected readonly hovered = signal(false);

  readonly linkClick = output<{ link: Link; shiftKey: boolean }>();
  readonly waypointPointerDown = output<WaypointPointerPayload>();
  readonly pathPointerDown = output<PathPointerPayload>();
  readonly segmentMidpointPointerDown = output<SegmentMidpointPayload>();
  readonly waypointDoubleClick = output<{ link: Link; pointIndex: number }>();
  readonly linkContextMenu = output<{ link: Link; event: MouseEvent }>();

  protected readonly pathD = computed(() => {
    this.renderTick(); // depend on tick so port positions (e.g. after node rotation) update
    const linkVal = this.link();
    const diagramVal = this.diagram();
    const target = this.previewTarget();

    if (target) {
      const source = diagramVal.getPortPosition(linkVal.sourcePortId);
      if (!source) return '';
      return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
    }

    return linkVal.buildPath(diagramVal);
  });

  /**
   * Waypoint display: for straight routing = link.points with their index;
   * for orthogonal = expanded path inner points, with pointIndex when the point is in link.points (selectable/removable).
   */
  protected readonly displayWaypoints = computed(() => {
    this.renderTick();
    const linkVal = this.link();
    const diagramVal = this.diagram();
    if (this.previewTarget()) return [];
    if (linkVal.routing === 'orthogonal') {
      const expanded = this.linkGeometry.getPathPoints(linkVal, diagramVal);
      if (expanded.length < 3) return [];
      const inner = expanded.slice(1, -1);
      return inner.map((pt) => {
        const idx = linkVal.points.findIndex((p) => p.x === pt.x && p.y === pt.y);
        return { x: pt.x, y: pt.y, pointIndex: idx >= 0 ? idx : null };
      });
    }
    return linkVal.points.map((p, i) => ({ x: p.x, y: p.y, pointIndex: i }));
  });

  /** Midpoints for each segment. For orthogonal uses expanded path so positions match the visible path. */
  protected readonly segmentMidpoints = computed(() => {
    this.renderTick();
    const linkVal = this.link();
    const diagramVal = this.diagram();
    if (this.previewTarget()) return [];
    const source = diagramVal.getPortPosition(linkVal.sourcePortId);
    const target = diagramVal.getPortPosition(linkVal.targetPortId);
    if (!source || !target) return [];
    const pts =
      linkVal.routing === 'orthogonal'
        ? this.linkGeometry.getPathPoints(linkVal, diagramVal)
        : [source, ...linkVal.points, target];
    const result: Array<{ segmentIndex: number; insertIndex: number; x: number; y: number }> = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const pointInsertIndex =
        linkVal.routing === 'orthogonal'
          ? this.linkGeometry.segmentToPointInsertIndex(linkVal, diagramVal, i)
          : i;
      result.push({
        segmentIndex: i,
        insertIndex: pointInsertIndex,
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      });
    }
    return result;
  });

  /** Emit linkClick with link and shiftKey for selection. */
  protected onLinkClick(event: MouseEvent): void {
    event.stopPropagation();
    this.linkClick.emit({ link: this.link(), shiftKey: event.shiftKey });
  }

  /** Emit pathPointerDown for segment grab (add waypoint). */
  protected onPathPointerDown(event: PointerEvent): void {
    event.stopPropagation();
    this.pathPointerDown.emit({ link: this.link(), event });
  }

  /** Emit waypointPointerDown for waypoint drag; on corner (pointIndex null) only stop propagation. */
  protected onWaypointHitPointerDown(
    event: PointerEvent,
    item: { x: number; y: number; pointIndex: number | null }
  ): void {
    event.stopPropagation();
    if (item.pointIndex !== null) {
      this.waypointPointerDown.emit({ link: this.link(), pointIndex: item.pointIndex, event });
    }
  }

  /** Emit waypointPointerDown for waypoint drag. */
  protected onWaypointPointerDown(event: PointerEvent, index: number): void {
    event.stopPropagation();
    this.waypointPointerDown.emit({ link: this.link(), pointIndex: index, event });
  }

  /** Emit waypointDoubleClick for remove waypoint. */
  protected onWaypointDoubleClick(index: number): void {
    this.waypointDoubleClick.emit({ link: this.link(), pointIndex: index });
  }

  /** Right-click on waypoint or corner: prevent default; remove waypoint only if pointIndex set. */
  protected onWaypointHitContextMenu(
    event: MouseEvent,
    item: { x: number; y: number; pointIndex: number | null }
  ): void {
    event.preventDefault();
    event.stopPropagation();
    if (item.pointIndex !== null) {
      this.waypointDoubleClick.emit({ link: this.link(), pointIndex: item.pointIndex });
    }
  }

  /** Right-click on waypoint: remove. */
  protected onWaypointContextMenu(event: MouseEvent, index: number): void {
    event.preventDefault();
    this.waypointDoubleClick.emit({ link: this.link(), pointIndex: index });
  }

  /** Right-click on link path: emit for context menu (e.g. Clear waypoints). */
  protected onLinkContextMenu(event: MouseEvent): void {
    this.linkContextMenu.emit({ link: this.link(), event });
  }

  /** Emit segmentMidpointPointerDown when grabbing a segment midpoint to add waypoint. */
  protected onSegmentMidpointPointerDown(
    event: PointerEvent,
    seg: { segmentIndex: number; insertIndex: number; x: number; y: number }
  ): void {
    event.stopPropagation();
    this.segmentMidpointPointerDown.emit({
      link: this.link(),
      insertIndex: seg.insertIndex,
      x: seg.x,
      y: seg.y,
      event,
    });
  }
}
