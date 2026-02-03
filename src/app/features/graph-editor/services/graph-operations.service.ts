import { Injectable } from '@angular/core';
import {
  Diagram,
  Node,
  Link,
  Port,
  Point,
  deserializeDiagram,
  serializeDiagram,
  cloneDiagramJsonForPaste,
} from '../../../../graph-core';
import type { DiagramJson } from '../../../../graph-core';
import type { LinkId, NodeId, NodeShape, PortId } from '../../../../graph-core';
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
  addNodeFromPalette(shape: NodeShape, svgX: number, svgY: number): void {
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
   * Returns true if anything was removed.
   */
  deleteSelection(): boolean {
    const d = this.state.getDiagram();
    if (!d) return false;
    const nodeIds = this.state.selectedNodeIds();
    const linkIds = this.state.selectedLinkIds();
    if (nodeIds.size === 0 && linkIds.size === 0) return false;

    this.undoRedo.pushState();
    let changed = false;
    for (const nodeId of nodeIds) {
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
}
