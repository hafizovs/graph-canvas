import { Injectable } from '@angular/core';
import type { Diagram, Link, Node } from '../../../../graph-core';
import type { PointLike, Rect } from '../../../../graph-core';
import { GraphLinkGeometryService } from './graph-link-geometry.service';
import { GRID_STEP } from './graph-coordinate.service';

export interface LodCanvasDrawOptions {
  gridVisible?: boolean;
  gridStep?: number;
}

/**
 * Draws the graph diagram onto a 2D canvas for LOD (Level of Detail) when zoomed out.
 * Transforms SVG coordinates to canvas pixels via viewBox. Draws grid (optional), links, then nodes.
 */
@Injectable({ providedIn: 'root' })
export class GraphLodCanvasService {
  constructor(private readonly linkGeometry: GraphLinkGeometryService) {}

  /**
   * Draw diagram onto the canvas. Coordinate transform: svg -> px
   * pxX = (svgX - viewBox.x) / viewBox.width * canvasWidth, same for Y.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    diagram: Diagram,
    viewBox: { x: number; y: number; width: number; height: number },
    canvasWidth: number,
    canvasHeight: number,
    options: LodCanvasDrawOptions = {}
  ): void {
    const { gridVisible = false, gridStep = GRID_STEP } = options;

    const toPx = (svgX: number, svgY: number): { x: number; y: number } => ({
      x: ((svgX - viewBox.x) / viewBox.width) * canvasWidth,
      y: ((svgY - viewBox.y) / viewBox.height) * canvasHeight,
    });

    ctx.save();

    if (gridVisible && viewBox.width > 0 && viewBox.height > 0) {
      this.drawGrid(ctx, viewBox, canvasWidth, canvasHeight, gridStep, toPx);
    }

    // Draw links below nodes
    const links = [...diagram.links].sort((a, b) => a.zIndex - b.zIndex);
    for (const link of links) {
      this.drawLink(ctx, diagram, link, toPx);
    }

    const nodes = [...diagram.nodes].sort((a, b) => a.zIndex - b.zIndex);
    for (const node of nodes) {
      this.drawNode(ctx, node, toPx);
    }

    ctx.restore();
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    viewBox: { x: number; y: number; width: number; height: number },
    canvasWidth: number,
    canvasHeight: number,
    gridStep: number,
    toPx: (x: number, y: number) => { x: number; y: number }
  ): void {
    const stroke = getComputedStyle(document.documentElement)
      .getPropertyValue('--grid-stroke')
      .trim() || '#ddd';
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.5;

    const xMin = Math.floor(viewBox.x / gridStep) * gridStep;
    const xMax = viewBox.x + viewBox.width;
    const yMin = Math.floor(viewBox.y / gridStep) * gridStep;
    const yMax = viewBox.y + viewBox.height;

    ctx.beginPath();
    for (let x = xMin; x <= xMax; x += gridStep) {
      const p0 = toPx(x, viewBox.y);
      const p1 = toPx(x, viewBox.y + viewBox.height);
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
    }
    for (let y = yMin; y <= yMax; y += gridStep) {
      const p0 = toPx(viewBox.x, y);
      const p1 = toPx(viewBox.x + viewBox.width, y);
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
    }
    ctx.stroke();
  }

  private drawLink(
    ctx: CanvasRenderingContext2D,
    diagram: Diagram,
    link: Link,
    toPx: (x: number, y: number) => { x: number; y: number }
  ): void {
    const pts = this.linkGeometry.getPathPoints(link, diagram);
    if (pts.length < 2) return;

    const stroke = getComputedStyle(document.documentElement)
      .getPropertyValue('--link-stroke')
      .trim() || '#666';
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const first = toPx(pts[0].x, pts[0].y);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < pts.length; i++) {
      const p = toPx(pts[i].x, pts[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  private drawNode(
    ctx: CanvasRenderingContext2D,
    node: Node,
    toPx: (x: number, y: number) => { x: number; y: number }
  ): void {
    const r = node.getRect();
    const x = r.x;
    const y = r.y;
    const w = r.width;
    const h = r.height;
    const cx = x + w / 2;
    const cy = y + h / 2;

    const tl = toPx(x, y);
    const br = toPx(x + w, y + h);
    const pxW = br.x - tl.x;
    const pxH = br.y - tl.y;
    const pxCx = tl.x + pxW / 2;
    const pxCy = tl.y + pxH / 2;

    const fill = getComputedStyle(document.documentElement)
      .getPropertyValue('--node-fill')
      .trim() || '#fff';
    const stroke = getComputedStyle(document.documentElement)
      .getPropertyValue('--node-stroke')
      .trim() || '#333';
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    switch (node.shape) {
      case 'roundedRect':
        const rx = Math.min(pxW / 4, 30);
        const ry = Math.min(pxH / 4, 15);
        this.roundRect(ctx, tl.x, tl.y, pxW, pxH, rx, ry);
        break;
      case 'circle':
      case 'ellipse':
        ctx.ellipse(pxCx, pxCy, pxW / 2, pxH / 2, 0, 0, Math.PI * 2);
        break;
      case 'diamond': {
        const dx = toPx(cx, y);
        const dy = toPx(cx, y + h);
        const l = toPx(x, cy);
        const ri = toPx(x + w, cy);
        ctx.moveTo(dx.x, dx.y);
        ctx.lineTo(ri.x, ri.y);
        ctx.lineTo(dy.x, dy.y);
        ctx.lineTo(l.x, l.y);
        ctx.closePath();
        break;
      }
      case 'triangle': {
        const t = toPx(cx, y);
        const bl = toPx(x, y + h);
        const br_ = toPx(x + w, y + h);
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(br_.x, br_.y);
        ctx.lineTo(bl.x, bl.y);
        ctx.closePath();
        break;
      }
      case 'hexagon':
      case 'parallelogram':
      case 'pentagon':
      case 'cross':
      case 'custom':
      case 'rectangle':
      default:
        ctx.rect(tl.x, tl.y, pxW, pxH);
        break;
    }
    ctx.fill();
    ctx.stroke();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    rx: number,
    ry: number
  ): void {
    ctx.moveTo(x + rx, y);
    ctx.lineTo(x + w - rx, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + ry);
    ctx.lineTo(x + w, y + h - ry);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rx, y + h);
    ctx.lineTo(x + rx, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - ry);
    ctx.lineTo(x, y + ry);
    ctx.quadraticCurveTo(x, y, x + rx, y);
  }
}
