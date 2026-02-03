import {
  Component,
  ChangeDetectionStrategy,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  HostListener,
  inject,
  input,
  signal,
  effect,
} from '@angular/core';
import type { DiagramJson } from '../../../graph-core';
import { MOCK_DIAGRAM_CHAIN } from '../../../graph-core';
import type { NodeShape } from '../../../graph-core';
import { GraphLinkComponent } from './graph-link/graph-link.component';
import { GraphNodeComponent } from './graph-node/graph-node.component';
import { GraphPaletteComponent } from './graph-palette/graph-palette.component';
import { GraphToolbarComponent } from './graph-toolbar/graph-toolbar.component';
import type {
  NodePointerEvent,
  NodeContextMenuEvent,
} from './graph-node/graph-node.component';
import type { PortPointerEvent } from './graph-node/graph-node.component';
import type { Link, Node } from '../../../graph-core';
import type { LinkId, NodeId, PortId } from '../../../graph-core';
import { GraphEditorStateService } from './services/graph-editor-state.service';
import { GraphUndoRedoService } from './services/graph-undo-redo.service';
import { GraphOperationsService } from './services/graph-operations.service';
import { GraphLinkGeometryService } from './services/graph-link-geometry.service';
import { GraphCoordinateService, GRID_STEP } from './services/graph-coordinate.service';
import { GraphViewportService } from './services/graph-viewport.service';
import { serializeDiagram } from '../../../graph-core';
import type {
  PathPointerPayload,
  SegmentMidpointPayload,
  WaypointPointerPayload,
} from './graph-link/graph-link.component';

/**
 * Main graph editor container. Coordinates state, undo/redo, operations, and coordinate services.
 * Handles pointer/keyboard events and delegates mutations to GraphOperationsService; drag state is local.
 */
