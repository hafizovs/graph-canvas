import { Injectable } from '@angular/core';
import {
  Diagram,
  Node,
  GroupNode,
  Link,
  Port,
  Point,
  deserializeDiagram,
  serializeDiagram,
  cloneDiagramJsonForPaste,
} from '../../../../graph-core';
import type { DiagramJson } from '../../../../graph-core';
import type { LinkId, NodeId, NodeShape, PortId, PortSide } from '../../../../graph-core';
import { GraphEditorStateService } from './graph-editor-state.service';
import { GraphUndoRedoService } from './graph-undo-redo.service';
import { GraphCoordinateService } from './graph-coordinate.service';
import { GraphLinkGeometryService } from './graph-link-geometry.service';

const PASTE_OFFSET = 20;

/**
 * High-level mutating operations on the graph. Operations that should be undoable
 * call undoRedo.pushState() once before applying changes. moveNodes does not push
 * (caller pushes once at drag start). All operations read/write diagram and counters via state.
 */
@Injectable({ providedIn: 'root' })
export class GraphOperationsService {
  constructor(
    private state: GraphEditorStateService,
    private undoRedo: GraphUndoRedoService,
    private coordinate: GraphCoordinateService,
    private linkGeometry: GraphLinkGeometryService
  ) {}

  /**
   * Add a new node at the center of the current viewBox with default in/out ports.
   * Pushes undo state before adding.
   */
  addNode(): void {
    const d = this.state.getDiagram();
    if (!d) return;
    this.undoRedo.pushState();

    const nodeId = `n${this.state.incrementNodeIdCounter()}` as NodeId;
    const vb = this.state.viewBox();
    const centerX = vb.x + vb.width / 2 - 60;
    const centerY = vb.y + vb.height / 2 - 30;
    const { x, y } = this.state.snapToGridEnabled()
      ? this.coordinate.snapToGrid(centerX, centerY)
      : { x: centerX, y: centerY };

    const node = new Node({
      id: nodeId,
      x,
      y,
      width: 120,
      height: 60,
      label: `Node ${this.state.getNodeIdCounter()}`,
      ports: [],
    });
    node.addPort(
      new Port({
        id: `${nodeId}-in` as PortId,
        nodeId,
        side: 'left',
        offset: 30,
        type: 'input',
      })
    );
    node.addPort(
      new Port({
        id: `${nodeId}-out` as PortId,
        nodeId,
        side: 'right',
        offset: 30,
        type: 'output',
      })
    );

    d.addNode(node);
    this.state.setDiagram(d, true);
  }

  /**
   * Add a new node from the palette at the given SVG coordinates (snapped to grid).
   * Pushes undo state before adding.
   */
  addNodeFromPalette(
    shape: NodeShape,
    svgX: number,
    svgY: number,
    customShapeId?: string
  ): void {
    const d = this.state.getDiagram();
    if (!d) return;
    this.undoRedo.pushState();

    const { x, y } = this.state.snapToGridEnabled()
      ? this.coordinate.snapToGrid(svgX, svgY)
      : { x: svgX, y: svgY };
    const nodeId = `n${this.state.incrementNodeIdCounter()}` as NodeId;
    const node = new Node({
      id: nodeId,
      x,
      y,
      width: 120,
      height: 60,
      label: `Node ${this.state.getNodeIdCounter()}`,
      shape,
      ...(shape === 'custom' && customShapeId != null && { customShapeId }),
      ports: [],
    });
    node.addPort(
      new Port({
        id: `${nodeId}-in` as PortId,
        nodeId,
        side: 'left',
        offset: 30,
        type: 'input',
      })
    );
    node.addPort(
      new Port({
        id: `${nodeId}-out` as PortId,
        nodeId,
        side: 'right',
        offset: 30,
        type: 'output',
      })
    );

    d.addNode(node);
    this.state.setDiagram(d, true);
  }

  /**
   * Apply delta to nodes by id; used during drag. Does not push undo (caller does once at drag start).
   */
  moveNodes(
    initialPositions: Map<NodeId, { x: number; y: number }>,
    dx: number,
    dy: number
  ): void {
    const d = this.state.getDiagram();
    if (!d) return;
    for (const [nodeId, pos] of initialPositions) {
      const n = d.getNode(nodeId);
      if (n) {
        const newX = pos.x + dx;
        const newY = pos.y + dy;
        const { x, y } = this.state.snapToGridEnabled()
          ? this.coordinate.snapToGrid(newX, newY)
          : { x: newX, y: newY };
        n.setPosition(x, y);
      }
    }
    this.state.incrementRenderTick();
  }

