import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { GraphEditorStateService } from './graph-editor-state.service';
import { GraphUndoRedoService } from './graph-undo-redo.service';
import { GraphOperationsService } from './graph-operations.service';
import { GraphEditorActionDispatcher } from '../actions/action-dispatcher.service';
import { GRAPH_EDITOR_CONFIG } from '../config/graph-editor-config';
import { createDefaultConfig } from '../config/graph-editor-config';
import { MOCK_DIAGRAM_CHAIN, MOCK_DIAGRAM_SINGLE_NODE } from '../../../../graph-core';
import { GRID_STEP } from './graph-coordinate.service';

describe('GraphOperationsService', () => {
  let state: GraphEditorStateService;
  let operations: GraphOperationsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: GRAPH_EDITOR_CONFIG, useValue: signal(createDefaultConfig()) },
        GraphEditorActionDispatcher,
        GraphOperationsService,
      ],
    });
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

  it('alignSelectedNodes alignLeft uses first selected as reference and aligns others', () => {
    const d = state.getDiagram()!;
    const n1 = d.getNode('n1')!;
    const n2 = d.getNode('n2')!;
    // n1 at (100,100), n2 at (350,100); first selected = n1 = reference
    state.setNodeSelection(new Set(['n1', 'n2']));
    state.setSnapToGridEnabled(false);
    operations.alignSelectedNodes('alignLeft');
    expect(n1.x).toBe(100);
    expect(n2.x).toBe(100);
  });

  it('alignSelectedNodes reference node does not move', () => {
    const d = state.getDiagram()!;
    const n1 = d.getNode('n1')!;
    const n2 = d.getNode('n2')!;
    const refX = n1.x;
    const refY = n1.y;
    state.setNodeSelection(new Set(['n1', 'n2']));
    state.setSnapToGridEnabled(false);
    operations.alignSelectedNodes('alignLeft');
    expect(n1.x).toBe(refX);
    expect(n1.y).toBe(refY);
  });

  it('alignSelectedNodes alignCenterH uses reference center (first selected)', () => {
    const d = state.getDiagram()!;
    const n1 = d.getNode('n1')!;
    const n2 = d.getNode('n2')!;
    state.setNodeSelection(new Set(['n1', 'n2']));
    state.setSnapToGridEnabled(false);
    operations.alignSelectedNodes('alignCenterH');
    const cx1 = n1.x + n1.width / 2;
    const cx2 = n2.x + n2.width / 2;
    expect(cx1).toBe(cx2);
    expect(n1.x).toBe(100);
  });

  it('alignSelectedNodes alignRight aligns others to reference right edge', () => {
    const d = state.getDiagram()!;
    const n1 = d.getNode('n1')!;
    const n2 = d.getNode('n2')!;
    state.setNodeSelection(new Set(['n1', 'n2']));
    state.setSnapToGridEnabled(false);
    operations.alignSelectedNodes('alignRight');
    expect(n1.x + n1.width).toBe(n2.x + n2.width);
    expect(n1.x).toBe(100);
  });

  it('alignSelectedNodes with snap snaps moved nodes to grid (reference unchanged)', () => {
    const d = state.getDiagram()!;
    d.getNode('n1')!.setPosition(103, 97);
    d.getNode('n2')!.setPosition(348, 98);
    state.setNodeSelection(new Set(['n1', 'n2']));
    state.setSnapToGridEnabled(true);
    operations.alignSelectedNodes('alignLeft');
    const n1 = d.getNode('n1')!;
    const n2 = d.getNode('n2')!;
    expect(n1.x).toBe(103);
    expect(n1.y).toBe(97);
    expect(n2.x % GRID_STEP).toBe(0);
    expect(n2.y % GRID_STEP).toBe(0);
  });

  it('alignSelectedNodes alignLeft with order n2 then n1 uses n2 as reference', () => {
    const d = state.getDiagram()!;
    const n1 = d.getNode('n1')!;
    const n2 = d.getNode('n2')!;
    state.setNodeSelection(new Set(['n2', 'n1']));
    state.setSnapToGridEnabled(false);
    operations.alignSelectedNodes('alignLeft');
    expect(n2.x).toBe(350);
    expect(n1.x).toBe(350);
  });

  it('alignSelectedNodes does nothing when fewer than 2 nodes selected', () => {
    const d = state.getDiagram()!;
    const n1 = d.getNode('n1')!;
    const origX = n1.x;
    state.setNodeSelection(new Set(['n1']));
    operations.alignSelectedNodes('alignLeft');
    expect(n1.x).toBe(origX);
  });

  it('alignSelectedNodes distributeH spaces three nodes evenly', () => {
    const d = state.getDiagram()!;
    const n1 = d.getNode('n1')!;
    const n2 = d.getNode('n2')!;
    const n3 = d.getNode('n3')!;
    state.setNodeSelection(new Set(['n1', 'n2', 'n3']));
    state.setSnapToGridEnabled(false);
    operations.alignSelectedNodes('distributeH');
    const lefts = [n1.x, n2.x, n3.x].sort((a, b) => a - b);
    const gap1 = lefts[1] - (lefts[0] + 120);
    const gap2 = lefts[2] - (lefts[1] + 120);
    expect(gap1).toBe(gap2);
  });

  it('alignSelectedNodes distributeV spaces three nodes evenly', () => {
    const d = state.getDiagram()!;
    const n1 = d.getNode('n1')!;
    const n2 = d.getNode('n2')!;
    const n3 = d.getNode('n3')!;
    state.setNodeSelection(new Set(['n1', 'n2', 'n3']));
    state.setSnapToGridEnabled(false);
    operations.alignSelectedNodes('distributeV');
    const tops = [n1.y, n2.y, n3.y].sort((a, b) => a - b);
    const gap1 = tops[1] - (tops[0] + 60);
    const gap2 = tops[2] - (tops[1] + 60);
    expect(gap1).toBe(gap2);
  });

  it('alignSelectedNodes distributeH does nothing when only 2 nodes selected', () => {
    const d = state.getDiagram()!;
    const n1 = d.getNode('n1')!;
    const n2 = d.getNode('n2')!;
    const origX1 = n1.x;
    const origX2 = n2.x;
    state.setNodeSelection(new Set(['n1', 'n2']));
    operations.alignSelectedNodes('distributeH');
    expect(n1.x).toBe(origX1);
    expect(n2.x).toBe(origX2);
  });
});
