import {
  Node,
  GroupNode,
  Link,
  Port,
} from '../../../../graph-core';
import type { Diagram, NodeId, NodeShape, LinkId, PortId } from '../../../../graph-core';
import type { ActionContext } from './action-context';
import type { GraphEditorAction } from './graph-editor-action';

/** Modes for aligning or distributing selected nodes (toolbar, Draw.io-style). */
export type AlignMode =
  | 'alignLeft'
  | 'alignCenterH'
  | 'alignRight'
  | 'alignTop'
  | 'alignMiddleV'
  | 'alignBottom'
  | 'distributeH'
  | 'distributeV';

/** Add a new node at view center with default in/out ports. */
export class AddNodeAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = true;

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    if (!d) return;
    const nodeId = `n${ctx.state.incrementNodeIdCounter()}` as NodeId;
    const vb = ctx.state.viewBox();
    const centerX = vb.x + vb.width / 2 - 60;
    const centerY = vb.y + vb.height / 2 - 30;
    const { x, y } = ctx.state.snapToGridEnabled()
      ? ctx.coordinate.snapToGrid(centerX, centerY)
      : { x: centerX, y: centerY };
    const maxZ = d.nodes.length > 0
      ? Math.max(...d.nodes.map((n) => n.zIndex ?? 0))
      : -1;
    const node = new Node({
      id: nodeId,
      x,
      y,
      width: 120,
      height: 60,
      label: `Node ${ctx.state.getNodeIdCounter()}`,
      zIndex: maxZ + 1,
      ports: [],
    });
    node.addPort(
      new Port({
        id: `${nodeId}-in` as PortId,
        nodeId,
        side: 'left',
        offset: 30,
        type: 'input',
      })
    );
    node.addPort(
      new Port({
        id: `${nodeId}-out` as PortId,
        nodeId,
        side: 'right',
        offset: 30,
        type: 'output',
      })
    );
    d.addNode(node);
    ctx.state.setDiagram(d, true);
  }
}

/** Add a new node from the palette at the given SVG coordinates. */
export class AddNodeFromPaletteAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = true;

  constructor(
    private readonly shape: NodeShape,
    private readonly svgX: number,
    private readonly svgY: number,
    private readonly customShapeId?: string
  ) {}

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    if (!d) return;
    const { x, y } = ctx.state.snapToGridEnabled()
      ? ctx.coordinate.snapToGrid(this.svgX, this.svgY)
      : { x: this.svgX, y: this.svgY };
    const nodeId = `n${ctx.state.incrementNodeIdCounter()}` as NodeId;
    const maxZ = d.nodes.length > 0
      ? Math.max(...d.nodes.map((n) => n.zIndex ?? 0))
      : -1;
    const node = new Node({
      id: nodeId,
      x,
      y,
      width: 120,
      height: 60,
      label: `Node ${ctx.state.getNodeIdCounter()}`,
      shape: this.shape,
      zIndex: maxZ + 1,
      ...(this.shape === 'custom' && this.customShapeId != null && { customShapeId: this.customShapeId }),
      ports: [],
    });
    node.addPort(
      new Port({
        id: `${nodeId}-in` as PortId,
        nodeId,
        side: 'left',
        offset: 30,
        type: 'input',
      })
    );
    node.addPort(
      new Port({
        id: `${nodeId}-out` as PortId,
        nodeId,
        side: 'right',
        offset: 30,
        type: 'output',
      })
    );
    d.addNode(node);
    ctx.state.setDiagram(d, true);
  }
}

/** Apply delta to nodes by id (used during drag). Caller pushes undo once at drag start. */
export class MoveNodesAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = false;

  constructor(
    private readonly initialPositions: Map<NodeId, { x: number; y: number }>,
    private readonly dx: number,
    private readonly dy: number
  ) {}

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    if (!d) return;
    for (const [nodeId, pos] of this.initialPositions) {
      const n = d.getNode(nodeId);
      if (n && !n.locked) {
        const newX = pos.x + this.dx;
        const newY = pos.y + this.dy;
        const { x, y } = ctx.state.snapToGridEnabled()
          ? ctx.coordinate.snapToGrid(newX, newY)
          : { x: newX, y: newY };
        n.setPosition(x, y);
      }
    }
    ctx.state.incrementRenderTick();
  }
}

