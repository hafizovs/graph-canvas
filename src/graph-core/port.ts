import { Point } from './point';
import type { PortId, PortSide, PortType, Rect } from './types';

export interface PortConfig {
  id: PortId;
  nodeId: string;
  side: PortSide;
  offset: number;
  type: PortType;
}

/** Port - connection point on a node */
export class Port implements PortConfig {
  readonly id: PortId;
  readonly nodeId: string;
  readonly side: PortSide;
  readonly offset: number;
  readonly type: PortType;

  constructor(config: PortConfig) {
    this.id = config.id;
    this.nodeId = config.nodeId;
    this.side = config.side;
    this.offset = config.offset;
    this.type = config.type;
  }

  /** Get absolute position of port given the node's rect */
  getAbsolutePosition(rect: Rect): Point {
    const { x, y, width, height } = rect;
    switch (this.side) {
      case 'top':
        return new Point(x + this.offset, y);
      case 'right':
        return new Point(x + width, y + this.offset);
      case 'bottom':
        return new Point(x + this.offset, y + height);
      case 'left':
        return new Point(x, y + this.offset);
      default:
        return new Point(x, y);
    }
  }
}
