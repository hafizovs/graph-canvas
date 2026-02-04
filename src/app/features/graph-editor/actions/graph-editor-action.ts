import type { ActionContext } from './action-context';

/**
 * Base interface for all graph editor actions (command pattern).
 * Actions are executed by {@link GraphEditorActionDispatcher}.
 * When {@link pushUndoBeforeExecute} is true, the dispatcher pushes the current
 * diagram state onto the undo stack before executing (e.g. add node, delete).
 * When false, the caller is responsible for pushing once (e.g. move nodes during drag).
 */
export interface GraphEditorAction {
  /** If true, dispatcher calls undoRedo.pushState() before execute(). */
  readonly pushUndoBeforeExecute: boolean;

  /**
   * Execute the action using the provided context.
   * @param ctx - Access to state, coordinate, and link geometry services
   */
  execute(ctx: ActionContext): void;
}