  /**
   * Rotate selected nodes by angleDeg degrees (clockwise). Pushes undo before applying.
   */
  rotateSelectedNodes(angleDeg: number): void {
    const d = this.state.getDiagram();
    const nodeIds = this.state.selectedNodeIds();
    if (!d || nodeIds.size === 0) return;
    this.undoRedo.pushState();
    for (const nodeId of nodeIds) {
      const n = d.getNode(nodeId);
      if (n) n.setRotation((n.rotation ?? 0) + angleDeg);
    }
    this.state.setDiagram(d, true);
  }

  /**
   * Create a link from source port to target port if valid (target is input, no duplicate).
   * Pushes undo before adding.
   */
  createLink(
    sourcePortId: PortId,
    _sourceNodeId: NodeId,
    targetPortId: PortId,
    targetNodeId: NodeId
  ): boolean {
    const d = this.state.getDiagram();
    if (!d) return false;
    const hasExisting =
      d.links.some(
        (l) => l.sourcePortId === sourcePortId && l.targetPortId === targetPortId
      ) || d.links.some((l) => l.targetPortId === targetPortId);
    if (hasExisting) return false;

    this.undoRedo.pushState();
    const linkId = `l${this.state.incrementLinkIdCounter()}`;
    d.addLink(
      new Link({
        id: linkId,
        sourcePortId,
        targetPortId,
      })
    );
    this.state.setDiagram(d, true);
    return true;
  }

  /**
   * Delete all selected nodes and links. Pushes undo before deleting.
   * Shows confirmation dialog if deleting a group node.
   * Returns true if anything was removed.
   */
  deleteSelection(): boolean {
    const d = this.state.getDiagram();
    if (!d) return false;
    const nodeIds = this.state.selectedNodeIds();
    const linkIds = this.state.selectedLinkIds();
    if (nodeIds.size === 0 && linkIds.size === 0) return false;

    // Check if any selected nodes are groups
    let hasGroups = false;
    for (const nodeId of nodeIds) {
      const node = d.getNode(nodeId);
      if (node instanceof GroupNode) {
        hasGroups = true;
        break;
      }
    }

    // Show confirmation dialog if deleting groups
    if (hasGroups) {
      const confirmed = window.confirm(
        'Delete group and all its contents? This will remove the group and all nodes/links inside it.'
      );
      if (!confirmed) return false;
    }

    this.undoRedo.pushState();
    let changed = false;
    
    // Delete group nodes and their children
    for (const nodeId of nodeIds) {
      const node = d.getNode(nodeId);
      if (node instanceof GroupNode) {
        // Delete all child nodes
        for (const childNodeId of node.childNodeIds) {
          d.removeNode(childNodeId);
        }
        // Delete all child links
        for (const childLinkId of node.childLinkIds) {
          d.removeLink(childLinkId);
        }
      }
      if (d.removeNode(nodeId)) changed = true;
    }
    
    for (const linkId of linkIds) {
      if (d.removeLink(linkId)) changed = true;
    }
    
    if (changed) {
      this.state.clearSelection();
      this.state.setDiagram(d, true);
    }
    return changed;
  }

  /**
   * Copy selected nodes and their internal links to clipboard (DiagramJson).
   */
  copy(): void {
    const d = this.state.getDiagram();
    const nodeIdSet = this.state.selectedNodeIds();
    if (!d || nodeIdSet.size === 0) return;
    const subsetDiagram = new Diagram();
    for (const node of d.nodes) {
      if (nodeIdSet.has(node.id)) subsetDiagram.addNode(node);
    }
    for (const link of d.links) {
      const srcNode = d.nodes.find((n) => n.getPort(link.sourcePortId));
      const tgtNode = d.nodes.find((n) => n.getPort(link.targetPortId));
      if (
        srcNode &&
        tgtNode &&
        nodeIdSet.has(srcNode.id) &&
        nodeIdSet.has(tgtNode.id)
      ) {
        subsetDiagram.addLink(link);
      }
    }
    this.state.setClipboard(serializeDiagram(subsetDiagram));
  }

