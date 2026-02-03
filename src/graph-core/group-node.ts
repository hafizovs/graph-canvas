import { Node, type NodeConfig } from './node';
import { Link } from './link';
import type { NodeId, LinkId, PointLike, Rect } from './types';

/** Configuration for creating a GroupNode. */
export interface GroupNodeConfig extends NodeConfig {
  childNodeIds?: NodeId[];
  childLinkIds?: LinkId[];
  originalPositions?: Map<NodeId, PointLike>;
  childNodes?: Node[];
  childLinks?: Link[];
  scale?: number;
}

/**
 * GroupNode – container node that groups multiple child nodes and links.
 * Displays miniature preview of contents and external ports for connections outside the group.
 * Stores full child node and link data for restoration on ungroup.
 */
export class GroupNode extends Node {
  childNodeIds: Set<NodeId>;
  childLinkIds: Set<LinkId>;
  originalPositions: Map<NodeId, PointLike>;
  childNodes: Map<NodeId, Node>;
  childLinks: Map<LinkId, Link>;
  scale: number;

  constructor(config: GroupNodeConfig) {
    super({
      ...config,
      nodeType: 'group',
      shape: 'rectangle', // Groups are always rectangular
    });
    this.childNodeIds = new Set(config.childNodeIds ?? []);
    this.childLinkIds = new Set(config.childLinkIds ?? []);
    this.originalPositions = config.originalPositions ?? new Map();
    this.childNodes = new Map();
    this.childLinks = new Map();
    this.scale = config.scale ?? 1;

    // Store child nodes and links if provided
    if (config.childNodes) {
      for (const node of config.childNodes) {
        this.childNodes.set(node.id, node);
      }
    }
    if (config.childLinks) {
      for (const link of config.childLinks) {
        this.childLinks.set(link.id, link);
      }
    }
  }

  /** Add a child node to the group. */
  addChildNode(node: Node, originalPosition?: PointLike): void {
    this.childNodeIds.add(node.id);
    this.childNodes.set(node.id, node);
    if (originalPosition) {
      this.originalPositions.set(node.id, originalPosition);
    }
  }

  /** Add a child link to the group. */
  addChildLink(link: Link): void {
    this.childLinkIds.add(link.id);
    this.childLinks.set(link.id, link);
  }

  /** Remove a child node from the group. */
  removeChildNode(nodeId: NodeId): boolean {
    this.originalPositions.delete(nodeId);
    this.childNodes.delete(nodeId);
    return this.childNodeIds.delete(nodeId);
  }

  /** Remove a child link from the group. */
  removeChildLink(linkId: LinkId): boolean {
    this.childLinks.delete(linkId);
    return this.childLinkIds.delete(linkId);
  }

  /** Get stored child node by ID. */
  getChildNode(nodeId: NodeId): Node | undefined {
    return this.childNodes.get(nodeId);
  }

  /** Get stored child link by ID. */
  getChildLink(linkId: LinkId): Link | undefined {
    return this.childLinks.get(linkId);
  }

  /** Get all stored child nodes. */
  getStoredChildNodes(): Node[] {
    return Array.from(this.childNodes.values());
  }

  /** Get all stored child links. */
  getStoredChildLinks(): Link[] {
    return Array.from(this.childLinks.values());
  }

  /** Get all child node IDs. */
  getChildNodeIds(): NodeId[] {
    return Array.from(this.childNodeIds);
  }

  /** Get all child link IDs. */
  getChildLinkIds(): LinkId[] {
    return Array.from(this.childLinkIds);
  }

  /** Get original position of a child node (before grouping). */
  getOriginalPosition(nodeId: NodeId): PointLike | undefined {
    return this.originalPositions.get(nodeId);
  }

  /** Check if a node is a child of this group. */
  hasChildNode(nodeId: NodeId): boolean {
    return this.childNodeIds.has(nodeId);
  }

  /** Check if a link is a child of this group. */
  hasChildLink(linkId: LinkId): boolean {
    return this.childLinkIds.has(linkId);
  }

  /**
   * Calculate bounding box of all child nodes based on their original positions.
   * Used for preview scaling calculations.
   */
  getBounds(): Rect {
    if (this.originalPositions.size === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const pos of this.originalPositions.values()) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      // Assuming default node size for bounds calculation
      maxX = Math.max(maxX, pos.x + 120);
      maxY = Math.max(maxY, pos.y + 60);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Calculate the scale factor for preview content based on group size.
   * Content is scaled to fit within the group with padding.
   */
  calculatePreviewScale(): number {
    const bounds = this.getBounds();
    if (bounds.width === 0 || bounds.height === 0) {
      return 1;
    }

    const padding = 20;
    const availableWidth = this.width - 2 * padding;
    const availableHeight = this.height - 2 * padding;

    const scaleX = availableWidth / bounds.width;
    const scaleY = availableHeight / bounds.height;

    // Never scale up, only down
    return Math.min(scaleX, scaleY, 1);
  }

  /** Update scale factor (called after resize). */
  updateScale(): void {
    this.scale = this.calculatePreviewScale();
  }
}
