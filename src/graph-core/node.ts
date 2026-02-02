import { Port } from './port';
import type { NodeId, PortId, PointLike } from './types';
import type { Rect } from './types';

/** Configuration for creating a Node. */
export interface NodeConfig {
  id: NodeId;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
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
  private _ports: Map<PortId, Port> = new Map();

  constructor(config: NodeConfig) {
    this.id = config.id;
    this.x = config.x;
    this.y = config.y;
    this.width = config.width ?? 120;
    this.height = config.height ?? 60;
    this.label = config.label ?? '';
    for (const p of config.ports ?? []) {
      this._ports.set(p.id, p);
    }
  }

  /** Bounding rectangle (x, y, width, height) for layout and port position. */
  getRect(): Rect {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  /** All ports on this node. */
  get ports(): Port[] {
    return Array.from(this._ports.values());
  }

  /** Add a port (e.g. input or output). */
  addPort(port: Port): void {
    this._ports.set(port.id, port);
  }

  /** Remove port by id. Returns true if removed. */
  removePort(id: PortId): boolean {
    return this._ports.delete(id);
  }

  /** Get port by id. */
  getPort(id: PortId): Port | undefined {
    return this._ports.get(id);
  }

  /** Set node position (in-place). */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /** Set position from a point-like object. */
  setPositionFromPoint(p: PointLike): void {
    this.x = p.x;
    this.y = p.y;
  }
}
