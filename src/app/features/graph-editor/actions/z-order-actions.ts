import type { ActionContext } from './action-context';
import type { GraphEditorAction } from './graph-editor-action';

/** Bring selected nodes and links to front (highest zIndex in their respective layers). */
export class BringToFrontAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = true;

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    if (!d) return;
    const nodeIds = ctx.state.selectedNodeIds();
    const linkIds = ctx.state.selectedLinkIds();

    if (nodeIds.size > 0) {
      const maxNodeZ = Math.max(0, ...d.nodes.map((n) => n.zIndex ?? 0));
      for (const nodeId of nodeIds) {
        const n = d.getNode(nodeId);
        if (n) n.setZIndex(maxNodeZ + 1);
      }
    }
    if (linkIds.size > 0) {
      const maxLinkZ = Math.max(0, ...d.links.map((l) => l.zIndex ?? 0));
      for (const linkId of linkIds) {
        const l = d.getLink(linkId);
        if (l) l.setZIndex(maxLinkZ + 1);
      }
    }
    if (nodeIds.size > 0 || linkIds.size > 0) {
      ctx.state.setDiagram(d, true);
    }
  }
}

/** Send selected nodes and links to back (lowest zIndex in their respective layers). */
export class SendToBackAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = true;

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    if (!d) return;
    const nodeIds = ctx.state.selectedNodeIds();
    const linkIds = ctx.state.selectedLinkIds();

    if (nodeIds.size > 0) {
      const minNodeZ = Math.min(0, ...d.nodes.map((n) => n.zIndex ?? 0));
      for (const nodeId of nodeIds) {
        const n = d.getNode(nodeId);
        if (n) n.setZIndex(minNodeZ - 1);
      }
    }
    if (linkIds.size > 0) {
      const minLinkZ = Math.min(0, ...d.links.map((l) => l.zIndex ?? 0));
      for (const linkId of linkIds) {
        const l = d.getLink(linkId);
        if (l) l.setZIndex(minLinkZ - 1);
      }
    }
    if (nodeIds.size > 0 || linkIds.size > 0) {
      ctx.state.setDiagram(d, true);
    }
  }
}

/** Toggle lock: if any selected is unlocked, lock all; otherwise unlock all. */
export class ToggleLockSelectionAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = true;

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    if (!d) return;
    const nodeIds = ctx.state.selectedNodeIds();
    const linkIds = ctx.state.selectedLinkIds();

    let anyUnlocked = false;
    for (const nodeId of nodeIds) {
      const n = d.getNode(nodeId);
      if (n && !n.locked) anyUnlocked = true;
    }
    for (const linkId of linkIds) {
      const l = d.getLink(linkId);
      if (l && !l.locked) anyUnlocked = true;
    }
    const lock = anyUnlocked;

    for (const nodeId of nodeIds) {
      const n = d.getNode(nodeId);
      if (n) n.setLocked(lock);
    }
    for (const linkId of linkIds) {
      const l = d.getLink(linkId);
      if (l) l.setLocked(lock);
    }
    if (nodeIds.size > 0 || linkIds.size > 0) {
      ctx.state.setDiagram(d, true);
    }
  }
}
