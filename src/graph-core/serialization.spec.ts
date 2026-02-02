import { describe, it, expect } from 'vitest';
import { deserializeDiagram, serializeDiagram } from './serialization';
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
});
