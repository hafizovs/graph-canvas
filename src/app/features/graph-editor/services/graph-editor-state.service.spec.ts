import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GraphEditorStateService } from './graph-editor-state.service';
import { deserializeDiagram } from '../../../../graph-core';
import { MOCK_DIAGRAM_CHAIN } from '../../../../graph-core';

describe('GraphEditorStateService', () => {
  let service: GraphEditorStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GraphEditorStateService);
  });

  it('getDiagram returns null initially', () => {
    expect(service.getDiagram()).toBeNull();
  });

  it('setDiagram and getDiagram', () => {
    const diagram = deserializeDiagram(MOCK_DIAGRAM_CHAIN);
    service.setDiagram(diagram, false);
    expect(service.getDiagram()).toBe(diagram);
    expect(service.diagram()).toBe(diagram);
  });

  it('clearSelection clears nodes and links selection', () => {
    service.selectedNodeIds.set(new Set(['n1']));
    service.selectedLinkIds.set(new Set(['l1']));
    service.clearSelection();
    expect(service.selectedNodeIds().size).toBe(0);
    expect(service.selectedLinkIds().size).toBe(0);
  });

  it('toggleNodeSelection adds or removes node', () => {
    service.toggleNodeSelection('n1');
    expect(service.selectedNodeIds().has('n1')).toBe(true);
    service.toggleNodeSelection('n1');
    expect(service.selectedNodeIds().has('n1')).toBe(false);
  });

  it('syncCountersFromDiagram updates counters from diagram', () => {
    const diagram = deserializeDiagram(MOCK_DIAGRAM_CHAIN);
    service.setDiagram(diagram, false);
    service.syncCountersFromDiagram();
    expect(service.getNodeIdCounter()).toBe(3);
    expect(service.getLinkIdCounter()).toBe(2);
  });

  it('setDiagramFromJson deserializes and clears selection', () => {
    service.setDiagramFromJson(MOCK_DIAGRAM_CHAIN);
    expect(service.getDiagram()).not.toBeNull();
    expect(service.getDiagram()!.nodes.length).toBe(3);
    expect(service.selectedNodeIds().size).toBe(0);
  });

  it('setViewBox updates viewBox', () => {
    service.setViewBox({ x: 10, y: 20, width: 400, height: 300 });
    const vb = service.viewBox();
    expect(vb.x).toBe(10);
    expect(vb.y).toBe(20);
    expect(vb.width).toBe(400);
    expect(vb.height).toBe(300);
  });

  it('selectNodesInRect selects nodes intersecting rect and clears selectionRect', () => {
    service.setDiagramFromJson(MOCK_DIAGRAM_CHAIN);
    const d = service.getDiagram()!;
    const n1 = d.getNode('n1')!;
    const n2 = d.getNode('n2')!;
    service.setSelectionRect({ x1: 0, y1: 0, x2: 0, y2: 0 });
    service.selectNodesInRect({
      x1: n1.x - 10,
      y1: n1.y - 10,
      x2: n1.x + n1.width + 10,
      y2: n1.y + n1.height + 10,
    });
    expect(service.selectedNodeIds().has('n1')).toBe(true);
    expect(service.selectedNodeIds().size).toBe(1);
    expect(service.selectionRect()).toBeNull();
  });
});
