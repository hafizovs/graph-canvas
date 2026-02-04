import { Injectable } from '@angular/core';
import { GroupNode } from '../../../../graph-core';
import type { LinkId, LinkRouting, NodeId, NodeShape, PortId } from '../../../../graph-core';
import { GraphEditorStateService } from './graph-editor-state.service';
import { GraphEditorActionDispatcher } from '../actions/action-dispatcher.service';
import {
  AddNodeAction,
  AddNodeFromPaletteAction,
  MoveNodesAction,
  RotateNodesAction,
  AlignNodesAction,
  GroupNodesAction,
  UngroupNodeAction,
  ResizeGroupNodeAction,
  CreateLinkAction,
  SetSelectedLinksRoutingAction,
  AddLinkWaypointAction,
  MoveLinkWaypointAction,
  RemoveLinkWaypointAction,
  MoveLinkSegmentAction,
  ClearLinkWaypointsAction,
  CopyAction,
  PasteAction,
  DeleteSelectionAction,
  BringToFrontAction,
  SendToBackAction,
  ToggleLockSelectionAction,
} from '../actions';
import type { AlignMode } from '../actions';

/** Re-export for consumers that import from the operations service. */
export type { AlignMode };

/**
 * Facade over graph editor actions. All mutating operations are delegated to
 * {@link GraphEditorActionDispatcher}; return values and pre-checks (e.g. group delete
 * confirmation) are handled here for API compatibility with the component and resize service.
 */
@Injectable()
export class GraphOperationsService {
  constructor(
    private readonly state: GraphEditorStateService,
    private readonly dispatcher: GraphEditorActionDispatcher
  ) {}

  addNode(): void {
    this.dispatcher.dispatch(new AddNodeAction());
  }

  addNodeFromPalette(
    shape: NodeShape,
    svgX: number,
    svgY: number,
    customShapeId?: string
  ): void {
    this.dispatcher.dispatch(new AddNodeFromPaletteAction(shape, svgX, svgY, customShapeId));
  }

  moveNodes(
    initialPositions: Map<NodeId, { x: number; y: number }>,
    dx: number,
    dy: number
  ): void {
    this.dispatcher.dispatch(new MoveNodesAction(initialPositions, dx, dy));
  }

  rotateSelectedNodes(angleDeg: number): void {
    this.dispatcher.dispatch(new RotateNodesAction(angleDeg));
  }

  alignSelectedNodes(mode: AlignMode): void {
    this.dispatcher.dispatch(new AlignNodesAction(mode));
  }

  createLink(
    sourcePortId: PortId,
    _sourceNodeId: NodeId,
    targetPortId: PortId,
    targetNodeId: NodeId
  ): boolean {
    const d = this.state.getDiagram();
    if (!d) return false;
    const hasExisting =
      d.links.some(
        (l) => l.sourcePortId === sourcePortId && l.targetPortId === targetPortId
      ) || d.links.some((l) => l.targetPortId === targetPortId);
    if (hasExisting) return false;
    this.dispatcher.dispatch(new CreateLinkAction(sourcePortId, targetPortId, targetNodeId));
    return true;
  }

  setSelectedLinksRouting(routing: LinkRouting): boolean {
    const d = this.state.getDiagram();
    const linkIds = this.state.selectedLinkIds();
    if (!d || linkIds.size === 0) return false;
    this.dispatcher.dispatch(new SetSelectedLinksRoutingAction(routing));
    return true;
  }

  deleteSelection(): boolean {
    const d = this.state.getDiagram();
    if (!d) return false;
    const nodeIds = this.state.selectedNodeIds();
    const linkIds = this.state.selectedLinkIds();
    if (nodeIds.size === 0 && linkIds.size === 0) return false;
    let hasGroups = false;
    for (const nodeId of nodeIds) {
      const node = d.getNode(nodeId);
      if (node instanceof GroupNode) {
        hasGroups = true;
        break;
      }
    }
    if (hasGroups && !DeleteSelectionAction.confirmGroupDelete()) return false;
    this.dispatcher.dispatch(new DeleteSelectionAction());
    return true;
  }

