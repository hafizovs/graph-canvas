import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  viewChildren,
  ElementRef,
  inject,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import type { TreeNode, ColumnFilter, ExpandedIds, AnchorPoint } from '../models/field-mapper.model';

/** Visible row for rendering: node, depth, is leaf. */
export interface VisibleRow {
  node: TreeNode;
  depth: number;
  isLeaf: boolean;
}

@Component({
  selector: 'app-tree-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './tree-table.component.html',
  styleUrl: './tree-table.component.scss',
})
export class TreeTableComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly root = input.required<TreeNode>();
  readonly expandedIds = input<ExpandedIds>(new Set());
  readonly filters = input<ColumnFilter[]>([
    { value: '' },
    { value: '' },
    { value: '' },
    { value: '' },
  ]);
  /** 'left' = sources (draggable), 'right' = receivers (droppable) */
  readonly side = input<'left' | 'right'>('left');
  /** When set, the leaf row with this id is highlighted as drop target. */
  readonly dropTargetLeafId = input<string | null>(null);

  readonly dragStart = output<{ leafId: string; event: PointerEvent }>();
  readonly filterChange = output<{ columnIndex: number; value: string }>();
  readonly toggleExpand = output<string>();

  readonly rowRefs = viewChildren<ElementRef<HTMLElement>>('rowRef');

  /** Filtered and expanded tree flattened to visible rows. */
  readonly visibleRows = computed(() => {
    const rootNode = this.root();
    const expanded = this.expandedIds();
    const filterVals = this.filters();
    const out: VisibleRow[] = [];
    const push = (node: TreeNode, depth: number) => {
      const isLeaf = node.isLeaf;
      if (isLeaf) {
        const cols = node.columns ?? ['', '', '', ''];
        const match = filterVals.every((f, i) => !f.value || (cols[i] ?? '').toLowerCase().includes(f.value.toLowerCase()));
        if (match) out.push({ node, depth, isLeaf: true });
      } else {
        const hasVisibleChild = (n: TreeNode): boolean => {
          if (n.isLeaf) {
            const cols = n.columns ?? ['', '', '', ''];
            return filterVals.every((f, i) => !f.value || (cols[i] ?? '').toLowerCase().includes(f.value.toLowerCase()));
          }
          return (n.children ?? []).some(hasVisibleChild);
        };
        const visible = (node.children ?? []).some(hasVisibleChild);
        if (visible) {
          out.push({ node, depth, isLeaf: false });
          if (expanded.has(node.id)) {
            for (const c of node.children ?? []) push(c, depth + 1);
          }
        }
      }
    };
    push(rootNode, 0);
    return out;
  });

  readonly columnHeaders = computed(() => {
    const f = this.filters();
    return [
      { label: 'Col 1', filterValue: f[0]?.value ?? '' },
      { label: 'Col 2', filterValue: f[1]?.value ?? '' },
      { label: 'Col 3', filterValue: f[2]?.value ?? '' },
      { label: 'Col 4', filterValue: f[3]?.value ?? '' },
    ];
  });

  onDragStart(leafId: string, event: PointerEvent): void {
    event.preventDefault();
    this.dragStart.emit({ leafId, event });
  }

  onFilterChange(columnIndex: number, value: string): void {
    this.filterChange.emit({ columnIndex, value });
  }

  onToggleExpand(nodeId: string): void {
    this.toggleExpand.emit(nodeId);
  }

  /**
   * Returns map of leafId -> anchor position in the given overlay container's coordinate system.
   * For visible leaf rows uses row rect; for leaves under a collapsed parent uses parent row rect.
   */
  getAnchorPositions(overlayRect: DOMRect): Map<string, AnchorPoint> {
    const result = new Map<string, AnchorPoint>();
    const hostEl = this.host.nativeElement;
    const isLeft = this.side() === 'left';
    const rows = this.visibleRows();
    const expanded = this.expandedIds();

    const leafIdToRowIndex = new Map<string, number>();
    const nodeIdToRowIndex = new Map<string, number>();
    rows.forEach((r, i) => {
      if (r.isLeaf) leafIdToRowIndex.set(r.node.id, i);
      else nodeIdToRowIndex.set(r.node.id, i);
    });

    const getRowElement = (index: number): HTMLElement | null => {
      const refs = this.rowRefs();
      const el = refs[index]?.nativeElement;
      return el ?? null;
    };

    const allLeafIds = this.collectLeafIds(this.root());
    const pathToLeaf = (node: TreeNode, id: string): TreeNode[] | null => {
      if (node.id === id) return [node];
      if (node.isLeaf) return null;
      for (const c of node.children ?? []) {
        const p = pathToLeaf(c, id);
        if (p) return [node, ...p];
      }
      return null;
    };

    for (const leafId of allLeafIds) {
      let rowIdx = leafIdToRowIndex.get(leafId);
      if (rowIdx === undefined) {
        const path = pathToLeaf(this.root(), leafId);
        if (path) {
          const collapsedAncestor = path.find((n) => !n.isLeaf && !expanded.has(n.id));
          if (collapsedAncestor) rowIdx = nodeIdToRowIndex.get(collapsedAncestor.id);
        }
      }
      const el = rowIdx !== undefined ? getRowElement(rowIdx) : null;
      if (el) {
        const r = el.getBoundingClientRect();
        const x = isLeft ? r.right - overlayRect.left : r.left - overlayRect.left;
        const y = (r.top + r.bottom) / 2 - overlayRect.top;
        result.set(leafId, { x, y });
      }
    }
    return result;
  }

  private collectLeafIds(node: TreeNode): string[] {
    if (node.isLeaf) return [node.id];
    const out: string[] = [];
    for (const c of node.children ?? []) out.push(...this.collectLeafIds(c));
    return out;
  }

  protected trackByNodeId(_index: number, row: VisibleRow): string {
    return row.node.id;
  }
}
