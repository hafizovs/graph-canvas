import { describe, it, expect } from 'vitest';
import { Node } from './node';
import { Port } from './port';

describe('Node', () => {
  it('getRect returns position and size', () => {
    const node = new Node({
      id: 'n1',
      x: 100,
      y: 200,
      width: 120,
      height: 60,
      ports: [],
    });
    const rect = node.getRect();
    expect(rect).toEqual({ x: 100, y: 200, width: 120, height: 60 });
  });

  it('setPosition updates x and y', () => {
    const node = new Node({
      id: 'n1',
      x: 0,
      y: 0,
      ports: [],
    });
    node.setPosition(50, 75);
    expect(node.x).toBe(50);
    expect(node.y).toBe(75);
  });

  it('setPositionFromPoint updates from point-like', () => {
    const node = new Node({
      id: 'n1',
      x: 0,
      y: 0,
      ports: [],
    });
    node.setPositionFromPoint({ x: 10, y: 20 });
    expect(node.x).toBe(10);
    expect(node.y).toBe(20);
  });

  it('rotation defaults to 0', () => {
    const node = new Node({
      id: 'n1',
      x: 0,
      y: 0,
      ports: [],
    });
    expect(node.rotation).toBe(0);
  });

  it('setRotation updates rotation', () => {
    const node = new Node({
      id: 'n1',
      x: 0,
      y: 0,
      ports: [],
    });
    node.setRotation(90);
    expect(node.rotation).toBe(90);
    node.setRotation(-45);
    expect(node.rotation).toBe(-45);
  });

  it('ports returns added ports', () => {
    const node = new Node({
      id: 'n1',
      x: 0,
      y: 0,
      ports: [],
    });
    const p1 = new Port({
      id: 'p1',
      nodeId: 'n1',
      side: 'left',
      offset: 0,
      type: 'input',
    });
    const p2 = new Port({
      id: 'p2',
      nodeId: 'n1',
      side: 'right',
      offset: 0,
      type: 'output',
    });
    node.addPort(p1);
    node.addPort(p2);
    expect(node.ports).toHaveLength(2);
    expect(node.getPort('p1')).toBe(p1);
    expect(node.getPort('p2')).toBe(p2);
  });

  it('removePort returns true when port exists', () => {
    const node = new Node({
      id: 'n1',
      x: 0,
      y: 0,
      ports: [],
    });
    node.addPort(
      new Port({
        id: 'p1',
        nodeId: 'n1',
        side: 'left',
        offset: 0,
        type: 'input',
      })
    );
    expect(node.removePort('p1')).toBe(true);
    expect(node.ports).toHaveLength(0);
    expect(node.removePort('p1')).toBe(false);
  });
});
