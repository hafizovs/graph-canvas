import { Diagram, deserializeDiagram, serializeDiagram, cloneDiagramJsonForPaste } from '../../../../graph-core';
import type { NodeId } from '../../../../graph-core';
import type { ActionContext } from './action-context';
import type { GraphEditorAction } from './graph-editor-action';

const PASTE_OFFSET = 20;

/** Copy selected nodes and their internal links to clipboard (DiagramJson). Does not push undo. */
export class CopyAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = false;

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    const nodeIdSet = ctx.state.selectedNodeIds();
    if (!d || nodeIdSet.size === 0) return;
    const subsetDiagram = new Diagram();
    for (const node of d.nodes) {
      if (nodeIdSet.has(node.id)) subsetDiagram.addNode(node);
    }
    for (const link of d.links) {
      const srcNode = d.nodes.find((n) => n.getPort(link.sourcePortId));
      const tgtNode = d.nodes.find((n) => n.getPort(link.targetPortId));
      if (
        srcNode &&
        tgtNode &&
        nodeIdSet.has(srcNode.id) &&
        nodeIdSet.has(tgtNode.id)
      ) {
        subsetDiagram.addLink(link);
      }
    }
    ctx.state.setClipboard(serializeDiagram(subsetDiagram));
  }
}

/** Paste from clipboard with offset and new ids; select pasted nodes. Pushes undo before paste. */
export class PasteAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = true;

  execute(ctx: ActionContext): void {
    const clipboard = ctx.state.getClipboard();
    const d = ctx.state.getDiagram();
    if (!clipboard || !d) return;
    const { json, newNodeIds } = cloneDiagramJsonForPaste(
      clipboard,
      PASTE_OFFSET,
      PASTE_OFFSET,
      ctx.state.getNodeIdCounter(),
      ctx.state.getLinkIdCounter()
    );
    const pasted = deserializeDiagram(json);
    for (const node of pasted.nodes) {
      if (ctx.state.snapToGridEnabled()) {
        const snapped = ctx.coordinate.snapToGrid(node.x, node.y);
        node.setPosition(snapped.x, snapped.y);
      }
      d.addNode(node);
      const m = /^n(\d+)$/.exec(node.id);
      if (m)
        ctx.state.setNodeIdCounter(
          Math.max(ctx.state.getNodeIdCounter(), parseInt(m[1], 10))
        );
    }
    for (const link of pasted.links) {
      d.addLink(link);
      const m = /^l(\d+)$/.exec(link.id);
      if (m)
        ctx.state.setLinkIdCounter(
          Math.max(ctx.state.getLinkIdCounter(), parseInt(m[1], 10))
        );
    }
    ctx.state.setNodeSelection(new Set(newNodeIds as NodeId[]));
    ctx.state.setDiagram(d, true);
  }
}
