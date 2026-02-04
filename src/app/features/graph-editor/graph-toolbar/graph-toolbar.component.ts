import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import type { DiagramJson } from '../../../../graph-core';
import {
  MOCK_DIAGRAM_EMPTY,
  MOCK_DIAGRAM_SINGLE_NODE,
  MOCK_DIAGRAM_CHAIN,
  MOCK_DIAGRAM_DIAMOND,
} from '../../../../graph-core';
import type { LinkRouting } from '../../../../graph-core';
import type { AlignMode } from '../services/graph-operations.service';

/** Toolbar: add node, delete selection, load example/file/storage, save. Emits events; parent handles logic. */
@Component({
  selector: 'app-graph-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './graph-toolbar.component.html',
  styleUrl: './graph-toolbar.component.scss',
})
export class GraphToolbarComponent {
  readonly disabled = input<boolean>(false);
  readonly hasSelection = input<boolean>(false);
  /** True when at least one node is selected (for rotate buttons). */
  readonly hasNodeSelection = input<boolean>(false);
  /** True when can group (2+ regular nodes selected). */
  readonly canGroup = input<boolean>(false);
  /** True when can ungroup (1 group node selected). */
  readonly canUngroup = input<boolean>(false);
  /** True when 2+ nodes selected (for align buttons). */
  readonly canAlign = input<boolean>(false);
  /** True when 3+ nodes selected (for distribute buttons). */
  readonly canDistribute = input<boolean>(false);
  readonly snapToGridEnabled = input<boolean>(true);
  /** Current link routing for connector select (from selection or default). */
  readonly linkRouting = input<LinkRouting>('orthogonal');

  readonly addNode = output<void>();
  readonly deleteSelection = output<void>();
  readonly rotateCw = output<void>();
  readonly rotateCcw = output<void>();
  readonly group = output<void>();
  readonly ungroup = output<void>();
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly fitToView = output<void>();
  readonly zoomToSelection = output<void>();
  readonly snapToGridToggle = output<void>();
  readonly loadExample = output<DiagramJson>();
  readonly saveRequest = output<void>();
  readonly loadFromFile = output<DiagramJson>();
  readonly loadFromStorage = output<void>();
  readonly align = output<AlignMode>();
  readonly linkRoutingChange = output<LinkRouting>();

  /** Emit linkRoutingChange when user changes connector style in select. */
  protected onLinkRoutingChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value as LinkRouting;
    if (value === 'straight' || value === 'orthogonal') {
      this.linkRoutingChange.emit(value);
    }
  }

  /** Emit addNode. */
  protected onAddNode(): void {
    this.addNode.emit();
  }

  /** Emit deleteSelection. */
  protected onDeleteSelection(): void {
    this.deleteSelection.emit();
  }

  /** Emit rotateCw (90° clockwise). */
  protected onRotateCw(): void {
    this.rotateCw.emit();
  }

  /** Emit rotateCcw (90° counter-clockwise). */
  protected onRotateCcw(): void {
    this.rotateCcw.emit();
  }

  /** Emit group. */
  protected onGroup(): void {
    this.group.emit();
  }

  /** Emit ungroup. */
  protected onUngroup(): void {
    this.ungroup.emit();
  }

  protected onAlign(mode: AlignMode): void {
    this.align.emit(mode);
  }

  protected onZoomIn(): void {
    this.zoomIn.emit();
  }

  protected onZoomOut(): void {
    this.zoomOut.emit();
  }

  protected onFitToView(): void {
    this.fitToView.emit();
  }

  protected onZoomToSelection(): void {
    this.zoomToSelection.emit();
  }

  protected onSnapToGridToggle(): void {
    this.snapToGridToggle.emit();
  }

  /** Emit loadExample with selected diagram JSON. */
  protected onLoadExample(json: DiagramJson): void {
    this.loadExample.emit(json);
  }

  protected readonly exampleEmpty = MOCK_DIAGRAM_EMPTY;
  protected readonly exampleSingle = MOCK_DIAGRAM_SINGLE_NODE;
  protected readonly exampleChain = MOCK_DIAGRAM_CHAIN;
  protected readonly exampleDiamond = MOCK_DIAGRAM_DIAMOND;

  /** Emit saveRequest. */
  protected onSave(): void {
    this.saveRequest.emit();
  }

  /** Emit loadFromStorage. */
  protected onLoadFromStorage(): void {
    this.loadFromStorage.emit();
  }

  /** Trigger file input click. */
  protected onLoadFile(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  /** Parse selected file as DiagramJson and emit loadFromFile. */
  protected onFileSelected(event: Event, fileInput: HTMLInputElement): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string) as DiagramJson;
        if (json && Array.isArray(json.nodes) && Array.isArray(json.links)) {
          this.loadFromFile.emit(json);
        }
      } catch {
        // ignore invalid JSON
      }
      fileInput.value = '';
    };
    reader.readAsText(file);
  }
}
