import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GraphViewportService } from './graph-viewport.service';
import { GraphEditorStateService } from './graph-editor-state.service';
import { deserializeDiagram } from '../../../../graph-core';
import { MOCK_DIAGRAM_CHAIN } from '../../../../graph-core';

describe('GraphViewportService', () => {
  let viewport: GraphViewportService;
  let state: GraphEditorStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    viewport = TestBed.inject(GraphViewportService);
    state = TestBed.inject(GraphEditorStateService);
  });

  it('pan updates viewBox x,y', () => {
    state.setViewBox({ x: 0, y: 0, width: 800, height: 600 });
    viewport.pan(50, 30);
    const vb = state.viewBox();
    expect(vb.x).toBe(-50);
    expect(vb.y).toBe(-30);
    expect(vb.width).toBe(800);
    expect(vb.height).toBe(600);
  });

  it('zoomToCenter zooms in when factor > 1', () => {
    state.setViewBox({ x: 0, y: 0, width: 800, height: 600 });
    viewport.zoomToCenter(1.2);
    const vb = state.viewBox();
    expect(vb.width).toBeLessThan(800);
    expect(vb.height).toBeLessThan(600);
  });

  it('zoomToCenter zooms out when factor < 1', () => {
    state.setViewBox({ x: 0, y: 0, width: 800, height: 600 });
    viewport.zoomToCenter(1 / 1.2);
    const vb = state.viewBox();
    expect(vb.width).toBeGreaterThan(800);
    expect(vb.height).toBeGreaterThan(600);
  });

  it('zoomIn / zoomOut change viewBox', () => {
    state.setViewBox({ x: 0, y: 0, width: 800, height: 600 });
    const w0 = state.viewBox().width;
    viewport.zoomIn();
    const wAfterIn = state.viewBox().width;
    expect(wAfterIn).toBeLessThan(w0);
    viewport.zoomOut();
    expect(state.viewBox().width).toBeGreaterThan(wAfterIn);
  });

  it('fitToView sets viewBox to contain default rect when no diagram', () => {
    state.setViewBox({ x: 100, y: 100, width: 200, height: 200 });
    viewport.fitToView(40);
    const vb = state.viewBox();
    expect(vb.width).toBeGreaterThan(0);
    expect(vb.height).toBeGreaterThan(0);
    expect(vb.x).toBeCloseTo(400 - vb.width / 2, 0);
    expect(vb.y).toBeCloseTo(300 - vb.height / 2, 0);
  });

  it('fitToView fits diagram nodes when diagram is set', () => {
    state.setDiagramFromJson(MOCK_DIAGRAM_CHAIN);
    viewport.fitToView(40, 800, 600);
    const vb = state.viewBox();
    expect(vb.width).toBeGreaterThan(0);
    expect(vb.height).toBeGreaterThan(0);
  });
});