/** Rotate selected nodes by angleDeg degrees (clockwise). */
export class RotateNodesAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = true;

  constructor(private readonly angleDeg: number) {}

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    const nodeIds = ctx.state.selectedNodeIds();
    if (!d || nodeIds.size === 0) return;
    for (const nodeId of nodeIds) {
      const n = d.getNode(nodeId);
      if (n && !n.locked) n.setRotation((n.rotation ?? 0) + this.angleDeg);
    }
    ctx.state.setDiagram(d, true);
  }
}

/** Align or distribute selected nodes by the given mode. */
export class AlignNodesAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = true;

  constructor(private readonly mode: AlignMode) {}

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    const nodeIds = ctx.state.selectedNodeIds();
    if (!d || nodeIds.size < 2) return;
    if ((this.mode === 'distributeH' || this.mode === 'distributeV') && nodeIds.size < 3) return;

    const orderedIds = Array.from(nodeIds);
    const refId = orderedIds[0];
    const ref = d.getNode(refId);
    if (!ref) return;

    const nodes: Node[] = [];
    for (const id of nodeIds) {
      const n = d.getNode(id);
      if (n) nodes.push(n);
    }
    if (nodes.length < 2) return;
    if ((this.mode === 'distributeH' || this.mode === 'distributeV') && nodes.length < 3) return;

    const snap = (x: number, y: number) =>
      ctx.state.snapToGridEnabled()
        ? ctx.coordinate.snapToGrid(x, y)
        : { x, y };

    const isAlignMode =
      this.mode === 'alignLeft' ||
      this.mode === 'alignCenterH' ||
      this.mode === 'alignRight' ||
      this.mode === 'alignTop' ||
      this.mode === 'alignMiddleV' ||
      this.mode === 'alignBottom';

    if (isAlignMode) {
      for (const n of nodes) {
        if (n.id === refId || n.locked) continue;
        if (this.mode === 'alignLeft') {
          const { x, y } = snap(ref.x, n.y);
          n.setPosition(x, y);
        } else if (this.mode === 'alignCenterH') {
          const newX = ref.x + ref.width / 2 - n.width / 2;
          const { x, y } = snap(newX, n.y);
          n.setPosition(x, y);
        } else if (this.mode === 'alignRight') {
          const newX = ref.x + ref.width - n.width;
          const { x, y } = snap(newX, n.y);
          n.setPosition(x, y);
        } else if (this.mode === 'alignTop') {
          const { x, y } = snap(n.x, ref.y);
          n.setPosition(x, y);
        } else if (this.mode === 'alignMiddleV') {
          const newY = ref.y + ref.height / 2 - n.height / 2;
          const { x, y } = snap(n.x, newY);
          n.setPosition(x, y);
        } else if (this.mode === 'alignBottom') {
          const newY = ref.y + ref.height - n.height;
          const { x, y } = snap(n.x, newY);
          n.setPosition(x, y);
        }
      }
    } else {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const n of nodes) {
        const left = n.x;
        const right = n.x + n.width;
        const top = n.y;
        const bottom = n.y + n.height;
        if (left < minX) minX = left;
        if (right > maxX) maxX = right;
        if (top < minY) minY = top;
        if (bottom > maxY) maxY = bottom;
      }
      if (this.mode === 'distributeH') {
        const sorted = [...nodes].sort((a, b) => a.x + a.width / 2 - (b.x + b.width / 2));
        const totalWidth = sorted.reduce((sum, n) => sum + n.width, 0);
        const bboxWidth = maxX - minX;
        const gap = (bboxWidth - totalWidth) / (sorted.length - 1);
        let x = minX;
        for (const n of sorted) {
          if (n.locked) {
            x += n.width + gap;
            continue;
          }
          const { x: sx, y } = snap(x, n.y);
          n.setPosition(sx, y);
          x += n.width + gap;
        }
      } else if (this.mode === 'distributeV') {
        const sorted = [...nodes].sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2));
        const totalHeight = sorted.reduce((sum, n) => sum + n.height, 0);
        const bboxHeight = maxY - minY;
        const gap = (bboxHeight - totalHeight) / (sorted.length - 1);
        let y = minY;
        for (const n of sorted) {
          if (n.locked) {
            y += n.height + gap;
            continue;
          }
          const { x, y: sy } = snap(n.x, y);
          n.setPosition(x, sy);
          y += n.height + gap;
        }
      }
    }

    ctx.state.setDiagram(d, true);
  }
}

