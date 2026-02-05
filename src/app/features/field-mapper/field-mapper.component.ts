import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  effect,
  viewChild,
  ElementRef,
  afterNextRender,
  inject,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import type { TreeNode, Mapping, ColumnFilter, ExpandedIds, AnchorPoint } from './models/field-mapper.model';
import { mappingKey } from './models/field-mapper.model';
import { TreeTableComponent } from './tree-table/tree-table.component';
import { MapperLinksOverlayComponent } from './mapper-links-overlay/mapper-links-overlay.component';
import { FieldMapperUndoRedoService } from './services/field-mapper-undo-redo.service';

@Component({
  selector: 'app-field-mapper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [NO_ERRORS_SCHEMA],
  imports: [TreeTableComponent, MapperLinksOverlayComponent],
  providers: [FieldMapperUndoRedoService],
  templateUrl: './field-mapper.component.html',
  styleUrl: './field-mapper.component.scss',
})
export class FieldMapperComponent {
  private readonly undoRedo = inject(FieldMapperUndoRedoService);

  readonly leftTreeRef = viewChild<TreeTableComponent>('leftTree');
  readonly rightTreeRef = viewChild<TreeTableComponent>('rightTree');
  readonly overlayContainerRef = viewChild<ElementRef<HTMLElement>>('overlayContainer');

  readonly sourcesRoot = signal<TreeNode | null>(null);
  readonly receiversRoot = signal<TreeNode | null>(null);
  readonly mappings = signal<Mapping[]>([]);
  readonly sourcesExpanded = signal<ExpandedIds>(new Set());
  readonly receiversExpanded = signal<ExpandedIds>(new Set());
  readonly sourcesFilters = signal<ColumnFilter[]>([
    { value: '' },
    { value: '' },
    { value: '' },
    { value: '' },
  ]);
  readonly receiversFilters = signal<ColumnFilter[]>([
    { value: '' },
    { value: '' },
    { value: '' },
    { value: '' },
  ]);

  /** When dragging: source leaf id and current pointer position in overlay coords. */
  readonly dragSource = signal<string | null>(null);
  readonly previewPoint = signal<AnchorPoint | null>(null);
  readonly dropTargetLeafId = signal<string | null>(null);

  readonly anchorByLeafId = signal<Map<string, AnchorPoint>>(new Map());
  readonly overlaySize = signal({ width: 1, height: 1 });

  /** Selected link (mapping) key for highlight and Delete. */
  readonly selectedMappingKey = signal<string | null>(null);

  private dragPointerId: number | null = null;
  private boundMove = (e: PointerEvent) => this.onDragMove(e);
  private boundUp = (e: PointerEvent) => this.onDragUp(e);

  constructor() {
    afterNextRender(() => {
      this.updateAnchorMap();
      this.overlayContainerRef()?.nativeElement?.focus();
    });
    effect(() => {
      this.sourcesExpanded();
      this.receiversExpanded();
      this.sourcesFilters();
      this.receiversFilters();
      queueMicrotask(() => this.updateAnchorMap());
    });
    effect(() => {
      const s = this.sourcesRoot();
      const r = this.receiversRoot();
      if (s && r) {
        const t = setTimeout(() => this.updateAnchorMap(), 100);
        return () => clearTimeout(t);
      }
      return undefined;
    });
  }

  setData(sources: TreeNode, receivers: TreeNode, initialMappings: Mapping[] = []): void {
    this.sourcesRoot.set(sources);
    this.receiversRoot.set(receivers);
    this.mappings.set(initialMappings);
    const expandAll = (n: TreeNode): Set<string> => {
      const s = new Set<string>();
      if (!n.isLeaf && (n.children?.length ?? 0) > 0) {
        s.add(n.id);
        for (const c of n.children ?? []) {
          for (const id of expandAll(c)) s.add(id);
        }
      }
      return s;
    };
    this.sourcesExpanded.set(expandAll(sources));
    this.receiversExpanded.set(expandAll(receivers));
  }

  onSourcesDragStart(payload: { leafId: string; event: PointerEvent }): void {
    this.dragSource.set(payload.leafId);
    this.previewPoint.set(this.anchorByLeafId().get(payload.leafId) ?? null);
    this.dragPointerId = payload.event.pointerId;
    (payload.event.target as Element).setPointerCapture?.(payload.event.pointerId);
    document.addEventListener('pointermove', this.boundMove);
    document.addEventListener('pointerup', this.boundUp);
  }

