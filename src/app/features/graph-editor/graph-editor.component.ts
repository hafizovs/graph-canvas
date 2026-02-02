import {
  Component,
  ChangeDetectionStrategy,
  AfterViewInit,
  OnDestroy,
  signal,
  computed,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
import {
  Diagram,
  Node,
  Link,
  Port,
  deserializeDiagram,
  serializeDiagram,
  cloneDiagramJsonForPaste,
  type DiagramJson,
} from '../../../graph-core';
import type { NodeId, LinkId, PortId } from '../../../graph-core';
import { MOCK_DIAGRAM_CHAIN } from '../../../graph-core';
import { GraphLinkComponent } from './graph-link/graph-link.component';
import { GraphNodeComponent } from './graph-node/graph-node.component';
import { GraphToolbarComponent } from './graph-toolbar/graph-toolbar.component';
import type { NodePointerEvent } from './graph-node/graph-node.component';
import type { PortPointerEvent } from './graph-node/graph-node.component';

@Component({
  selector: 'app-graph-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GraphLinkComponent, GraphNodeComponent, GraphToolbarComponent],
  templateUrl: './graph-editor.component.html',
  styleUrl: './graph-editor.component.scss',
})
export class GraphEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('svgContainer', { static: true }) svgContainer!: ElementRef<SVGSVGElement>;

  protected readonly diagram = signal<Diagram | null>(null);
  protected readonly renderTick = signal(0);
  protected readonly viewBox = signal({ x: 0, y: 0, width: 800, height: 600 });

  protected readonly linkingFrom = signal<{
    portId: PortId;
    nodeId: NodeId;
    portType: 'output' | 'input';
  } | null>(null);
  protected readonly linkingPreviewPoint = signal<{ x: number; y: number } | null>(null);

  protected readonly selectedNodeIds = signal<Set<NodeId>>(new Set());
  protected readonly selectedLinkIds = signal<Set<LinkId>>(new Set());
  protected readonly hasSelection = computed(
    () =>
      this.selectedNodeIds().size > 0 || this.selectedLinkIds().size > 0
  );

  private _diagram: Diagram | null = null;
  private _pendingDrag: { node: Node; startX: number; startY: number } | null = null;
  private _dragging: {
    node: Node;
    startX: number;
    startY: number;
    /** Initial positions of the primary node and all other selected nodes when drag started */
    initialPositions: Map<NodeId, { x: number; y: number }>;
  } | null = null;
  private static readonly DRAG_THRESHOLD_PX = 4;
  private _nodeIdCounter = 0;
  private _linkIdCounter = 0;
  private _clipboard: DiagramJson | null = null;
  private _undoStack: DiagramJson[] = [];
  private _redoStack: DiagramJson[] = [];
  private static readonly MAX_UNDO = 50;

  ngAfterViewInit(): void {
    this.loadDiagramFromJson(MOCK_DIAGRAM_CHAIN);
  }

  /** Load diagram from JSON; does not push to undo stack (use for initial load or restore) */
  protected loadDiagramFromJson(json: DiagramJson): void {
    this.restoreFromJson(json);
  }

  private restoreFromJson(json: DiagramJson): void {
    this._diagram = deserializeDiagram(json);
    this.diagram.set(this._diagram);
    this.selectedNodeIds.set(new Set());
    this.selectedLinkIds.set(new Set());
    this.syncCountersFromDiagram();
    this.renderTick.update((v) => v + 1);
  }

  private pushState(): void {
    const d = this._diagram;
    if (!d) return;
    this._undoStack.push(serializeDiagram(d));
    if (this._undoStack.length > GraphEditorComponent.MAX_UNDO) {
      this._undoStack.shift();
    }
    this._redoStack = [];
  }

  protected onLoadExample(json: DiagramJson): void {
    this.pushState();
    this.restoreFromJson(json);
  }

  protected onLoadFromFile(json: DiagramJson): void {
    this.pushState();
    this.restoreFromJson(json);
  }

  private static readonly STORAGE_KEY = 'graph-canvas-diagram';

  protected onSave(): void {
    const d = this._diagram;
    if (!d) return;
    const json = serializeDiagram(d);
    const str = JSON.stringify(json, null, 2);
    try {
      localStorage.setItem(GraphEditorComponent.STORAGE_KEY, str);
    } catch {
      // ignore quota errors
    }
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  protected onLoadFromStorage(): void {
    try {
      const str = localStorage.getItem(GraphEditorComponent.STORAGE_KEY);
      if (!str) return;
      const json = JSON.parse(str) as DiagramJson;
      if (json && Array.isArray(json.nodes) && Array.isArray(json.links)) {
        this.pushState();
        this.restoreFromJson(json);
      }
    } catch {
      // ignore
    }
  }

  private syncCountersFromDiagram(): void {
    const d = this._diagram;
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

  ngOnDestroy(): void {
    this._diagram = null;
    this.diagram.set(null);
  }

  private clientToSvg(clientX: number, clientY: number): { x: number; y: number } {
    const svg = this.svgContainer?.nativeElement;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    const svgP = ctm ? pt.matrixTransform(ctm.inverse()) : pt;
    return { x: svgP.x, y: svgP.y };
  }

  protected onAddNode(): void {
    const d = this._diagram;
    if (!d) return;
    this.pushState();

    this._nodeIdCounter++;
    const nodeId = `n${this._nodeIdCounter}` as NodeId;
    const vb = this.viewBox();
    const x = vb.x + vb.width / 2 - 60;
    const y = vb.y + vb.height / 2 - 30;

    const node = new Node({
      id: nodeId,
      x,
      y,
      width: 120,
      height: 60,
      label: `Node ${this._nodeIdCounter}`,
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
    this.diagram.set(d);
    this.renderTick.update((v) => v + 1);
  }

  protected onNodePointerDown(e: NodePointerEvent): void {
    if (this.linkingFrom()) return;
    const pt = this.clientToSvg(e.event.clientX, e.event.clientY);
    this._pendingDrag = {
      node: e.node,
      startX: pt.x - e.node.x,
      startY: pt.y - e.node.y,
    };
    (e.event.target as Element).setPointerCapture?.(e.event.pointerId);
  }

  protected onNodePointerMove(e: NodePointerEvent): void {
    const pt = this.clientToSvg(e.event.clientX, e.event.clientY);
    if (this._pendingDrag?.node === e.node) {
      const dx = pt.x - (e.node.x + this._pendingDrag.startX);
      const dy = pt.y - (e.node.y + this._pendingDrag.startY);
      if (Math.sqrt(dx * dx + dy * dy) > GraphEditorComponent.DRAG_THRESHOLD_PX) {
        this.pushState();
        const d = this._diagram;
        const selectedIds = this.selectedNodeIds();
        const initialPositions = new Map<NodeId, { x: number; y: number }>();
        if (d && selectedIds.has(e.node.id)) {
          for (const nodeId of selectedIds) {
            const n = d.getNode(nodeId);
            if (n) initialPositions.set(nodeId, { x: n.x, y: n.y });
          }
        } else {
          initialPositions.set(e.node.id, { x: e.node.x, y: e.node.y });
        }
        this._dragging = {
          node: this._pendingDrag.node,
          startX: this._pendingDrag.startX,
          startY: this._pendingDrag.startY,
          initialPositions,
        };
        this._pendingDrag = null;
      } else {
        return;
      }
    }
    if (!this._dragging || this._dragging.node !== e.node) return;
    const { startX, startY, initialPositions } = this._dragging;
    const primaryInitial = initialPositions.get(this._dragging.node.id);
    if (!primaryInitial) return;
    const newPrimaryX = pt.x - startX;
    const newPrimaryY = pt.y - startY;
    const dx = newPrimaryX - primaryInitial.x;
    const dy = newPrimaryY - primaryInitial.y;
    const d = this._diagram;
    if (d) {
      for (const [nodeId, pos] of initialPositions) {
        const n = d.getNode(nodeId);
        if (n) n.setPosition(pos.x + dx, pos.y + dy);
      }
    }
    this.renderTick.update((v) => v + 1);
  }

  protected onNodePointerUp(e: NodePointerEvent): void {
    (e.event.target as Element).releasePointerCapture?.(e.event.pointerId);
    if (this._dragging?.node === e.node) {
      this._dragging = null;
    } else if (this._pendingDrag?.node === e.node) {
      const id = e.node.id;
      if (e.shiftKey) {
        const next = new Set(this.selectedNodeIds());
        if (next.has(id)) next.delete(id);
        else next.add(id);
        this.selectedNodeIds.set(next);
        this.selectedLinkIds.set(new Set());
      } else {
        this.selectedNodeIds.set(new Set([id]));
        this.selectedLinkIds.set(new Set());
      }
      this._pendingDrag = null;
    }
  }

  protected onPortPointerDown(e: PortPointerEvent): void {
    if (this.linkingFrom()) return;
    if (e.port.type !== 'output') return;

    this.linkingFrom.set({
      portId: e.port.id,
      nodeId: e.node.id,
      portType: 'output',
    });
    const pt = this.clientToSvg(e.event.clientX, e.event.clientY);
    this.linkingPreviewPoint.set(pt);
    (e.event.target as Element).setPointerCapture?.(e.event.pointerId);
  }

  protected onContainerPointerMove(event: PointerEvent): void {
    if (this.linkingFrom()) {
      const pt = this.clientToSvg(event.clientX, event.clientY);
      this.linkingPreviewPoint.set(pt);
    }
  }

  protected onContainerPointerUp(event: PointerEvent): void {
    const from = this.linkingFrom();
    if (from) {
      const underCursor = document.elementFromPoint(event.clientX, event.clientY);
      const target = underCursor?.closest('[data-port-id][data-port-type][data-node-id]');
      const targetPortId = target?.getAttribute('data-port-id') as PortId | null;
      const targetPortType = target?.getAttribute('data-port-type');
      const targetNodeId = target?.getAttribute('data-node-id') as NodeId | null;

      if (
        targetPortId &&
        targetPortType === 'input' &&
        targetNodeId &&
        targetNodeId !== from.nodeId
      ) {
        const d = this._diagram;
        if (d) {
          const hasExisting =
            d.links.some(
              (l) =>
                l.sourcePortId === from.portId && l.targetPortId === targetPortId
            ) || d.links.some((l) => l.targetPortId === targetPortId);
          if (!hasExisting) {
            this.pushState();
            this._linkIdCounter++;
            d.addLink(
              new Link({
                id: `l${this._linkIdCounter}`,
                sourcePortId: from.portId,
                targetPortId,
              })
            );
            this.diagram.set(d);
            this.renderTick.update((v) => v + 1);
          }
        }
      }

      this.linkingFrom.set(null);
      this.linkingPreviewPoint.set(null);
    }
  }

  protected getPreviewPathD(): string {
    const from = this.linkingFrom();
    const preview = this.linkingPreviewPoint();
    const d = this._diagram;
    if (!from || !preview || !d) return '';

    const source = d.getPortPosition(from.portId);
    if (!source) return '';
    return `M ${source.x} ${source.y} L ${preview.x} ${preview.y}`;
  }

  protected onLinkSelect(payload: { link: Link; shiftKey: boolean }): void {
    const id = payload.link.id;
    if (payload.shiftKey) {
      const next = new Set(this.selectedLinkIds());
      if (next.has(id)) next.delete(id);
      else next.add(id);
      this.selectedLinkIds.set(next);
      this.selectedNodeIds.set(new Set());
    } else {
      this.selectedLinkIds.set(new Set([id]));
      this.selectedNodeIds.set(new Set());
    }
  }

  protected onDeleteSelection(): void {
    const d = this._diagram;
    if (!d) return;
    const nodeIds = this.selectedNodeIds();
    const linkIds = this.selectedLinkIds();
    const wouldChange =
      nodeIds.size > 0 || linkIds.size > 0;
    if (!wouldChange) return;
    this.pushState();

    let changed = false;
    for (const nodeId of nodeIds) {
      if (d.removeNode(nodeId)) changed = true;
    }
    for (const linkId of linkIds) {
      if (d.removeLink(linkId)) changed = true;
    }
    if (changed) {
      this.selectedNodeIds.set(new Set());
      this.selectedLinkIds.set(new Set());
      this.diagram.set(d);
      this.renderTick.update((v) => v + 1);
    }
  }

  protected onCanvasPointerDown(event: PointerEvent): void {
    const target = event.target as Element;
    if (target.closest('g[app-graph-node]') || target.closest('.link-path')) return;
    this.selectedNodeIds.set(new Set());
    this.selectedLinkIds.set(new Set());
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeyDown(event: KeyboardEvent): void {
    const tag = (event.target as Element)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (event.key === 'Escape') {
      this.selectedNodeIds.set(new Set());
      this.selectedLinkIds.set(new Set());
      return;
    }

    if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      const d = this._diagram;
      if (!d) return;
      this.selectedNodeIds.set(new Set(d.nodes.map((n) => n.id)));
      this.selectedLinkIds.set(new Set(d.links.map((l) => l.id)));
      return;
    }

    if (event.key === 'c' && (event.ctrlKey || event.metaKey)) {
      this.onCopy();
      return;
    }

    if (event.key === 'v' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.onPaste();
      return;
    }

    if (event.key === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
      event.preventDefault();
      this.undo();
      return;
    }

    if (
      (event.key === 'y' && (event.ctrlKey || event.metaKey)) ||
      (event.key === 'z' && event.ctrlKey && event.shiftKey) ||
      (event.key === 'z' && event.metaKey && event.shiftKey)
    ) {
      event.preventDefault();
      this.redo();
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      this.onDeleteSelection();
    }
  }

  protected undo(): void {
    if (this._undoStack.length === 0 || !this._diagram) return;
    this._redoStack.push(serializeDiagram(this._diagram));
    const json = this._undoStack.pop()!;
    this.restoreFromJson(json);
  }

  protected redo(): void {
    if (this._redoStack.length === 0 || !this._diagram) return;
    this._undoStack.push(serializeDiagram(this._diagram));
    const json = this._redoStack.pop()!;
    this.restoreFromJson(json);
  }

  private onCopy(): void {
    const d = this._diagram;
    const nodeIdSet = this.selectedNodeIds();
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
    this._clipboard = serializeDiagram(subsetDiagram);
  }

  private onPaste(): void {
    if (!this._clipboard || !this._diagram) return;
    this.pushState();
    const PASTE_OFFSET = 20;
    const { json, newNodeIds } = cloneDiagramJsonForPaste(
      this._clipboard,
      PASTE_OFFSET,
      PASTE_OFFSET,
      this._nodeIdCounter,
      this._linkIdCounter
    );
    const pasted = deserializeDiagram(json);
    for (const node of pasted.nodes) {
      this._diagram.addNode(node);
      const m = /^n(\d+)$/.exec(node.id);
      if (m) this._nodeIdCounter = Math.max(this._nodeIdCounter, parseInt(m[1], 10));
    }
    for (const link of pasted.links) {
      this._diagram.addLink(link);
      const m = /^l(\d+)$/.exec(link.id);
      if (m) this._linkIdCounter = Math.max(this._linkIdCounter, parseInt(m[1], 10));
    }
    this.selectedNodeIds.set(new Set(newNodeIds));
    this.selectedLinkIds.set(new Set());
    this.diagram.set(this._diagram);
    this.renderTick.update((v) => v + 1);
  }
}
