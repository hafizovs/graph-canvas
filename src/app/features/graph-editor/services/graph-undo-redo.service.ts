import { Injectable } from '@angular/core';
import { serializeDiagram } from '../../../../graph-core';
import type { DiagramJson } from '../../../../graph-core';
import { GraphEditorStateService } from './graph-editor-state.service';

const MAX_UNDO = 50;

/**
 * Manages undo/redo history for the graph editor. Pushes snapshots of the diagram (DiagramJson)
 * before mutations; restore replaces current diagram and selection via state service.
 * Max undo steps: 50.
 */
@Injectable({ providedIn: 'root' })
export class GraphUndoRedoService {
  private _undoStack: DiagramJson[] = [];
  private _redoStack: DiagramJson[] = [];

  constructor(private state: GraphEditorStateService) {}

  /**
   * Push current diagram state onto undo stack and clear redo.
   * Call once before a user-triggered mutation (add node, delete, create link, paste, drag start).
   */
  pushState(): void {
    const d = this.state.getDiagram();
    if (!d) return;
    this._undoStack.push(serializeDiagram(d));
    if (this._undoStack.length > MAX_UNDO) {
      this._undoStack.shift();
    }
    this._redoStack = [];
  }

  /** Restore diagram and selection from JSON; used by load, undo, redo. Clears selection. */
  restoreFromJson(json: DiagramJson): void {
    this.state.setDiagramFromJson(json);
  }

  /** Undo one step: push current to redo, pop from undo and restore. */
  undo(): boolean {
    const d = this.state.getDiagram();
    if (this._undoStack.length === 0 || !d) return false;
    this._redoStack.push(serializeDiagram(d));
    const json = this._undoStack.pop()!;
    this.restoreFromJson(json);
    return true;
  }

  /** Redo one step: push current to undo, pop from redo and restore. */
  redo(): boolean {
    const d = this.state.getDiagram();
    if (this._redoStack.length === 0 || !d) return false;
    this._undoStack.push(serializeDiagram(d));
    const json = this._redoStack.pop()!;
    this.restoreFromJson(json);
    return true;
  }

  get canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this._redoStack.length > 0;
  }
}
