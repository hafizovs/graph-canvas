import type { DiagramJson, NodeDto, PortDto, LinkDto } from '../serialization';

const ROWS = 50;
const NODE_WIDTH = 120;
const NODE_HEIGHT = 60;
const SPACING_X = 220;
const SPACING_Y = 100;

/**
 * Stress test diagram creation metrics.
 */
export interface StressTestMetrics {
  nodes: number;
  links: number;
  creationMs: number;
}

/**
 * Creates a stress test diagram with the given number of nodes in a chain topology.
 * Nodes are laid out in a grid (~50 per row). Links connect consecutive nodes n1→n2→...→nN.
 *
 * @param nodeCount - Number of nodes (and nodeCount - 1 links)
 * @param options - Optional: logToConsole to output metrics to console
 * @returns DiagramJson and metrics
 */
export function createStressTestDiagram(
  nodeCount: number,
  options?: { logToConsole?: boolean }
): { diagram: DiagramJson; metrics: StressTestMetrics } {
  const logToConsole = options?.logToConsole ?? true;

  performance.mark('stress-create-start');

  const nodes: NodeDto[] = [];
  const links: LinkDto[] = [];

  for (let i = 1; i <= nodeCount; i++) {
    const nodeId = `n${i}`;
    const x = ((i - 1) % ROWS) * SPACING_X;
    const y = Math.floor((i - 1) / ROWS) * SPACING_Y;

    const ports: PortDto[] = [
      {
        id: `p${i}-in`,
        nodeId,
        side: 'left',
        offset: NODE_HEIGHT / 2,
        type: 'input',
      },
      {
        id: `p${i}-out`,
        nodeId,
        side: 'right',
        offset: NODE_HEIGHT / 2,
        type: 'output',
      },
    ];

    nodes.push({
      id: nodeId,
      x,
      y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      label: `Node ${i}`,
      ports,
    });
  }

  for (let i = 1; i < nodeCount; i++) {
    links.push({
      id: `l${i}`,
      sourcePortId: `p${i}-out`,
      targetPortId: `p${i + 1}-in`,
    });
  }

  performance.mark('stress-create-end');
  performance.measure('stress-diagram-create', 'stress-create-start', 'stress-create-end');

  const measure = performance.getEntriesByName('stress-diagram-create', 'measure')[0];
  const creationMs = measure?.duration ?? 0;

  const metrics: StressTestMetrics = {
    nodes: nodeCount,
    links: nodeCount - 1,
    creationMs,
  };

  if (logToConsole) {
    console.log(
      `[Stress Test] Diagram created: ${metrics.nodes} nodes, ${metrics.links} links in ${creationMs.toFixed(1)} ms`
    );
    console.log('[Stress Test] Performance measures: create=', creationMs.toFixed(1), 'ms');
  }

  return {
    diagram: { nodes, links },
    metrics,
  };
}
