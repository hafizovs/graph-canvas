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
});
