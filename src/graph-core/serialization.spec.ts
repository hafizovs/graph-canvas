import { describe, it, expect } from 'vitest';
import type { DiagramJson } from './serialization';
import {
  deserializeDiagram,
  serializeDiagram,
  cloneDiagramJsonForPaste,
} from './serialization';
import {
  MOCK_DIAGRAM_EMPTY,
  MOCK_DIAGRAM_SINGLE_NODE,
  MOCK_DIAGRAM_CHAIN,
  MOCK_DIAGRAM_DIAMOND,
} from './mocks/diagram-mocks';

describe('deserializeDiagram', () => {
  it('deserializes empty diagram', () => {
    const diagram = deserializeDiagram(MOCK_DIAGRAM_EMPTY);
    expect(diagram.nodes).toHaveLength(0);
    expect(diagram.links).toHaveLength(0);
  });

  it('deserializes single-node diagram', () => {
    const diagram = deserializeDiagram(MOCK_DIAGRAM_SINGLE_NODE);
    expect(diagram.nodes).toHaveLength(1);
    expect(diagram.links).toHaveLength(0);
    const node = diagram.getNode('n1');
    expect(node).toBeDefined();
    expect(node!.x).toBe(100);
    expect(node!.y).toBe(100);
    expect(node!.label).toBe('Node A');
    expect(node!.ports).toHaveLength(2);
  });

  it('deserializes chain diagram (3 nodes, 2 links)', () => {
    const diagram = deserializeDiagram(MOCK_DIAGRAM_CHAIN);
    expect(diagram.nodes).toHaveLength(3);
    expect(diagram.links).toHaveLength(2);
    expect(diagram.getNode('n1')?.label).toBe('Node A');
    expect(diagram.getNode('n2')?.label).toBe('Node B');
    expect(diagram.getNode('n3')?.label).toBe('Node C');
    expect(diagram.getLink('l1')).toBeDefined();
    expect(diagram.getLink('l2')).toBeDefined();
  });

  it('deserializes diamond diagram (4 nodes, 3 links)', () => {
    const diagram = deserializeDiagram(MOCK_DIAGRAM_DIAMOND);
    expect(diagram.nodes).toHaveLength(4);
    expect(diagram.links).toHaveLength(3);
    expect(diagram.getNode('n3')?.ports).toHaveLength(3);
  });
});

describe('serializeDiagram', () => {
  it('serializes empty diagram round-trip', () => {
    const diagram = deserializeDiagram(MOCK_DIAGRAM_EMPTY);
    const json = serializeDiagram(diagram);
    expect(json.nodes).toHaveLength(0);
    expect(json.links).toHaveLength(0);
  });

  it('serializes and deserializes chain round-trip', () => {
    const diagram = deserializeDiagram(MOCK_DIAGRAM_CHAIN);
    const json = serializeDiagram(diagram);
    const diagram2 = deserializeDiagram(json);
    expect(diagram2.nodes).toHaveLength(diagram.nodes.length);
    expect(diagram2.links).toHaveLength(diagram.links.length);
    expect(diagram2.getNode('n1')?.x).toBe(diagram.getNode('n1')?.x);
  });

  it('round-trip preserves node rotation', () => {
    const diagram = deserializeDiagram(MOCK_DIAGRAM_SINGLE_NODE);
    diagram.getNode('n1')!.setRotation(90);
    const json = serializeDiagram(diagram);
    expect(json.nodes[0].rotation).toBe(90);
    const diagram2 = deserializeDiagram(json);
    expect(diagram2.getNode('n1')!.rotation).toBe(90);
  });
});

describe('cloneDiagramJsonForPaste', () => {
  it('produces new node and link ids', () => {
    const { json, newNodeIds } = cloneDiagramJsonForPaste(
      MOCK_DIAGRAM_CHAIN,
      0,
      0,
      0,
      0
    );
    expect(json.nodes.map((n) => n.id)).toEqual(['n1', 'n2', 'n3']);
    expect(json.links.map((l) => l.id)).toEqual(['l1', 'l2']);
    expect(newNodeIds).toEqual(['n1', 'n2', 'n3']);
  });

  it('applies position offset to nodes', () => {
    const { json } = cloneDiagramJsonForPaste(
      MOCK_DIAGRAM_SINGLE_NODE,
      50,
      60,
      0,
      0
    );
    expect(json.nodes).toHaveLength(1);
    expect(json.nodes[0].x).toBe(100 + 50);
    expect(json.nodes[0].y).toBe(100 + 60);
  });

  it('uses startNodeCounter and startLinkCounter for new ids', () => {
    const { json } = cloneDiagramJsonForPaste(
      MOCK_DIAGRAM_SINGLE_NODE,
      0,
      0,
      5,
      10
    );
    expect(json.nodes[0].id).toBe('n6');
    expect(json.links).toHaveLength(0);
  });

  it('remaps port ids and link port references', () => {
    const { json } = cloneDiagramJsonForPaste(
      MOCK_DIAGRAM_CHAIN,
      0,
      0,
      0,
      0
    );
    const n1 = json.nodes.find((n) => n.id === 'n1')!;
    expect(n1.ports.every((p) => p.nodeId === 'n1')).toBe(true);
    expect(json.links[0].sourcePortId).toBeDefined();
    expect(json.links[0].targetPortId).toBeDefined();
  });

  it('preserves node rotation when cloning for paste', () => {
    const withRotation: DiagramJson = {
      nodes: [
        {
          id: 'n1',
          x: 50,
          y: 50,
          width: 100,
          height: 60,
          label: 'A',
          rotation: 45,
          ports: [
            { id: 'p1-in', nodeId: 'n1', side: 'left', offset: 30, type: 'input' },
            { id: 'p1-out', nodeId: 'n1', side: 'right', offset: 30, type: 'output' },
          ],
        },
      ],
      links: [],
    };
    const { json } = cloneDiagramJsonForPaste(withRotation, 0, 0, 0, 0);
    expect(json.nodes[0].rotation).toBe(45);
  });
});
