# Porting Checklist: @gravity-ui/graph to Angular 21

Each item can be a separate step (plan + commit). One small feature per commit.

## 5.1 Preparation and project

- [ ] Generate Angular 21 project (`ng new`).
- [ ] Initialize git (if not present) and first commit.
- [ ] Add base Cursor rules (angular-21, angular-style, graph-editor, testing).
- [ ] Create `docs/ARCHITECTURE.md` with diagram and core vs Angular.
- [ ] Add scripts: build, test, lint; optionally Storybook.

## 5.2 Core dependencies (no Angular)

- [ ] Add `@preact/signals-core`, `rbush`, `intersects` (and types if needed).
- [ ] Do not add `@gravity-ui/graph` as a package — port code into this repo in chunks.

## 5.3 Types and configuration

- [ ] Port types (TBlockId, TConnection, TBlock, TGraphConfig, EAnchorType, GraphSettings, Colors, Constants, etc.).
- [ ] Place in `graph-core/types` or `lib/graph/types`.

## 5.4 Utilities and low-level layers

- [ ] Emitter (EventTarget-like API).
- [ ] Scheduler (rAF, component tree traversal).
- [ ] Tree, CoreComponent, Component, EventedComponent, GraphComponent (lifecycle, state/props, HitBox).

## 5.5 Core services

- [ ] CameraService (coordinates, scale, LOD levels, viewport).
- [ ] HitTest + HitBox (RBush, register/update/remove).
- [ ] LayersService + base Layer (Canvas/HTML, events via AbortController).

## 5.6 Store and reactivity

- [ ] RootStore, BlockListStore, BlockState, ConnectionsStore, ConnectionState, PortsStore, SelectionService, GraphEditorSettings.
- [ ] Decide: keep @preact/signals or add adapter to Angular signals only at UI integration points.

## 5.7 Canvas components

- [ ] GraphLayer (container for blocks and connections).
- [ ] Block (three detail levels, anchors, drag via DragService).
- [ ] Connection (line/Bezier, arrows, labels, hit-test).
- [ ] Other layers: SelectionLayer, BelowLayer, CursorLayer, etc.

## 5.8 Graph class

- [ ] Constructor, attach/detach/start, setEntities, Public API (zoomTo, addBlock, addConnection, updateBlock, deleteSelected, …).
- [ ] Subscribe to graph events and expose to Angular (via service or Outputs).

## 5.9 Angular integration

- [ ] GraphService (createGraph/getGraph/destroyGraph by id or context).
- [ ] GraphEditorService (facade: loadGraph, addBlock, addConnection, updateBlock, deleteSelected, zoomToBlocks, …).
- [ ] GraphCanvasComponent (ViewChild container, attach in ngAfterViewInit, detach in ngOnDestroy, Outputs for events).
- [ ] BlocksListComponent (subscribe to camera + blocks, filter visible, trackBy).
- [ ] GraphBlockComponent (input block, position/size, optional custom content).
- [ ] Module or standalone imports for public app API.

## 5.10 Styles and themes

- [ ] Base Canvas styles (colors, constants from settings).
- [ ] CSS variables/themes and binding to `graph.updateGraphColors()` if needed.

## 5.11 Tests and documentation

- [ ] Unit tests for Graph, Camera, Store, HitTest.
- [ ] Component tests (GraphCanvas, BlocksList, GraphBlock) with graph mocks.
- [ ] Storybook or dedicated page with examples (basic graph, many blocks, custom blocks/connections).
- [ ] Update README and docs/ARCHITECTURE.md as layers are added.

---

Iteration: one sub-item = one detailed plan in chat + one commit.