  copy(): void {
    this.dispatcher.dispatch(new CopyAction());
  }

  paste(): boolean {
    const clipboard = this.state.getClipboard();
    const d = this.state.getDiagram();
    if (!clipboard || !d) return false;
    this.dispatcher.dispatch(new PasteAction());
    return true;
  }

  addLinkWaypoint(linkId: LinkId, index: number, x: number, y: number): boolean {
    const d = this.state.getDiagram();
    const link = d?.getLink(linkId);
    if (!d || !link) return false;
    this.dispatcher.dispatch(new AddLinkWaypointAction(linkId, index, x, y));
    return true;
  }

  moveLinkWaypoint(linkId: LinkId, index: number, x: number, y: number): boolean {
    const d = this.state.getDiagram();
    const link = d?.getLink(linkId);
    if (!d || !link || index < 0 || index >= link.points.length) return false;
    this.dispatcher.dispatch(new MoveLinkWaypointAction(linkId, index, x, y));
    return true;
  }

  removeLinkWaypoint(linkId: LinkId, index: number): boolean {
    const d = this.state.getDiagram();
    const link = d?.getLink(linkId);
    if (!d || !link || index < 0 || index >= link.points.length) return false;
    this.dispatcher.dispatch(new RemoveLinkWaypointAction(linkId, index));
    return true;
  }

  moveLinkSegment(linkId: LinkId, segmentIndex: number, dx: number, dy: number): boolean {
    const d = this.state.getDiagram();
    const link = d?.getLink(linkId);
    if (!d || !link || link.points.length === 0) return false;
    this.dispatcher.dispatch(new MoveLinkSegmentAction(linkId, segmentIndex, dx, dy));
    return true;
  }

  clearLinkWaypoints(linkId: LinkId): boolean {
    const d = this.state.getDiagram();
    const link = d?.getLink(linkId);
    if (!d || !link || link.points.length === 0) return false;
    this.dispatcher.dispatch(new ClearLinkWaypointsAction(linkId));
    return true;
  }

  groupSelectedNodes(): boolean {
    const d = this.state.getDiagram();
    const selectedNodeIds = this.state.selectedNodeIds();
    if (!d || selectedNodeIds.size < 2) return false;
    for (const nodeId of selectedNodeIds) {
      const node = d.getNode(nodeId);
      if (!node || node.nodeType === 'group') return false;
    }
    this.dispatcher.dispatch(new GroupNodesAction());
    return true;
  }

  ungroupNode(groupId: NodeId): boolean {
    const d = this.state.getDiagram();
    const groupNode = d?.getNode(groupId);
    if (!d || !groupNode || !(groupNode instanceof GroupNode)) return false;
    this.dispatcher.dispatch(new UngroupNodeAction(groupId));
    return true;
  }

  resizeGroupNode(groupId: NodeId, newWidth: number, newHeight: number): void {
    this.dispatcher.dispatch(new ResizeGroupNodeAction(groupId, newWidth, newHeight));
  }

  bringToFront(): boolean {
    const d = this.state.getDiagram();
    if (!d) return false;
    const hasSelection =
      this.state.selectedNodeIds().size > 0 || this.state.selectedLinkIds().size > 0;
    if (!hasSelection) return false;
    this.dispatcher.dispatch(new BringToFrontAction());
    return true;
  }

  sendToBack(): boolean {
    const d = this.state.getDiagram();
    if (!d) return false;
    const hasSelection =
      this.state.selectedNodeIds().size > 0 || this.state.selectedLinkIds().size > 0;
    if (!hasSelection) return false;
    this.dispatcher.dispatch(new SendToBackAction());
    return true;
  }

  toggleLockSelection(): boolean {
    const d = this.state.getDiagram();
    if (!d) return false;
    const hasSelection =
      this.state.selectedNodeIds().size > 0 || this.state.selectedLinkIds().size > 0;
    if (!hasSelection) return false;
    this.dispatcher.dispatch(new ToggleLockSelectionAction());
    return true;
  }
}
