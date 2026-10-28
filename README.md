# Graph Canvas

## About

## Live demo

- App: https://hafizovs.github.io/graph-canvas/
- Storybook: https://hafizovs.github.io/graph-canvas/storybook/

Deployed from the `develop` branch via GitHub Actions Pages.


Graph Canvas is an Angular 21 graph editor (SVG + HTML hybrid) for node-link diagrams. It supports nodes, links, waypoints, groups, undo/redo, pan/zoom, and palette drag-and-drop. The code is split into a framework-agnostic domain layer, an application layer of signals and actions, and UI components.

## Capabilities

- Domain model in `src/graph-core/`: `Diagram`, `Node`, `GroupNode`, `Link`, `Port`, `Point`, and serialization
- Editor state in signals, actions via `GraphEditorActionDispatcher`, and `GraphOperationsService` as a thin facade
- Services for viewport, coordinates, link geometry, resize, and undo/redo
- UI pieces: graph editor, node, link, toolbar, palette, and a keyboard directive

## Functionality

- Run `ng serve` and open `http://localhost:4200/`.
- Drag items from the palette, connect nodes, and edit waypoints and groups.
- Pan and zoom the canvas, then undo or redo.
- Build and test with `ng build`, `ng test`, and `ng e2e` as documented below.

Angular 21 graph editor (SVG + HTML hybrid) for node-link diagrams. Supports nodes, links, waypoints, groups, undo/redo, pan/zoom, and palette drag-and-drop.

## Architecture

The codebase is split into three layers:

- **Domain** (`src/graph-core/`) — Framework-agnostic model: `Diagram`, `Node`, `GroupNode`, `Link`, `Port`, `Point`, and serialization. No Angular dependencies.
- **Application** (`src/app/features/graph-editor/`) — State (signals), command/action layer, services (viewport, coordinate, link geometry, resize, undo/redo). Operations are implemented as actions dispatched via `GraphEditorActionDispatcher`; `GraphOperationsService` is a thin facade.
- **UI** — Components (graph-editor, graph-node, graph-link, graph-toolbar, graph-palette, etc.) and the keyboard directive. They subscribe to state and invoke operations or actions.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a detailed architecture description and data flow.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
