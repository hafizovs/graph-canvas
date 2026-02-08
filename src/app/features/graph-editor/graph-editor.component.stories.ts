import type { Meta, StoryObj } from '@storybook/angular';
import { GraphEditorComponent } from './graph-editor.component';
import { MOCK_DIAGRAM_CHAIN, MOCK_DIAGRAM_DIAMOND, MOCK_DIAGRAM_EMPTY } from '../../../graph-core';

const meta: Meta<GraphEditorComponent> = {
  title: 'Graph Editor/Graph Editor',
  component: GraphEditorComponent,
  tags: ['autodocs'],
  args: {
    config: null,
  },
};

export default meta;
type Story = StoryObj<GraphEditorComponent>;

export const Default: Story = {
  args: {
    config: {
      toolbar: { visible: false },
      palette: { visible: true },
      initialDiagram: null,
    },
  },
};

export const WithToolbar: Story = {
  args: {
    config: {
      toolbar: { visible: true },
      palette: { visible: true },
      initialDiagram: undefined,
    },
  },
};

export const WithPalette: Story = {
  args: {
    config: {
      toolbar: { visible: false },
      palette: { visible: true },
      initialDiagram: MOCK_DIAGRAM_CHAIN,
    },
  },
};

export const WithInitialDiagramChain: Story = {
  args: {
    config: {
      toolbar: { visible: true },
      palette: { visible: true },
      initialDiagram: MOCK_DIAGRAM_CHAIN,
    },
  },
};

export const WithInitialDiagramDiamond: Story = {
  args: {
    config: {
      toolbar: { visible: true },
      palette: { visible: true },
      initialDiagram: MOCK_DIAGRAM_DIAMOND,
    },
  },
};

export const ToolbarOnly: Story = {
  args: {
    config: {
      toolbar: { visible: true },
      palette: { visible: false },
      initialDiagram: MOCK_DIAGRAM_CHAIN,
    },
  },
};

export const PaletteOnly: Story = {
  args: {
    config: {
      toolbar: { visible: false },
      palette: { visible: true },
      initialDiagram: MOCK_DIAGRAM_EMPTY,
    },
  },
};

export const Minimal: Story = {
  args: {
    config: {
      toolbar: { visible: false },
      palette: { visible: false },
      initialDiagram: MOCK_DIAGRAM_EMPTY,
    },
  },
};

export const WithLod: Story = {
  args: {
    config: {
      toolbar: { visible: true },
      palette: { visible: true },
      initialDiagram: MOCK_DIAGRAM_CHAIN,
      lod: { enabled: true, useCanvas: true, scaleThreshold: 0.5 },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'LOD enabled with Canvas 2D. Zoom out (scroll or toolbar) until scale is below 0.5 to see the canvas layer; pan and zoom still work. Zoom in to return to interactive SVG.',
      },
    },
  },
};

export const WithLodNoCanvas: Story = {
  args: {
    config: {
      toolbar: { visible: true },
      palette: { visible: true },
      initialDiagram: MOCK_DIAGRAM_CHAIN,
      lod: { enabled: true, useCanvas: false, scaleThreshold: 0.5 },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'LOD enabled without Canvas. When zoomed out (scale < 0.5) only pan/zoom work; node/link interaction is disabled. SVG remains visible.',
      },
    },
  },
};
