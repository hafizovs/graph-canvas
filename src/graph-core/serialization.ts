import type { NodeShape, PortSide, PortType } from './types';
import type { LinkRouting } from './link';
import { Diagram } from './diagram';
import { Node } from './node';
import { Link } from './link';
import { Port } from './port';
import type { NodeId, LinkId, PortId } from './types';

/** JSON-serializable port data (for save/load and paste). */
export interface PortDto {
  id: PortId;
  nodeId: string;
  side: PortSide;
  offset: number;
  type: PortType;
}

/** JSON-serializable node data (for save/load and paste). */
export interface NodeDto {
  id: NodeId;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
  shape?: NodeShape;
  ports: PortDto[];
}

/** JSON-serializable link data (for save/load and paste). */
export interface LinkDto {
  id: LinkId;
  sourcePortId: PortId;
  targetPortId: PortId;
  points?: Array<{ x: number; y: number }>;
  routing?: LinkRouting;
}

/** JSON-serializable diagram data; format for file storage and undo/redo snapshots. */
export interface DiagramJson {
  nodes: NodeDto[];
  links: LinkDto[];
}

/**
 * Serialize a diagram to a plain JSON-serializable object (for save, undo stack, clipboard).
 * @param diagram - Current diagram instance
 * @returns DiagramJson
 */
export function serializeDiagram(diagram: Diagram): DiagramJson {
  const nodes: NodeDto[] = diagram.nodes.map((node) => ({
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    label: node.label,
    shape: node.shape,
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
    if (link.routing !== 'straight') {
      dto.routing = link.routing;
    }
    return dto;
  });

  return { nodes, links };
}

/**
 * Deserialize a diagram from a plain JSON object (load file, undo/redo restore).
 * @param json - Valid DiagramJson (nodes and links arrays)
 * @returns New Diagram instance
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
      shape: nd.shape,
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
        routing: ld.routing,
      })
    );
  }

  return diagram;
}

/**
 * Clone a DiagramJson with new node/link/port ids and position offset (for paste).
 * Node ids become n{startNodeCounter+1}, n{startNodeCounter+2}, ...; links l{startLinkCounter+1}, ...
 * @param json - Source diagram JSON (e.g. from clipboard)
 * @param offsetX - Added to every node x
 * @param offsetY - Added to every node y
 * @param startNodeCounter - Current max node number (e.g. from state); new nodes get higher numbers
 * @param startLinkCounter - Current max link number; new links get higher numbers
 * @returns New DiagramJson and list of new node ids (for selecting pasted nodes)
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
