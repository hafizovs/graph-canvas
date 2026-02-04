import { Node, type NodeConfig } from './node';
import { Link } from './link';
import type { NodeId, LinkId, PointLike, Rect } from './types';

/**
 * Configuration for creating a GroupNode.
 * Extends NodeConfig with group-specific child and scale data.
 */
export interface GroupNodeConfig extends NodeConfig {
  /** IDs of nodes contained in the group. */
  childNodeIds?: NodeId[];
  /** IDs of links contained in the group. */
  childLinkIds?: LinkId[];
  /** Original positions of children before grouping (for ungroup restore). */
  originalPositions?: Map<NodeId, PointLike>;
  /** Child node instances (for preview and ungroup). */
  childNodes?: Node[];
  /** Child link instances (for ungroup). */
  childLinks?: Link[];
  /** Preview scale factor (fit content in group bounds). */
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

  /**
   * Add a child node to the group.
   * @param node - Node to add as child
   * @param originalPosition - Optional position to store for ungroup
   */
  addChildNode(node: Node, originalPosition?: PointLike): void {
    this.childNodeIds.add(node.id);
    this.childNodes.set(node.id, node);
    if (originalPosition) {
      this.originalPositions.set(node.id, originalPosition);
    }
  }

  /**
   * Add a child link to the group.
   * @param link - Link to add as child
   */
  addChildLink(link: Link): void {
    this.childLinkIds.add(link.id);
    this.childLinks.set(link.id, link);
  }

  /**
   * Remove a child node from the group.
   * @param nodeId - ID of child node to remove
   * @returns true if the child existed and was removed
   */
  removeChildNode(nodeId: NodeId): boolean {
    this.originalPositions.delete(nodeId);
    this.childNodes.delete(nodeId);
    return this.childNodeIds.delete(nodeId);
  }

  /**
   * Remove a child link from the group.
   * @param linkId - ID of child link to remove
   * @returns true if the child existed and was removed
   */
  removeChildLink(linkId: LinkId): boolean {
    this.childLinks.delete(linkId);
    return this.childLinkIds.delete(linkId);
  }

  /**
   * Get stored child node by ID.
   * @param nodeId - Child node id
   * @returns Node or undefined
   */
  getChildNode(nodeId: NodeId): Node | undefined {
    return this.childNodes.get(nodeId);
  }

  /**
   * Get stored child link by ID.
   * @param linkId - Child link id
   * @returns Link or undefined
   */
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

  /**
   * Get original position of a child node (before grouping).
   * @param nodeId - Child node id
   * @returns Stored position or undefined
   */
  getOriginalPosition(nodeId: NodeId): PointLike | undefined {
    return this.originalPositions.get(nodeId);
  }

  /**
   * Check if a node is a child of this group.
   * @param nodeId - Node id to check
   */
  hasChildNode(nodeId: NodeId): boolean {
    return this.childNodeIds.has(nodeId);
  }

  /**
   * Check if a link is a child of this group.
   * @param linkId - Link id to check
   */
  hasChildLink(linkId: LinkId): boolean {
    return this.childLinkIds.has(linkId);
  }

  /**
   * Calculate bounding box of all child nodes using stored/original positions and dimensions.
   * Used for preview scaling so the full picture fits.
   * @returns Rect encompassing all children
   */
  getBounds(): Rect {
    if (this.childNodes.size === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of this.childNodes.values()) {
      const pos = this.originalPositions.get(node.id) ?? { x: node.x, y: node.y };
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + node.width);
      maxY = Math.max(maxY, pos.y + node.height);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /** Minimum scale below which we show a generic placeholder instead of detailed preview. */
  static readonly MIN_PREVIEW_SCALE = 0.2;

  /**
   * Calculate the scale factor for preview content: fit entire bounds in the preview area.
   * Never scale up; if scale would be below MIN_PREVIEW_SCALE, we still return it (caller shows placeholder).
   * @returns Scale factor (0..1)
   */
  calculatePreviewScale(): number {
    const bounds = this.getBounds();
    if (bounds.width === 0 || bounds.height === 0) {
      return 1;
    }

    const padding = 20;
    const previewAreaY = 30;
    const previewAreaHeight = this.height - 50;
    const availableWidth = this.width - 2 * padding;
    const availableHeight = Math.max(previewAreaHeight, 40);

    const scaleX = availableWidth / bounds.width;
    const scaleY = availableHeight / bounds.height;

    // Fit entire picture; never scale up
    return Math.min(scaleX, scaleY, 1);
  }

  /** True when preview scale is below minimum and we should show generic placeholder. */
  shouldShowPlaceholder(): boolean {
    return this.scale < GroupNode.MIN_PREVIEW_SCALE && this.childNodes.size > 0;
  }

  /** Recompute and set scale from current bounds and size (call after resize). */
  updateScale(): void {
    this.scale = this.calculatePreviewScale();
  }
}
