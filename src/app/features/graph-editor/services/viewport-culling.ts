import type { Diagram, Link } from '../../../../graph-core';
import type { NodeId, LinkId } from '../../../../graph-core';
import type { Rect } from '../../../../graph-core';
import type { PointLike } from '../../../../graph-core';

function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

function pathBbox(pts: PointLike[]): Rect | null {
  if (pts.length === 0) return null;
  let xMin = pts[0].x;
  let yMin = pts[0].y;
  let xMax = pts[0].x;
  let yMax = pts[0].y;
  for (let i = 1; i < pts.length; i++) {
    xMin = Math.min(xMin, pts[i].x);
    yMin = Math.min(yMin, pts[i].y);
    xMax = Math.max(xMax, pts[i].x);
    yMax = Math.max(yMax, pts[i].y);
  }
  return { x: xMin, y: yMin, width: xMax - xMin, height: yMax - yMin };
}

export interface VisibleInViewBoxResult {
  nodeIds: Set<NodeId>;
  linkIds: Set<LinkId>;
}

export interface LinkGeometryLike {
  getPathPoints(link: Link, diagram: Diagram): PointLike[];
}

/**
 * Returns node and link IDs that intersect the viewBox.
 * Nodes: rect intersection with viewBox.
 * Links: visible if path bbox intersects viewBox.
 */
export function getVisibleInViewBox(
  diagram: Diagram,
  viewBox: Rect,
  linkGeometry: LinkGeometryLike
): VisibleInViewBoxResult {
  const nodeIds = new Set<NodeId>();
  const linkIds = new Set<LinkId>();

  for (const node of diagram.nodes) {
    const r = node.getRect();
    if (rectsIntersect(r, viewBox)) nodeIds.add(node.id);
  }

  for (const link of diagram.links) {
    const pts = linkGeometry.getPathPoints(link, diagram);
    const bbox = pathBbox(pts);
    if (bbox && rectsIntersect(bbox, viewBox)) linkIds.add(link.id);
  }

  return { nodeIds, linkIds };
}
