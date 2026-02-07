import {
  Directive,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core';
import { GraphEditorStateService } from '../services/graph-editor-state.service';
import { GraphOperationsService } from '../services/graph-operations.service';
import { GraphUndoRedoService } from '../services/graph-undo-redo.service';
import type { GraphEditorKeyboardConfig } from '../config/graph-editor-config';

/**
 * Handles document-level keyboard shortcuts for the graph editor.
 * Attach to the graph editor host (e.g. the root div). Handles Space (pan mode), Escape,
 * Ctrl+A (select all), Ctrl+C/V (copy/paste), Ctrl+Z/Y (undo/redo), Delete/Backspace (emits
 * deleteKey for component to handle waypoint vs selection), KeyR (rotate), Ctrl+G (emits groupKey),
 * Ctrl+Shift+G (emits ungroupKey). Emits escapeKey, deleteKey, groupKey, ungroupKey for actions
 * that require component state (e.g. selected waypoint, canGroup/canUngroup).
 */
@Directive({
  selector: '[appGraphEditorKeyboard]',
  standalone: true,
})
export class GraphEditorKeyboardDirective {
  private readonly state = inject(GraphEditorStateService);
  private readonly operations = inject(GraphOperationsService);
  private readonly undoRedo = inject(GraphUndoRedoService);

  /** Keyboard config; when a flag is false, that shortcut is disabled. */
  readonly keyboardConfig = input<GraphEditorKeyboardConfig | undefined>(undefined);

  /** Emitted when Escape is pressed (component should clear selected waypoint). */
  readonly escapeKey = output<void>();
  /** Emitted when Delete/Backspace is pressed (component handles waypoint vs selection). */
  readonly deleteKey = output<void>();
  /** Emitted when Ctrl+G / Cmd+G is pressed (component calls onGroup). */
  readonly groupKey = output<void>();
  /** Emitted when Ctrl+Shift+G / Cmd+Shift+G is pressed (component calls onUngroup). */
  readonly ungroupKey = output<void>();

  private isEnabled(key: keyof GraphEditorKeyboardConfig): boolean {
    const cfg = this.keyboardConfig();
    return cfg?.[key] !== false;
  }

  @HostListener('document:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    if (event.key === ' ' && this.isEnabled('spacePan')) {
      this.state.setSpaceKeyDown(false);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const tag = (event.target as Element)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (event.key === ' ') {
      if (this.isEnabled('spacePan')) {
        this.state.setSpaceKeyDown(true);
        event.preventDefault();
      }
      return;
    }
    if (event.key === 'Escape') {
      if (this.isEnabled('escape')) {
        this.state.clearSelection();
        this.escapeKey.emit();
      }
      return;
    }
    if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
      if (this.isEnabled('selectAll')) {
        event.preventDefault();
        this.state.selectAllNodesAndLinks();
      }
      return;
    }
    if (event.key === 'c' && (event.ctrlKey || event.metaKey)) {
      if (this.isEnabled('copyPaste')) this.operations.copy();
      return;
    }
    if (event.key === 'v' && (event.ctrlKey || event.metaKey)) {
      if (this.isEnabled('copyPaste')) {
        event.preventDefault();
        this.operations.paste();
      }
      return;
    }
    if (event.key === 'd' && (event.ctrlKey || event.metaKey)) {
      if (this.isEnabled('duplicate')) {
        event.preventDefault();
        this.operations.duplicateSelection();
      }
      return;
    }
    if (event.key === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
      if (this.isEnabled('undoRedo')) {
        event.preventDefault();
        this.undoRedo.undo();
      }
      return;
    }
    if (
      (event.key === 'y' && (event.ctrlKey || event.metaKey)) ||
      (event.key === 'z' && event.ctrlKey && event.shiftKey) ||
      (event.key === 'z' && event.metaKey && event.shiftKey)
    ) {
      if (this.isEnabled('undoRedo')) {
        event.preventDefault();
        this.undoRedo.redo();
      }
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this.isEnabled('delete')) this.deleteKey.emit();
      return;
    }
    if (
      event.code === 'KeyR' &&
      !event.ctrlKey &&
      !event.metaKey &&
      this.state.selectedNodeIds().size > 0
    ) {
      if (this.isEnabled('rotate')) {
        event.preventDefault();
        this.operations.rotateSelectedNodes(event.shiftKey ? -90 : 90);
      }
      return;
    }
    if (event.key === 'g' && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
      if (this.isEnabled('groupUngroup')) {
        event.preventDefault();
        this.groupKey.emit();
      }
      return;
    }
    if (event.key === 'G' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
      if (this.isEnabled('groupUngroup')) {
        event.preventDefault();
        this.ungroupKey.emit();
      }
      return;
    }
  }
}
