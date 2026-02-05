import { Injectable } from '@angular/core';
import type { Mapping } from '../models/field-mapper.model';

const MAX_UNDO = 50;

/**
 * Undo/redo for field-mapper mappings only. Stores snapshots of Mapping[].
 * Provide at FieldMapperComponent (or demo modal) level, not in root.
 */
@Injectable()
export class FieldMapperUndoRedoService {
  private _undoStack: Mapping[][] = [];
  private _redoStack: Mapping[][] = [];

  /** Push current mappings onto undo stack; clear redo. */
  pushState(mappings: Mapping[]): void {
    const snapshot = mappings.map((m) => ({ ...m }));
    this._undoStack.push(snapshot);
    if (this._undoStack.length > MAX_UNDO) {
      this._undoStack.shift();
    }
    this._redoStack = [];
  }

  /**
   * Undo one step: push current to redo, pop from undo and return snapshot to apply.
   * Caller must set mappings to the returned value.
   */
  undo(current: Mapping[]): Mapping[] | null {
    if (this._undoStack.length === 0) return null;
    this._redoStack.push(current.map((m) => ({ ...m })));
    return this._undoStack.pop() ?? null;
  }

  /**
   * Redo one step: push current to undo, pop from redo and return snapshot to apply.
   */
  redo(current: Mapping[]): Mapping[] | null {
    if (this._redoStack.length === 0) return null;
    this._undoStack.push(current.map((m) => ({ ...m })));
    return this._redoStack.pop() ?? null;
  }

  get canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this._redoStack.length > 0;
  }
}
