import {
  Component,
  ChangeDetectionStrategy,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  inject,
  input,
  signal,
  effect,
  computed,
  viewChild,
} from '@angular/core';
import type { DiagramJson } from '../../../graph-core';
import { MOCK_DIAGRAM_CHAIN, MOCK_DIAGRAM_EMPTY, GroupNode } from '../../../graph-core';
import type { NodeShape } from '../../../graph-core';
import { GraphLinkComponent } from './graph-link/graph-link.component';
import { GraphNodeComponent } from './graph-node/graph-node.component';
import { GraphGroupNodeComponent } from './graph-group-node/graph-group-node.component';
import { GraphPaletteComponent } from './graph-palette/graph-palette.component';
import { GraphToolbarComponent } from './graph-toolbar/graph-toolbar.component';
import type {
  NodePointerEvent,
  NodeContextMenuEvent,
} from './graph-node/graph-node.component';
import type { PortPointerEvent } from './graph-node/graph-node.component';
import type {
  GroupNodePointerEvent,
  GroupNodeContextMenuEvent,
  GroupPortPointerEvent,
  ResizeHandlePointerEvent,
} from './graph-group-node/graph-group-node.component';
import type { Link, Node } from '../../../graph-core';
import type { LinkId, LinkRouting, NodeId, PortId } from '../../../graph-core';
import {
  GraphEditorStateService,
  type SelectionRect,
} from './services/graph-editor-state.service';
import { GraphUndoRedoService } from './services/graph-undo-redo.service';
import { GraphOperationsService, type AlignMode } from './services/graph-operations.service';
import { GraphLinkGeometryService } from './services/graph-link-geometry.service';
import { GraphCoordinateService, GRID_STEP } from './services/graph-coordinate.service';
import { GraphViewportService } from './services/graph-viewport.service';
import { GraphResizeService } from './services/graph-resize.service';
import { GraphLodCanvasService, rgbToIndex } from './services/graph-lod-canvas.service';
import { getVisibleInViewBox } from './services/viewport-culling';
import { GraphEditorKeyboardDirective } from './directives/graph-editor-keyboard.directive';
import { serializeDiagram } from '../../../graph-core';
import type {
  PathPointerPayload,
  SegmentMidpointPayload,
  WaypointPointerPayload,
} from './graph-link/graph-link.component';
import type { GraphEditorConfig } from './config/graph-editor-config';
import { GRAPH_EDITOR_CONFIG, mergeWithDefaults } from './config/graph-editor-config';
import { GraphEditorActionDispatcher } from './actions/action-dispatcher.service';
import type { Type } from '@angular/core';
import { Injector } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { FIELD_MAPPER_DEMO_CLOSE } from '../field-mapper/field-mapper-demo-modal/field-mapper-demo-modal.tokens';

/**
 * Main graph editor container. Renders the diagram (nodes, links, grid), coordinates state,
 * undo/redo, operations, and coordinate/viewport services. Handles pointer events (node/link drag,
 * palette drop, pan, rubber-band selection, waypoints) and delegates mutations to
 * {@link GraphOperationsService}. Keyboard shortcuts are handled by
 * {@link GraphEditorKeyboardDirective}. Drag state (pending drag, active drag, waypoint/segment
 * drag) is kept in the component; view state (selection, linking preview, viewBox) is in
 * {@link GraphEditorStateService}.
 */
