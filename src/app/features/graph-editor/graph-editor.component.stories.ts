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
