import { describe, it, expect } from 'vitest';
import { Diagram } from './diagram';
import { Node } from './node';
import { Link } from './link';
import { Port } from './port';
import { deserializeDiagram } from './serialization';
import { MOCK_DIAGRAM_EMPTY, MOCK_DIAGRAM_CHAIN } from './mocks/diagram-mocks';

describe('Diagram', () => {
  it('addNode and getNode', () => {
    const diagram = new Diagram();
    const node = new Node({
      id: 'n1',
      x: 10,
      y: 20,
      label: 'A',
      ports: [],
    });
    diagram.addNode(node);
    expect(diagram.nodes).toHaveLength(1);
    expect(diagram.getNode('n1')).toBe(node);
    expect(diagram.getNode('n2')).toBeUndefined();
  });

  it('removeNode returns false for unknown id', () => {
    const diagram = new Diagram();
    expect(diagram.removeNode('n1')).toBe(false);
  });

  it('removeNode removes node and connected links', () => {
    const diagram = deserializeDiagram(MOCK_DIAGRAM_CHAIN);
    expect(diagram.nodes).toHaveLength(3);
    expect(diagram.links).toHaveLength(2);
    const removed = diagram.removeNode('n2');
    expect(removed).toBe(true);
    expect(diagram.nodes).toHaveLength(2);
    expect(diagram.getNode('n2')).toBeUndefined();
    expect(diagram.links).toHaveLength(0);
  });

  it('addLink and getLink', () => {
    const diagram = deserializeDiagram(MOCK_DIAGRAM_CHAIN);
    const link = diagram.getLink('l1');
    expect(link).toBeDefined();
    expect(link!.sourcePortId).toBe('p1-out');
    expect(link!.targetPortId).toBe('p2-in');
    expect(diagram.getLink('l99')).toBeUndefined();
  });

  it('removeLink returns true when link exists', () => {
    const diagram = deserializeDiagram(MOCK_DIAGRAM_CHAIN);
    expect(diagram.links).toHaveLength(2);
    expect(diagram.removeLink('l1')).toBe(true);
    expect(diagram.links).toHaveLength(1);
    expect(diagram.removeLink('l1')).toBe(false);
  });

  it('getPortPosition returns position for existing port', () => {
    const diagram = deserializeDiagram(MOCK_DIAGRAM_CHAIN);
    const node = diagram.getNode('n1')!;
    const port = node.getPort('p1-out')!;
    const pos = diagram.getPortPosition('p1-out');
    expect(pos).toBeDefined();
    const expected = port.getAbsolutePosition(node.getRect());
    expect(pos!.x).toBe(expected.x);
    expect(pos!.y).toBe(expected.y);
  });

  it('getPortPosition returns undefined for unknown port', () => {
    const diagram = deserializeDiagram(MOCK_DIAGRAM_EMPTY);
    expect(diagram.getPortPosition('unknown')).toBeUndefined();
  });

  it('getPortPosition returns rotated port position when node has rotation', () => {
    const diagram = new Diagram();
    const node = new Node({
      id: 'n1',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      ports: [
        new Port({
          id: 'p1-out',
          nodeId: 'n1',
          side: 'left',
          offset: 25,
          type: 'output',
        }),
      ],
    });
    node.setRotation(90);
    diagram.addNode(node);
    const pos = diagram.getPortPosition('p1-out');
    expect(pos).toBeDefined();
    // Unrotated port at left side: (0, 25). Center (50, 25). Rotate 90° CW -> (50, 75).
    expect(pos!.x).toBeCloseTo(50, 5);
    expect(pos!.y).toBeCloseTo(75, 5);
  });
});
