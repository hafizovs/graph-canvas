import { Link, Point } from '../../../../graph-core';
import type { LinkId, LinkRouting, NodeId, PortId } from '../../../../graph-core';
import type { ActionContext } from './action-context';
import type { GraphEditorAction } from './graph-editor-action';

/** Create a link from source port to target port. Respects max links per port and no duplicate. */
export class CreateLinkAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = true;

  constructor(
    private readonly sourcePortId: PortId,
    private readonly targetPortId: PortId,
    private readonly targetNodeId: string
  ) {}

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    if (!d) return;
    const duplicate = d.links.some(
      (l) =>
        l.sourcePortId === this.sourcePortId && l.targetPortId === this.targetPortId
    );
    if (duplicate) return;

    const defaultMax = ctx.state.defaultMaxLinksPerPort();
    const getPort = (portId: PortId) => {
      for (const node of d!.nodes) {
        const p = node.getPort(portId);
        if (p) return p;
      }
      return undefined;
    };
    const countLinksAtPort = (portId: PortId) =>
      d.links.filter(
        (l) => l.sourcePortId === portId || l.targetPortId === portId
      ).length;

    const sourcePort = getPort(this.sourcePortId);
    const targetPort = getPort(this.targetPortId);
    const maxSource = sourcePort?.maxLinks ?? defaultMax;
    const maxTarget = targetPort?.maxLinks ?? defaultMax;
    if (maxSource > 0 && countLinksAtPort(this.sourcePortId) >= maxSource) return;
    if (maxTarget > 0 && countLinksAtPort(this.targetPortId) >= maxTarget) return;

    const linkId = `l${ctx.state.incrementLinkIdCounter()}`;
    const maxZ =
      d.links.length > 0
        ? Math.max(...d.links.map((l) => l.zIndex ?? 0))
        : -1;
    d.addLink(
      new Link({
        id: linkId,
        sourcePortId: this.sourcePortId,
        targetPortId: this.targetPortId,
        routing: ctx.state.defaultLinkRouting(),
        zIndex: maxZ + 1,
      })
    );
    ctx.state.setDiagram(d, true);
  }
}

/** Set routing for all selected links. */
export class SetSelectedLinksRoutingAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = true;

  constructor(private readonly routing: LinkRouting) {}

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    const linkIds = ctx.state.selectedLinkIds();
    if (!d || linkIds.size === 0) return;
    for (const linkId of linkIds) {
      const link = d.getLink(linkId);
      if (link) link.routing = this.routing;
    }
    ctx.state.setDiagram(d, true);
  }
}

/** Add a waypoint to a link at the given index. */
export class AddLinkWaypointAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = true;

  constructor(
    private readonly linkId: LinkId,
    private readonly index: number,
    private readonly x: number,
    private readonly y: number
  ) {}

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    const link = d?.getLink(this.linkId);
    if (!d || !link || link.locked) return;
    let px = this.x;
    let py = this.y;
    if (ctx.state.snapToGridEnabled()) {
      const snapped = ctx.coordinate.snapToGrid(this.x, this.y);
      px = snapped.x;
      py = snapped.y;
    }
    link.points.splice(this.index, 0, new Point(px, py));
    ctx.state.setDiagram(d, true);
  }
}

/** Move an existing waypoint; caller pushes undo at drag start. */
export class MoveLinkWaypointAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = false;

  constructor(
    private readonly linkId: LinkId,
    private readonly index: number,
    private readonly x: number,
    private readonly y: number
  ) {}

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    const link = d?.getLink(this.linkId);
    if (!d || !link || link.locked || this.index < 0 || this.index >= link.points.length) return;
    let px = this.x;
    let py = this.y;
    if (ctx.state.snapToGridEnabled()) {
      const snapped = ctx.coordinate.snapToGrid(this.x, this.y);
      px = snapped.x;
      py = snapped.y;
    }
    link.points[this.index] = new Point(px, py);
    ctx.state.incrementRenderTick();
  }
}

/** Remove a waypoint from a link. */
export class RemoveLinkWaypointAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = true;

  constructor(
    private readonly linkId: LinkId,
    private readonly index: number
  ) {}

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    const link = d?.getLink(this.linkId);
    if (!d || !link || link.locked || this.index < 0 || this.index >= link.points.length) return;
    link.points.splice(this.index, 1);
    ctx.state.setDiagram(d, true);
  }
}

/** Move a segment by (dx, dy); caller pushes undo at drag start. */
export class MoveLinkSegmentAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = false;

  constructor(
    private readonly linkId: LinkId,
    private readonly segmentIndex: number,
    private readonly dx: number,
    private readonly dy: number
  ) {}

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    const link = d?.getLink(this.linkId);
    if (!d || !link || link.locked) return;
    const n = link.points.length;
    if (n === 0) return;
    if (this.segmentIndex === 0) {
      link.points[0] = new Point(link.points[0].x + this.dx, link.points[0].y + this.dy);
    } else if (this.segmentIndex >= n) {
      link.points[n - 1] = new Point(
        link.points[n - 1].x + this.dx,
        link.points[n - 1].y + this.dy
      );
    } else {
      link.points[this.segmentIndex - 1] = new Point(
        link.points[this.segmentIndex - 1].x + this.dx,
        link.points[this.segmentIndex - 1].y + this.dy
      );
      link.points[this.segmentIndex] = new Point(
        link.points[this.segmentIndex].x + this.dx,
        link.points[this.segmentIndex].y + this.dy
      );
    }
    ctx.state.incrementRenderTick();
  }
}

/** Clear all waypoints from a link. */
export class ClearLinkWaypointsAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = true;

  constructor(private readonly linkId: LinkId) {}

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    const link = d?.getLink(this.linkId);
    if (!d || !link || link.locked || link.points.length === 0) return;
    link.points.length = 0;
    ctx.state.setDiagram(d, true);
  }
}

/** Set maxLinks on all ports of the given nodes. */
export class SetPortMaxLinksAction implements GraphEditorAction {
  readonly pushUndoBeforeExecute = true;

  constructor(
    private readonly nodeIds: NodeId[],
    private readonly value: number
  ) {}

  execute(ctx: ActionContext): void {
    const d = ctx.state.getDiagram();
    if (!d || this.nodeIds.length === 0) return;
    for (const nodeId of this.nodeIds) {
      const node = d.getNode(nodeId);
      if (!node) continue;
      for (const port of node.ports) {
        port.maxLinks = this.value;
      }
    }
    ctx.state.setDiagram(d, true);
  }
}