@Component({
  selector: 'app-graph-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [GraphEditorActionDispatcher, GraphOperationsService, GraphResizeService],
  imports: [
    GraphLinkComponent,
    GraphNodeComponent,
    GraphGroupNodeComponent,
    GraphPaletteComponent,
    GraphToolbarComponent,
    GraphEditorKeyboardDirective,
    NgComponentOutlet,
  ],
  templateUrl: './graph-editor.component.html',
  styleUrl: './graph-editor.component.scss',
})
export class GraphEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('svgContainer', { static: true }) svgContainer!: ElementRef<SVGSVGElement>;
  @ViewChild('canvasWrapper') canvasWrapperRef?: ElementRef<HTMLElement>;
  @ViewChild('lodCanvas') lodCanvasRef?: ElementRef<HTMLCanvasElement>;

  protected readonly state = inject(GraphEditorStateService);
  private readonly undoRedo = inject(GraphUndoRedoService);
  private readonly operations = inject(GraphOperationsService);
  private readonly linkGeometry = inject(GraphLinkGeometryService);
  private readonly coordinate = inject(GraphCoordinateService);
  private readonly viewport = inject(GraphViewportService);
  private readonly resize = inject(GraphResizeService);
  private readonly lodCanvasService = inject(GraphLodCanvasService);

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

  /** Link routing for toolbar select: from selected links (if all same) or default. */
  protected linkRoutingForToolbar(): LinkRouting {
    const linkIds = this.state.selectedLinkIds();
    if (linkIds.size === 0) return this.state.defaultLinkRouting();
    const d = this.state.getDiagram();
    if (!d) return this.state.defaultLinkRouting();
    const routings = new Set<LinkRouting>();
    for (const id of linkIds) {
      const link = d.getLink(id);
      if (link) routings.add(link.routing);
    }
    if (routings.size === 1) {
      const r = routings.values().next().value;
      return r ?? this.state.defaultLinkRouting();
    }
    return this.state.defaultLinkRouting();
  }

  /** Apply connector style change from toolbar: to selected links or default. */
  protected onLinkRoutingChange(routing: LinkRouting): void {
    if (this.state.selectedLinkIds().size > 0) {
      this.operations.setSelectedLinksRouting(routing);
    } else {
      this.state.setDefaultLinkRouting(routing);
    }
  }

  /** Initial snap-to-grid from config (input). */
  readonly snapToGrid = input<boolean>(true);

  /** Editor configuration. Merged with defaults; toolbar.visible is false by default. */
  readonly config = input<GraphEditorConfig | null | undefined>(null);

  /** Injected by parent (e.g. EditorPageComponent) to avoid circular dependency. */
  private readonly injectedConfigSignal = inject(GRAPH_EDITOR_CONFIG, { optional: true });

  /** Effective config: from parent injector when provided, otherwise merged from config input. */
  protected readonly effectiveConfig = this.injectedConfigSignal ?? computed(
    () => mergeWithDefaults(this.config())
  );

  /** Container size (canvas wrapper) for scale calculation; updated via ResizeObserver. */
  protected readonly containerSizeSignal = signal<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });

  /** Scale = container size / viewBox size (min of w and h ratio). */
  protected readonly scale = computed(() => {
    const vb = this.viewBox();
    const c = this.containerSizeSignal();
    if (vb.width <= 0 || vb.height <= 0) return 1;
    return Math.min(c.width / vb.width, c.height / vb.height);
  });

  /** Node count for LOD decisions. */
  private readonly nodeCount = computed(() => this.diagram()?.nodes.length ?? 0);

  /** Force canvas+hit when node count >= this (never render all nodes in SVG). */
  private readonly forceCanvasAbove = computed(
    () => this.effectiveConfig().lod?.forceCanvasAboveNodeCount ?? 500
  );

  /** Current LOD mode: stateful with hysteresis to avoid flicker at scale boundaries. */
  private readonly currentLodMode = signal<'canvasOnly' | 'canvasHit' | 'svgCulled' | null>(null);

  /** Level 0: canvas only, no interaction. */
  protected readonly useCanvasOnly = computed(
    () =>
      this.state.lodEnabled() &&
      this.effectiveConfig().lod?.useCanvas !== false &&
      this.currentLodMode() === 'canvasOnly'
  );

  /** Level 1: canvas + hit testing. */
  protected readonly useCanvasWithHit = computed(
    () =>
      this.state.lodEnabled() &&
      this.effectiveConfig().lod?.useCanvas !== false &&
      this.currentLodMode() === 'canvasHit'
  );

  /** Level 2: SVG with viewport culling. */
  protected readonly useSvgCulled = computed(
    () => this.state.lodEnabled() && this.currentLodMode() === 'svgCulled'
  );

  /** Show canvas layer when canvas-only or canvas+hit. */
  protected readonly useCanvasLayer = computed(
    () => this.useCanvasOnly() || this.useCanvasWithHit()
  );

  /** Visible node IDs in viewBox (for culling when in SVG mode). */
  private readonly visibleInViewBox = computed(() => {
    const d = this.diagram();
    const vb = this.viewBox();
    if (!d || vb.width <= 0 || vb.height <= 0)
      return { nodeIds: new Set<NodeId>(), linkIds: new Set<LinkId>() };
    return getVisibleInViewBox(d, vb, this.linkGeometry);
  });

  /** Nodes to render in SVG: visible when useSvgCulled, else all when not canvas, else []. */
  protected readonly nodesForRender = computed(() => {
    if (this.useCanvasLayer()) return [];
    const d = this.diagram();
    if (!d) return [];
    if (!this.useSvgCulled()) return d.nodes;
    const { nodeIds } = this.visibleInViewBox();
    return d.nodes.filter((n) => nodeIds.has(n.id));
  });

  /** Links to render in SVG: visible when useSvgCulled, else all when not canvas, else []. */
  protected readonly linksForRender = computed(() => {
    if (this.useCanvasLayer()) return [];
    const d = this.diagram();
    if (!d) return [];
    if (!this.useSvgCulled()) return d.links;
    const { linkIds } = this.visibleInViewBox();
    return d.links.filter((l) => linkIds.has(l.id));
  });

  private _resizeObserver: ResizeObserver | null = null;
  private _lodRafId = 0;
  private _hitBufferCanvas: HTMLCanvasElement | null = null;
  private _hitBufferCtx: CanvasRenderingContext2D | null = null;
  private _hitBufferResult: { nodeIds: NodeId[]; linkIds: LinkId[] } | null = null;
  private _draggingCanvasNodeId: NodeId | null = null;
  private _draggingCanvasPushedUndo = false;
  private _draggingCanvasStartSvg: { x: number; y: number } | null = null;
  private _draggingCanvasInitialPositions: Map<NodeId, { x: number; y: number }> | null = null;

  protected readonly draggingFromPalette = signal<{
    shape: NodeShape;
    pointerId: number;
    customShapeId?: string;
  } | null>(null);
  protected readonly paletteDropPreview = signal<{
    x: number;
    y: number;
    shape: NodeShape;
    customShapeId?: string;
  } | null>(null);
  /** Node context menu position (client coordinates); null when closed. */
  protected readonly nodeContextMenuPosition = signal<{ x: number; y: number } | null>(null);
  /** Link context menu: position and data for Add waypoint / Clear waypoints / z-order / lock. */
  protected readonly linkContextMenu = signal<{
    x: number;
    y: number;
    linkId: LinkId;
    insertIndex: number;
    waypointX: number;
    waypointY: number;
    hasWaypoints: boolean;
    linkLocked: boolean;
  } | null>(null);

  /** Selected waypoint (single); null when link or segment is selected as a whole. */
  protected readonly selectedWaypoint = signal<{ linkId: LinkId; pointIndex: number } | null>(null);

  /** True when node context menu is from a group (no Rotate). */
  protected readonly nodeContextMenuIsGroup = signal<boolean>(false);

  /** When true, the field mapper demo modal is open. */
  protected readonly fieldMapperDemoOpen = signal(false);
  /** Lazy-loaded modal component type (loaded on first open). */
  protected readonly fieldMapperDemoComponent = signal<Type<unknown> | null>(null);
  private readonly injector = inject(Injector);
  protected readonly fieldMapperDemoInjector = computed(() =>
    Injector.create({
      providers: [
        {
          provide: FIELD_MAPPER_DEMO_CLOSE,
          useValue: () => this.closeFieldMapperDemo(),
        },
      ],
      parent: this.injector,
    })
  );

  /** True when all selected nodes and links are locked (for Lock/Unlock button label). */
  protected readonly hasLockedSelection = computed(() => {
    this.renderTick(); // Track render tick so computed updates after in-place lock mutations
    const d = this.state.getDiagram();
    if (!d) return false;
    const nodeIds = this.state.selectedNodeIds();
    const linkIds = this.state.selectedLinkIds();
    if (nodeIds.size === 0 && linkIds.size === 0) return false;
    let allLocked = true;
    for (const nodeId of nodeIds) {
      const n = d.getNode(nodeId);
      if (n && !n.locked) allLocked = false;
    }
    for (const linkId of linkIds) {
      const l = d.getLink(linkId);
      if (l && !l.locked) allLocked = false;
    }
    return allLocked;
  });

  /** Index of selected waypoint for a given link, or null. */
  protected selectedWaypointIndexForLink(linkId: LinkId): number | null {
    const sw = this.selectedWaypoint();
    return sw?.linkId === linkId ? sw.pointIndex : null;
  }

  private _palettePointerMove = (e: PointerEvent) => this.onPalettePointerMove(e);
  private _palettePointerUp = (e: PointerEvent) => this.onPalettePointerUp(e);
  private _waypointPointerMove = (e: PointerEvent) => this.onWaypointPointerMove(e);
  private _waypointPointerUp = (e: PointerEvent) => this.onWaypointPointerUp(e);
  private _segmentDragPointerMove = (e: PointerEvent) => this.onSegmentDragPointerMove(e);
  private _segmentDragPointerUp = (e: PointerEvent) => this.onSegmentDragPointerUp(e);
  private _segmentMovePointerMove = (e: PointerEvent) => this.onSegmentMovePointerMove(e);
  private _segmentMovePointerUp = (e: PointerEvent) => this.onSegmentMovePointerUp(e);

  private pushUndoIfEnabled(): void {
    const cfg = this.effectiveConfig();
    if (cfg?.undoRedo?.enabled !== false) {
      this.undoRedo.pushState();
    }
  }

  private onWaypointPointerMove(event: PointerEvent): void {
    if (!this._draggingWaypoint || event.pointerId !== this._draggingWaypoint.pointerId) return;
    if (!this._draggingWaypoint.pushedUndo) {
      this._draggingWaypoint.pushedUndo = true;
      this.pushUndoIfEnabled();
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
  private _segmentMove: {
    linkId: LinkId;
    segmentIndex: number;
    lastX: number;
    lastY: number;
    pointerId: number;
    target: Element;
  } | null = null;
  private static readonly DRAG_THRESHOLD_PX = 4;

  private static readonly STORAGE_KEY = 'graph-canvas-diagram';

  private _wheelHandler = (event: WheelEvent) => this.onCanvasWheel(event);

  constructor() {
    effect(() => {
      const cfg = this.effectiveConfig();
      this.state.setSnapToGridEnabled(cfg.snapToGrid ?? this.snapToGrid());
    });
    effect(() => {
      const cfg = this.effectiveConfig();
      this.state.setLodEnabled(cfg.lod?.enabled ?? false);
    });
    effect(() => {
      const cfg = this.effectiveConfig();
      const lod = cfg.lod;
      if (!this.state.lodEnabled() || !lod || lod.useCanvas === false) {
        this.currentLodMode.set(null);
        return;
      }
      const s = this.scale();
      const n = this.nodeCount();
      const forceN = this.forceCanvasAbove();
      const thEnter = lod.scaleThresholdEnter ?? 0.45;
      const thLeave = lod.scaleThresholdLeave ?? 0.55;
      const th2Enter = lod.interactiveScaleThresholdEnter ?? 1.1;
      const th2Leave = lod.interactiveScaleThresholdLeave ?? 1.2;
      const singleTh = lod.scaleThreshold ?? 0.5;
      const singleTh2 = lod.interactiveScaleThreshold ?? 1.2;

      const scaleAboveForceSvg = lod.scaleAboveForceSvg;
      const current = this.currentLodMode();
      let next: 'canvasOnly' | 'canvasHit' | 'svgCulled';

      if (current === null) {
        if (s < singleTh) next = 'canvasOnly';
        else if (
          scaleAboveForceSvg != null &&
          s >= scaleAboveForceSvg
        )
          next = 'svgCulled';
        else if (n >= forceN || s < singleTh2) next = 'canvasHit';
        else next = 'svgCulled';
      } else {
        if (current === 'canvasOnly') {
          next = s >= thLeave ? 'canvasHit' : 'canvasOnly';
        } else if (current === 'canvasHit') {
          if (s < thEnter) next = 'canvasOnly';
          else if (
            (s >= th2Leave && n < forceN) ||
            (scaleAboveForceSvg != null && s >= scaleAboveForceSvg)
          )
            next = 'svgCulled';
          else next = 'canvasHit';
        } else {
          next = s < th2Enter ? 'canvasHit' : 'svgCulled';
        }
      }
      if (next !== current) this.currentLodMode.set(next);
    });
    effect(() => {
      if (!this.useCanvasLayer()) return;
      this.diagram();
      this.viewBox();
      this.containerSizeSignal();
      this.snapToGridEnabled();
      this.effectiveConfig().gridVisible;
      this.scheduleLodDraw();
    });
  }

  private scheduleLodDraw(): void {
    if (this._lodRafId) cancelAnimationFrame(this._lodRafId);
    this._lodRafId = requestAnimationFrame(() => this.doLodDraw());
  }

  private doLodDraw(): void {
    this._lodRafId = 0;
    if (!this.useCanvasLayer()) return;
    const canvas = this.lodCanvasRef?.nativeElement;
    const diagram = this.diagram();
    const vb = this.viewBox();
    const size = this.containerSizeSignal();
    if (!canvas || !diagram || vb.width <= 0 || vb.height <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const gridVisible =
      (this.effectiveConfig().gridVisible !== false && this.snapToGridEnabled()) ?? false;
    this.lodCanvasService.draw(ctx, diagram, vb, size.width, size.height, {
      gridVisible,
      gridStep: GRID_STEP,
    });
    if (this.useCanvasWithHit()) {
      const w = Math.max(1, Math.floor(size.width));
      const h = Math.max(1, Math.floor(size.height));
      if (!this._hitBufferCanvas || this._hitBufferCanvas.width !== w || this._hitBufferCanvas.height !== h) {
        this._hitBufferCanvas = document.createElement('canvas');
        this._hitBufferCanvas.width = w;
        this._hitBufferCanvas.height = h;
        this._hitBufferCtx = this._hitBufferCanvas.getContext('2d');
      }
      if (this._hitBufferCtx) {
        this._hitBufferResult = this.lodCanvasService.drawHitBuffer(
          this._hitBufferCtx,
          diagram,
          vb,
          w,
          h
        );
      }
    } else {
      this._hitBufferResult = null;
    }
  }

  protected onFieldMapperDemo(): void {
    const comp = this.fieldMapperDemoComponent();
    if (comp) {
      this.fieldMapperDemoOpen.set(true);
      return;
    }
    import(
      '../field-mapper/field-mapper-demo-modal/field-mapper-demo-modal.component'
    ).then((m) => {
      this.fieldMapperDemoComponent.set(m.FieldMapperDemoModalComponent);
      this.fieldMapperDemoOpen.set(true);
    });
  }

  protected closeFieldMapperDemo(): void {
    this.fieldMapperDemoOpen.set(false);
  }

  private interactionEnabled(key: keyof NonNullable<GraphEditorConfig['interactions']>): boolean {
    return this.effectiveConfig().interactions?.[key] !== false;
  }

  /** Load diagram on init per config; attach wheel zoom (non-passive so preventDefault works). */
  ngAfterViewInit(): void {
    const cfg = this.effectiveConfig();
    if (cfg.initialDiagram === null) {
      this.loadDiagramFromJson(MOCK_DIAGRAM_EMPTY);
    } else if (cfg.initialDiagram) {
      this.loadDiagramFromJson(cfg.initialDiagram);
    } else {
      this.loadDiagramFromJson(MOCK_DIAGRAM_CHAIN);
    }
    const wrapper = this.canvasWrapperRef?.nativeElement;
    if (wrapper) wrapper.addEventListener('wheel', this._wheelHandler, { passive: false });

    if (wrapper && typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        this.containerSizeSignal.set({ width, height });
      });
      this._resizeObserver.observe(wrapper);
      this.containerSizeSignal.set({
        width: wrapper.clientWidth,
        height: wrapper.clientHeight,
      });
    }
  }

  /** Storage key from config; null if localStorage disabled. */
  private getStorageKey(): string | null {
    const cfg = this.effectiveConfig();
    return cfg.storageKey ?? null;
  }

  /** Load diagram from JSON without pushing undo (initial load or programmatic restore). */
  protected loadDiagramFromJson(json: DiagramJson): void {
    this.state.setDiagramFromJson(json);
  }

  /** Load example diagram; pushes undo so it can be undone. */
  protected onLoadExample(json: DiagramJson): void {
    this.pushUndoIfEnabled();
    this.undoRedo.restoreFromJson(json);
  }

  /** Load diagram from file; pushes undo. */
  protected onLoadFromFile(json: DiagramJson): void {
    this.pushUndoIfEnabled();
    this.undoRedo.restoreFromJson(json);
  }

  /** Serialize diagram to JSON, save to localStorage and trigger file download. */
  protected onSave(): void {
    const d = this.state.getDiagram();
    if (!d) return;
    const json = serializeDiagram(d);
    const str = JSON.stringify(json, null, 2);
    const key = this.getStorageKey();
    try {
      if (key) localStorage.setItem(key, str);
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
    const key = this.getStorageKey();
    if (!key) return;
    try {
      const str = localStorage.getItem(key);
      if (!str) return;
      const json = JSON.parse(str) as DiagramJson;
      if (json && Array.isArray(json.nodes) && Array.isArray(json.links)) {
        this.pushUndoIfEnabled();
        this.undoRedo.restoreFromJson(json);
      }
    } catch {
      // ignore
    }
  }

  /** Clear diagram reference and wheel listener on destroy. */
  ngOnDestroy(): void {
    const wrapper = this.canvasWrapperRef?.nativeElement;
    if (wrapper) wrapper.removeEventListener('wheel', this._wheelHandler);
    if (this._lodRafId) cancelAnimationFrame(this._lodRafId);
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this.cleanupSegmentMoveListeners();
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

  /** Toggle LOD and Canvas (toolbar button). */
  protected onLodToggle(): void {
    this.state.toggleLodEnabled();
  }

  /** Start drag from palette; capture pointer and listen for move/up on document. */
  protected onPaletteShapeDragStart(payload: {
    shape: NodeShape;
    pointerId: number;
    customShapeId?: string;
  }): void {
    this.draggingFromPalette.set({
      shape: payload.shape,
      pointerId: payload.pointerId,
      customShapeId: payload.customShapeId,
    });
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
      this.paletteDropPreview.set({
        x,
        y,
        shape: drag.shape,
        customShapeId: drag.customShapeId,
      });
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
      this.operations.addNodeFromPalette(
        preview.shape,
        preview.x,
        preview.y,
        preview.customShapeId
      );
    }
    this.draggingFromPalette.set(null);
    this.paletteDropPreview.set(null);
  }

  /** Start pending drag or capture pointer for click. Locked nodes can be selected but not dragged. */
  protected onNodePointerDown(e: NodePointerEvent): void {
    if (this.state.linkingFrom()) return;
    if (!this.interactionEnabled('nodeDrag')) return;
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
      if (
        !e.node.locked &&
        this.interactionEnabled('nodeDrag') &&
        Math.sqrt(dx * dx + dy * dy) > GraphEditorComponent.DRAG_THRESHOLD_PX
      ) {
        this.pushUndoIfEnabled();
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
    if (!this.interactionEnabled('linkCreation')) return;
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
    if (this._draggingCanvasNodeId && this._draggingCanvasStartSvg && this._draggingCanvasInitialPositions) {
      if (!this._draggingCanvasPushedUndo) {
        this._draggingCanvasPushedUndo = true;
        this.pushUndoIfEnabled();
      }
      const pt = this.clientToSvgFromWrapper(event.clientX, event.clientY);
      const dx = pt.x - this._draggingCanvasStartSvg.x;
      const dy = pt.y - this._draggingCanvasStartSvg.y;
      this.operations.moveNodes(this._draggingCanvasInitialPositions, dx, dy);
      this.scheduleLodDraw();
      return;
    }
    const svg = this.svgContainer?.nativeElement;
    const wrapper = this.canvasWrapperRef?.nativeElement;
    if (this._panning) {
      const r = this.useCanvasLayer() && wrapper ? wrapper.getBoundingClientRect() : svg?.getBoundingClientRect();
      if (r) {
        const vb = this.state.viewBox();
        const dxSvg = ((this._panning.startClientX - event.clientX) * vb.width) / r.width;
        const dySvg = ((this._panning.startClientY - event.clientY) * vb.height) / r.height;
        this.viewport.pan(-dxSvg, -dySvg);
        this._panning.startClientX = event.clientX;
        this._panning.startClientY = event.clientY;
      }
      return;
    }
    if (this._rubberBand && svg) {
      const pt = this.coordinate.clientToSvg(svg, event.clientX, event.clientY);
      const rect: SelectionRect = {
        x1: this._rubberBand.x1,
        y1: this._rubberBand.y1,
        x2: pt.x,
        y2: pt.y,
      };
      this.state.setSelectionRect(rect);
      this.updateSelectionForRect(rect);
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
    if (this._draggingCanvasNodeId) {
      (event.target as Element).releasePointerCapture?.(event.pointerId);
      this._draggingCanvasNodeId = null;
      this._draggingCanvasStartSvg = null;
      this._draggingCanvasInitialPositions = null;
      return;
    }
    if (this._panning) {
      const wasClick = Math.hypot(
        event.clientX - this._panning.startClientX,
        event.clientY - this._panning.startClientY
      ) < GraphEditorComponent.DRAG_THRESHOLD_PX;
      this._panning.target.releasePointerCapture?.(this._panning.pointerId);
      this._panning = null;
      if (wasClick) {
        this.selectedWaypoint.set(null);
        this.state.clearSelection();
      }
      return;
    }
    if (this._rubberBand) {
      this._rubberBand.target.releasePointerCapture?.(this._rubberBand.pointerId);
      const rect = this.state.selectionRect();
      if (rect) {
        this.updateSelectionForRect(rect);
        this.state.setSelectionRect(null);
      }
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

  /** SVG path d for the link preview line (uses current default connector style). */
  protected getPreviewPathD(): string {
    const from = this.state.linkingFrom();
    const preview = this.state.linkingPreviewPoint();
    const d = this.state.getDiagram();
    if (!from || !preview || !d) return '';
    const source = d.getPortPosition(from.portId);
    if (!source) return '';
    const sx = source.x;
    const sy = source.y;
    const px = preview.x;
    const py = preview.y;
    if (this.state.defaultLinkRouting() === 'straight') {
      return `M ${sx} ${sy} L ${px} ${py}`;
    }
    // orthogonal: horizontal then vertical from source to pointer
    return `M ${sx} ${sy} L ${px} ${sy} L ${px} ${py}`;
  }

  /** Select link (single or Shift-toggle). Click on segment = select whole link, clear single waypoint selection. */
  protected onLinkSelect(payload: { link: Link; shiftKey: boolean }): void {
    this.selectedWaypoint.set(null);
    const id = payload.link.id;
    if (payload.shiftKey) {
      this.state.toggleLinkSelection(id);
    } else {
      this.state.setLinkSelection(new Set([id]));
    }
  }

  /** Start waypoint drag; select this waypoint and ensure link is selected. Undo pushed on first move. */
  protected onWaypointPointerDown(payload: WaypointPointerPayload): void {
    if (this.state.linkingFrom()) return;
    if (!this.interactionEnabled('linkWaypoints')) return;
    if (payload.link.locked) return;
    this.selectedWaypoint.set({ linkId: payload.link.id, pointIndex: payload.pointIndex });
    this.state.setLinkSelection(new Set([payload.link.id]));
    this.pushUndoIfEnabled();
    this._draggingWaypoint = {
      linkId: payload.link.id,
      pointIndex: payload.pointIndex,
      pointerId: payload.event.pointerId,
      target: payload.event.target as Element,
      pushedUndo: true,
    };
    (payload.event.target as Element).setPointerCapture?.(payload.event.pointerId);
    document.addEventListener('pointermove', this._waypointPointerMove);
    document.addEventListener('pointerup', this._waypointPointerUp);
  }

  /** Path pointer down: start pending segment drag if link selected and hit on path. */
  protected onPathPointerDown(payload: PathPointerPayload): void {
    if (this.state.linkingFrom()) return;
    if (!this.interactionEnabled('linkWaypoints')) return;
    if (payload.link.locked) return;
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
    const segmentIndex = this.linkGeometry.segmentToPointInsertIndex(
      link,
      d,
      this._pendingSegmentDrag.segIdx
    );
    document.removeEventListener('pointermove', this._segmentDragPointerMove);
    document.removeEventListener('pointerup', this._segmentDragPointerUp);
    this._pendingSegmentDrag.target.releasePointerCapture?.(this._pendingSegmentDrag.pointerId);

    if (event.altKey && link.points.length > 0) {
      this.pushUndoIfEnabled();
      this._segmentMove = {
        linkId: this._pendingSegmentDrag.linkId,
        segmentIndex,
        lastX: pt.x,
        lastY: pt.y,
        pointerId: this._pendingSegmentDrag.pointerId,
        target: this._pendingSegmentDrag.target,
      };
      this._pendingSegmentDrag.target.setPointerCapture?.(this._pendingSegmentDrag.pointerId);
      document.addEventListener('pointermove', this._segmentMovePointerMove);
      document.addEventListener('pointerup', this._segmentMovePointerUp);
    } else {
      this.pushUndoIfEnabled();
      this.operations.addLinkWaypoint(
        this._pendingSegmentDrag.linkId,
        segmentIndex,
        pt.x,
        pt.y
      );
      this._draggingWaypoint = {
        linkId: this._pendingSegmentDrag.linkId,
        pointIndex: segmentIndex,
        pointerId: this._pendingSegmentDrag.pointerId,
        target: this._pendingSegmentDrag.target,
        pushedUndo: true,
      };
      this._pendingSegmentDrag.target.setPointerCapture?.(this._pendingSegmentDrag.pointerId);
      document.addEventListener('pointermove', this._waypointPointerMove);
      document.addEventListener('pointerup', this._waypointPointerUp);
    }
    this._pendingSegmentDrag = null;
  }

  private onSegmentMovePointerMove(event: PointerEvent): void {
    if (!this._segmentMove || event.pointerId !== this._segmentMove.pointerId) return;
    const svg = this.svgContainer?.nativeElement;
    if (!svg) return;
    const pt = this.coordinate.clientToSvg(svg, event.clientX, event.clientY);
    const dx = pt.x - this._segmentMove.lastX;
    const dy = pt.y - this._segmentMove.lastY;
    this.operations.moveLinkSegment(
      this._segmentMove.linkId,
      this._segmentMove.segmentIndex,
      dx,
      dy
    );
    this._segmentMove.lastX = pt.x;
    this._segmentMove.lastY = pt.y;
  }

  private onSegmentMovePointerUp(event: PointerEvent): void {
    if (!this._segmentMove || event.pointerId !== this._segmentMove.pointerId) return;
    this._segmentMove.target.releasePointerCapture?.(this._segmentMove.pointerId);
    document.removeEventListener('pointermove', this._segmentMovePointerMove);
    document.removeEventListener('pointerup', this._segmentMovePointerUp);
    this._segmentMove = null;
  }

  private onSegmentDragPointerUp(event: PointerEvent): void {
    if (!this._pendingSegmentDrag || event.pointerId !== this._pendingSegmentDrag.pointerId) return;
    document.removeEventListener('pointermove', this._segmentDragPointerMove);
    document.removeEventListener('pointerup', this._segmentDragPointerUp);
    this._pendingSegmentDrag.target.releasePointerCapture?.(this._pendingSegmentDrag.pointerId);
    this._pendingSegmentDrag = null;
  }

  private cleanupSegmentMoveListeners(): void {
    document.removeEventListener('pointermove', this._segmentMovePointerMove);
    document.removeEventListener('pointerup', this._segmentMovePointerUp);
  }

  /** Segment midpoint pointer down (0 waypoints): add first waypoint and start dragging it. */
  protected onSegmentMidpointPointerDown(payload: SegmentMidpointPayload): void {
    if (this.state.linkingFrom()) return;
    if (!this.interactionEnabled('linkWaypoints')) return;
    if (payload.link.locked) return;
    this.pushUndoIfEnabled();
    this.operations.addLinkWaypoint(payload.link.id, payload.insertIndex, payload.x, payload.y);
    this._draggingWaypoint = {
      linkId: payload.link.id,
      pointIndex: payload.insertIndex,
      pointerId: payload.event.pointerId,
      target: payload.event.target as Element,
      pushedUndo: true,
    };
    (payload.event.target as Element).setPointerCapture?.(payload.event.pointerId);
    document.addEventListener('pointermove', this._waypointPointerMove);
    document.addEventListener('pointerup', this._waypointPointerUp);
  }

  /** Right-click on link: show context menu (Add waypoint / Clear waypoints). */
  protected onLinkContextMenu(payload: { link: Link; event: MouseEvent }): void {
    if (!this.interactionEnabled('linkContextMenu')) return;
    payload.event.preventDefault();
    if (!this.state.selectedLinkIds().has(payload.link.id)) {
      this.state.setLinkSelection(new Set([payload.link.id]));
    }
    const svg = this.svgContainer?.nativeElement;
    const d = this.state.getDiagram();
    if (!svg || !d) return;
    const pt = this.coordinate.clientToSvg(svg, payload.event.clientX, payload.event.clientY);
    const pts = this.linkGeometry.getPathPoints(payload.link, d);
    const result = this.linkGeometry.findClosestSegment(pts, pt);
    const insertIndex = result
      ? this.linkGeometry.segmentToPointInsertIndex(payload.link, d, result.segIdx)
      : 0;
    const waypointX = result ? result.projected.x : pt.x;
    const waypointY = result ? result.projected.y : pt.y;
    this.linkContextMenu.set({
      x: payload.event.clientX,
      y: payload.event.clientY,
      linkId: payload.link.id,
      insertIndex,
      waypointX,
      waypointY,
      hasWaypoints: payload.link.points.length > 0,
      linkLocked: payload.link.locked,
    });
  }

  protected onLinkContextMenuAddWaypoint(ctx: {
    linkId: LinkId;
    insertIndex: number;
    waypointX: number;
    waypointY: number;
  }): void {
    this.operations.addLinkWaypoint(ctx.linkId, ctx.insertIndex, ctx.waypointX, ctx.waypointY);
    this.linkContextMenu.set(null);
  }

  protected onLinkContextMenuClearWaypoints(linkId: LinkId): void {
    this.operations.clearLinkWaypoints(linkId);
    this.linkContextMenu.set(null);
  }

  protected closeLinkContextMenu(): void {
    this.linkContextMenu.set(null);
  }

  /** Right-click on node: ensure node is selected and show context menu. */
  protected onNodeContextMenu(payload: NodeContextMenuEvent): void {
    if (!this.interactionEnabled('nodeContextMenu')) return;
    const { node, event } = payload;
    if (!this.selectedNodeIds().has(node.id)) {
      this.state.setNodeSelection(new Set([node.id]));
      this.state.setLinkSelection(new Set());
    }
    this.nodeContextMenuIsGroup.set(false);
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
    this.nodeContextMenuIsGroup.set(false);
  }

  protected onBringToFront(): void {
    this.operations.bringToFront();
  }

  protected onSendToBack(): void {
    this.operations.sendToBack();
  }

  protected onToggleLock(): void {
    this.operations.toggleLockSelection();
  }

  /** Rotate selected nodes 90° clockwise (toolbar / R). */
  protected onRotateCw(): void {
    this.operations.rotateSelectedNodes(90);
  }

  /** Rotate selected nodes 90° counter-clockwise (toolbar / Shift+R). */
  protected onRotateCcw(): void {
    this.operations.rotateSelectedNodes(-90);
  }

  /** Align or distribute selected nodes (toolbar). */
  protected onAlign(mode: AlignMode): void {
    this.operations.alignSelectedNodes(mode);
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

  /** Convert client coords to SVG using wrapper rect and viewBox (for canvas mode). */
  private clientToSvgFromWrapper(clientX: number, clientY: number): { x: number; y: number } {
    const wrapper = this.canvasWrapperRef?.nativeElement;
    if (!wrapper) return { x: 0, y: 0 };
    const rect = wrapper.getBoundingClientRect();
    const vb = this.viewBox();
    return {
      x: vb.x + ((clientX - rect.left) / rect.width) * vb.width,
      y: vb.y + ((clientY - rect.top) / rect.height) * vb.height,
    };
  }

  /** Pan, rubber-band, or clear selection on canvas pointer down. */
  protected onCanvasPointerDown(event: PointerEvent): void {
    const isMiddle = event.button === 1;
    const spaceHeld = this.state.spaceKeyDown() || (typeof event.getModifierState === 'function' && event.getModifierState(' '));
    const isLeftWithSpace = event.button === 0 && spaceHeld;
    const isLeftWithPanTool = event.button === 0 && !event.shiftKey && this.state.panToolActive();

    if (this.useCanvasLayer()) {
      if ((isMiddle || isLeftWithSpace || isLeftWithPanTool) && this.interactionEnabled('pan')) {
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
      if (this.useCanvasWithHit() && event.button === 0 && this._hitBufferCanvas && this._hitBufferCtx && this._hitBufferResult) {
        const canvas = this.lodCanvasRef?.nativeElement;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const px = (event.clientX - rect.left) * (canvas.width / rect.width);
          const py = (event.clientY - rect.top) * (canvas.height / rect.height);
          const pxI = Math.floor(px);
          const pyI = Math.floor(py);
          if (pxI >= 0 && pxI < this._hitBufferCanvas.width && pyI >= 0 && pyI < this._hitBufferCanvas.height) {
            const data = this._hitBufferCtx.getImageData(pxI, pyI, 1, 1).data;
            const hitIndex = rgbToIndex(data[0], data[1], data[2]);
            const { nodeIds, linkIds } = this._hitBufferResult;
            if (hitIndex >= 1 && hitIndex <= nodeIds.length) {
              const nodeId = nodeIds[hitIndex - 1];
              this.state.setNodeSelection(new Set([nodeId]));
              this.state.setLinkSelection(new Set());
              const d = this.state.getDiagram();
              const node = d?.getNode(nodeId);
              if (node && this.interactionEnabled('nodeDrag')) {
                this._draggingCanvasNodeId = nodeId;
                this._draggingCanvasPushedUndo = false;
                this._draggingCanvasStartSvg = this.clientToSvgFromWrapper(event.clientX, event.clientY);
                const r = node.getRect();
                this._draggingCanvasInitialPositions = new Map([[nodeId, { x: r.x, y: r.y }]]);
                (event.target as Element).setPointerCapture?.(event.pointerId);
              }
            } else if (hitIndex > nodeIds.length && hitIndex <= nodeIds.length + linkIds.length) {
              const linkId = linkIds[hitIndex - 1 - nodeIds.length];
              this.state.setNodeSelection(new Set());
              this.state.setLinkSelection(new Set([linkId]));
            } else {
              this.selectedWaypoint.set(null);
              this.state.clearSelection();
            }
          }
        }
      }
      return;
    }

    const target = event.target as Element;
    if (
      target.closest('g[app-graph-node]') ||
      target.closest('.link-path') ||
      target.closest('.link-path-hit') ||
      target.closest('.waypoint-handle') ||
      target.closest('.waypoint-hit') ||
      target.closest('.segment-handle')
    )
      return;
    if (this.state.linkingFrom()) return;

    const svg = this.svgContainer?.nativeElement;
    const isShiftLeft = event.button === 0 && event.shiftKey;

    if ((isMiddle || isLeftWithSpace || isLeftWithPanTool) && svg && this.interactionEnabled('pan')) {
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
    if (isShiftLeft && svg && this.interactionEnabled('rubberBandSelection')) {
      const targetEl = event.target as Element;
      const pt = this.coordinate.clientToSvg(svg, event.clientX, event.clientY);
      this._rubberBand = { x1: pt.x, y1: pt.y, pointerId: event.pointerId, target: targetEl };
      this.state.setSelectionRect({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
      targetEl.setPointerCapture?.(event.pointerId);
      return;
    }
    this.selectedWaypoint.set(null);
    this.state.clearSelection();
  }

  /** Zoom at cursor (wheel). */
  protected onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    const wrapper = this.canvasWrapperRef?.nativeElement;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const vb = this.viewBox();
    const center = {
      x: vb.x + ((event.clientX - rect.left) / rect.width) * vb.width,
      y: vb.y + ((event.clientY - rect.top) / rect.height) * vb.height,
    };
    const factor = event.deltaY > 0 ? 1 / 1.2 : 1.2;
    this.viewport.zoomAt(factor, center);
  }

  /** Called by keyboard directive on Escape; clear selected waypoint (directive already cleared selection). */
  protected onEscapeKey(): void {
    this.selectedWaypoint.set(null);
  }

  /** Called by keyboard directive on Delete/Backspace; remove waypoint or delete selection. */
  protected onDeleteKey(): void {
    const sw = this.selectedWaypoint();
    if (sw !== null) {
      this.pushUndoIfEnabled();
      this.operations.removeLinkWaypoint(sw.linkId, sw.pointIndex);
      this.selectedWaypoint.set(null);
      return;
    }
    this.onDeleteSelection();
  }

  /** Undo one step. */
  protected undo(): void {
    this.undoRedo.undo();
  }

  /** Redo one step. */
  protected redo(): void {
    this.undoRedo.redo();
  }

  /** Whether pan mode is active (Space, pan tool, or middle-drag) for cursor styling. */
  protected get isPanMode(): boolean {
    return this.state.spaceKeyDown() || this.state.panToolActive() || this._panning !== null;
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

  /**
   * Get node and link IDs that intersect the selection rectangle.
   * Nodes: rect intersection. Links: any path point inside rect.
   */
  private getNodesAndLinksInRect(rect: SelectionRect): {
    nodeIds: Set<NodeId>;
    linkIds: Set<LinkId>;
  } {
    const d = this.state.getDiagram();
    const nodeIds = new Set<NodeId>();
    const linkIds = new Set<LinkId>();
    if (!d) return { nodeIds, linkIds };

    const xMin = Math.min(rect.x1, rect.x2);
    const xMax = Math.max(rect.x1, rect.x2);
    const yMin = Math.min(rect.y1, rect.y2);
    const yMax = Math.max(rect.y1, rect.y2);

    for (const node of d.nodes) {
      const r = node.getRect();
      const intersects =
        r.x + r.width >= xMin &&
        r.x <= xMax &&
        r.y + r.height >= yMin &&
        r.y <= yMax;
      if (intersects) nodeIds.add(node.id);
    }

    for (const link of d.links) {
      const pts = this.linkGeometry.getPathPoints(link, d);
      const anyInside = pts.some(
        (p) => p.x >= xMin && p.x <= xMax && p.y >= yMin && p.y <= yMax
      );
      if (anyInside) linkIds.add(link.id);
    }

    return { nodeIds, linkIds };
  }

  /** Update node and link selection to match what intersects the rect (live during rubber-band). */
  private updateSelectionForRect(rect: SelectionRect): void {
    const { nodeIds, linkIds } = this.getNodesAndLinksInRect(rect);
    this.state.setNodeAndLinkSelection(nodeIds, linkIds);
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

  /** Toggle Pan tool (toolbar button). */
  protected onPanToolToggle(): void {
    this.state.setPanToolActive(!this.state.panToolActive());
  }

  /** Reset zoom to 100%. */
  protected onResetZoom(): void {
    const { width, height } = this.getContainerSize();
    this.viewport.resetZoom(width, height);
  }

  /** Current zoom as percentage for toolbar display. */
  protected zoomPercent(): number {
    const { width } = this.getContainerSize();
    const vb = this.state.viewBox();
    return Math.round((width / vb.width) * 100);
  }

  /** Group selected nodes into a GroupNode. */
  protected onGroup(): void {
    this.operations.groupSelectedNodes();
  }

  /** Ungroup the selected GroupNode. */
  protected onUngroup(): void {
    const selectedNodeIds = this.state.selectedNodeIds();
    if (selectedNodeIds.size !== 1) return;
    
    const nodeId = Array.from(selectedNodeIds)[0];
    this.operations.ungroupNode(nodeId);
  }

  /** Check if grouping is possible (2+ regular nodes selected). */
  protected canGroup(): boolean {
    const d = this.state.getDiagram();
    const selectedNodeIds = this.state.selectedNodeIds();
    if (!d || selectedNodeIds.size < 2) return false;

    // Check that all selected nodes are regular nodes (not groups)
    for (const nodeId of selectedNodeIds) {
      const node = d.getNode(nodeId);
      if (!node || node.nodeType === 'group') return false;
    }
    return true;
  }

  /** Check if ungrouping is possible (1 group node selected). */
  protected canUngroup(): boolean {
    const d = this.state.getDiagram();
    const selectedNodeIds = this.state.selectedNodeIds();
    if (!d || selectedNodeIds.size !== 1) return false;

    const nodeId = Array.from(selectedNodeIds)[0];
    const node = d.getNode(nodeId);
    return node instanceof GroupNode;
  }

  /** Handle group node pointer events (same as regular nodes). */
  protected onGroupNodePointerDown(event: GroupNodePointerEvent): void {
    this.onNodePointerDown(event as unknown as NodePointerEvent);
  }

  protected onGroupNodePointerMove(event: GroupNodePointerEvent): void {
    this.onNodePointerMove(event as unknown as NodePointerEvent);
  }

  protected onGroupNodePointerUp(event: GroupNodePointerEvent): void {
    this.onNodePointerUp(event as unknown as NodePointerEvent);
  }

  protected onGroupNodeContextMenu(event: GroupNodeContextMenuEvent): void {
    if (!this.interactionEnabled('nodeContextMenu')) return;
    const { node, event: ev } = event;
    if (!this.selectedNodeIds().has(node.id)) {
      this.state.setNodeSelection(new Set([node.id]));
      this.state.setLinkSelection(new Set());
    }
    this.nodeContextMenuIsGroup.set(true);
    this.nodeContextMenuPosition.set({ x: ev.clientX, y: ev.clientY });
  }

  /** Handle group port pointer events (same as regular ports). */
  protected onGroupPortPointerDown(event: GroupPortPointerEvent): void {
    this.onPortPointerDown(event as unknown as PortPointerEvent);
  }

  /** Handle resize handle pointer down. */
  protected onResizeHandlePointerDown(event: ResizeHandlePointerEvent): void {
    if (!this.interactionEnabled('groupResize')) return;
    if (event.node.locked) return;
    const svg = this.svgContainer?.nativeElement;
    if (!svg) return;

    const pt = this.coordinate.clientToSvg(svg, event.event.clientX, event.event.clientY);
    this.resize.startResize(event.node.id, event.handle, pt.x, pt.y);

    // Set up pointer capture and listeners
    const target = event.event.target as Element;
    target.setPointerCapture?.(event.event.pointerId);
    
    const pointerId = event.event.pointerId;
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const pt = this.coordinate.clientToSvg(svg, e.clientX, e.clientY);
      this.resize.updateResize(pt.x, pt.y);
    };
    
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      target.releasePointerCapture?.(pointerId);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      this.resize.endResize();
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
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
