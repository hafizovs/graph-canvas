export type { PointLike, Rect, NodeId, LinkId, PortId, PortSide, PortType, NodeShape, NodeType } from './types';
export type { LinkRouting } from './link';
export * from './point';
export * from './port';
export * from './node';
export * from './group-node';
export * from './link';
export * from './diagram';
export type { DiagramJson, NodeDto, PortDto, LinkDto } from './serialization';
export {
  serializeDiagram,
  deserializeDiagram,
  cloneDiagramJsonForPaste,
} from './serialization';
export {
  MOCK_DIAGRAM_EMPTY,
  MOCK_DIAGRAM_SINGLE_NODE,
  MOCK_DIAGRAM_CHAIN,
  MOCK_DIAGRAM_DIAMOND,
} from './mocks/diagram-mocks';
export {
  createStressTestDiagram,
  type StressTestMetrics,
} from './mocks/stress-test-diagram';
