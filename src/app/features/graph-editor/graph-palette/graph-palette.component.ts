import { Component, ChangeDetectionStrategy, output } from '@angular/core';
import type { NodeShape } from '../../../../graph-core';

export interface ShapeDragStartPayload {
  shape: NodeShape;
  pointerId: number;
  customShapeId?: string;
}

const BUILTIN_SHAPES: { shape: NodeShape; label: string }[] = [
  { shape: 'rectangle', label: 'Rectangle' },
  { shape: 'roundedRect', label: 'Rounded rect' },
  { shape: 'circle', label: 'Circle' },
  { shape: 'ellipse', label: 'Ellipse' },
  { shape: 'diamond', label: 'Diamond' },
  { shape: 'triangle', label: 'Triangle' },
  { shape: 'hexagon', label: 'Hexagon' },
  { shape: 'parallelogram', label: 'Parallelogram' },
  { shape: 'pentagon', label: 'Pentagon' },
  { shape: 'cross', label: 'Cross' },
];

const CUSTOM_SHAPES: { assetId: string; label: string }[] = [
  { assetId: 'shapes/star.svg', label: 'Star' },
  { assetId: 'shapes/gear.svg', label: 'Gear' },
  { assetId: 'shapes/arrow.svg', label: 'Arrow' },
  { assetId: 'shapes/heart.svg', label: 'Heart' },
];

/**
 * Sidebar palette of node shapes. User can drag a shape onto the canvas to add a node.
 */
@Component({
  selector: 'app-graph-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './graph-palette.component.html',
  styleUrl: './graph-palette.component.scss',
})
export class GraphPaletteComponent {
  readonly shapeDragStart = output<ShapeDragStartPayload>();

  protected readonly builtinShapes = BUILTIN_SHAPES;
  protected readonly customShapes = CUSTOM_SHAPES;

  protected readonly assetsBase = '/assets/';

  protected onBuiltinPointerDown(shape: NodeShape, event: PointerEvent): void {
    event.preventDefault();
    this.shapeDragStart.emit({ shape, pointerId: event.pointerId });
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  protected onCustomPointerDown(assetId: string, event: PointerEvent): void {
    event.preventDefault();
    this.shapeDragStart.emit({
      shape: 'custom',
      pointerId: event.pointerId,
      customShapeId: assetId,
    });
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }
}
