import { inject, Injectable } from '@angular/core';
import type { GraphEditorAction } from './graph-editor-action';
import type { ActionContext } from './action-context';
import { GraphEditorStateService } from '../services/graph-editor-state.service';
import { GraphUndoRedoService } from '../services/graph-undo-redo.service';
import { GraphCoordinateService } from '../services/graph-coordinate.service';
import { GraphLinkGeometryService } from '../services/graph-link-geometry.service';
import { GRAPH_EDITOR_CONFIG } from '../config/graph-editor-config';

/**
 * Dispatches graph editor actions: pushes undo state when required,
 * then executes the action with a shared context (state, coordinate, linkGeometry).
 * Used by {@link GraphOperationsService} as the single entry point for undoable mutations.
 */
@Injectable()
export class GraphEditorActionDispatcher {
  private readonly context: ActionContext;
  private readonly configSignal = inject(GRAPH_EDITOR_CONFIG, { optional: true });

  constructor(
    private readonly state: GraphEditorStateService,
    private readonly undoRedo: GraphUndoRedoService,
    private readonly coordinate: GraphCoordinateService,
    private readonly linkGeometry: GraphLinkGeometryService
  ) {
    this.context = {
      state: this.state,
      coordinate: this.coordinate,
      linkGeometry: this.linkGeometry,
    };
  }

  /**
   * Execute an action. Pushes current diagram onto undo stack first if the action requests it
   * and undo/redo is enabled in config.
   */
  dispatch(action: GraphEditorAction): void {
    if (action.pushUndoBeforeExecute) {
      const cfg = this.configSignal?.();
      if (cfg?.undoRedo?.enabled !== false) {
        this.undoRedo.pushState();
      }
    }
    action.execute(this.context);
  }
}
