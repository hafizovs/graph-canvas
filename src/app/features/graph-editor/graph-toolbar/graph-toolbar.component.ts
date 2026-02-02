import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';

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

  readonly addNode = output<void>();
  readonly deleteSelection = output<void>();

  protected onAddNode(): void {
    this.addNode.emit();
  }

  protected onDeleteSelection(): void {
    this.deleteSelection.emit();
  }
}
