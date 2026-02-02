import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GraphEditorStateService } from './graph-editor-state.service';
import { GraphUndoRedoService } from './graph-undo-redo.service';
import { deserializeDiagram, serializeDiagram } from '../../../../graph-core';
import { MOCK_DIAGRAM_EMPTY, MOCK_DIAGRAM_CHAIN, MOCK_DIAGRAM_SINGLE_NODE } from '../../../../graph-core';

describe('GraphUndoRedoService', () => {
  let state: GraphEditorStateService;
  let undoRedo: GraphUndoRedoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    state = TestBed.inject(GraphEditorStateService);
    undoRedo = TestBed.inject(GraphUndoRedoService);
  });

  it('pushState saves current diagram to undo stack', () => {
    state.setDiagramFromJson(MOCK_DIAGRAM_CHAIN);
    undoRedo.pushState();
    state.setDiagramFromJson(MOCK_DIAGRAM_EMPTY);
    undoRedo.undo();
    expect(state.getDiagram()!.nodes.length).toBe(3);
  });

  it('undo restores previous state and redo restores next', () => {
    state.setDiagramFromJson(MOCK_DIAGRAM_EMPTY);
    undoRedo.pushState();
    state.setDiagramFromJson(MOCK_DIAGRAM_SINGLE_NODE);
    undoRedo.pushState();
    state.setDiagramFromJson(MOCK_DIAGRAM_CHAIN);

    undoRedo.undo();
    expect(state.getDiagram()!.nodes.length).toBe(1);
    undoRedo.undo();
    expect(state.getDiagram()!.nodes.length).toBe(0);

    undoRedo.redo();
    expect(state.getDiagram()!.nodes.length).toBe(1);
    undoRedo.redo();
    expect(state.getDiagram()!.nodes.length).toBe(3);
  });

  it('redo stack is cleared after pushState', () => {
    state.setDiagramFromJson(MOCK_DIAGRAM_CHAIN);
    undoRedo.pushState();
    state.setDiagramFromJson(MOCK_DIAGRAM_EMPTY);
    undoRedo.undo();
    expect(state.getDiagram()!.nodes.length).toBe(3);
    undoRedo.pushState();
    state.setDiagramFromJson(MOCK_DIAGRAM_SINGLE_NODE);
    undoRedo.undo();
    expect(state.getDiagram()!.nodes.length).toBe(3);
    undoRedo.redo();
    expect(state.getDiagram()!.nodes.length).toBe(1);
  });

  it('restoreFromJson clears selection', () => {
    state.setDiagramFromJson(MOCK_DIAGRAM_CHAIN);
    state.setNodeSelection(new Set(['n1']));
    undoRedo.restoreFromJson(MOCK_DIAGRAM_EMPTY);
    expect(state.selectedNodeIds().size).toBe(0);
  });
});
