import {
  Component,
  ChangeDetectionStrategy,
  AfterViewInit,
  OnDestroy,
  signal,
  computed,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
import {
  Diagram,
  Node,
  Link,
  Port,
} from '../../../graph-core';
import type { NodeId, LinkId, PortId } from '../../../graph-core';
import { GraphLinkComponent } from './graph-link/graph-link.component';
import { GraphNodeComponent } from './graph-node/graph-node.component';
import { GraphToolbarComponent } from './graph-toolbar/graph-toolbar.component';
import type { NodePointerEvent } from './graph-node/graph-node.component';
import type { PortPointerEvent } from './graph-node/graph-node.component';

@Component({
  selector: 'app-graph-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GraphLinkComponent, GraphNodeComponent, GraphToolbarComponent],
  templateUrl: './graph-editor.component.html',
  styleUrl: './graph-editor.component.scss',
})
export class GraphEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('svgContainer', { static: true }) svgContainer!: ElementRef<SVGSVGElement>;

  protected readonly diagram = signal<Diagram | null>(null);
  protected readonly renderTick = signal(0);
  protected readonly viewBox = signal({ x: 0, y: 0, width: 800, height: 600 });

  protected readonly linkingFrom = signal<{
    portId: PortId;
    nodeId: NodeId;
    portType: 'output' | 'input';
  } | null>(null);
  protected readonly linkingPreviewPoint = signal<{ x: number; y: number } | null>(null);

  protected readonly selectedNodeId = signal<NodeId | null>(null);
  protected readonly selectedLinkId = signal<LinkId | null>(null);
  protected readonly hasSelection = computed(
    () => this.selectedNodeId() != null || this.selectedLinkId() != null
  );

  private _diagram: Diagram | null = null;
  private _pendingDrag: { node: Node; startX: number; startY: number } | null = null;
  private _dragging: { node: Node; startX: number; startY: number } | null = null;
  private static readonly DRAG_THRESHOLD_PX = 4;
  private _nodeIdCounter = 0;
  private _linkIdCounter = 0;

  ngAfterViewInit(): void {
    this._diagram = this.createSampleDiagram();
    this.diagram.set(this._diagram);
  }

  ngOnDestroy(): void {
    this._diagram = null;
    this.diagram.set(null);
  }

  private createSampleDiagram(): Diagram {
    const diagram = new Diagram();

    const node1 = new Node({
      id: 'n1',
      x: 100,
      y: 100,
      width: 120,
      height: 60,
      label: 'Node A',
      ports: [
        new Port({
          id: 'p1-out',
          nodeId: 'n1',
          side: 'right',
          offset: 30,
          type: 'output',
        }),
      ],
    });
    node1.addPort(
      new Port({
        id: 'p1-in',
        nodeId: 'n1',
        side: 'left',
        offset: 30,
        type: 'input',
      })
    );

    const node2 = new Node({
      id: 'n2',
      x: 350,
      y: 100,
      width: 120,
      height: 60,
      label: 'Node B',
      ports: [
        new Port({
          id: 'p2-in',
          nodeId: 'n2',
          side: 'left',
          offset: 30,
          type: 'input',
        }),
        new Port({
          id: 'p2-out',
          nodeId: 'n2',
          side: 'right',
          offset: 30,
          type: 'output',
        }),
      ],
    });

    const node3 = new Node({
      id: 'n3',
      x: 350,
      y: 250,
      width: 120,
      height: 60,
      label: 'Node C',
      ports: [
        new Port({
          id: 'p3-in',
          nodeId: 'n3',
          side: 'top',
          offset: 60,
          type: 'input',
        }),
      ],
    });

    diagram.addNode(node1);
    diagram.addNode(node2);
    diagram.addNode(node3);
    diagram.addLink(
      new Link({
        id: 'l1',
        sourcePortId: 'p1-out',
        targetPortId: 'p2-in',
      })
    );
    diagram.addLink(
      new Link({
        id: 'l2',
        sourcePortId: 'p2-out',
        targetPortId: 'p3-in',
      })
    );

    return diagram;
  }

  private clientToSvg(clientX: number, clientY: number): { x: number; y: number } {
    const svg = this.svgContainer?.nativeElement;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    const svgP = ctm ? pt.matrixTransform(ctm.inverse()) : pt;
    return { x: svgP.x, y: svgP.y };
  }

  protected onAddNode(): void {
    const d = this._diagram;
    if (!d) return;

    this._nodeIdCounter++;
    const nodeId = `n${this._nodeIdCounter}` as NodeId;
    const vb = this.viewBox();
    const x = vb.x + vb.width / 2 - 60;
    const y = vb.y + vb.height / 2 - 30;

    const node = new Node({
      id: nodeId,
      x,
      y,
      width: 120,
      height: 60,
      label: `Node ${this._nodeIdCounter}`,
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
    this.diagram.set(d);
    this.renderTick.update((v) => v + 1);
  }

  protected onNodePointerDown(e: NodePointerEvent): void {
    if (this.linkingFrom()) return;
    const pt = this.clientToSvg(e.event.clientX, e.event.clientY);
    this._pendingDrag = { node: e.node, startX: pt.x - e.node.x, startY: pt.y - e.node.y };
    (e.event.target as Element).setPointerCapture?.(e.event.pointerId);
  }

  protected onNodePointerMove(e: NodePointerEvent): void {
    const pt = this.clientToSvg(e.event.clientX, e.event.clientY);
    if (this._pendingDrag?.node === e.node) {
      const dx = pt.x - (e.node.x + this._pendingDrag.startX);
      const dy = pt.y - (e.node.y + this._pendingDrag.startY);
      if (Math.sqrt(dx * dx + dy * dy) > GraphEditorComponent.DRAG_THRESHOLD_PX) {
        this._dragging = this._pendingDrag;
        this._pendingDrag = null;
      } else {
        return;
      }
    }
    if (!this._dragging || this._dragging.node !== e.node) return;
    const { startX, startY } = this._dragging;
    e.node.setPosition(pt.x - startX, pt.y - startY);
    this.renderTick.update((v) => v + 1);
  }

  protected onNodePointerUp(e: NodePointerEvent): void {
    (e.event.target as Element).releasePointerCapture?.(e.event.pointerId);
    if (this._dragging?.node === e.node) {
      this._dragging = null;
    } else if (this._pendingDrag?.node === e.node) {
      this.selectedNodeId.set(e.node.id);
      this.selectedLinkId.set(null);
      this._pendingDrag = null;
    }
  }

  protected onPortPointerDown(e: PortPointerEvent): void {
    if (this.linkingFrom()) return;
    if (e.port.type !== 'output') return;

    this.linkingFrom.set({
      portId: e.port.id,
      nodeId: e.node.id,
      portType: 'output',
    });
    const pt = this.clientToSvg(e.event.clientX, e.event.clientY);
    this.linkingPreviewPoint.set(pt);
    (e.event.target as Element).setPointerCapture?.(e.event.pointerId);
  }

  protected onContainerPointerMove(event: PointerEvent): void {
    if (this.linkingFrom()) {
      const pt = this.clientToSvg(event.clientX, event.clientY);
      this.linkingPreviewPoint.set(pt);
    }
  }

  protected onContainerPointerUp(event: PointerEvent): void {
    const from = this.linkingFrom();
    if (from) {
      const underCursor = document.elementFromPoint(event.clientX, event.clientY);
      const target = underCursor?.closest('[data-port-id][data-port-type][data-node-id]');
      const targetPortId = target?.getAttribute('data-port-id') as PortId | null;
      const targetPortType = target?.getAttribute('data-port-type');
      const targetNodeId = target?.getAttribute('data-node-id') as NodeId | null;

      if (
        targetPortId &&
        targetPortType === 'input' &&
        targetNodeId &&
        targetNodeId !== from.nodeId
      ) {
        const d = this._diagram;
        if (d) {
          const hasExisting =
            d.links.some(
              (l) =>
                l.sourcePortId === from.portId && l.targetPortId === targetPortId
            ) || d.links.some((l) => l.targetPortId === targetPortId);
          if (!hasExisting) {
            this._linkIdCounter++;
            d.addLink(
              new Link({
                id: `l${this._linkIdCounter}`,
                sourcePortId: from.portId,
                targetPortId,
              })
            );
            this.diagram.set(d);
            this.renderTick.update((v) => v + 1);
          }
        }
      }

      this.linkingFrom.set(null);
      this.linkingPreviewPoint.set(null);
    }
  }

  protected getPreviewPathD(): string {
    const from = this.linkingFrom();
    const preview = this.linkingPreviewPoint();
    const d = this._diagram;
    if (!from || !preview || !d) return '';

    const source = d.getPortPosition(from.portId);
    if (!source) return '';
    return `M ${source.x} ${source.y} L ${preview.x} ${preview.y}`;
  }

  protected onLinkSelect(link: Link): void {
    this.selectedLinkId.set(link.id);
    this.selectedNodeId.set(null);
  }

  protected onDeleteSelection(): void {
    const d = this._diagram;
    if (!d) return;
    const nodeId = this.selectedNodeId();
    const linkId = this.selectedLinkId();
    if (nodeId) {
      d.removeNode(nodeId);
      this.selectedNodeId.set(null);
      this.selectedLinkId.set(null);
      this.diagram.set(d);
      this.renderTick.update((v) => v + 1);
    } else if (linkId) {
      d.removeLink(linkId);
      this.selectedNodeId.set(null);
      this.selectedLinkId.set(null);
      this.diagram.set(d);
      this.renderTick.update((v) => v + 1);
    }
  }

  protected onCanvasPointerDown(event: PointerEvent): void {
    const target = event.target as Element;
    if (target.closest('g[app-graph-node]') || target.closest('.link-path')) return;
    this.selectedNodeId.set(null);
    this.selectedLinkId.set(null);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeyDown(event: KeyboardEvent): void {
    const tag = (event.target as Element)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    this.onDeleteSelection();
  }
}
