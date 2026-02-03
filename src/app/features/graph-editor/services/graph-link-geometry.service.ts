import { Injectable } from '@angular/core';
import type { Diagram, Link, PointLike } from '../../../../graph-core';

export interface ClosestSegmentResult {
  segIdx: number;
  projected: PointLike;
}

const HIT_TOLERANCE = 12;

/**
 * Geometry utilities for link paths: hit-test, orthogonal expansion, point projection.
 */
@Injectable({ providedIn: 'root' })
export class GraphLinkGeometryService {
  /**
   * Get all path points for hit-test and segment lookup.
   * For straight: [source, ...points, target].
   * For orthogonal: expanded path with corner points.
   */
  getPathPoints(link: Link, diagram: Diagram): PointLike[] {
    const source = diagram.getPortPosition(link.sourcePortId);
    const target = diagram.getPortPosition(link.targetPortId);
    if (!source || !target) return [];

    const pts: PointLike[] = [source, ...link.points, target];

    if (link.routing === 'orthogonal') {
      return this.expandOrthogonalPath(pts);
    }
    return pts;
  }

  /**
   * Expand path for orthogonal routing: insert corner points so each segment is H or V.
   */
  expandOrthogonalPath(pts: PointLike[]): PointLike[] {
    if (pts.length < 2) return pts;
    const result: PointLike[] = [pts[0]];

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (a.x === b.x || a.y === b.y) {
        result.push(b);
      } else {
        result.push({ x: b.x, y: a.y });
        result.push(b);
      }
    }
    return result;
  }

  /**
   * Project point P onto segment A-B, clamped to the segment.
   */
  projectPointOnSegment(P: PointLike, A: PointLike, B: PointLike): PointLike {
    const ax = B.x - A.x;
    const ay = B.y - A.y;
    const lenSq = ax * ax + ay * ay;
    if (lenSq === 0) return { x: A.x, y: A.y };
    let t = ((P.x - A.x) * ax + (P.y - A.y) * ay) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return { x: A.x + t * ax, y: A.y + t * ay };
  }

  /**
   * Distance from point P to segment A-B.
   */
  distanceToSegment(P: PointLike, A: PointLike, B: PointLike): number {
    const q = this.projectPointOnSegment(P, A, B);
    const dx = P.x - q.x;
    const dy = P.y - q.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Find the closest segment to point pt and the projected point on that segment.
   * @returns { segIdx, projected } or null if no segment within tolerance
   */
  findClosestSegment(
    pts: PointLike[],
    pt: PointLike,
    tolerance = HIT_TOLERANCE
  ): ClosestSegmentResult | null {
    if (pts.length < 2) return null;
    let bestDist = tolerance;
    let bestSegIdx = -1;
    let bestProjected: PointLike = { x: pt.x, y: pt.y };

    for (let i = 0; i < pts.length - 1; i++) {
      const dist = this.distanceToSegment(pt, pts[i], pts[i + 1]);
      if (dist < bestDist) {
        bestDist = dist;
        bestSegIdx = i;
        bestProjected = this.projectPointOnSegment(pt, pts[i], pts[i + 1]);
      }
    }
    if (bestSegIdx >= 0) {
      return { segIdx: bestSegIdx, projected: bestProjected };
    }
    return null;
  }

  /**
   * Snap a newly inserted waypoint for orthogonal routing.
   * Keeps one coordinate from prev and one from next so segments stay H or V.
   */
  snapToOrthogonal(
    inserted: PointLike,
    prev: PointLike,
    next: PointLike
  ): PointLike {
    const dxPrev = Math.abs(inserted.x - prev.x);
    const dyPrev = Math.abs(inserted.y - prev.y);
    const dxNext = Math.abs(inserted.x - next.x);
    const dyNext = Math.abs(inserted.y - next.y);
    if (dxPrev < dyPrev) {
      return { x: prev.x, y: next.y };
    }
    return { x: next.x, y: prev.y };
  }

  /**
   * Map segment index (from findClosestSegment on getPathPoints result) to link.points insert index.
   * For straight: segIdx equals insert index.
   * For orthogonal: count waypoints that appear at or before segment start in expanded path.
   */
  segmentToPointInsertIndex(link: Link, diagram: Diagram, segIdx: number): number {
    const pts = this.getPathPoints(link, diagram);
    if (segIdx < 0 || segIdx >= pts.length - 1) return 0;
    if (link.routing === 'straight') return segIdx;

    const source = diagram.getPortPosition(link.sourcePortId)!;
    const target = diagram.getPortPosition(link.targetPortId)!;
    const waypoints = link.points;
    if (waypoints.length === 0) return 0;

    const expanded = this.expandOrthogonalPath([source, ...waypoints, target]);
    let insertIdx = 0;
    for (const wp of waypoints) {
      const wpIdx = expanded.findIndex((p) => p.x === wp.x && p.y === wp.y);
      if (wpIdx >= 0 && wpIdx <= segIdx) insertIdx++;
    }
    return insertIdx;
  }
}
