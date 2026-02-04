/**
 * 2D point with x, y coordinates.
 * Use for plain data; use {@link Point} from point.ts for instances with helpers.
 */
export interface PointLike {
  /** X coordinate. */
  x: number;
  /** Y coordinate. */
  y: number;
}

/**
 * Rectangle with position and dimensions.
 * Used by {@link Node.getRect} and port position calculation.
 */
export interface Rect {
  /** Left edge. */
  x: number;
  /** Top edge. */
  y: number;
  /** Width. */
  width: number;
  /** Height. */
  height: number;
}

/** Unique identifier for a node. Convention: "n" + number (e.g. n1). */
export type NodeId = string;

/** Unique identifier for a link. Convention: "l" + number (e.g. l1). */
export type LinkId = string;

/** Unique identifier for a port. Typically scoped to a node (e.g. n1-in, n1-out). */
export type PortId = string;

/** Which edge of the node the port is attached to. */
export type PortSide = 'top' | 'right' | 'bottom' | 'left';

/** Port direction: input (incoming links) or output (outgoing links). */
export type PortType = 'input' | 'output';

/** Geometric shape of a node for rendering. */
export type NodeShape =
  | 'rectangle'
  | 'roundedRect'
  | 'circle'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'hexagon'
  | 'parallelogram'
  | 'pentagon'
  | 'cross'
  | 'custom';

/** Type of node: regular node or group container. */
export type NodeType = 'regular' | 'group';
