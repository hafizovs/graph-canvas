import { Injectable } from '@angular/core';

/** Grid step in SVG units; used for snap and future pathfinding. */
export const GRID_STEP = 20;

/**
 * Service for converting between screen (client) coordinates and SVG coordinate space,
 * and for snapping coordinates to the grid.
 */
@Injectable({ providedIn: 'root' })
export class GraphCoordinateService {
  /**
   * Converts client (screen) coordinates to coordinates in the SVG's coordinate system.
   * Uses the SVG element's current transform (viewBox, zoom, etc.).
   *
   * @param svgElement - The root SVGSVGElement (e.g. canvas container)
   * @param clientX - Client X from PointerEvent
   * @param clientY - Client Y from PointerEvent
   * @returns Point in SVG coordinates, or { x: 0, y: 0 } if element/CTM unavailable
   */
  clientToSvg(
    svgElement: SVGSVGElement | null | undefined,
    clientX: number,
    clientY: number
  ): { x: number; y: number } {
    if (!svgElement) return { x: 0, y: 0 };
    const pt = svgElement.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svgElement.getScreenCTM();
    const svgP = ctm ? pt.matrixTransform(ctm.inverse()) : pt;
    return { x: svgP.x, y: svgP.y };
  }

  /**
   * Snaps a point to the grid. Single source for grid step (pathfinding, snap).
   */
  snapToGrid(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.round(x / GRID_STEP) * GRID_STEP,
      y: Math.round(y / GRID_STEP) * GRID_STEP,
    };
  }
}
