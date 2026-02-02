import type { DiagramJson } from '../serialization';

/** Empty diagram: no nodes, no links */
export const MOCK_DIAGRAM_EMPTY: DiagramJson = {
  nodes: [],
  links: [],
};

/** Single node, no links */
export const MOCK_DIAGRAM_SINGLE_NODE: DiagramJson = {
  nodes: [
    {
      id: 'n1',
      x: 100,
      y: 100,
      width: 120,
      height: 60,
      label: 'Node A',
      ports: [
        { id: 'p1-in', nodeId: 'n1', side: 'left', offset: 30, type: 'input' },
        { id: 'p1-out', nodeId: 'n1', side: 'right', offset: 30, type: 'output' },
      ],
    },
  ],
  links: [],
};

/** Chain of 3 nodes: A → B → C (same as createSampleDiagram) */
export const MOCK_DIAGRAM_CHAIN: DiagramJson = {
  nodes: [
    {
      id: 'n1',
      x: 100,
      y: 100,
      width: 120,
      height: 60,
      label: 'Node A',
      ports: [
        { id: 'p1-in', nodeId: 'n1', side: 'left', offset: 30, type: 'input' },
        { id: 'p1-out', nodeId: 'n1', side: 'right', offset: 30, type: 'output' },
      ],
    },
    {
      id: 'n2',
      x: 350,
      y: 100,
      width: 120,
      height: 60,
      label: 'Node B',
      ports: [
        { id: 'p2-in', nodeId: 'n2', side: 'left', offset: 30, type: 'input' },
        { id: 'p2-out', nodeId: 'n2', side: 'right', offset: 30, type: 'output' },
      ],
    },
    {
      id: 'n3',
      x: 350,
      y: 250,
      width: 120,
      height: 60,
      label: 'Node C',
      ports: [{ id: 'p3-in', nodeId: 'n3', side: 'top', offset: 60, type: 'input' }],
    },
  ],
  links: [
    { id: 'l1', sourcePortId: 'p1-out', targetPortId: 'p2-in' },
    { id: 'l2', sourcePortId: 'p2-out', targetPortId: 'p3-in' },
  ],
};

/** Diamond: two sources (n1, n2), one middle (n3), one sink (n4). n1→n3, n2→n3, n3→n4 */
export const MOCK_DIAGRAM_DIAMOND: DiagramJson = {
  nodes: [
    {
      id: 'n1',
      x: 80,
      y: 80,
      width: 100,
      height: 50,
      label: 'Source 1',
      ports: [
        { id: 'p1-out', nodeId: 'n1', side: 'right', offset: 25, type: 'output' },
      ],
    },
    {
      id: 'n2',
      x: 320,
      y: 80,
      width: 100,
      height: 50,
      label: 'Source 2',
      ports: [
        { id: 'p2-out', nodeId: 'n2', side: 'left', offset: 25, type: 'output' },
      ],
    },
    {
      id: 'n3',
      x: 200,
      y: 200,
      width: 100,
      height: 50,
      label: 'Middle',
      ports: [
        { id: 'p3-in-left', nodeId: 'n3', side: 'left', offset: 25, type: 'input' },
        { id: 'p3-in-right', nodeId: 'n3', side: 'right', offset: 25, type: 'input' },
        { id: 'p3-out', nodeId: 'n3', side: 'bottom', offset: 50, type: 'output' },
      ],
    },
    {
      id: 'n4',
      x: 200,
      y: 320,
      width: 100,
      height: 50,
      label: 'Sink',
      ports: [{ id: 'p4-in', nodeId: 'n4', side: 'top', offset: 50, type: 'input' }],
    },
  ],
  links: [
    { id: 'l1', sourcePortId: 'p1-out', targetPortId: 'p3-in-left' },
    { id: 'l2', sourcePortId: 'p2-out', targetPortId: 'p3-in-right' },
    { id: 'l3', sourcePortId: 'p3-out', targetPortId: 'p4-in' },
  ],
};
