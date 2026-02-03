import { Injectable } from '@angular/core';
import { GroupNode } from '../../../../graph-core';
import type { NodeId } from '../../../../graph-core';
import { GraphEditorStateService } from './graph-editor-state.service';
import { GraphOperationsService } from './graph-operations.service';
import { GraphUndoRedoService } from './graph-undo-redo.service';

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface ResizeState {
  nodeId: NodeId;
  handle: ResizeHandle;
  initialWidth: number;
  initialHeight: number;
  initialX: number;
  initialY: number;
  startX: number;
  startY: number;
}

/**
 * Service for handling node resize operations (primarily for GroupNodes).
 * Manages resize state and applies transformations based on handle dragging.
 */
@Injectable({ providedIn: 'root' })
export class GraphResizeService {
  private resizeState: ResizeState | null = null;

  constructor(
    private state: GraphEditorStateService,
    private operations: GraphOperationsService,
    private undoRedo: GraphUndoRedoService
  ) {}

  /**
   * Start a resize operation.
   * @param nodeId - ID of the node being resized
   * @param handle - Which resize handle was grabbed
   * @param startX - Initial pointer X position (SVG coordinates)
   * @param startY - Initial pointer Y position (SVG coordinates)
   */
  startResize(nodeId: NodeId, handle: ResizeHandle, startX: number, startY: number): boolean {
    const d = this.state.getDiagram();
    const node = d?.getNode(nodeId);
    if (!d || !node || !(node instanceof GroupNode)) return false;

    // Push undo state at the start of resize
    this.undoRedo.pushState();

    this.resizeState = {
      nodeId,
      handle,
      initialWidth: node.width,
      initialHeight: node.height,
      initialX: node.x,
      initialY: node.y,
      startX,
      startY,
    };

    return true;
  }

  /**
   * Update the resize based on current pointer position.
   * @param currentX - Current pointer X position (SVG coordinates)
   * @param currentY - Current pointer Y position (SVG coordinates)
   */
  updateResize(currentX: number, currentY: number): boolean {
    if (!this.resizeState) return false;

    const d = this.state.getDiagram();
    const node = d?.getNode(this.resizeState.nodeId);
    if (!d || !node || !(node instanceof GroupNode)) return false;

    const dx = currentX - this.resizeState.startX;
    const dy = currentY - this.resizeState.startY;

    let newWidth = this.resizeState.initialWidth;
    let newHeight = this.resizeState.initialHeight;
    let newX = this.resizeState.initialX;
    let newY = this.resizeState.initialY;

    // Apply resize based on handle
    switch (this.resizeState.handle) {
      case 'nw':
        newWidth = this.resizeState.initialWidth - dx;
        newHeight = this.resizeState.initialHeight - dy;
        newX = this.resizeState.initialX + dx;
        newY = this.resizeState.initialY + dy;
        break;
      case 'n':
        newHeight = this.resizeState.initialHeight - dy;
        newY = this.resizeState.initialY + dy;
        break;
      case 'ne':
        newWidth = this.resizeState.initialWidth + dx;
        newHeight = this.resizeState.initialHeight - dy;
        newY = this.resizeState.initialY + dy;
        break;
      case 'e':
        newWidth = this.resizeState.initialWidth + dx;
        break;
      case 'se':
        newWidth = this.resizeState.initialWidth + dx;
        newHeight = this.resizeState.initialHeight + dy;
        break;
      case 's':
        newHeight = this.resizeState.initialHeight + dy;
        break;
      case 'sw':
        newWidth = this.resizeState.initialWidth - dx;
        newHeight = this.resizeState.initialHeight + dy;
        newX = this.resizeState.initialX + dx;
        break;
      case 'w':
        newWidth = this.resizeState.initialWidth - dx;
        newX = this.resizeState.initialX + dx;
        break;
    }

    // Apply minimum size constraints
    const minWidth = 100;
    const minHeight = 80;

    if (newWidth < minWidth) {
      if (this.resizeState.handle.includes('w')) {
        newX = this.resizeState.initialX + this.resizeState.initialWidth - minWidth;
      }
      newWidth = minWidth;
    }

    if (newHeight < minHeight) {
      if (this.resizeState.handle.includes('n')) {
        newY = this.resizeState.initialY + this.resizeState.initialHeight - minHeight;
      }
      newHeight = minHeight;
    }

    // Update node position and size
    node.setPosition(newX, newY);
    this.operations.resizeGroupNode(this.resizeState.nodeId, newWidth, newHeight);

    return true;
  }

  /**
   * End the resize operation.
   */
  endResize(): void {
    if (!this.resizeState) return;

    this.resizeState = null;
    
    // Force a render update
    this.state.incrementRenderTick();
  }

  /**
   * Check if a resize operation is currently active.
   */
  isResizing(): boolean {
    return this.resizeState !== null;
  }

  /**
   * Get the current resize state (for debugging or UI feedback).
   */
  getResizeState(): ResizeState | null {
    return this.resizeState;
  }
}
