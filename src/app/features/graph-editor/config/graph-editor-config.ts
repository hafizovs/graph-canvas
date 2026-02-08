import { InjectionToken } from '@angular/core';
import type { Signal } from '@angular/core';
import type { NodeShape } from '../../../../graph-core';
import type { DiagramJson } from '../../../../graph-core';

/** Token for injecting the current editor config (as a Signal). Provided by GraphEditorComponent. */
export const GRAPH_EDITOR_CONFIG = new InjectionToken<Signal<GraphEditorConfig>>(
  'GRAPH_EDITOR_CONFIG'
);

/** Toolbar feature flags. */
export interface GraphEditorToolbarConfig {
  visible?: boolean;
  addNode?: boolean;
  delete?: boolean;
  rotate?: boolean;
  align?: boolean;
  groupUngroup?: boolean;
  bringToFrontSendToBack?: boolean;
  lockUnlock?: boolean;
  connectorStyle?: boolean;
  zoom?: boolean;
  panTool?: boolean;
  zoomReset100?: boolean;
  zoomIndicator?: boolean;
  tooltips?: boolean;
  snapToGrid?: boolean;
  examples?: boolean;
  saveLoad?: boolean;
  fieldMapperDemo?: boolean;
  lodToggle?: boolean;
  viewportCullingToggle?: boolean;
  /** Show "Max links per port" input in toolbar. Default true. */
  maxLinksPerPort?: boolean;
}

/** Palette feature flags. */
export interface GraphEditorPaletteConfig {
  visible?: boolean;
  shapes?: NodeShape[] | 'all';
}

/** Keyboard shortcut feature flags. */
export interface GraphEditorKeyboardConfig {
  spacePan?: boolean;
  escape?: boolean;
  selectAll?: boolean;
  copyPaste?: boolean;
  duplicate?: boolean;
  undoRedo?: boolean;
  delete?: boolean;
  rotate?: boolean;
  groupUngroup?: boolean;
}

/** Canvas interaction feature flags. */
export interface GraphEditorInteractionsConfig {
  pan?: boolean;
  rubberBandSelection?: boolean;
  nodeDrag?: boolean;
  linkCreation?: boolean;
  /** When true, link drag can start from both input and output ports; when false, only from output. Default false. */
  linkCreationBidirectional?: boolean;
  linkWaypoints?: boolean;
  nodeContextMenu?: boolean;
  linkContextMenu?: boolean;
  groupResize?: boolean;
  /** Max links per port (0 = unlimited). Default 1. */
  maxLinksPerPort?: number;
}

/** Undo/redo configuration. */
export interface GraphEditorUndoRedoConfig {
  enabled: boolean;
  maxSteps?: number;
}

/** LOD (Level of Detail): simplified render and optional Canvas 2D when zoomed out. */
export interface GraphEditorLodConfig {
  /** Enable LOD at low zoom (scale below threshold). Default false. */
  enabled?: boolean;
  /** When LOD is active, use Canvas 2D for rendering. Default true when LOD enabled. */
  useCanvas?: boolean;
  /** Scale threshold: canvas-only (no interaction) when scale < this. Default 0.5. */
  scaleThreshold?: number;
  /** Scale above which SVG culled is allowed when node count is below forceCanvasAboveNodeCount. Default 1.2. */
  interactiveScaleThreshold?: number;
  /** Never render all nodes in SVG when node count >= this; use canvas+hit instead. Default 500. */
  forceCanvasAboveNodeCount?: number;
  /** Hysteresis: enter canvas-only when scale < this. Default 0.45. */
  scaleThresholdEnter?: number;
  /** Hysteresis: leave canvas-only when scale >= this. Default 0.55. */
  scaleThresholdLeave?: number;
  /** Hysteresis: leave canvas+hit for SVG when scale >= this. Default 1.2. */
  interactiveScaleThresholdLeave?: number;
  /** Hysteresis: leave SVG culled when scale < this. Default 1.1. */
  interactiveScaleThresholdEnter?: number;
  /**
   * When set, switch to SVG (svgCulled) at close zoom even when node count >= forceCanvasAboveNodeCount.
   * Example: 1.5 or 2 — at scale >= this value use SVG for crisp rendering; culling keeps only visible nodes/links.
   */
  scaleAboveForceSvg?: number;
}

/**
 * Unified configuration for the graph editor.
 * All features are enabled by default except toolbar.visible (false).
 */
export interface GraphEditorConfig {
  undoRedo?: GraphEditorUndoRedoConfig;
  toolbar?: GraphEditorToolbarConfig;
  palette?: GraphEditorPaletteConfig;
  keyboard?: GraphEditorKeyboardConfig;
  interactions?: GraphEditorInteractionsConfig;
  /** LOD and optional Canvas 2D when zoomed out. */
  lod?: GraphEditorLodConfig;
  snapToGrid?: boolean;
  gridVisible?: boolean;
  /** null = empty diagram, omit = MOCK_DIAGRAM_CHAIN for demo */
  initialDiagram?: DiagramJson | null;
  /** null = disable localStorage */
  storageKey?: string | null;
}

