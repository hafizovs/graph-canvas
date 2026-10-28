# Contributing to Graph Canvas

## Adding a new operation

1. **Define an action** in the appropriate file under `src/app/features/graph-editor/actions/`:
   - Node-related: `node-actions.ts`
   - Link-related: `link-actions.ts`
   - Clipboard: `clipboard-actions.ts`
   - Or add a new file (e.g. `my-feature-actions.ts`) and export from `actions/index.ts`.

2. Implement `GraphEditorAction`: set `pushUndoBeforeExecute` to `true` if the operation should be undoable (and the dispatcher will push state before execute). Implement `execute(ctx: ActionContext)` using only `ctx.state`, `ctx.coordinate`, and `ctx.linkGeometry`.

3. **Expose via the facade**: In `GraphOperationsService`, add a method that calls `this.dispatcher.dispatch(new MyAction(...))`. Handle any pre-checks or return values (e.g. confirmation dialogs) in the facade.

4. **Wire from the UI**: Call the new method from the component or directive (e.g. toolbar button, keyboard shortcut).

## Adding new node or link types

- **Domain**: Extend or use existing types in `graph-core` (e.g. `Node`, `GroupNode`, `Link`). Add serialization in `serialization.ts` and update `NodeDto`/`LinkDto` if needed.
- **UI**: Add or extend components under `graph-editor/` (e.g. a new node component) and register them in the main template based on `node.nodeType` or link shape.

## Import rules

- **graph-core** must not import from `@angular/*` or from `app/`.
- **Application layer** (services, actions) may import from `graph-core` and from each other; avoid UI (components) importing actions directly—prefer going through `GraphOperationsService`.

## Tests

- Unit tests live next to the source (e.g. `graph-operations.service.spec.ts`). Use Vitest (`ng test`).
- Keep actions pure with respect to `ActionContext` so they can be tested by passing a mock context.

## Documentation

- Add JSDoc to public APIs (classes, methods, `@param`, `@returns`).
- Update this file and `docs/ARCHITECTURE.md` when adding new layers or significant patterns.

## GitHub Pages

Production preview (app + Storybook) deploys from `develop` through `.github/workflows/pages.yml`.
Ensure repository Settings → Pages → Source is set to **GitHub Actions**.

