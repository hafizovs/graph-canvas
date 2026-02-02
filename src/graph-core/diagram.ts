import { Node } from './node';
import { Link } from './link';
import { Port } from './port';
import { Point } from './point';
import type { NodeId, LinkId, PortId } from './types';

/**
 * Diagram – container for nodes and links; single source of truth for the graph model.
 * Removing a node also removes any links connected to that node's ports.
 */
export class Diagram {
  private _nodes: Map<NodeId, Node> = new Map();
  private _links: Map<LinkId, Link> = new Map();

  /** All nodes in the diagram. */
  get nodes(): Node[] {
    return Array.from(this._nodes.values());
  }

  /** All links in the diagram. */
  get links(): Link[] {
    return Array.from(this._links.values());
  }

  /** Add a node. Replaces existing node with same id. */
  addNode(node: Node): void {
    this._nodes.set(node.id, node);
  }

  /**
   * Remove a node and any links connected to its ports.
   * @returns true if the node existed and was removed
   */
  removeNode(id: NodeId): boolean {
    const node = this._nodes.get(id);
    if (!node) return false;
    for (const link of this._links.values()) {
      const sourceNode = this.getNodeByPortId(link.sourcePortId);
      const targetNode = this.getNodeByPortId(link.targetPortId);
      if (sourceNode?.id === id || targetNode?.id === id) {
        this._links.delete(link.id);
      }
    }
    return this._nodes.delete(id);
  }

  /** Get node by id. */
  getNode(id: NodeId): Node | undefined {
    return this._nodes.get(id);
  }

  /** Add a link. Replaces existing link with same id. */
  addLink(link: Link): void {
    this._links.set(link.id, link);
  }

  /** Remove link by id. Returns true if removed. */
  removeLink(id: LinkId): boolean {
    return this._links.delete(id);
  }

  /** Get link by id. */
  getLink(id: LinkId): Link | undefined {
    return this._links.get(id);
  }

  /**
   * Get absolute position of a port by id (searches all nodes).
   * @returns Point in diagram coordinates, or undefined if port not found
   */
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
