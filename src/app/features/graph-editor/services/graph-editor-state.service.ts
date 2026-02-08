import { Injectable, signal, computed } from '@angular/core';
import { deserializeDiagram } from '../../../../graph-core';
import type { Diagram } from '../../../../graph-core';
import type { DiagramJson } from '../../../../graph-core';
import type { LinkRouting } from '../../../../graph-core';
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

/** Rubber-band selection rectangle (any two corners as x1,y1 and x2,y2). */
export interface SelectionRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
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
  readonly selectionRect = signal<SelectionRect | null>(null);
  readonly hasSelection = computed(
    () =>
      this.selectedNodeIds().size > 0 || this.selectedLinkIds().size > 0
  );

  /** When true, node positions snap to grid (add, move, paste, palette drop). */
  readonly snapToGridEnabled = signal(true);

  /** When true, LOD (Level of Detail) and Canvas rendering are enabled at low zoom. */
  readonly lodEnabled = signal(false);

  /** Default link routing for newly created links (used by createLink). */
  readonly defaultLinkRouting = signal<LinkRouting>('orthogonal');

  /** True while Space is held (for pan-with-left-drag cursor). */
  readonly spaceKeyDown = signal(false);

  /** True when Pan tool is active in toolbar (left-drag pans without Space). */
  readonly panToolActive = signal(false);

  /** Set Space key state (used by keyboard directive). */
  setSpaceKeyDown(value: boolean): void {
    this.spaceKeyDown.set(value);
  }

  /** Set Pan tool active (used by toolbar toggle). */
  setPanToolActive(value: boolean): void {
    this.panToolActive.set(value);
  }

  /** Set snap-to-grid on or off. */
  setSnapToGridEnabled(value: boolean): void {
    this.snapToGridEnabled.set(value);
  }

  /** Toggle snap-to-grid (for toolbar button). */
  toggleSnapToGrid(): void {
    this.snapToGridEnabled.update((v) => !v);
  }

  /** Set LOD and Canvas rendering on or off. */
  setLodEnabled(value: boolean): void {
    this.lodEnabled.set(value);
  }

  /** Toggle LOD and Canvas (for toolbar button). */
  toggleLodEnabled(): void {
    this.lodEnabled.update((v) => !v);
  }

  /** Set default link routing (for new links and toolbar select when no links selected). */
  setDefaultLinkRouting(routing: LinkRouting): void {
    this.defaultLinkRouting.set(routing);
  }

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

  /** Set both node and link selection at once (e.g. rubber-band selection). */
  setNodeAndLinkSelection(nodeIds: Set<NodeId>, linkIds: Set<LinkId>): void {
    this.selectedNodeIds.set(nodeIds);
    this.selectedLinkIds.set(linkIds);
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

  /** Set viewBox (for pan/zoom). */
  setViewBox(vb: { x: number; y: number; width: number; height: number }): void {
    this.viewBox.set(vb);
  }

  /** Set rubber-band selection rectangle (null to clear). */
  setSelectionRect(rect: SelectionRect | null): void {
    this.selectionRect.set(rect);
  }

  /** Select all nodes whose rect intersects the given rect; clears selectionRect. */
  selectNodesInRect(rect: SelectionRect): void {
    const d = this.getDiagram();
    if (!d) {
      this.setSelectionRect(null);
      return;
    }
    const xMin = Math.min(rect.x1, rect.x2);
    const xMax = Math.max(rect.x1, rect.x2);
    const yMin = Math.min(rect.y1, rect.y2);
    const yMax = Math.max(rect.y1, rect.y2);
    const ids = new Set<NodeId>();
    for (const node of d.nodes) {
      const r = node.getRect();
      const intersects =
        r.x + r.width >= xMin &&
        r.x <= xMax &&
        r.y + r.height >= yMin &&
        r.y <= yMax;
      if (intersects) ids.add(node.id);
    }
    this.setNodeSelection(ids);
    this.setSelectionRect(null);
  }
}
