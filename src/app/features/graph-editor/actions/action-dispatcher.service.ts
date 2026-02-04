import { Injectable } from '@angular/core';
import type { GraphEditorAction } from './graph-editor-action';
import type { ActionContext } from './action-context';
import { GraphEditorStateService } from '../services/graph-editor-state.service';
import { GraphUndoRedoService } from '../services/graph-undo-redo.service';
import { GraphCoordinateService } from '../services/graph-coordinate.service';
import { GraphLinkGeometryService } from '../services/graph-link-geometry.service';

/**
 * Dispatches graph editor actions: pushes undo state when required,
 * then executes the action with a shared context (state, coordinate, linkGeometry).
 * Used by {@link GraphOperationsService} as the single entry point for undoable mutations.
 */
@Injectable({ providedIn: 'root' })
export class GraphEditorActionDispatcher {
  private readonly context: ActionContext;

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
   * Execute an action. Pushes current diagram onto undo stack first if the action requests it.
   * @param action - Action to run
   */
  dispatch(action: GraphEditorAction): void {
    if (action.pushUndoBeforeExecute) {
      this.undoRedo.pushState();
    }
    action.execute(this.context);
  }
}