const DEFAULT_TOOLBAR: Required<GraphEditorToolbarConfig> = {
  visible: false,
  addNode: true,
  delete: true,
  rotate: true,
  align: true,
  groupUngroup: true,
  bringToFrontSendToBack: true,
  lockUnlock: true,
  connectorStyle: true,
  zoom: true,
  panTool: true,
  zoomReset100: true,
  zoomIndicator: true,
  tooltips: true,
  snapToGrid: true,
  examples: true,
  saveLoad: true,
  fieldMapperDemo: true,
  lodToggle: true,
  viewportCullingToggle: true,
  maxLinksPerPort: true,
};

const DEFAULT_PALETTE: Required<GraphEditorPaletteConfig> = {
  visible: true,
  shapes: 'all',
};

const DEFAULT_KEYBOARD: Required<GraphEditorKeyboardConfig> = {
  spacePan: true,
  escape: true,
  selectAll: true,
  copyPaste: true,
  duplicate: true,
  undoRedo: true,
  delete: true,
  rotate: true,
  groupUngroup: true,
};

const DEFAULT_INTERACTIONS: Required<GraphEditorInteractionsConfig> = {
  pan: true,
  rubberBandSelection: true,
  nodeDrag: true,
  linkCreation: true,
  linkCreationBidirectional: false,
  linkWaypoints: true,
  nodeContextMenu: true,
  linkContextMenu: true,
  groupResize: true,
  maxLinksPerPort: 1,
};

const DEFAULT_UNDO_REDO: Required<GraphEditorUndoRedoConfig> = {
  enabled: true,
  maxSteps: 50,
};

/** Default LOD: disabled, useCanvas true, scaleThreshold 0.5. */
export const DEFAULT_LOD_SCALE_THRESHOLD = 0.5;

export const DEFAULT_LOD_INTERACTIVE_SCALE_THRESHOLD = 1.2;
export const DEFAULT_LOD_FORCE_CANVAS_ABOVE_NODE_COUNT = 500;

export const DEFAULT_LOD_SCALE_THRESHOLD_ENTER = 0.45;
export const DEFAULT_LOD_SCALE_THRESHOLD_LEAVE = 0.55;
export const DEFAULT_LOD_INTERACTIVE_SCALE_THRESHOLD_ENTER = 1.1;
export const DEFAULT_LOD_INTERACTIVE_SCALE_THRESHOLD_LEAVE = 1.2;

const DEFAULT_LOD: Omit<Required<GraphEditorLodConfig>, 'scaleAboveForceSvg'> = {
  enabled: false,
  useCanvas: true,
  scaleThreshold: DEFAULT_LOD_SCALE_THRESHOLD,
  interactiveScaleThreshold: DEFAULT_LOD_INTERACTIVE_SCALE_THRESHOLD,
  forceCanvasAboveNodeCount: DEFAULT_LOD_FORCE_CANVAS_ABOVE_NODE_COUNT,
  scaleThresholdEnter: DEFAULT_LOD_SCALE_THRESHOLD_ENTER,
  scaleThresholdLeave: DEFAULT_LOD_SCALE_THRESHOLD_LEAVE,
  interactiveScaleThresholdEnter: DEFAULT_LOD_INTERACTIVE_SCALE_THRESHOLD_ENTER,
  interactiveScaleThresholdLeave: DEFAULT_LOD_INTERACTIVE_SCALE_THRESHOLD_LEAVE,
};

/** Creates default config: all enabled except toolbar.visible = false. */
export function createDefaultConfig(): GraphEditorConfig {
  return {
    undoRedo: { ...DEFAULT_UNDO_REDO },
    toolbar: { ...DEFAULT_TOOLBAR },
    palette: { ...DEFAULT_PALETTE },
    keyboard: { ...DEFAULT_KEYBOARD },
    interactions: { ...DEFAULT_INTERACTIONS },
    lod: { ...DEFAULT_LOD },
    snapToGrid: true,
    gridVisible: true,
    storageKey: 'graph-canvas-diagram',
  };
}

/** Merges user config with defaults. User values override. */
export function mergeWithDefaults(user: GraphEditorConfig | null | undefined): GraphEditorConfig {
  const defaults = createDefaultConfig();
  if (!user || typeof user !== 'object') return defaults;
  return {
    ...defaults,
    ...user,
    undoRedo: user.undoRedo !== undefined ? { ...DEFAULT_UNDO_REDO, ...user.undoRedo } : defaults.undoRedo,
    toolbar: user.toolbar !== undefined ? { ...DEFAULT_TOOLBAR, ...user.toolbar } : defaults.toolbar,
    palette: user.palette !== undefined ? { ...DEFAULT_PALETTE, ...user.palette } : defaults.palette,
    keyboard:
      user.keyboard !== undefined ? { ...DEFAULT_KEYBOARD, ...user.keyboard } : defaults.keyboard,
    interactions:
      user.interactions !== undefined
        ? { ...DEFAULT_INTERACTIONS, ...user.interactions }
        : defaults.interactions,
    lod: user.lod !== undefined ? { ...DEFAULT_LOD, ...user.lod } : defaults.lod,
  };
}
