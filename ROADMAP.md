# Graph Canvas – Roadmap

Future improvements and features. Prioritize by project needs.

## Zoom and pan

- **Zoom**: Mouse wheel and pinch; change viewBox or use a separate transform; optionally persist in state or URL.
- **Pan**: Drag canvas (without dragging a node); optional bounds for large diagrams.

## Minimap

- Thumbnail of the full diagram with viewport indicator; click/drag to navigate.

## Node editing

- **Inline label edit**: Double-click to edit node label; validate and cancel with Escape.
- **Resize**: Resize handles on nodes; recompute port positions by side.

## Links

- **Manual waypoints**: Drag mid-segment or bend points to create polyline links.
- **Options**: Allow multiple links per input; link types with distinct visuals.

## Validation and rules

- Move graph rules (e.g. one link per input) into a validator layer; show errors in UI.
- Optional type/schema for nodes and ports (compatibility matrix).

## Export and integration

- **Export**: PNG/SVG from current SVG or via canvas render.
- **Import**: Support other formats (e.g. partial Mermaid/PlantUML or custom DSL).

## Performance and scale

- **Virtualization**: Render only nodes/links in viewport when count is high.
- **Web Worker**: Heavy work (serialization, validation) off main thread.

## Multiple diagrams and tabs

- Several open diagrams (tabs); separate state and undo per tab.

## Accessibility and UX

- **Keyboard**: Tab and arrows to move focus between nodes; focus and selection in sync.
- **Screen readers**: Semantic markup and ARIA for nodes and links.

## Testing and quality

- **E2E**: Playwright/Cypress for main flows (add node, link, undo, copy/paste, save/load).
- **Visual regression**: Snapshot tests for canvas/SVG output.

## Documentation and development

- **README**: Architecture overview; how to run tests and build.
- **Storybook** (or similar): Isolated development of toolbar, node, link and state variants.

---

*This refactor (services, tests, JSDoc) provides the base for implementing these items without overloading the editor component.*
