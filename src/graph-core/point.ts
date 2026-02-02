import type { PointLike } from './types';

/** Immutable 2D point with helper methods */
export class Point implements PointLike {
  readonly x: number;
  readonly y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /** Returns SVG cx/cy or x/y attribute string */
  toSvg(useCxCy = false): string {
    const prefix = useCxCy ? 'cx' : 'x';
    const suffix = useCxCy ? 'cy' : 'y';
    return `${prefix}="${this.x}" ${suffix}="${this.y}"`;
  }

  /** Returns string for path commands: "x,y" */
  toPathSegment(): string {
    return `${this.x},${this.y}`;
  }

  static from(p: PointLike): Point {
    return p instanceof Point ? p : new Point(p.x, p.y);
  }
}
