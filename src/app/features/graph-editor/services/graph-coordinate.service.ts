import { Injectable } from '@angular/core';

/**
 * Service for converting between screen (client) coordinates and SVG coordinate space.
 * Used by the graph editor for pointer events and drag/link preview.
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
}
