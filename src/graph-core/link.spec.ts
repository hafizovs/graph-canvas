import { describe, it, expect } from 'vitest';
import { Diagram } from './diagram';
import { Link } from './link';
import { Point } from './point';
import { deserializeDiagram } from './serialization';
import { MOCK_DIAGRAM_CHAIN } from './mocks/diagram-mocks';

describe('Link', () => {
  it('buildPath returns straight line when no waypoints', () => {
    const diagram = deserializeDiagram(MOCK_DIAGRAM_CHAIN);
    const link = diagram.getLink('l1')!;
    const path = link.buildPath(diagram);
    expect(path).toMatch(/^M \d+ \d+ L \d+ \d+$/);
    expect(path).toContain('M ');
    expect(path).toContain(' L ');
  });

  it('buildPath returns path with waypoints when points are set', () => {
    const diagram = deserializeDiagram(MOCK_DIAGRAM_CHAIN);
    const link = diagram.getLink('l1')!;
    link.points = [new Point(250, 100), new Point(250, 175)];
    const path = link.buildPath(diagram);
    expect(path).toContain('M ');
    expect(path).toContain('L 250 100');
    expect(path).toContain('L 250 175');
    expect(path).toContain(' L '); // final segment to target
  });

  it('buildPath returns empty string when port not found', () => {
    const diagram = new Diagram();
    const link = new Link({
      id: 'l1',
      sourcePortId: 'missing',
      targetPortId: 'also-missing',
    });
    expect(link.buildPath(diagram)).toBe('');
  });
});
