import {
  Component,
  ChangeDetectionStrategy,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  HostListener,
  inject,
} from '@angular/core';
import type { DiagramJson } from '../../../graph-core';
import { MOCK_DIAGRAM_CHAIN } from '../../../graph-core';
import { GraphLinkComponent } from './graph-link/graph-link.component';
import { GraphNodeComponent } from './graph-node/graph-node.component';
import { GraphToolbarComponent } from './graph-toolbar/graph-toolbar.component';
import type { NodePointerEvent } from './graph-node/graph-node.component';
import type { PortPointerEvent } from './graph-node/graph-node.component';
import type { Link, Node } from '../../../graph-core';
import type { NodeId, PortId } from '../../../graph-core';
import { GraphEditorStateService } from './services/graph-editor-state.service';
import { GraphUndoRedoService } from './services/graph-undo-redo.service';
import { GraphOperationsService } from './services/graph-operations.service';
import { GraphCoordinateService } from './services/graph-coordinate.service';
import { serializeDiagram } from '../../../graph-core';

/**
 * Main graph editor container. Coordinates state, undo/redo, operations, and coordinate services.
 * Handles pointer/keyboard events and delegates mutations to GraphOperationsService; drag state is local.
 */
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

  protected readonly state = inject(GraphEditorStateService);
  private readonly undoRedo = inject(GraphUndoRedoService);
  private readonly operations = inject(GraphOperationsService);
  private readonly coordinate = inject(GraphCoordinateService);

  protected readonly diagram = this.state.diagram;
  protected readonly renderTick = this.state.renderTick;
  protected readonly viewBox = this.state.viewBox;
  protected readonly linkingFrom = this.state.linkingFrom;
  protected readonly linkingPreviewPoint = this.state.linkingPreviewPoint;
  protected readonly selectedNodeIds = this.state.selectedNodeIds;
  protected readonly selectedLinkIds = this.state.selectedLinkIds;
  protected readonly hasSelection = this.state.hasSelection;

  private _pendingDrag: { node: Node; startX: number; startY: number } | null = null;
  private _dragging: {
    node: Node;
    startX: number;
    startY: number;
    initialPositions: Map<NodeId, { x: number; y: number }>;
  } | null = null;
  private static readonly DRAG_THRESHOLD_PX = 4;

  private static readonly STORAGE_KEY = 'graph-canvas-diagram';

  /** Load example diagram on init. */
  ngAfterViewInit(): void {
    this.loadDiagramFromJson(MOCK_DIAGRAM_CHAIN);
  }

  /** Load diagram from JSON without pushing undo (initial load or programmatic restore). */
  protected loadDiagramFromJson(json: DiagramJson): void {
    this.state.setDiagramFromJson(json);
  }

  /** Load example diagram; pushes undo so it can be undone. */
  protected onLoadExample(json: DiagramJson): void {
    this.undoRedo.pushState();
    this.undoRedo.restoreFromJson(json);
  }

  /** Load diagram from file; pushes undo. */
  protected onLoadFromFile(json: DiagramJson): void {
    this.undoRedo.pushState();
    this.undoRedo.restoreFromJson(json);
  }

  /** Serialize diagram to JSON, save to localStorage and trigger file download. */
  protected onSave(): void {
    const d = this.state.getDiagram();
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

  /** Load diagram from localStorage; pushes undo. */
  protected onLoadFromStorage(): void {
    try {
      const str = localStorage.getItem(GraphEditorComponent.STORAGE_KEY);
      if (!str) return;
      const json = JSON.parse(str) as DiagramJson;
      if (json && Array.isArray(json.nodes) && Array.isArray(json.links)) {
        this.undoRedo.pushState();
        this.undoRedo.restoreFromJson(json);
      }
    } catch {
      // ignore
    }
  }

  /** Clear diagram reference on destroy. */
  ngOnDestroy(): void {
    this.state.setDiagram(null, false);
  }

  /** Add a new node at view center (undoable). */
  protected onAddNode(): void {
    this.operations.addNode();
  }

  /** Start pending drag or capture pointer for click. */
  protected onNodePointerDown(e: NodePointerEvent): void {
    if (this.state.linkingFrom()) return;
    const pt = this.coordinate.clientToSvg(
      this.svgContainer?.nativeElement,
      e.event.clientX,
      e.event.clientY
    );
    this._pendingDrag = {
      node: e.node,
      startX: pt.x - e.node.x,
      startY: pt.y - e.node.y,
    };
    (e.event.target as Element).setPointerCapture?.(e.event.pointerId);
  }

  /** After drag threshold: push undo once and move nodes; otherwise update drag position. */
  protected onNodePointerMove(e: NodePointerEvent): void {
    const pt = this.coordinate.clientToSvg(
      this.svgContainer?.nativeElement,
      e.event.clientX,
      e.event.clientY
    );
    if (this._pendingDrag?.node === e.node) {
      const dx = pt.x - (e.node.x + this._pendingDrag.startX);
      const dy = pt.y - (e.node.y + this._pendingDrag.startY);
      if (Math.sqrt(dx * dx + dy * dy) > GraphEditorComponent.DRAG_THRESHOLD_PX) {
        this.undoRedo.pushState();
        const d = this.state.getDiagram();
        const selectedIds = this.state.selectedNodeIds();
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
    this.operations.moveNodes(initialPositions, dx, dy);
  }

  /** End drag or apply click selection (single or Shift-toggle). */
  protected onNodePointerUp(e: NodePointerEvent): void {
    (e.event.target as Element).releasePointerCapture?.(e.event.pointerId);
    if (this._dragging?.node === e.node) {
      this._dragging = null;
    } else if (this._pendingDrag?.node === e.node) {
      const id = e.node.id;
      if (e.shiftKey) {
        this.state.toggleNodeSelection(id);
      } else {
        this.state.setNodeSelection(new Set([id]));
      }
      this._pendingDrag = null;
    }
  }

  /** Start link drag from output port; set linking state and preview point. */
  protected onPortPointerDown(e: PortPointerEvent): void {
    if (this.state.linkingFrom()) return;
    if (e.port.type !== 'output') return;
    this.state.setLinkingFrom({
      portId: e.port.id,
      nodeId: e.node.id,
      portType: 'output',
    });
    const pt = this.coordinate.clientToSvg(
      this.svgContainer?.nativeElement,
      e.event.clientX,
      e.event.clientY
    );
    this.state.setLinkingPreviewPoint(pt);
    (e.event.target as Element).setPointerCapture?.(e.event.pointerId);
  }

  /** Update link preview point while dragging. */
  protected onContainerPointerMove(event: PointerEvent): void {
    if (this.state.linkingFrom()) {
      const pt = this.coordinate.clientToSvg(
        this.svgContainer?.nativeElement,
        event.clientX,
        event.clientY
      );
      this.state.setLinkingPreviewPoint(pt);
    }
  }

  /** Complete or cancel link: if over valid input port, create link (undoable). */
  protected onContainerPointerUp(event: PointerEvent): void {
    const from = this.state.linkingFrom();
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
        this.operations.createLink(from.portId, from.nodeId, targetPortId, targetNodeId);
      }

      this.state.setLinkingFrom(null);
      this.state.setLinkingPreviewPoint(null);
    }
  }

  /** SVG path d for the link preview line (source port to current pointer). */
  protected getPreviewPathD(): string {
    const from = this.state.linkingFrom();
    const preview = this.state.linkingPreviewPoint();
    const d = this.state.getDiagram();
    if (!from || !preview || !d) return '';
    const source = d.getPortPosition(from.portId);
    if (!source) return '';
    return `M ${source.x} ${source.y} L ${preview.x} ${preview.y}`;
  }

  /** Select link (single or Shift-toggle). */
  protected onLinkSelect(payload: { link: Link; shiftKey: boolean }): void {
    const id = payload.link.id;
    if (payload.shiftKey) {
      this.state.toggleLinkSelection(id);
    } else {
      this.state.setLinkSelection(new Set([id]));
    }
  }

  /** Delete selected nodes and links (undoable). */
  protected onDeleteSelection(): void {
    this.operations.deleteSelection();
  }

  /** Clear selection when clicking on canvas (not on node/link). */
  protected onCanvasPointerDown(event: PointerEvent): void {
    const target = event.target as Element;
    if (target.closest('g[app-graph-node]') || target.closest('.link-path')) return;
    this.state.clearSelection();
  }

  /** Handle Escape (clear selection), Ctrl+A (select all), Ctrl+C/V (copy/paste), Ctrl+Z/Y (undo/redo), Delete/Backspace (delete). */
  @HostListener('document:keydown', ['$event'])
  protected onKeyDown(event: KeyboardEvent): void {
    const tag = (event.target as Element)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (event.key === 'Escape') {
      this.state.clearSelection();
      return;
    }

    if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.state.selectAllNodesAndLinks();
      return;
    }

    if (event.key === 'c' && (event.ctrlKey || event.metaKey)) {
      this.operations.copy();
      return;
    }

    if (event.key === 'v' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.operations.paste();
      return;
    }

    if (event.key === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
      event.preventDefault();
      this.undoRedo.undo();
      return;
    }

    if (
      (event.key === 'y' && (event.ctrlKey || event.metaKey)) ||
      (event.key === 'z' && event.ctrlKey && event.shiftKey) ||
      (event.key === 'z' && event.metaKey && event.shiftKey)
    ) {
      event.preventDefault();
      this.undoRedo.redo();
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      this.onDeleteSelection();
    }
  }

  /** Undo one step. */
  protected undo(): void {
    this.undoRedo.undo();
  }

  /** Redo one step. */
  protected redo(): void {
    this.undoRedo.redo();
  }
}
