import { Component, input, computed } from '@angular/core';
import { Diagram, Link, deserializeDiagram } from '../../../../graph-core';
import { MOCK_DIAGRAM_CHAIN } from '../../../../graph-core';
import type { LinkRouting, PointLike } from '../../../../graph-core';
import { GraphLinkComponent } from './graph-link.component';
import { GraphLinkGeometryService } from '../services/graph-link-geometry.service';

/**
 * Wrapper for GraphLinkComponent stories. Provides a Diagram and Link so the
 * presentation component can render inside an SVG. Provides GraphLinkGeometryService.
 */
@Component({
  selector: 'app-graph-link-story-wrapper',
  standalone: true,
  imports: [GraphLinkComponent],
  providers: [GraphLinkGeometryService],
  template: `
    <svg width="800" height="600" viewBox="0 0 800 600">
      <g
        app-graph-link
        [link]="link()"
        [diagram]="diagram()"
        [previewTarget]="previewTarget()"
        [renderTick]="renderTick()"
        [selected]="selected()"
        [selectedWaypointIndex]="selectedWaypointIndex()"
      />
    </svg>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      svg {
        border: 1px solid #ccc;
      }
    `,
  ],
})
export class GraphLinkStoryWrapperComponent {
  readonly selected = input<boolean>(false);
  readonly selectedWaypointIndex = input<number | null>(null);
  readonly renderTick = input<number>(0);
  readonly routing = input<LinkRouting>('straight');
  /** When set, link is shown in preview mode (line from source to this point). */
  readonly previewTarget = input<PointLike | null>(null);
  /** When true, link has waypoints for polyline. */
  readonly withWaypoints = input<boolean>(false);

  protected readonly diagram = computed(() => {
    const base = deserializeDiagram(MOCK_DIAGRAM_CHAIN);
    const link = base.links[0];
    if (!link) return base;
    const routing = this.routing();
    const withWaypoints = this.withWaypoints();
    const newLink = new Link({
      id: link.id,
      sourcePortId: link.sourcePortId,
      targetPortId: link.targetPortId,
      routing,
      points: withWaypoints ? [{ x: 280, y: 130 }, { x: 280, y: 200 }] : undefined,
    });
    const diagram = new Diagram();
    for (const n of base.nodes) diagram.addNode(n);
    diagram.addLink(newLink);
    return diagram;
  });
  protected readonly link = computed(() => this.diagram().links[0]!);
}
