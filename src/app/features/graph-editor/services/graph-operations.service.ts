import { Injectable } from '@angular/core';
import {
  Diagram,
  Node,
  Link,
  Port,
  deserializeDiagram,
  serializeDiagram,
  cloneDiagramJsonForPaste,
} from '../../../../graph-core';
import type { DiagramJson } from '../../../../graph-core';
import type { NodeId, PortId } from '../../../../graph-core';
import { GraphEditorStateService } from './graph-editor-state.service';
import { GraphUndoRedoService } from './graph-undo-redo.service';

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
    private undoRedo: GraphUndoRedoService
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
    const x = vb.x + vb.width / 2 - 60;
    const y = vb.y + vb.height / 2 - 30;

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
      if (n) n.setPosition(pos.x + dx, pos.y + dy);
    }
    this.state.incrementRenderTick();
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
}
