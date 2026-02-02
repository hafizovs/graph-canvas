import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import type { Diagram, Link, PointLike } from '../../../../graph-core';

@Component({
  selector: 'g[app-graph-link]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './graph-link.component.html',
  styleUrl: './graph-link.component.scss',
})
export class GraphLinkComponent {
  readonly link = input.required<Link>();
  readonly diagram = input.required<Diagram>();
  readonly previewTarget = input<PointLike | null>(null);
  readonly selected = input<boolean>(false);

  readonly linkClick = output<Link>();

  protected readonly pathD = computed(() => {
    const linkVal = this.link();
    const diagramVal = this.diagram();
    const target = this.previewTarget();

    if (target) {
      const source = diagramVal.getPortPosition(linkVal.sourcePortId);
      if (!source) return '';
      return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
    }

    return linkVal.buildPath(diagramVal);
  });

  protected onLinkClick(event: MouseEvent): void {
    event.stopPropagation();
    this.linkClick.emit(this.link());
  }
}
