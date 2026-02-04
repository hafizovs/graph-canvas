import type { GraphEditorStateService } from '../services/graph-editor-state.service';
import type { GraphCoordinateService } from '../services/graph-coordinate.service';
import type { GraphLinkGeometryService } from '../services/graph-link-geometry.service';

/**
 * Context passed to each graph editor action when it is executed.
 * Provides access to state, coordinate conversion, and link geometry without
 * actions depending on the full Angular injector.
 */
export interface ActionContext {
  readonly state: GraphEditorStateService;
  readonly coordinate: GraphCoordinateService;
  readonly linkGeometry: GraphLinkGeometryService;
}
