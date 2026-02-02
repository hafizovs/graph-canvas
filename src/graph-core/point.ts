import type { PointLike } from './types';

/**
 * Immutable 2D point with helper methods for SVG and path segments.
 */
export class Point implements PointLike {
  readonly x: number;
  readonly y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /**
   * Returns SVG attribute string for position (e.g. x="10" y="20" or cx="10" cy="20").
   * @param useCxCy - If true, use cx/cy (for circles); otherwise x/y
   * @returns Attribute string
   */
  toSvg(useCxCy = false): string {
    const prefix = useCxCy ? 'cx' : 'x';
    const suffix = useCxCy ? 'cy' : 'y';
    return `${prefix}="${this.x}" ${suffix}="${this.y}"`;
  }

  /**
   * Returns string for SVG path segment: "x,y".
   * @returns Path segment string
   */
  toPathSegment(): string {
    return `${this.x},${this.y}`;
  }

  /**
   * Create a Point from any PointLike; returns same instance if already a Point.
   * @param p - Point or plain { x, y }
   * @returns Point instance
   */
  static from(p: PointLike): Point {
    return p instanceof Point ? p : new Point(p.x, p.y);
  }
}