@Component({
  selector: 'app-graph-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GraphLinkComponent, GraphNodeComponent, GraphPaletteComponent, GraphToolbarComponent],
  templateUrl: './graph-editor.component.html',
  styleUrl: './graph-editor.component.scss',
})
export class GraphEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('svgContainer', { static: true }) svgContainer!: ElementRef<SVGSVGElement>;

  protected readonly state = inject(GraphEditorStateService);
  private readonly undoRedo = inject(GraphUndoRedoService);
  private readonly operations = inject(GraphOperationsService);
  private readonly linkGeometry = inject(GraphLinkGeometryService);
  private readonly coordinate = inject(GraphCoordinateService);
  private readonly viewport = inject(GraphViewportService);

  protected readonly diagram = this.state.diagram;
  protected readonly renderTick = this.state.renderTick;
  protected readonly viewBox = this.state.viewBox;
  protected readonly linkingFrom = this.state.linkingFrom;
  protected readonly linkingPreviewPoint = this.state.linkingPreviewPoint;
  protected readonly selectedNodeIds = this.state.selectedNodeIds;
  protected readonly selectedLinkIds = this.state.selectedLinkIds;
  protected readonly selectionRect = this.state.selectionRect;
  protected readonly hasSelection = this.state.hasSelection;
  protected readonly gridStep = GRID_STEP;
  protected readonly snapToGridEnabled = this.state.snapToGridEnabled;

  /** Initial snap-to-grid from config (input). */
  readonly snapToGrid = input<boolean>(true);

  protected readonly draggingFromPalette = signal<{ shape: NodeShape; pointerId: number } | null>(null);
  protected readonly paletteDropPreview = signal<{ x: number; y: number; shape: NodeShape } | null>(null);
  /** Node context menu position (client coordinates); null when closed. */
  protected readonly nodeContextMenuPosition = signal<{ x: number; y: number } | null>(null);

  private _palettePointerMove = (e: PointerEvent) => this.onPalettePointerMove(e);
  private _palettePointerUp = (e: PointerEvent) => this.onPalettePointerUp(e);
  private _waypointPointerMove = (e: PointerEvent) => this.onWaypointPointerMove(e);
  private _waypointPointerUp = (e: PointerEvent) => this.onWaypointPointerUp(e);
  private _segmentDragPointerMove = (e: PointerEvent) => this.onSegmentDragPointerMove(e);
  private _segmentDragPointerUp = (e: PointerEvent) => this.onSegmentDragPointerUp(e);

  private onWaypointPointerMove(event: PointerEvent): void {
    if (!this._draggingWaypoint || event.pointerId !== this._draggingWaypoint.pointerId) return;
    if (!this._draggingWaypoint.pushedUndo) {
      this._draggingWaypoint.pushedUndo = true;
      this.undoRedo.pushState();
    }
    const svg = this.svgContainer?.nativeElement;
    if (!svg) return;
    const pt = this.coordinate.clientToSvg(svg, event.clientX, event.clientY);
    this.operations.moveLinkWaypoint(
      this._draggingWaypoint.linkId,
      this._draggingWaypoint.pointIndex,
      pt.x,
      pt.y
    );
  }

  private onWaypointPointerUp(event: PointerEvent): void {
    if (!this._draggingWaypoint || event.pointerId !== this._draggingWaypoint.pointerId) return;
    this._draggingWaypoint.target.releasePointerCapture?.(this._draggingWaypoint.pointerId);
    document.removeEventListener('pointermove', this._waypointPointerMove);
    document.removeEventListener('pointerup', this._waypointPointerUp);
    this._draggingWaypoint = null;
  }

  private _spaceKey = false;
  private _panning: { startClientX: number; startClientY: number; startViewBoxX: number; startViewBoxY: number; pointerId: number; target: Element } | null = null;
  private _rubberBand: { x1: number; y1: number; pointerId: number; target: Element } | null = null;

  private _pendingDrag: { node: Node; startX: number; startY: number } | null = null;
  private _dragging: {
    node: Node;
    startX: number;
    startY: number;
    initialPositions: Map<NodeId, { x: number; y: number }>;
  } | null = null;
  private _draggingWaypoint: {
    linkId: LinkId;
    pointIndex: number;
    pointerId: number;
    target: Element;
    pushedUndo: boolean;
  } | null = null;
  private _pendingSegmentDrag: {
    linkId: LinkId;
    segIdx: number;
    projected: { x: number; y: number };
    pointerId: number;
    target: Element;
  } | null = null;
  private static readonly DRAG_THRESHOLD_PX = 4;

  private static readonly STORAGE_KEY = 'graph-canvas-diagram';

  private _wheelHandler = (event: WheelEvent) => this.onCanvasWheel(event);

  constructor() {
    effect(() => {
      this.state.setSnapToGridEnabled(this.snapToGrid());
    });
  }

  /** Load example diagram on init; attach wheel zoom (non-passive so preventDefault works). */
  ngAfterViewInit(): void {
    this.loadDiagramFromJson(MOCK_DIAGRAM_CHAIN);
    const el = this.svgContainer?.nativeElement;
    if (el) el.addEventListener('wheel', this._wheelHandler, { passive: false });
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

  /** Clear diagram reference and wheel listener on destroy. */
  ngOnDestroy(): void {
    const el = this.svgContainer?.nativeElement;
    if (el) el.removeEventListener('wheel', this._wheelHandler);
    this.state.setDiagram(null, false);
  }

  /** Add a new node at view center (undoable). */
  protected onAddNode(): void {
    this.operations.addNode();
  }

  /** Toggle snap-to-grid (toolbar button). */
  protected onSnapToGridToggle(): void {
    this.state.toggleSnapToGrid();
  }

  /** Start drag from palette; capture pointer and listen for move/up on document. */
  protected onPaletteShapeDragStart(payload: { shape: NodeShape; pointerId: number }): void {
    this.draggingFromPalette.set({ shape: payload.shape, pointerId: payload.pointerId });
    document.addEventListener('pointermove', this._palettePointerMove);
    document.addEventListener('pointerup', this._palettePointerUp);
  }

  private onPalettePointerMove(event: PointerEvent): void {
    const drag = this.draggingFromPalette();
    if (!drag || event.pointerId !== drag.pointerId) return;
    const svg = this.svgContainer?.nativeElement;
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const overCanvas = svg && (under === svg || svg.contains(under));
    if (overCanvas && svg) {
      const pt = this.coordinate.clientToSvg(svg, event.clientX, event.clientY);
      const { x, y } = this.state.snapToGridEnabled()
        ? this.coordinate.snapToGrid(pt.x, pt.y)
        : { x: pt.x, y: pt.y };
      this.paletteDropPreview.set({ x, y, shape: drag.shape });
    } else {
      this.paletteDropPreview.set(null);
    }
  }

  private onPalettePointerUp(event: PointerEvent): void {
    const drag = this.draggingFromPalette();
    if (!drag || event.pointerId !== drag.pointerId) return;
    document.removeEventListener('pointermove', this._palettePointerMove);
    document.removeEventListener('pointerup', this._palettePointerUp);
    const preview = this.paletteDropPreview();
    if (preview) {
      this.operations.addNodeFromPalette(preview.shape, preview.x, preview.y);
    }
    this.draggingFromPalette.set(null);
    this.paletteDropPreview.set(null);
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

  /** Update link preview point, pan, rubber-band, or waypoint/segment drag. */
  protected onContainerPointerMove(event: PointerEvent): void {
    if (this.state.linkingFrom()) {
      const pt = this.coordinate.clientToSvg(
        this.svgContainer?.nativeElement,
        event.clientX,
        event.clientY
      );
      this.state.setLinkingPreviewPoint(pt);
      return;
    }
    const svg = this.svgContainer?.nativeElement;
    if (this._panning && svg) {
      const r = svg.getBoundingClientRect();
      const vb = this.state.viewBox();
      const dxSvg = ((this._panning.startClientX - event.clientX) * vb.width) / r.width;
      const dySvg = ((this._panning.startClientY - event.clientY) * vb.height) / r.height;
      this.viewport.pan(-dxSvg, -dySvg);
      this._panning.startClientX = event.clientX;
      this._panning.startClientY = event.clientY;
      return;
    }
    if (this._rubberBand && svg) {
      const pt = this.coordinate.clientToSvg(svg, event.clientX, event.clientY);
      this.state.setSelectionRect({
        x1: this._rubberBand.x1,
        y1: this._rubberBand.y1,
        x2: pt.x,
        y2: pt.y,
      });
    }
    if (this._draggingWaypoint && svg) {
      const pt = this.coordinate.clientToSvg(svg, event.clientX, event.clientY);
      this.operations.moveLinkWaypoint(
        this._draggingWaypoint.linkId,
        this._draggingWaypoint.pointIndex,
        pt.x,
        pt.y
      );
    }
  }

  /** Complete or cancel link; end pan or rubber-band. (Waypoint/segment drag use document listeners.) */
  protected onContainerPointerUp(event: PointerEvent): void {
    if (this._panning) {
      this._panning.target.releasePointerCapture?.(this._panning.pointerId);
      this._panning = null;
      return;
    }
    if (this._rubberBand) {
      this._rubberBand.target.releasePointerCapture?.(this._rubberBand.pointerId);
      const rect = this.state.selectionRect();
      if (rect) this.state.selectNodesInRect(rect);
      this._rubberBand = null;
      return;
    }
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

  /** Start waypoint drag. Undo pushed on first move. */
  protected onWaypointPointerDown(payload: WaypointPointerPayload): void {
    if (this.state.linkingFrom()) return;
    this._draggingWaypoint = {
      linkId: payload.link.id,
      pointIndex: payload.pointIndex,
      pointerId: payload.event.pointerId,
      target: payload.event.target as Element,
      pushedUndo: false,
    };
    (payload.event.target as Element).setPointerCapture?.(payload.event.pointerId);
    document.addEventListener('pointermove', this._waypointPointerMove);
    document.addEventListener('pointerup', this._waypointPointerUp);
  }

  /** Path pointer down: start pending segment drag if link selected and hit on path. */
  protected onPathPointerDown(payload: PathPointerPayload): void {
    if (this.state.linkingFrom()) return;
    if (!this.state.selectedLinkIds().has(payload.link.id)) return;
    const svg = this.svgContainer?.nativeElement;
    if (!svg) return;
    const pt = this.coordinate.clientToSvg(svg, payload.event.clientX, payload.event.clientY);
    const d = this.state.getDiagram();
    if (!d) return;
    const pts = this.linkGeometry.getPathPoints(payload.link, d);
    const result = this.linkGeometry.findClosestSegment(pts, pt);
    if (!result) return;
    this._pendingSegmentDrag = {
      linkId: payload.link.id,
      segIdx: result.segIdx,
      projected: result.projected,
      pointerId: payload.event.pointerId,
      target: payload.event.target as Element,
    };
    (payload.event.target as Element).setPointerCapture?.(payload.event.pointerId);
    document.addEventListener('pointermove', this._segmentDragPointerMove);
    document.addEventListener('pointerup', this._segmentDragPointerUp);
  }

  private onSegmentDragPointerMove(event: PointerEvent): void {
    if (!this._pendingSegmentDrag || event.pointerId !== this._pendingSegmentDrag.pointerId) return;
    const svg = this.svgContainer?.nativeElement;
    if (!svg) return;
    const d = this.state.getDiagram();
    const link = d?.getLink(this._pendingSegmentDrag.linkId);
    if (!d || !link) return;
    const pt = this.coordinate.clientToSvg(svg, event.clientX, event.clientY);
    const insertIdx = this.linkGeometry.segmentToPointInsertIndex(
      link,
      d,
      this._pendingSegmentDrag.segIdx
    );
    document.removeEventListener('pointermove', this._segmentDragPointerMove);
    document.removeEventListener('pointerup', this._segmentDragPointerUp);
    this._pendingSegmentDrag.target.releasePointerCapture?.(this._pendingSegmentDrag.pointerId);
    this.undoRedo.pushState();
    this.operations.addLinkWaypoint(
      this._pendingSegmentDrag.linkId,
      insertIdx,
      pt.x,
      pt.y
    );
    this._draggingWaypoint = {
      linkId: this._pendingSegmentDrag.linkId,
      pointIndex: insertIdx,
      pointerId: this._pendingSegmentDrag.pointerId,
      target: this._pendingSegmentDrag.target,
      pushedUndo: true,
    };
    this._pendingSegmentDrag.target.setPointerCapture?.(this._pendingSegmentDrag.pointerId);
    document.addEventListener('pointermove', this._waypointPointerMove);
    document.addEventListener('pointerup', this._waypointPointerUp);
    this._pendingSegmentDrag = null;
  }

  private onSegmentDragPointerUp(event: PointerEvent): void {
    if (!this._pendingSegmentDrag || event.pointerId !== this._pendingSegmentDrag.pointerId) return;
    document.removeEventListener('pointermove', this._segmentDragPointerMove);
    document.removeEventListener('pointerup', this._segmentDragPointerUp);
    this._pendingSegmentDrag.target.releasePointerCapture?.(this._pendingSegmentDrag.pointerId);
    this._pendingSegmentDrag = null;
  }

  /** Segment midpoint pointer down (0 waypoints): add first waypoint and start dragging it. */
  protected onSegmentMidpointPointerDown(payload: SegmentMidpointPayload): void {
    if (this.state.linkingFrom()) return;
    this.undoRedo.pushState();
    this.operations.addLinkWaypoint(payload.link.id, 0, payload.x, payload.y);
    this._draggingWaypoint = {
      linkId: payload.link.id,
      pointIndex: 0,
      pointerId: payload.event.pointerId,
      target: payload.event.target as Element,
      pushedUndo: true,
    };
    (payload.event.target as Element).setPointerCapture?.(payload.event.pointerId);
    document.addEventListener('pointermove', this._waypointPointerMove);
    document.addEventListener('pointerup', this._waypointPointerUp);
  }

  /** Right-click on link: show context menu; for now clear waypoints if any. */
  protected onLinkContextMenu(payload: { link: Link; event: MouseEvent }): void {
    payload.event.preventDefault();
    if (payload.link.points.length > 0) {
      this.operations.clearLinkWaypoints(payload.link.id);
    }
  }

  /** Right-click on node: ensure node is selected and show rotate context menu. */
  protected onNodeContextMenu(payload: NodeContextMenuEvent): void {
    const { node, event } = payload;
    if (!this.selectedNodeIds().has(node.id)) {
      this.state.setNodeSelection(new Set([node.id]));
      this.state.setLinkSelection(new Set());
    }
    this.nodeContextMenuPosition.set({ x: event.clientX, y: event.clientY });
  }

  /** Apply rotation from context menu and close menu. */
  protected onRotateNodeContext(angleDeg: number): void {
    this.operations.rotateSelectedNodes(angleDeg);
    this.nodeContextMenuPosition.set(null);
  }

  /** Close node context menu (e.g. backdrop click). */
  protected closeNodeContextMenu(): void {
    this.nodeContextMenuPosition.set(null);
  }

  /** Rotate selected nodes 90° clockwise (toolbar / R). */
  protected onRotateCw(): void {
    this.operations.rotateSelectedNodes(90);
  }

  /** Rotate selected nodes 90° counter-clockwise (toolbar / Shift+R). */
  protected onRotateCcw(): void {
    this.operations.rotateSelectedNodes(-90);
  }

  /** Double-click on waypoint: remove it. Cancel any active drag of that waypoint. */
  protected onWaypointDoubleClick(linkId: LinkId, index: number): void {
    if (
      this._draggingWaypoint &&
      this._draggingWaypoint.linkId === linkId &&
      this._draggingWaypoint.pointIndex === index
    ) {
      this._draggingWaypoint.target.releasePointerCapture?.(this._draggingWaypoint.pointerId);
      document.removeEventListener('pointermove', this._waypointPointerMove);
      document.removeEventListener('pointerup', this._waypointPointerUp);
      this._draggingWaypoint = null;
    }
    this.operations.removeLinkWaypoint(linkId, index);
  }

  /** Delete selected nodes and links (undoable). */
  protected onDeleteSelection(): void {
    this.operations.deleteSelection();
  }

  /** Pan, rubber-band, or clear selection on canvas pointer down. */
  protected onCanvasPointerDown(event: PointerEvent): void {
    const target = event.target as Element;
    if (
      target.closest('g[app-graph-node]') ||
      target.closest('.link-path') ||
      target.closest('.link-path-hit') ||
      target.closest('.waypoint-handle') ||
      target.closest('.segment-handle')
    )
      return;
    if (this.state.linkingFrom()) return;

    const svg = this.svgContainer?.nativeElement;
    const isMiddle = event.button === 1;
    const isLeftWithSpace = event.button === 0 && this._spaceKey;
    const isShiftLeft = event.button === 0 && event.shiftKey;

    if ((isMiddle || isLeftWithSpace) && svg) {
      const targetEl = event.target as Element;
      this._panning = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        startViewBoxX: this.state.viewBox().x,
        startViewBoxY: this.state.viewBox().y,
        pointerId: event.pointerId,
        target: targetEl,
      };
      targetEl.setPointerCapture?.(event.pointerId);
      return;
    }
    if (isShiftLeft && svg) {
      const targetEl = event.target as Element;
      const pt = this.coordinate.clientToSvg(svg, event.clientX, event.clientY);
      this._rubberBand = { x1: pt.x, y1: pt.y, pointerId: event.pointerId, target: targetEl };
      this.state.setSelectionRect({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
      targetEl.setPointerCapture?.(event.pointerId);
      return;
    }
    this.state.clearSelection();
  }

  /** Zoom at cursor (wheel). */
  protected onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    const svg = this.svgContainer?.nativeElement;
    if (!svg) return;
    const center = this.coordinate.clientToSvg(svg, event.clientX, event.clientY);
    const factor = event.deltaY > 0 ? 1 / 1.2 : 1.2;
    this.viewport.zoomAt(factor, center);
  }

  /** Track Space for pan-with-left-drag. */
  @HostListener('document:keyup', ['$event'])
  protected onKeyUp(event: KeyboardEvent): void {
    if (event.key === ' ') this._spaceKey = false;
  }

  /** Handle Escape (clear selection), Space (pan mode), Ctrl+A (select all), etc. */
  @HostListener('document:keydown', ['$event'])
  protected onKeyDown(event: KeyboardEvent): void {
    const tag = (event.target as Element)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (event.key === ' ') {
      this._spaceKey = true;
      event.preventDefault();
      return;
    }
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
      return;
    }

    // KeyR = physical R key (works with any layout, e.g. Russian); Shift+R = CCW
    if (event.code === 'KeyR' && !event.ctrlKey && !event.metaKey && this.selectedNodeIds().size > 0) {
      event.preventDefault();
      this.operations.rotateSelectedNodes(event.shiftKey ? -90 : 90);
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

  /** Whether pan mode is active (Space or middle-drag) for cursor styling. */
  protected get isPanMode(): boolean {
    return this._spaceKey || this._panning !== null;
  }

  /** Normalized selection rect for drawing (x, y, width, height). */
  protected get normalizedSelectionRect(): { x: number; y: number; width: number; height: number } | null {
    const r = this.state.selectionRect();
    if (!r) return null;
    const x = Math.min(r.x1, r.x2);
    const y = Math.min(r.y1, r.y2);
    return {
      x,
      y,
      width: Math.abs(r.x2 - r.x1),
      height: Math.abs(r.y2 - r.y1),
    };
  }

  /** Container size for fitToView/zoomToSelection. */
  protected getContainerSize(): { width: number; height: number } {
    const el = this.svgContainer?.nativeElement;
    if (!el) return { width: 800, height: 600 };
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height };
  }

  protected onZoomIn(): void {
    this.viewport.zoomIn();
  }

  protected onZoomOut(): void {
    this.viewport.zoomOut();
  }

  protected onFitToView(): void {
    const { width, height } = this.getContainerSize();
    this.viewport.fitToView(40, width, height);
  }

  protected onZoomToSelection(): void {
    const { width, height } = this.getContainerSize();
    this.viewport.zoomToSelection(40, width, height);
  }

  protected getPreviewDiamondPoints(): string {
    return '60,0 120,30 60,60 0,30';
  }

  protected getPreviewTrianglePoints(): string {
    return '60,0 120,60 0,60';
  }

  protected getPreviewHexagonPoints(): string {
    return '60,0 120,15 120,45 60,60 0,45 0,15';
  }

  protected getPreviewParallelogramPoints(): string {
    return '24,0 120,0 96,60 0,60';
  }

  protected getPreviewPentagonPoints(): string {
    return '60,0 120,24 96,60 24,60 0,24';
  }

  protected getPreviewCrossPath(): string {
    return 'M 48 0 L 72 0 L 72 60 L 48 60 Z M 0 24 L 120 24 L 120 36 L 0 36 Z';
  }
}
