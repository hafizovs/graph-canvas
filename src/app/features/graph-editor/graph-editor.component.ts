import {
  Component,
  ChangeDetectionStrategy,
  AfterViewInit,
  OnDestroy,
  signal,
  ViewChild,
  ElementRef,
} from '@angular/core';
import {
  Diagram,
  Node,
  Link,
  Port,
} from '../../../graph-core';

@Component({
  selector: 'app-graph-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './graph-editor.component.html',
  styleUrl: './graph-editor.component.scss',
})
export class GraphEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('svgContainer', { static: true }) svgContainer!: ElementRef<SVGSVGElement>;

  protected readonly diagram = signal<Diagram | null>(null);
  protected readonly renderTick = signal(0);
  protected readonly viewBox = signal({ x: 0, y: 0, width: 800, height: 600 });

  private _diagram: Diagram | null = null;
  private _dragging: { node: Node; startX: number; startY: number } | null = null;

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

  protected onNodePointerDown(node: Node, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const pt = this.clientToSvg(event.clientX, event.clientY);
    this._dragging = { node, startX: pt.x - node.x, startY: pt.y - node.y };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  protected onNodePointerMove(node: Node, event: PointerEvent): void {
    if (!this._dragging || this._dragging.node !== node) return;
    const { startX, startY } = this._dragging;
    const pt = this.clientToSvg(event.clientX, event.clientY);
    node.setPosition(pt.x - startX, pt.y - startY);
    this.renderTick.update((v) => v + 1);
  }

  protected onNodePointerUp(node: Node, event: PointerEvent): void {
    if (this._dragging?.node === node) {
      (event.target as Element).releasePointerCapture?.(event.pointerId);
      this._dragging = null;
    }
  }

  protected getLinkPath(link: Link): string {
    const d = this._diagram;
    return d ? link.buildPath(d) : '';
  }
}
