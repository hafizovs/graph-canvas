import type { AnchorPoint } from '../models/field-mapper.model';

const DEFAULT_CONTROL_OFFSET = 0.3;

/**
 * Build SVG path d for a cubic Bezier from source to target.
 * Control points are offset horizontally so the curve flows between two panels.
 */
export function buildBezierPath(
  source: AnchorPoint,
  target: AnchorPoint,
  options?: { controlOffset?: number }
): string {
  const offset = options?.controlOffset ?? DEFAULT_CONTROL_OFFSET;
  const dx = Math.abs(target.x - source.x) || 1;
  const cpx1 = source.x + dx * offset;
  const cpy1 = source.y;
  const cpx2 = target.x - dx * offset;
  const cpy2 = target.y;
  return `M ${source.x} ${source.y} C ${cpx1} ${cpy1} ${cpx2} ${cpy2} ${target.x} ${target.y}`;
}
