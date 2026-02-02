import type { PortSide, PortType } from './types';
import { Diagram } from './diagram';
import { Node } from './node';
import { Link } from './link';
import { Port } from './port';
import type { NodeId, LinkId, PortId } from './types';

/** JSON-serializable port data */
export interface PortDto {
  id: PortId;
  nodeId: string;
  side: PortSide;
  offset: number;
  type: PortType;
}

/** JSON-serializable node data */
export interface NodeDto {
  id: NodeId;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
  ports: PortDto[];
}

/** JSON-serializable link data */
export interface LinkDto {
  id: LinkId;
  sourcePortId: PortId;
  targetPortId: PortId;
  points?: Array<{ x: number; y: number }>;
}

/** JSON-serializable diagram data */
export interface DiagramJson {
  nodes: NodeDto[];
  links: LinkDto[];
}

/**
 * Serialize a diagram to a plain JSON-serializable object.
 */
export function serializeDiagram(diagram: Diagram): DiagramJson {
  const nodes: NodeDto[] = diagram.nodes.map((node) => ({
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    label: node.label,
    ports: node.ports.map((p) => ({
      id: p.id,
      nodeId: p.nodeId,
      side: p.side,
      offset: p.offset,
      type: p.type,
    })),
  }));

  const links: LinkDto[] = diagram.links.map((link) => {
    const dto: LinkDto = {
      id: link.id,
      sourcePortId: link.sourcePortId,
      targetPortId: link.targetPortId,
    };
    if (link.points.length > 0) {
      dto.points = link.points.map((p) => ({ x: p.x, y: p.y }));
    }
    return dto;
  });

  return { nodes, links };
}

/**
 * Deserialize a diagram from a plain JSON object.
 */
export function deserializeDiagram(json: DiagramJson): Diagram {
  const diagram = new Diagram();

  for (const nd of json.nodes ?? []) {
    const ports = (nd.ports ?? []).map(
      (p) =>
        new Port({
          id: p.id,
          nodeId: p.nodeId,
          side: p.side,
          offset: p.offset,
          type: p.type,
        })
    );
    const node = new Node({
      id: nd.id,
      x: nd.x,
      y: nd.y,
      width: nd.width,
      height: nd.height,
      label: nd.label,
      ports,
    });
    diagram.addNode(node);
  }

  for (const ld of json.links ?? []) {
    diagram.addLink(
      new Link({
        id: ld.id,
        sourcePortId: ld.sourcePortId,
        targetPortId: ld.targetPortId,
        points: ld.points,
      })
    );
  }

  return diagram;
}

/**
 * Clone a DiagramJson with new ids and an position offset (for paste).
 * Returns the new JSON and the list of new node ids (for selection).
 */
export function cloneDiagramJsonForPaste(
  json: DiagramJson,
  offsetX: number,
  offsetY: number,
  startNodeCounter: number,
  startLinkCounter: number
): { json: DiagramJson; newNodeIds: NodeId[] } {
  const nodeIdMap = new Map<string, NodeId>();
  const portIdMap = new Map<string, PortId>();
  let nodeCounter = startNodeCounter;
  let linkCounter = startLinkCounter;

  const newNodes: NodeDto[] = (json.nodes ?? []).map((nd) => {
    nodeCounter++;
    const newNodeId = `n${nodeCounter}` as NodeId;
    nodeIdMap.set(nd.id, newNodeId);
    const newPorts: PortDto[] = (nd.ports ?? []).map((p, i) => {
      const newPortId = `${newNodeId}-p${i}` as PortId;
      portIdMap.set(p.id, newPortId);
      return {
        ...p,
        id: newPortId,
        nodeId: newNodeId,
      };
    });
    return {
      ...nd,
      id: newNodeId,
      x: nd.x + offsetX,
      y: nd.y + offsetY,
      ports: newPorts,
    };
  });

  const newNodeIds = newNodes.map((n) => n.id);

  const newLinks: LinkDto[] = (json.links ?? []).map((ld) => {
    linkCounter++;
    const newLinkId = `l${linkCounter}` as LinkId;
    return {
      ...ld,
      id: newLinkId,
      sourcePortId: portIdMap.get(ld.sourcePortId) ?? ld.sourcePortId,
      targetPortId: portIdMap.get(ld.targetPortId) ?? ld.targetPortId,
    };
  });

  return {
    json: { nodes: newNodes, links: newLinks },
    newNodeIds,
  };
}
