import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GraphLodCanvasService } from './graph-lod-canvas.service';
import { GraphLinkGeometryService } from './graph-link-geometry.service';
import { Diagram, Node, Link, Port } from '../../../../graph-core';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    rect: () => {},
    ellipse: () => {},
    stroke: () => {},
    fill: () => {},
    closePath: () => {},
    quadraticCurveTo: () => {},
    get contextAttributes() {
      return {};
    },
    get canvas() {
      return null as unknown as HTMLCanvasElement;
    },
    set fillStyle(_: string | CanvasGradient | CanvasPattern) {},
    get fillStyle() {
      return '';
    },
    set strokeStyle(_: string | CanvasGradient | CanvasPattern) {},
    get strokeStyle() {
      return '';
    },
    set lineWidth(_: number) {},
    get lineWidth() {
      return 1;
    },
  } as unknown as CanvasRenderingContext2D;
}

describe('GraphLodCanvasService', () => {
  let service: GraphLodCanvasService;
  let diagram: Diagram;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GraphLodCanvasService, GraphLinkGeometryService],
    });
    service = TestBed.inject(GraphLodCanvasService);
    diagram = new Diagram();
    const n1 = new Node({
      id: 'n1',
      x: 100,
      y: 100,
      width: 120,
      height: 60,
      shape: 'rectangle',
      ports: [new Port({ id: 'n1-out', nodeId: 'n1', side: 'right', offset: 30, type: 'output' })],
    });
    const n2 = new Node({
      id: 'n2',
      x: 400,
      y: 100,
      width: 120,
      height: 60,
      shape: 'rectangle',
      ports: [new Port({ id: 'n2-in', nodeId: 'n2', side: 'left', offset: 30, type: 'input' })],
    });
    diagram.addNode(n1);
    diagram.addNode(n2);
    diagram.addLink(
      new Link({
        id: 'l1',
        sourcePortId: 'n1-out',
        targetPortId: 'n2-in',
      })
    );
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should draw without throwing', () => {
    const ctx = createMockCtx();
    const viewBox = { x: 0, y: 0, width: 800, height: 600 };
    expect(() => {
      service.draw(ctx, diagram, viewBox, 800, 600, { gridVisible: false });
    }).not.toThrow();
  });

  it('should draw with grid without throwing', () => {
    const ctx = createMockCtx();
    const viewBox = { x: 0, y: 0, width: 800, height: 600 };
    expect(() => {
      service.draw(ctx, diagram, viewBox, 800, 600, { gridVisible: true, gridStep: 20 });
    }).not.toThrow();
  });

  it('should not throw with empty diagram', () => {
    const emptyDiagram = new Diagram();
    const ctx = createMockCtx();
    const viewBox = { x: 0, y: 0, width: 800, height: 600 };
    expect(() => {
      service.draw(ctx, emptyDiagram, viewBox, 800, 600, {});
    }).not.toThrow();
  });
});
