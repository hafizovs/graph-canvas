import type { Meta, StoryObj } from '@storybook/angular';
import { fn } from 'storybook/test';
import { GraphPaletteComponent } from './graph-palette.component';
import type { NodeShape } from '../../../../graph-core';

const meta: Meta<GraphPaletteComponent> = {
  title: 'Graph Editor/Graph Palette',
  component: GraphPaletteComponent,
  tags: ['autodocs'],
  args: {
    shapeDragStart: fn(),
  },
};

export default meta;
type Story = StoryObj<GraphPaletteComponent>;

export const Default: Story = {
  args: {},
};

export const FilteredShapes: Story = {
  args: {
    paletteConfig: {
      visible: true,
      shapes: ['rectangle', 'circle', 'diamond', 'triangle'] as NodeShape[],
    },
  },
};
