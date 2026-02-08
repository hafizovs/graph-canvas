import { Point } from './point';
import type { PortId, PortSide, PortType, Rect } from './types';

/**
 * Configuration for creating a Port.
 */
export interface PortConfig {
  /** Unique port identifier (e.g. n1-in, n1-out). */
  id: PortId;
  /** ID of the node this port belongs to. */
  nodeId: string;
  /** Edge of the node the port is attached to. */
  side: PortSide;
  /** Offset along the side (e.g. from top for left/right sides). */
  offset: number;
  /** Input (incoming) or output (outgoing). */
  type: PortType;
  /** Max links allowed on this port (0 = unlimited). Overrides editor default when set. */
  maxLinks?: number;
}

/**
 * Port – connection point on a node. Position is computed from the node's rect and port side/offset.
 */
export class Port implements PortConfig {
  readonly id: PortId;
  readonly nodeId: string;
  readonly side: PortSide;
  readonly offset: number;
  readonly type: PortType;
  /** Max links allowed on this port (0 = unlimited). Mutable so toolbar/actions can set it. */
  maxLinks?: number;

  constructor(config: PortConfig) {
    this.id = config.id;
    this.nodeId = config.nodeId;
    this.side = config.side;
    this.offset = config.offset;
    this.type = config.type;
    this.maxLinks = config.maxLinks;
  }

  /**
   * Get absolute position of this port given the node's bounding rect.
   * Offset is applied along the side (e.g. left side: offset from top).
   * @param rect - Node's rectangle (x, y, width, height)
   * @returns Point in diagram coordinates
   */
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
