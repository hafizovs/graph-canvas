import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import type { Mapping, AnchorPoint } from '../models/field-mapper.model';
import { mappingKey } from '../models/field-mapper.model';
import { buildBezierPath } from '../utils/bezier-path';

export interface MappingClickPayload {
  sourceLeafId: string;
  targetLeafId: string;
}

@Component({
  selector: 'app-mapper-links-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './mapper-links-overlay.component.html',
  styleUrl: './mapper-links-overlay.component.scss',
})
export class MapperLinksOverlayComponent {
  readonly mappings = input<Mapping[]>([]);
  /** Map leafId -> anchor position in overlay pixel coordinates */
  readonly anchorByLeafId = input<Map<string, AnchorPoint>>(new Map());
  readonly previewFrom = input<AnchorPoint | null>(null);
  readonly previewTo = input<AnchorPoint | null>(null);
  readonly width = input<number>(1);
  readonly height = input<number>(1);
  readonly selectedMappingKey = input<string | null>(null);

  readonly mappingClick = output<MappingClickPayload>();

  readonly pathItems = computed(() => {
    const map = this.anchorByLeafId();
    const list = this.mappings();
    return list
      .map((m) => {
        const from = map.get(m.sourceLeafId);
        const to = map.get(m.targetLeafId);
        if (!from || !to) return null;
        return { pathD: buildBezierPath(from, to), mapping: m };
      })
      .filter((x): x is { pathD: string; mapping: Mapping } => x !== null);
  });

  protected isSelected(mapping: Mapping): boolean {
    return mappingKey(mapping) === this.selectedMappingKey();
  }

  protected getMappingKey(mapping: Mapping): string {
    return mappingKey(mapping);
  }

  protected onPathClick(mapping: Mapping, event: MouseEvent): void {
    event.stopPropagation();
    this.mappingClick.emit({
      sourceLeafId: mapping.sourceLeafId,
      targetLeafId: mapping.targetLeafId,
    });
  }

  readonly previewPathD = computed(() => {
    const from = this.previewFrom();
    const to = this.previewTo();
    if (!from || !to) return '';
    return buildBezierPath(from, to);
  });
}
