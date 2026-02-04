import { Port } from './port';
import type { NodeId, NodeShape, NodeType, PortId, PointLike } from './types';
import type { Rect } from './types';

/**
 * Configuration for creating a Node.
 */
export interface NodeConfig {
  /** Unique node identifier. */
  id: NodeId;
  /** X position in diagram coordinates. */
  x: number;
  /** Y position in diagram coordinates. */
  y: number;
  /** Width; defaults to 120. */
  width?: number;
  /** Height; defaults to 60. */
  height?: number;
  /** Display label. */
  label?: string;
  /** Geometric shape for rendering. */
  shape?: NodeShape;
  /** Rotation in degrees (clockwise). */
  rotation?: number;
  /** Regular or group node. */
  nodeType?: NodeType;
  /** Custom shape identifier when shape is 'custom'. */
  customShapeId?: string;
  /** Initial ports (input/output). */
  ports?: Port[];
}

/**
 * Node – graph element with position, size, label, and ports. Mutations (setPosition) are in-place.
 */
export class Node implements NodeConfig {
  readonly id: NodeId;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  shape: NodeShape;
  rotation: number;
  nodeType: NodeType;
  customShapeId?: string;
  private _ports: Map<PortId, Port> = new Map();

  constructor(config: NodeConfig) {
    this.id = config.id;
    this.x = config.x;
    this.y = config.y;
    this.width = config.width ?? 120;
    this.height = config.height ?? 60;
    this.label = config.label ?? '';
    this.shape = config.shape ?? 'rectangle';
    this.rotation = config.rotation ?? 0;
    this.nodeType = config.nodeType ?? 'regular';
    this.customShapeId = config.customShapeId;
    for (const p of config.ports ?? []) {
      this._ports.set(p.id, p);
    }
  }

  /**
   * Bounding rectangle for layout and port position.
   * @returns Rect with x, y, width, height
   */
  getRect(): Rect {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  /** All ports on this node. */
  get ports(): Port[] {
    return Array.from(this._ports.values());
  }

  /**
   * Add a port (e.g. input or output).
   * @param port - Port to add; replaces existing port with same id
   */
  addPort(port: Port): void {
    this._ports.set(port.id, port);
  }

  /**
   * Remove port by id.
   * @param id - Port id to remove
   * @returns true if the port existed and was removed
   */
  removePort(id: PortId): boolean {
    return this._ports.delete(id);
  }

  /**
   * Get port by id.
   * @param id - Port id
   * @returns Port or undefined
   */
  getPort(id: PortId): Port | undefined {
    return this._ports.get(id);
  }

  /**
   * Set node position (in-place).
   * @param x - New x
   * @param y - New y
   */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /**
   * Set position from a point-like object.
   * @param p - Point or { x, y }
   */
  setPositionFromPoint(p: PointLike): void {
    this.x = p.x;
    this.y = p.y;
  }

  /**
   * Set node rotation in degrees (clockwise). In-place.
   * @param deg - Rotation in degrees
   */
  setRotation(deg: number): void {
    this.rotation = deg;
  }
}