  private onDragMove(e: PointerEvent): void {
    if (this.dragPointerId !== null && e.pointerId !== this.dragPointerId) return;
    const container = this.overlayContainerRef()?.nativeElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    this.previewPoint.set({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const row = el?.closest?.('[data-leaf-id]');
    const leafId = row?.getAttribute('data-leaf-id') ?? null;
    const isRight = row?.closest?.('[data-side="right"]') != null;
    this.dropTargetLeafId.set(isRight && leafId ? leafId : null);
  }

  private onDragUp(e: PointerEvent): void {
    if (this.dragPointerId !== null && e.pointerId !== this.dragPointerId) return;
    document.removeEventListener('pointermove', this.boundMove);
    document.removeEventListener('pointerup', this.boundUp);
    const source = this.dragSource();
    const targetLeafId = this.dropTargetLeafId();
    if (source && targetLeafId) {
      this.undoRedo.pushState(this.mappings());
      this.mappings.update((list) => [...list, { sourceLeafId: source, targetLeafId }]);
    }
    this.dragSource.set(null);
    this.previewPoint.set(null);
    this.dropTargetLeafId.set(null);
    this.dragPointerId = null;
  }

  onSourcesFilterChange(payload: { columnIndex: number; value: string }): void {
    this.sourcesFilters.update((f) => {
      const next = f.slice();
      next[payload.columnIndex] = { value: payload.value };
      return next;
    });
  }

  onReceiversFilterChange(payload: { columnIndex: number; value: string }): void {
    this.receiversFilters.update((f) => {
      const next = f.slice();
      next[payload.columnIndex] = { value: payload.value };
      return next;
    });
  }

  onSourcesToggleExpand(nodeId: string): void {
    this.sourcesExpanded.update((s) => {
      const next = new Set(s);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  onReceiversToggleExpand(nodeId: string): void {
    this.receiversExpanded.update((s) => {
      const next = new Set(s);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  onMappingClick(payload: { sourceLeafId: string; targetLeafId: string }): void {
    this.selectedMappingKey.set(mappingKey(payload));
  }

  onCenterClick(): void {
    this.selectedMappingKey.set(null);
  }

  onKeydown(event: KeyboardEvent): void {
    const isUndo = (event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey;
    const isRedo =
      (event.ctrlKey || event.metaKey) &&
      (event.key === 'y' || (event.key === 'z' && event.shiftKey));
    if (isUndo) {
      event.preventDefault();
      event.stopPropagation();
      const snapshot = this.undoRedo.undo(this.mappings());
      if (snapshot !== null) {
        this.mappings.set(snapshot);
        this.selectedMappingKey.set(null);
      }
      return;
    }
    if (isRedo) {
      event.preventDefault();
      event.stopPropagation();
      const snapshot = this.undoRedo.redo(this.mappings());
      if (snapshot !== null) {
        this.mappings.set(snapshot);
        this.selectedMappingKey.set(null);
      }
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const key = this.selectedMappingKey();
      if (!key) return;
      event.preventDefault();
      this.undoRedo.pushState(this.mappings());
      const [sourceLeafId, targetLeafId] = key.split('\0');
      this.mappings.update((list) =>
        list.filter(
          (m) => !(m.sourceLeafId === sourceLeafId && m.targetLeafId === targetLeafId)
        )
      );
      this.selectedMappingKey.set(null);
    }
  }

  private updateAnchorMap(): void {
    const left = this.leftTreeRef();
    const right = this.rightTreeRef();
    const container = this.overlayContainerRef()?.nativeElement;
    if (!left || !right || !container) return;
    const rect = container.getBoundingClientRect();
    this.overlaySize.set({ width: rect.width, height: rect.height });
    const leftAnchors = left.getAnchorPositions(rect);
    const rightAnchors = right.getAnchorPositions(rect);
    const merged = new Map<string, AnchorPoint>();
    for (const [id, p] of leftAnchors) merged.set(id, p);
    for (const [id, p] of rightAnchors) merged.set(id, p);
    this.anchorByLeafId.set(merged);
  }

  readonly previewFrom = computed(() => {
    const src = this.dragSource();
    if (!src) return null;
    return this.anchorByLeafId().get(src) ?? null;
  });
}
