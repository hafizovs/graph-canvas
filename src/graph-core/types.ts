/** 2D point with x, y coordinates (use Point class from point.ts for instances) */
export interface PointLike {
  x: number;
  y: number;
}

/** Rectangle with position and dimensions */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Unique identifier for a node */
export type NodeId = string;

/** Unique identifier for a link */
export type LinkId = string;

/** Unique identifier for a port */
export type PortId = string;

/** Port side on a node */
export type PortSide = 'top' | 'right' | 'bottom' | 'left';

/** Port type (input/output) */
export type PortType = 'input' | 'output';