  /**
   * Paste from clipboard with offset and new ids; select pasted nodes. Pushes undo before paste.
   */
  paste(): boolean {
    const clipboard = this.state.getClipboard();
    const d = this.state.getDiagram();
    if (!clipboard || !d) return false;

    this.undoRedo.pushState();
    const { json, newNodeIds } = cloneDiagramJsonForPaste(
      clipboard,
      PASTE_OFFSET,
      PASTE_OFFSET,
      this.state.getNodeIdCounter(),
      this.state.getLinkIdCounter()
    );
    const pasted = deserializeDiagram(json);
    for (const node of pasted.nodes) {
      if (this.state.snapToGridEnabled()) {
        const snapped = this.coordinate.snapToGrid(node.x, node.y);
        node.setPosition(snapped.x, snapped.y);
      }
      d.addNode(node);
      const m = /^n(\d+)$/.exec(node.id);
      if (m)
        this.state.setNodeIdCounter(
          Math.max(this.state.getNodeIdCounter(), parseInt(m[1], 10))
        );
    }
    for (const link of pasted.links) {
      d.addLink(link);
      const m = /^l(\d+)$/.exec(link.id);
      if (m)
        this.state.setLinkIdCounter(
          Math.max(this.state.getLinkIdCounter(), parseInt(m[1], 10))
        );
    }
    this.state.setNodeSelection(new Set(newNodeIds));
    this.state.setDiagram(d, true);
    return true;
  }

  /**
   * Add a waypoint to a link at the given index. Pushes undo before adding.
   * For orthogonal routing, snaps the point to keep segments H/V.
   */
  addLinkWaypoint(linkId: LinkId, index: number, x: number, y: number): boolean {
    const d = this.state.getDiagram();
    const link = d?.getLink(linkId);
    if (!d || !link) return false;

    this.undoRedo.pushState();

    let px = x;
    let py = y;
    if (this.state.snapToGridEnabled()) {
      const snapped = this.coordinate.snapToGrid(x, y);
      px = snapped.x;
      py = snapped.y;
    }

    if (link.routing === 'orthogonal') {
      const source = d.getPortPosition(link.sourcePortId);
      const target = d.getPortPosition(link.targetPortId);
      if (source && target) {
        const prev =
          index <= 0 ? source : link.points[index - 1];
        const next =
          index >= link.points.length ? target : link.points[index];
        const snapped = this.linkGeometry.snapToOrthogonal(
          { x: px, y: py },
          prev,
          next
        );
        px = snapped.x;
        py = snapped.y;
      }
    }

    const pt = new Point(px, py);
    link.points.splice(index, 0, pt);
    this.state.setDiagram(d, true);
    return true;
  }

  /**
   * Move an existing waypoint. Does not push undo (caller pushes at drag start).
   */
  moveLinkWaypoint(linkId: LinkId, index: number, x: number, y: number): boolean {
    const d = this.state.getDiagram();
    const link = d?.getLink(linkId);
    if (!d || !link || index < 0 || index >= link.points.length) return false;

    let px = x;
    let py = y;
    if (this.state.snapToGridEnabled()) {
      const snapped = this.coordinate.snapToGrid(x, y);
      px = snapped.x;
      py = snapped.y;
    }

    if (link.routing === 'orthogonal') {
      const source = d.getPortPosition(link.sourcePortId);
      const target = d.getPortPosition(link.targetPortId);
      if (source && target) {
        const prev = index <= 0 ? source : link.points[index - 1];
        const next =
          index >= link.points.length - 1 ? target : link.points[index + 1];
        const snapped = this.linkGeometry.snapToOrthogonal(
          { x: px, y: py },
          prev,
          next
        );
        px = snapped.x;
        py = snapped.y;
      }
    }

    link.points[index] = new Point(px, py);
    this.state.incrementRenderTick();
    return true;
  }

  /**
   * Remove a waypoint from a link. Pushes undo before removing.
   */
  removeLinkWaypoint(linkId: LinkId, index: number): boolean {
    const d = this.state.getDiagram();
    const link = d?.getLink(linkId);
    if (!d || !link || index < 0 || index >= link.points.length) return false;

    this.undoRedo.pushState();
    link.points.splice(index, 1);
    this.state.setDiagram(d, true);
    return true;
  }

  /**
   * Clear all waypoints from a link. Pushes undo before clearing.
   */
  clearLinkWaypoints(linkId: LinkId): boolean {
    const d = this.state.getDiagram();
    const link = d?.getLink(linkId);
    if (!d || !link || link.points.length === 0) return false;

    this.undoRedo.pushState();
    link.points.length = 0;
    this.state.setDiagram(d, true);
    return true;
  }

