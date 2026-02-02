import { Injectable } from '@angular/core';
import type { NodeId } from '../../../../graph-core';
import type { Rect } from '../../../../graph-core';
import { GraphEditorStateService } from './graph-editor-state.service';

const DEFAULT_VIEW_WIDTH = 800;
const DEFAULT_VIEW_HEIGHT = 600;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const DEFAULT_ZOOM_FACTOR = 1.2;
const FIT_PADDING = 40;

/**
 * Service for pan/zoom and "zoom to" operations. Reads and updates viewBox via GraphEditorStateService.
 * All viewport logic is here; component passes container dimensions for fit/zoom-to-node/selection.
 */
@Injectable({ providedIn: 'root' })
export class GraphViewportService {
  constructor(private readonly state: GraphEditorStateService) {}

  /** Pan the view by dx, dy in SVG coordinates. */
  pan(dx: number, dy: number): void {
    const vb = this.state.viewBox();
    this.state.setViewBox({
      ...vb,
      x: vb.x - dx,
      y: vb.y - dy,
    });
  }

  /**
   * Zoom by factor around an optional center point (SVG coords).
   * Factor > 1 zooms in, < 1 zooms out. If center omitted, uses viewBox center.
   */
  zoomAt(factor: number, centerInSvg?: { x: number; y: number }): void {
    const vb = this.state.viewBox();
    let newW = vb.width / factor;
    let newH = vb.height / factor;
    const scaleW = DEFAULT_VIEW_WIDTH / newW;
    const scaleH = DEFAULT_VIEW_HEIGHT / newH;
    const scale = Math.min(scaleW, scaleH);
    const clampedScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
    newW = DEFAULT_VIEW_WIDTH / clampedScale;
    newH = DEFAULT_VIEW_HEIGHT / clampedScale;

    const cx = centerInSvg?.x ?? vb.x + vb.width / 2;
    const cy = centerInSvg?.y ?? vb.y + vb.height / 2;
    const newX = cx - ((cx - vb.x) * newW) / vb.width;
    const newY = cy - ((cy - vb.y) * newH) / vb.height;

    this.state.setViewBox({
      x: newX,
      y: newY,
      width: newW,
      height: newH,
    });
  }

  /** Zoom in/out around view center. Factor > 1 = zoom in. */
  zoomToCenter(factor: number): void {
    this.zoomAt(factor);
  }

  /**
   * Set viewBox so the given node is centered with padding.
   * Preserves aspect ratio from containerWidth/containerHeight if provided.
   */
  zoomToNode(
    nodeId: NodeId,
    padding: number = FIT_PADDING,
    containerWidth?: number,
    containerHeight?: number
  ): void {
    const d = this.state.getDiagram();
    if (!d) return;
    const node = d.getNode(nodeId);
    if (!node) return;
    const r = node.getRect();
    this.fitRect(
      { x: r.x, y: r.y, width: r.width, height: r.height },
      padding,
      containerWidth,
      containerHeight
    );
  }

  /**
   * Set viewBox to fit selected nodes with padding. If no selection, does nothing (or could fit all).
   */
  zoomToSelection(
    padding: number = FIT_PADDING,
    containerWidth?: number,
    containerHeight?: number
  ): void {
    const d = this.state.getDiagram();
    const ids = this.state.selectedNodeIds();
    if (!d || ids.size === 0) return;
    const rect = this.bboxOfNodeIds(d, ids);
    if (!rect) return;
    this.fitRect(rect, padding, containerWidth, containerHeight);
  }

  /**
   * Fit all nodes (or default rect) in view with padding.
   * Uses container aspect ratio when containerWidth and containerHeight are provided.
   */
  fitToView(
    padding: number = FIT_PADDING,
    containerWidth?: number,
    containerHeight?: number
  ): void {
    const d = this.state.getDiagram();
    const rect = d && d.nodes.length > 0
      ? this.bboxOfNodes(d.nodes.map((n) => n.getRect()))
      : {
          x: 0,
          y: 0,
          width: DEFAULT_VIEW_WIDTH,
          height: DEFAULT_VIEW_HEIGHT,
        };
    this.fitRect(rect, padding, containerWidth, containerHeight);
  }

  /** Zoom in one step (toolbar). */
  zoomIn(): void {
    this.zoomToCenter(DEFAULT_ZOOM_FACTOR);
  }

  /** Zoom out one step (toolbar). */
  zoomOut(): void {
    this.zoomToCenter(1 / DEFAULT_ZOOM_FACTOR);
  }

  private bboxOfNodeIds(
    d: { getNode(id: NodeId): { getRect(): Rect } | undefined },
    ids: Set<NodeId>
  ): Rect | null {
    const rects: Rect[] = [];
    for (const id of ids) {
      const node = d.getNode(id);
      if (node) rects.push(node.getRect());
    }
    return rects.length > 0 ? this.bboxOfNodes(rects) : null;
  }

  private bboxOfNodes(rects: Rect[]): Rect {
    let xMin = rects[0].x;
    let yMin = rects[0].y;
    let xMax = rects[0].x + rects[0].width;
    let yMax = rects[0].y + rects[0].height;
    for (let i = 1; i < rects.length; i++) {
      const r = rects[i];
      xMin = Math.min(xMin, r.x);
      yMin = Math.min(yMin, r.y);
      xMax = Math.max(xMax, r.x + r.width);
      yMax = Math.max(yMax, r.y + r.height);
    }
    return {
      x: xMin,
      y: yMin,
      width: xMax - xMin,
      height: yMax - yMin,
    };
  }

  private fitRect(
    rect: Rect,
    padding: number,
    containerWidth?: number,
    containerHeight?: number
  ): void {
    const contentW = rect.width + 2 * padding;
    const contentH = rect.height + 2 * padding;
    const contentCenterX = rect.x + rect.width / 2;
    const contentCenterY = rect.y + rect.height / 2;

    const cw = containerWidth ?? DEFAULT_VIEW_WIDTH;
    const ch = containerHeight ?? DEFAULT_VIEW_HEIGHT;
    const viewAspect = cw / ch;
    const contentAspect = contentW / contentH;

    let w: number;
    let h: number;
    if (contentAspect > viewAspect) {
      w = contentW;
      h = contentW / viewAspect;
    } else {
      h = contentH;
      w = contentH * viewAspect;
    }

    this.state.setViewBox({
      x: contentCenterX - w / 2,
      y: contentCenterY - h / 2,
      width: w,
      height: h,
    });
  }
}
