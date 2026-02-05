/**
 * Field Mapper data model: tree nodes, mappings, filters.
 */

/** Single tree node. Leaves have 4 column values; parents have children. */
export interface TreeNode {
  id: string;
  label: string;
  /** Present for parent nodes; absent or empty for leaves. */
  children?: TreeNode[];
  /** True when node is a leaf (no children). Leaves have columns. */
  isLeaf: boolean;
  /** For leaves only: values for the 4 columns. */
  columns?: [string, string, string, string];
}

/** One connection from a source leaf to a target leaf. */
export interface Mapping {
  sourceLeafId: string;
  targetLeafId: string;
}

/** Stable key for a mapping (for selection / lookup). */
export function mappingKey(m: Mapping): string {
  return `${m.sourceLeafId}\0${m.targetLeafId}`;
}

/** Filter state per column (e.g. search string). */
export interface ColumnFilter {
  value: string;
}

/** Expanded state: set of node ids that are expanded. */
export type ExpandedIds = Set<string>;

/** Anchor position for drawing links (in container/SVG coordinates). */
export interface AnchorPoint {
  x: number;
  y: number;
}

/** Optional Bezier path options (control point offset). */
export interface BezierPathOptions {
  /** Horizontal offset for control points as fraction of width. Default 0.3. */
  controlOffset?: number;
}

export const COLUMN_COUNT = 4;