  /**
   * Group selected nodes into a GroupNode container.
   * Requirements: at least 2 regular nodes selected, no groups selected.
   * Creates external ports for links crossing group boundary.
   * Pushes undo before grouping.
   */
  groupSelectedNodes(): boolean {
    const d = this.state.getDiagram();
    const selectedNodeIds = this.state.selectedNodeIds();
    if (!d || selectedNodeIds.size < 2) return false;

    // Check that all selected nodes are regular nodes (not groups)
    const selectedNodes: Node[] = [];
    for (const nodeId of selectedNodeIds) {
      const node = d.getNode(nodeId);
      if (!node) return false;
      if (node.nodeType === 'group') {
        // Don't allow grouping of groups (nested groups not supported yet)
        return false;
      }
      selectedNodes.push(node);
    }

    this.undoRedo.pushState();

    // Calculate bounding box of selected nodes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const originalPositions = new Map<NodeId, { x: number; y: number }>();
    for (const node of selectedNodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
      originalPositions.set(node.id, { x: node.x, y: node.y });
    }

    const padding = 30;
    const groupX = minX - padding;
    const groupY = minY - padding;
    const groupWidth = maxX - minX + 2 * padding;
    const groupHeight = maxY - minY + 2 * padding;

    // Create group node
    const groupId = `g${this.state.incrementNodeIdCounter()}` as NodeId;
    const groupNode = new GroupNode({
      id: groupId,
      x: groupX,
      y: groupY,
      width: groupWidth,
      height: groupHeight,
      label: `Group ${this.state.getNodeIdCounter()}`,
      childNodeIds: Array.from(selectedNodeIds),
      childLinkIds: [],
      originalPositions,
      scale: 1,
      ports: [],
    });

    // Find internal and external links
    const childNodeIdSet = new Set(selectedNodeIds);
    const internalLinkIds: LinkId[] = [];
    const externalLinks: Array<{
      link: Link;
      isOutgoing: boolean;
      childPortId: PortId;
      externalPortId: PortId;
    }> = [];

    for (const link of d.links) {
      const sourceNode = this.getNodeByPortId(d, link.sourcePortId);
      const targetNode = this.getNodeByPortId(d, link.targetPortId);
      
      const sourceInGroup = sourceNode && childNodeIdSet.has(sourceNode.id);
      const targetInGroup = targetNode && childNodeIdSet.has(targetNode.id);

      if (sourceInGroup && targetInGroup) {
        // Internal link
        internalLinkIds.push(link.id);
      } else if (sourceInGroup && !targetInGroup) {
        // Outgoing link
        externalLinks.push({
          link,
          isOutgoing: true,
          childPortId: link.sourcePortId,
          externalPortId: link.targetPortId,
        });
      } else if (!sourceInGroup && targetInGroup) {
        // Incoming link
        externalLinks.push({
          link,
          isOutgoing: false,
          childPortId: link.targetPortId,
          externalPortId: link.sourcePortId,
        });
      }
    }

    groupNode.childLinkIds = new Set(internalLinkIds);

    // Store child nodes and links in the group for later restoration
    for (const node of selectedNodes) {
      groupNode.childNodes.set(node.id, node);
    }
    for (const linkId of internalLinkIds) {
      const link = d.getLink(linkId);
      if (link) {
        groupNode.childLinks.set(linkId, link);
      }
    }

    // Create external ports on the group and reconnect links
    const portMap = new Map<PortId, PortId>(); // child port -> group port
    let portCounter = 0;

    for (const { link, isOutgoing, childPortId } of externalLinks) {
      // Check if we already created a port for this child port
      let groupPortId = portMap.get(childPortId);
      
      if (!groupPortId) {
        // Create new external port on group
        portCounter++;
        groupPortId = `${groupId}-ext-${childPortId}` as PortId;
        portMap.set(childPortId, groupPortId);

        // Determine port side based on child node position relative to group
        const childNode = this.getNodeByPortId(d, childPortId);
        let side: PortSide = 'right';
        let offset = groupHeight / 2;

        if (childNode) {
          const childCenterX = childNode.x + childNode.width / 2;
          const childCenterY = childNode.y + childNode.height / 2;
          const groupCenterX = groupX + groupWidth / 2;
          const groupCenterY = groupY + groupHeight / 2;

          // Determine which side of the group the port should be on
          const dx = childCenterX - groupCenterX;
          const dy = childCenterY - groupCenterY;

          if (Math.abs(dx) > Math.abs(dy)) {
            side = dx > 0 ? 'right' : 'left';
            offset = childCenterY - groupY;
          } else {
            side = dy > 0 ? 'bottom' : 'top';
            offset = childCenterX - groupX;
          }
        }

        const port = new Port({
          id: groupPortId,
          nodeId: groupId,
          side,
          offset,
          type: isOutgoing ? 'output' : 'input',
        });
        groupNode.addPort(port);
      }

      // Reconnect the link: remove old and add new with group port
      d.removeLink(link.id);
      const newLink = new Link({
        id: link.id,
        sourcePortId: isOutgoing ? groupPortId : link.sourcePortId,
        targetPortId: isOutgoing ? link.targetPortId : groupPortId,
        points: link.points.map((p) => ({ x: p.x, y: p.y })),
        routing: link.routing,
      });
      d.addLink(newLink);
    }

    // Remove child nodes from diagram (they're now inside the group)
    for (const nodeId of selectedNodeIds) {
      d.removeNode(nodeId);
    }

    // Add group node to diagram
    d.addNode(groupNode);

    // Update scale for preview
    groupNode.updateScale();

    // Select the new group
    this.state.clearSelection();
    this.state.setNodeSelection(new Set([groupId]));
    this.state.setDiagram(d, true);

    return true;
  }

