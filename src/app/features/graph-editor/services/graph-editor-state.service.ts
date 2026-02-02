import { Injectable, signal, computed } from '@angular/core';
import { deserializeDiagram } from '../../../../graph-core';
import type { Diagram } from '../../../../graph-core';
import type { DiagramJson } from '../../../../graph-core';
import type { NodeId, LinkId, PortId } from '../../../../graph-core';

/**
 * State while user is dragging a new link from an output port.
 * Used to draw preview line and to complete link on pointer up.
 */
export interface LinkingFromState {
  portId: PortId;
  nodeId: NodeId;
  portType: 'output' | 'input';
}

/**
 * Holds all reactive state for the graph editor: diagram, selection, linking preview,
 * viewBox, render tick, id counters, and clipboard. Single source of truth for UI binding.
 * Signals: diagram, renderTick, viewBox, linkingFrom, linkingPreviewPoint, selectedNodeIds,
 * selectedLinkIds, hasSelection (computed).
 */
@Injectable({ providedIn: 'root' })
export class GraphEditorStateService {
  readonly diagram = signal<Diagram | null>(null);
  readonly renderTick = signal(0);
  readonly viewBox = signal({ x: 0, y: 0, width: 800, height: 600 });

  readonly linkingFrom = signal<LinkingFromState | null>(null);
  readonly linkingPreviewPoint = signal<{ x: number; y: number } | null>(null);

  readonly selectedNodeIds = signal<Set<NodeId>>(new Set());
  readonly selectedLinkIds = signal<Set<LinkId>>(new Set());
  readonly hasSelection = computed(
    () =>
      this.selectedNodeIds().size > 0 || this.selectedLinkIds().size > 0
  );

  private _nodeIdCounter = 0;
  private _linkIdCounter = 0;
  private _clipboard: DiagramJson | null = null;

  /** Current diagram instance (mutable). Use diagram() for reactive reads. */
  getDiagram(): Diagram | null {
    return this.diagram();
  }

  /** Set diagram and optionally bump render tick. */
  setDiagram(d: Diagram | null, bumpTick = true): void {
    this.diagram.set(d);
    if (bumpTick) this.incrementRenderTick();
  }

  /** Replace diagram with deserialized JSON; clear selection and sync id counters. Used by load/undo/redo. */
  setDiagramFromJson(json: DiagramJson): void {
    const d = deserializeDiagram(json);
    this.setDiagram(d, true);
    this.clearSelection();
    this.syncCountersFromDiagram();
  }

  /** Increment render tick to trigger template updates after in-place diagram mutations. */
  incrementRenderTick(): void {
    this.renderTick.update((v) => v + 1);
  }

  /** Sync node/link id counters from current diagram (e.g. after load/restore). */
  syncCountersFromDiagram(): void {
    const d = this.diagram();
    if (!d) return;
    let maxN = 0;
    let maxL = 0;
    for (const node of d.nodes) {
      const m = /^n(\d+)$/.exec(node.id);
      if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
    }
    for (const link of d.links) {
      const m = /^l(\d+)$/.exec(link.id);
      if (m) maxL = Math.max(maxL, parseInt(m[1], 10));
    }
    this._nodeIdCounter = maxN;
    this._linkIdCounter = maxL;
  }

  /** Current node id counter (n1, n2, ...). */
  getNodeIdCounter(): number {
    return this._nodeIdCounter;
  }

  /** Set node id counter (e.g. after load or paste). */
  setNodeIdCounter(value: number): void {
    this._nodeIdCounter = value;
  }

  /** Increment and return new node id counter. */
  incrementNodeIdCounter(): number {
    this._nodeIdCounter++;
    return this._nodeIdCounter;
  }

  /** Current link id counter (l1, l2, ...). */
  getLinkIdCounter(): number {
    return this._linkIdCounter;
  }

  /** Set link id counter (e.g. after load or paste). */
  setLinkIdCounter(value: number): void {
    this._linkIdCounter = value;
  }

  /** Increment and return new link id counter. */
  incrementLinkIdCounter(): number {
    this._linkIdCounter++;
    return this._linkIdCounter;
  }

  /** Clipboard content (DiagramJson) for paste. */
  getClipboard(): DiagramJson | null {
    return this._clipboard;
  }

  /** Set clipboard (e.g. after copy). */
  setClipboard(json: DiagramJson | null): void {
    this._clipboard = json;
  }

  /** Clear node and link selection. */
  clearSelection(): void {
    this.selectedNodeIds.set(new Set());
    this.selectedLinkIds.set(new Set());
  }

  /** Set selected nodes and clear link selection. */
  setNodeSelection(ids: Set<NodeId>): void {
    this.selectedNodeIds.set(ids);
    this.selectedLinkIds.set(new Set());
  }

  /** Set selected links and clear node selection. */
  setLinkSelection(ids: Set<LinkId>): void {
    this.selectedLinkIds.set(ids);
    this.selectedNodeIds.set(new Set());
  }

  /** Toggle one node in selection (Shift+click); clear link selection. */
  toggleNodeSelection(nodeId: NodeId): void {
    const next = new Set(this.selectedNodeIds());
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    this.selectedNodeIds.set(next);
    this.selectedLinkIds.set(new Set());
  }

  /** Toggle one link in selection (Shift+click); clear node selection. */
  toggleLinkSelection(linkId: LinkId): void {
    const next = new Set(this.selectedLinkIds());
    if (next.has(linkId)) next.delete(linkId);
    else next.add(linkId);
    this.selectedLinkIds.set(next);
    this.selectedNodeIds.set(new Set());
  }

  /** Select all nodes and links in the current diagram. */
  selectAllNodesAndLinks(): void {
    const d = this.diagram();
    if (!d) return;
    this.selectedNodeIds.set(new Set(d.nodes.map((n) => n.id)));
    this.selectedLinkIds.set(new Set(d.links.map((l) => l.id)));
  }

  /** Set linking-from state (start or cancel link drag). */
  setLinkingFrom(state: LinkingFromState | null): void {
    this.linkingFrom.set(state);
  }

  /** Set preview point for link-in-progress. */
  setLinkingPreviewPoint(point: { x: number; y: number } | null): void {
    this.linkingPreviewPoint.set(point);
  }
}
