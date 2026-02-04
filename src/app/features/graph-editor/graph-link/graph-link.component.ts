import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import type { Diagram, Link, PointLike } from '../../../../graph-core';

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
  readonly link = input.required<Link>();
  readonly diagram = input.required<Diagram>();
  readonly previewTarget = input<PointLike | null>(null);
  /** When diagram is mutated in place (e.g. node rotation), bump so path recomputes. */
  readonly renderTick = input<number>(0);
  readonly selected = input<boolean>(false);

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

  protected readonly waypoints = computed(() => this.link().points);

  /** Midpoints for each segment (source–p0, p0–p1, …, pn–target). insertIndex = where to insert new waypoint. */
  protected readonly segmentMidpoints = computed(() => {
    this.renderTick();
    const linkVal = this.link();
    const diagramVal = this.diagram();
    if (this.previewTarget()) return [];
    const source = diagramVal.getPortPosition(linkVal.sourcePortId);
    const target = diagramVal.getPortPosition(linkVal.targetPortId);
    if (!source || !target) return [];
    const pts = [source, ...linkVal.points, target];
    const result: Array<{ insertIndex: number; x: number; y: number }> = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      result.push({
        insertIndex: i,
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

  /** Emit waypointPointerDown for waypoint drag. */
  protected onWaypointPointerDown(event: PointerEvent, index: number): void {
    event.stopPropagation();
    this.waypointPointerDown.emit({ link: this.link(), pointIndex: index, event });
  }

  /** Emit waypointDoubleClick for remove waypoint. */
  protected onWaypointDoubleClick(index: number): void {
    this.waypointDoubleClick.emit({ link: this.link(), pointIndex: index });
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
  protected onSegmentMidpointPointerDown(event: PointerEvent, seg: { insertIndex: number; x: number; y: number }): void {
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
