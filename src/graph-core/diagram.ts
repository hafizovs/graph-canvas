import { Node } from './node';
import { Link } from './link';
import { Port } from './port';
import { Point } from './point';
import type { NodeId, LinkId, PortId } from './types';

/** Diagram - container for nodes and links; source of truth */
export class Diagram {
  private _nodes: Map<NodeId, Node> = new Map();
  private _links: Map<LinkId, Link> = new Map();

  get nodes(): Node[] {
    return Array.from(this._nodes.values());
  }

  get links(): Link[] {
    return Array.from(this._links.values());
  }

  addNode(node: Node): void {
    this._nodes.set(node.id, node);
  }

  removeNode(id: NodeId): boolean {
    const node = this._nodes.get(id);
    if (!node) return false;
    // Remove links connected to this node's ports
    for (const link of this._links.values()) {
      const sourceNode = this.getNodeByPortId(link.sourcePortId);
      const targetNode = this.getNodeByPortId(link.targetPortId);
      if (sourceNode?.id === id || targetNode?.id === id) {
        this._links.delete(link.id);
      }
    }
    return this._nodes.delete(id);
  }

  getNode(id: NodeId): Node | undefined {
    return this._nodes.get(id);
  }

  addLink(link: Link): void {
    this._links.set(link.id, link);
  }

  removeLink(id: LinkId): boolean {
    return this._links.delete(id);
  }

  getLink(id: LinkId): Link | undefined {
    return this._links.get(id);
  }

  /** Get absolute position of a port by id (searches all nodes) */
  getPortPosition(portId: PortId): Point | undefined {
    for (const node of this._nodes.values()) {
      const port = node.getPort(portId);
      if (port) {
        return port.getAbsolutePosition(node.getRect());
      }
    }
    return undefined;
  }

  private getNodeByPortId(portId: PortId): Node | undefined {
    for (const node of this._nodes.values()) {
      if (node.getPort(portId)) return node;
    }
    return undefined;
  }
}
