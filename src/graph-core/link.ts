import { Point } from './point';
import type { LinkId, PortId } from './types';
import type { Diagram } from './diagram';

export interface LinkConfig {
  id: LinkId;
  sourcePortId: PortId;
  targetPortId: PortId;
  points?: Array<{ x: number; y: number }>;
}

/** Link - connection between two ports, with optional waypoints */
export class Link implements LinkConfig {
  readonly id: LinkId;
  readonly sourcePortId: PortId;
  readonly targetPortId: PortId;
  points: Point[] = [];

  constructor(config: LinkConfig) {
    this.id = config.id;
    this.sourcePortId = config.sourcePortId;
    this.targetPortId = config.targetPortId;
    this.points = (config.points ?? []).map((p) => new Point(p.x, p.y));
  }

  /** Build SVG path d attribute. Uses waypoints if present, else straight line. */
  buildPath(diagram: Diagram): string {
    const source = diagram.getPortPosition(this.sourcePortId);
    const target = diagram.getPortPosition(this.targetPortId);
    if (!source || !target) {
      return '';
    }

    if (this.points.length === 0) {
      return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
    }

    const segments: string[] = [`M ${source.x} ${source.y}`];
    for (const p of this.points) {
      segments.push(`L ${p.x} ${p.y}`);
    }
    segments.push(`L ${target.x} ${target.y}`);
    return segments.join(' ');
  }
}