function getNodeByPortId(d: Diagram, portId: PortId): Node | undefined {
  for (const node of d.nodes) {
    if (node.getPort(portId)) return node;
  }
  return undefined;
}

/** Group selected nodes into a GroupNode. */
export class GroupNodesAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = true;

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    const selectedNodeIds = ctx.state.selectedNodeIds();
    if (!d || selectedNodeIds.size < 2) return;

    const selectedNodes: Node[] = [];
    for (const nodeId of selectedNodeIds) {
      const node = d.getNode(nodeId);
      if (!node || node.nodeType === 'group') return;
      selectedNodes.push(node);
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const originalPositions = new Map<NodeId, { x: number; y: number }>();
    for (const node of selectedNodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
      originalPositions.set(node.id, { x: node.x, y: node.y });
    }

    const padding = 30;
    const groupX = minX - padding;
    const groupY = minY - padding;
    const groupWidth = maxX - minX + 2 * padding;
    const groupHeight = maxY - minY + 2 * padding;

    const groupId = `g${ctx.state.incrementNodeIdCounter()}` as NodeId;
    const maxZ = d.nodes.length > 0
      ? Math.max(...d.nodes.map((n) => n.zIndex ?? 0))
      : -1;
    const groupNode = new GroupNode({
      id: groupId,
      x: groupX,
      y: groupY,
      width: groupWidth,
      height: groupHeight,
      label: `Group ${ctx.state.getNodeIdCounter()}`,
      childNodeIds: Array.from(selectedNodeIds),
      childLinkIds: [],
      originalPositions,
      scale: 1,
      zIndex: maxZ + 1,
      ports: [],
    });

    const childNodeIdSet = new Set(selectedNodeIds);
    const internalLinkIds: LinkId[] = [];
    const externalLinks: Array<{
      link: Link;
      isOutgoing: boolean;
      childPortId: PortId;
      externalPortId: PortId;
    }> = [];

    for (const link of d.links) {
      const sourceNode = getNodeByPortId(d, link.sourcePortId);
      const targetNode = getNodeByPortId(d, link.targetPortId);
      const sourceInGroup = sourceNode && childNodeIdSet.has(sourceNode.id);
      const targetInGroup = targetNode && childNodeIdSet.has(targetNode.id);

      if (sourceInGroup && targetInGroup) {
        internalLinkIds.push(link.id);
      } else if (sourceInGroup && !targetInGroup) {
        externalLinks.push({
          link,
          isOutgoing: true,
          childPortId: link.sourcePortId,
          externalPortId: link.targetPortId,
        });
      } else if (!sourceInGroup && targetInGroup) {
        externalLinks.push({
          link,
          isOutgoing: false,
          childPortId: link.targetPortId,
          externalPortId: link.sourcePortId,
        });
      }
    }

    groupNode.childLinkIds = new Set(internalLinkIds);

    for (const node of selectedNodes) {
      groupNode.childNodes.set(node.id, node);
    }
    for (const linkId of internalLinkIds) {
      const link = d.getLink(linkId);
      if (link) groupNode.childLinks.set(linkId, link);
    }

    const portMap = new Map<PortId, PortId>();
    for (const { link, isOutgoing, childPortId } of externalLinks) {
      let groupPortId = portMap.get(childPortId);
      if (!groupPortId) {
        groupPortId = `${groupId}-ext-${childPortId}` as PortId;
        portMap.set(childPortId, groupPortId);
        const childNode = getNodeByPortId(d, childPortId);
        let side: 'top' | 'right' | 'bottom' | 'left' = 'right';
        let offset = groupHeight / 2;
        if (childNode) {
          const childCenterX = childNode.x + childNode.width / 2;
          const childCenterY = childNode.y + childNode.height / 2;
          const groupCenterX = groupX + groupWidth / 2;
          const groupCenterY = groupY + groupHeight / 2;
          const dx = childCenterX - groupCenterX;
          const dy = childCenterY - groupCenterY;
          if (Math.abs(dx) > Math.abs(dy)) {
            side = dx > 0 ? 'right' : 'left';
            offset = childCenterY - groupY;
          } else {
            side = dy > 0 ? 'bottom' : 'top';
            offset = childCenterX - groupX;
          }
        }
        const port = new Port({
          id: groupPortId,
          nodeId: groupId,
          side,
          offset,
          type: isOutgoing ? 'output' : 'input',
        });
        groupNode.addPort(port);
      }
      d.removeLink(link.id);
      const newLink = new Link({
        id: link.id,
        sourcePortId: isOutgoing ? groupPortId! : link.sourcePortId,
        targetPortId: isOutgoing ? link.targetPortId : groupPortId!,
        points: link.points.map((p) => ({ x: p.x, y: p.y })),
        routing: link.routing,
      });
      d.addLink(newLink);
    }

    for (const nodeId of selectedNodeIds) {
      d.removeNode(nodeId);
    }
    d.addNode(groupNode);
    groupNode.updateScale();
    ctx.state.clearSelection();
    ctx.state.setNodeSelection(new Set([groupId]));
    ctx.state.setDiagram(d, true);
  }
}

