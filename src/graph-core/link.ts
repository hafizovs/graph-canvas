import { Point } from './point';
import type { LinkId, PortId } from './types';
import type { Diagram } from './diagram';

/** Routing style for links: straight (free angles) or orthogonal (H/V only). */
export type LinkRouting = 'straight' | 'orthogonal';

/** Configuration for creating a Link. */
export interface LinkConfig {
  id: LinkId;
  sourcePortId: PortId;
  targetPortId: PortId;
  points?: Array<{ x: number; y: number }>;
  routing?: LinkRouting;
}

/**
 * Link – connection between two ports. Optional waypoints for polyline; otherwise straight line.
 * With orthogonal routing, segments are horizontal or vertical only.
 */
export class Link implements LinkConfig {
  readonly id: LinkId;
  readonly sourcePortId: PortId;
  readonly targetPortId: PortId;
  points: Point[] = [];
  routing: LinkRouting = 'straight';

  constructor(config: LinkConfig) {
    this.id = config.id;
    this.sourcePortId = config.sourcePortId;
    this.targetPortId = config.targetPortId;
    this.points = (config.points ?? []).map((p) => new Point(p.x, p.y));
    this.routing = config.routing ?? 'straight';
  }

  /**
   * Build SVG path d attribute: M source L target, or M source L waypoint... L target.
   * For orthogonal routing, inserts corner points so segments are H or V only.
   * @param diagram - Used to resolve port positions
   * @returns Path d string, or '' if port positions not found
   */
  buildPath(diagram: Diagram): string {
    const source = diagram.getPortPosition(this.sourcePortId);
    const target = diagram.getPortPosition(this.targetPortId);
    if (!source || !target) {
      return '';
    }

    const pts = [source, ...this.points, target];

    if (this.routing === 'orthogonal') {
      return this.buildOrthogonalPath(pts);
    }

    const segments: string[] = [`M ${pts[0].x} ${pts[0].y}`];
    for (let i = 1; i < pts.length; i++) {
      segments.push(`L ${pts[i].x} ${pts[i].y}`);
    }
    return segments.join(' ');
  }

  /**
   * Build orthogonal path: only horizontal and vertical segments.
   * Between non-aligned points A and B, inserts corner (B.x, A.y) or (A.x, B.y).
   */
  private buildOrthogonalPath(pts: Array<{ x: number; y: number }>): string {
    if (pts.length < 2) return '';
    const result: string[] = [`M ${pts[0].x} ${pts[0].y}`];

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (a.x === b.x || a.y === b.y) {
        result.push(`L ${b.x} ${b.y}`);
      } else {
        const corner = this.orthogonalCorner(a, b);
        result.push(`L ${corner.x} ${corner.y} L ${b.x} ${b.y}`);
      }
    }
    return result.join(' ');
  }

  /** Choose corner for A->B: horizontal first from A, then vertical. */
  private orthogonalCorner(
    a: { x: number; y: number },
    b: { x: number; y: number }
  ): { x: number; y: number } {
    return { x: b.x, y: a.y };
  }
}
