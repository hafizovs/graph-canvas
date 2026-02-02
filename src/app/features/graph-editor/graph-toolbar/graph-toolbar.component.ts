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
  readonly snapToGridEnabled = input<boolean>(true);

  readonly addNode = output<void>();
  readonly deleteSelection = output<void>();
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly fitToView = output<void>();
  readonly zoomToSelection = output<void>();
  readonly snapToGridToggle = output<void>();
  readonly loadExample = output<DiagramJson>();
  readonly saveRequest = output<void>();
  readonly loadFromFile = output<DiagramJson>();
  readonly loadFromStorage = output<void>();

  /** Emit addNode. */
  protected onAddNode(): void {
    this.addNode.emit();
  }

  /** Emit deleteSelection. */
  protected onDeleteSelection(): void {
    this.deleteSelection.emit();
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