/** Ungroup a GroupNode, restoring child nodes and links. */
export class UngroupNodeAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = true;

  constructor(private readonly groupId: NodeId) {}

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    const groupNode = d?.getNode(this.groupId);
    if (!d || !groupNode || !(groupNode instanceof GroupNode)) return;

    const restoredNodeIds: NodeId[] = [];
    for (const childNodeId of groupNode.childNodeIds) {
      const storedNode = groupNode.getChildNode(childNodeId);
      const originalPos = groupNode.getOriginalPosition(childNodeId);
      if (storedNode && originalPos) {
        storedNode.setPosition(originalPos.x, originalPos.y);
        d.addNode(storedNode);
        restoredNodeIds.push(childNodeId);
      }
    }

    for (const childLinkId of groupNode.childLinkIds) {
      const storedLink = groupNode.getChildLink(childLinkId);
      if (storedLink) d.addLink(storedLink);
    }

    const portMap = new Map<PortId, PortId>();
    for (const port of groupNode.ports) {
      const match = port.id.match(/-ext-(.+)$/);
      if (match) portMap.set(port.id, match[1] as PortId);
    }

    const linksToUpdate = d.links.filter(
      (l) => portMap.has(l.sourcePortId) || portMap.has(l.targetPortId)
    );
    for (const link of linksToUpdate) {
      const childSourcePortId = portMap.get(link.sourcePortId);
      const childTargetPortId = portMap.get(link.targetPortId);
      if (!childSourcePortId && !childTargetPortId) continue;
      d.removeLink(link.id);
      const newLink = new Link({
        id: link.id,
        sourcePortId: childSourcePortId ?? link.sourcePortId,
        targetPortId: childTargetPortId ?? link.targetPortId,
        points: link.points.map((p) => ({ x: p.x, y: p.y })),
        routing: link.routing,
      });
      d.addLink(newLink);
    }

    d.removeNode(this.groupId);
    ctx.state.clearSelection();
    ctx.state.setNodeSelection(new Set(restoredNodeIds));
    ctx.state.setDiagram(d, true);
  }
}

/** Resize a group node; caller pushes undo at resize start. */
export class ResizeGroupNodeAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = false;

  constructor(
    private readonly groupId: NodeId,
    private readonly newWidth: number,
    private readonly newHeight: number
  ) {}

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    const groupNode = d?.getNode(this.groupId);
    if (!d || !groupNode || !(groupNode instanceof GroupNode) || groupNode.locked) return;
    groupNode.width = Math.max(this.newWidth, 100);
    groupNode.height = Math.max(this.newHeight, 80);
    groupNode.updateScale();
    ctx.state.incrementRenderTick();
  }
}
