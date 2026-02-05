import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import type { Mapping, AnchorPoint } from '../models/field-mapper.model';
import { buildBezierPath } from '../utils/bezier-path';

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

  readonly pathDataList = computed(() => {
    const map = this.anchorByLeafId();
    const list = this.mappings();
    return list
      .map((m) => {
        const from = map.get(m.sourceLeafId);
        const to = map.get(m.targetLeafId);
        if (!from || !to) return null;
        return buildBezierPath(from, to);
      })
      .filter((d): d is string => d !== null);
  });

  readonly previewPathD = computed(() => {
    const from = this.previewFrom();
    const to = this.previewTo();
    if (!from || !to) return '';
    return buildBezierPath(from, to);
  });
}
