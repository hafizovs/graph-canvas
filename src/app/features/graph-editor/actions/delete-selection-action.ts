import { GroupNode } from '../../../../graph-core';
import type { ActionContext } from './action-context';
import type { GraphEditorAction } from './graph-editor-action';

/**
 * Delete all selected nodes and links.
 * Pushes undo before deleting. For group nodes, the implementation checks
 * and the UI may show a confirmation dialog before dispatching (handled in component/facade).
 */
export class DeleteSelectionAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = true;

  /** If true, caller should skip dispatch when user cancels group-delete confirmation. */
  static confirmGroupDelete(): boolean {
    return window.confirm(
      'Delete group and all its contents? This will remove the group and all nodes/links inside it.'
    );
  }

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    if (!d) return;
    const nodeIds = ctx.state.selectedNodeIds();
    const linkIds = ctx.state.selectedLinkIds();
    if (nodeIds.size === 0 && linkIds.size === 0) return;

    for (const nodeId of nodeIds) {
      const node = d.getNode(nodeId);
      if (node instanceof GroupNode) {
        for (const childNodeId of node.childNodeIds) {
          d.removeNode(childNodeId);
        }
        for (const childLinkId of node.childLinkIds) {
          d.removeLink(childLinkId);
        }
      }
      d.removeNode(nodeId);
    }
    for (const linkId of linkIds) {
      d.removeLink(linkId);
    }
    ctx.state.clearSelection();
    ctx.state.setDiagram(d, true);
  }
}
