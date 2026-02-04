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
  snapToGrid?: boolean;
  examples?: boolean;
  saveLoad?: boolean;
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
  linkWaypoints?: boolean;
  nodeContextMenu?: boolean;
  linkContextMenu?: boolean;
  groupResize?: boolean;
}

/** Undo/redo configuration. */
export interface GraphEditorUndoRedoConfig {
  enabled: boolean;
  maxSteps?: number;
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
  snapToGrid: true,
  examples: true,
  saveLoad: true,
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
  linkWaypoints: true,
  nodeContextMenu: true,
  linkContextMenu: true,
  groupResize: true,
};

const DEFAULT_UNDO_REDO: Required<GraphEditorUndoRedoConfig> = {
  enabled: true,
  maxSteps: 50,
};

/** Creates default config: all enabled except toolbar.visible = false. */
export function createDefaultConfig(): GraphEditorConfig {
  return {
    undoRedo: { ...DEFAULT_UNDO_REDO },
    toolbar: { ...DEFAULT_TOOLBAR },
    palette: { ...DEFAULT_PALETTE },
    keyboard: { ...DEFAULT_KEYBOARD },
    interactions: { ...DEFAULT_INTERACTIONS },
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
  };
}