  /**
   * Ungroup a GroupNode, restoring its child nodes and links.
   * Reconnects external links back to original child ports.
   * Pushes undo before ungrouping.
   */
  ungroupNode(groupId: NodeId): boolean {
    const d = this.state.getDiagram();
    const groupNode = d?.getNode(groupId);
    if (!d || !groupNode || !(groupNode instanceof GroupNode)) return false;

    this.undoRedo.pushState();

    // Restore child nodes with their original positions
    const restoredNodeIds: NodeId[] = [];
    for (const childNodeId of groupNode.childNodeIds) {
      const storedNode = groupNode.getChildNode(childNodeId);
      const originalPos = groupNode.getOriginalPosition(childNodeId);
      
      if (storedNode && originalPos) {
        // Restore the original node with its original position
        storedNode.setPosition(originalPos.x, originalPos.y);
        d.addNode(storedNode);
        restoredNodeIds.push(childNodeId);
      }
    }

    // Restore internal links
    for (const childLinkId of groupNode.childLinkIds) {
      const storedLink = groupNode.getChildLink(childLinkId);
      if (storedLink) {
        d.addLink(storedLink);
      }
    }

    // Reconnect external links back to child ports
    const portMap = new Map<PortId, PortId>(); // group port -> child port
    for (const port of groupNode.ports) {
      // Extract child port ID from group port ID (format: "g1-ext-n2-out")
      const match = port.id.match(/-ext-(.+)$/);
      if (match) {
        portMap.set(port.id, match[1] as PortId);
      }
    }

    // Reconnect external links: replace with new links pointing to child ports
    const linksToUpdate = d.links.filter(
      (l) => portMap.has(l.sourcePortId) || portMap.has(l.targetPortId)
    );
    for (const link of linksToUpdate) {
      const childSourcePortId = portMap.get(link.sourcePortId);
      const childTargetPortId = portMap.get(link.targetPortId);
      if (!childSourcePortId && !childTargetPortId) continue;

      d.removeLink(link.id);
      const newLink = new Link({
        id: link.id,
        sourcePortId: childSourcePortId ?? link.sourcePortId,
        targetPortId: childTargetPortId ?? link.targetPortId,
        points: link.points.map((p) => ({ x: p.x, y: p.y })),
        routing: link.routing,
      });
      d.addLink(newLink);
    }

    // Remove the group node
    d.removeNode(groupId);

    // Select the restored nodes
    this.state.clearSelection();
    this.state.setNodeSelection(new Set(restoredNodeIds));
    this.state.setDiagram(d, true);

    return true;
  }

  /**
   * Resize a group node to new dimensions.
   * Updates scale factor for preview content.
   * Does not push undo (caller should push once at resize start).
   */
  resizeGroupNode(groupId: NodeId, newWidth: number, newHeight: number): void {
    const d = this.state.getDiagram();
    const groupNode = d?.getNode(groupId);
    if (!d || !groupNode || !(groupNode instanceof GroupNode)) return;

    // Update dimensions
    groupNode.width = Math.max(newWidth, 100); // Minimum width
    groupNode.height = Math.max(newHeight, 80); // Minimum height

    // Recalculate scale for preview
    groupNode.updateScale();

    // Reposition ports proportionally
    // (Ports stay at their relative positions on the edges)

    this.state.incrementRenderTick();
  }

  /** Helper to find node by port ID. */
  private getNodeByPortId(diagram: Diagram, portId: PortId): Node | undefined {
    for (const node of diagram.nodes) {
      if (node.getPort(portId)) return node;
    }
    return undefined;
  }
}
