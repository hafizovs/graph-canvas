import {
  Component,
  ChangeDetectionStrategy,
  viewChild,
  effect,
  output,
  inject,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import { FieldMapperComponent } from '../field-mapper.component';
import {
  DEMO_SOURCES_TREE,
  DEMO_RECEIVERS_TREE,
  DEMO_MAPPINGS,
} from '../demo-data';
import { FIELD_MAPPER_DEMO_CLOSE } from './field-mapper-demo-modal.tokens';

@Component({
  selector: 'app-field-mapper-demo-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [NO_ERRORS_SCHEMA],
  imports: [FieldMapperComponent],
  templateUrl: './field-mapper-demo-modal.component.html',
  styleUrl: './field-mapper-demo-modal.component.scss',
})
export class FieldMapperDemoModalComponent {
  readonly fieldMapperRef = viewChild(FieldMapperComponent);
  readonly close = output<void>();

  private readonly hostClose = inject(FIELD_MAPPER_DEMO_CLOSE, { optional: true });
  private dataLoaded = false;

  constructor() {
    effect(() => {
      const mapper = this.fieldMapperRef();
      if (mapper && !this.dataLoaded) {
        this.dataLoaded = true;
        mapper.setData(DEMO_SOURCES_TREE, DEMO_RECEIVERS_TREE, DEMO_MAPPINGS);
      }
    });
  }

  onBackdropClick(): void {
    this.hostClose?.();
    this.close.emit();
  }

  onCloseClick(): void {
    this.hostClose?.();
    this.close.emit();
  }
}
