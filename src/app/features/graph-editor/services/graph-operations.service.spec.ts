import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GraphEditorStateService } from './graph-editor-state.service';
import { GraphUndoRedoService } from './graph-undo-redo.service';
import { GraphOperationsService } from './graph-operations.service';
import { MOCK_DIAGRAM_CHAIN, MOCK_DIAGRAM_SINGLE_NODE } from '../../../../graph-core';

describe('GraphOperationsService', () => {
  let state: GraphEditorStateService;
  let operations: GraphOperationsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    state = TestBed.inject(GraphEditorStateService);
    const undoRedo = TestBed.inject(GraphUndoRedoService);
    operations = TestBed.inject(GraphOperationsService);
    state.setDiagramFromJson(MOCK_DIAGRAM_CHAIN);
  });

  it('addNode adds a node and increments counter', () => {
    const initialCount = state.getDiagram()!.nodes.length;
    operations.addNode();
    expect(state.getDiagram()!.nodes.length).toBe(initialCount + 1);
    expect(state.getNodeIdCounter()).toBeGreaterThanOrEqual(3);
  });

  it('deleteSelection removes selected nodes and links', () => {
    state.setNodeSelection(new Set(['n2']));
    const removed = operations.deleteSelection();
    expect(removed).toBe(true);
    expect(state.getDiagram()!.getNode('n2')).toBeUndefined();
    expect(state.getDiagram()!.links.length).toBe(0);
  });

  it('moveNodes applies delta and snaps to grid when snap enabled', () => {
    state.setSnapToGridEnabled(true);
    const d = state.getDiagram()!;
    const initialPositions = new Map([
      ['n1', { x: d.getNode('n1')!.x, y: d.getNode('n1')!.y }],
    ]);
    const dx = 10;
    const dy = 20;
    operations.moveNodes(initialPositions, dx, dy);
    const n1 = d.getNode('n1')!;
    const rawX = initialPositions.get('n1')!.x + dx;
    const rawY = initialPositions.get('n1')!.y + dy;
    const snappedX = Math.round(rawX / 20) * 20;
    const snappedY = Math.round(rawY / 20) * 20;
    expect(n1.x).toBe(snappedX);
    expect(n1.y).toBe(snappedY);
  });

  it('moveNodes does not snap when snapToGrid is disabled', () => {
    state.setSnapToGridEnabled(false);
    const d = state.getDiagram()!;
    const initialPositions = new Map([
      ['n1', { x: 55, y: 73 }],
    ]);
    d.getNode('n1')!.setPosition(55, 73);
    operations.moveNodes(initialPositions, 7, 11);
    const n1 = d.getNode('n1')!;
    expect(n1.x).toBe(62);
    expect(n1.y).toBe(84);
  });

  it('createLink adds link when target is free', () => {
    const d = state.getDiagram()!;
    d.removeLink('l2');
    const n1 = d.getNode('n1')!;
    const n3 = d.getNode('n3')!;
    const outPort = n1.ports.find((p) => p.type === 'output')!;
    const inPort = n3.ports.find((p) => p.type === 'input')!;
    const added = operations.createLink(outPort.id, n1.id, inPort.id, n3.id);
    expect(added).toBe(true);
    expect(d.links.length).toBe(2);
  });

  it('copy and paste: paste creates new nodes and selects them', () => {
    state.setNodeSelection(new Set(['n1']));
    operations.copy();
    operations.paste();
    const d = state.getDiagram()!;
    expect(d.nodes.length).toBe(4);
    expect(state.selectedNodeIds().size).toBe(1);
  });

  it('paste with clipboard adds nodes with offset', () => {
    state.setDiagramFromJson(MOCK_DIAGRAM_SINGLE_NODE);
    state.setNodeSelection(new Set(['n1']));
    operations.copy();
    const xBefore = state.getDiagram()!.getNode('n1')!.x;
    operations.paste();
    const nodes = state.getDiagram()!.nodes;
    const pasted = nodes.find((n) => n.id === 'n2');
    expect(pasted).toBeDefined();
    expect(pasted!.x).toBe(xBefore + 20);
  });

  it('rotateSelectedNodes adds angle to selected nodes only', () => {
    const d = state.getDiagram()!;
    const n1 = d.getNode('n1')!;
    const n2 = d.getNode('n2')!;
    n1.setRotation(0);
    n2.setRotation(10);
    state.setNodeSelection(new Set(['n1']));
    operations.rotateSelectedNodes(90);
    expect(n1.rotation).toBe(90);
    expect(n2.rotation).toBe(10);
  });
});
