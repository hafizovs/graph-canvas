import type { Meta, StoryObj } from '@storybook/angular';
import { GraphNodeStoryWrapperComponent } from './graph-node-story-wrapper.component';
import type { NodeShape } from '../../../../graph-core';

const meta: Meta<GraphNodeStoryWrapperComponent> = {
  title: 'Graph Editor/Graph Node',
  component: GraphNodeStoryWrapperComponent,
  tags: ['autodocs'],
  args: {
    shape: 'rectangle',
    selected: false,
    renderTick: 0,
    label: 'Node',
  },
};

export default meta;
type Story = StoryObj<GraphNodeStoryWrapperComponent>;

export const Rectangle: Story = {
  args: { shape: 'rectangle' as NodeShape, label: 'Rectangle' },
};

export const RoundedRect: Story = {
  args: { shape: 'roundedRect' as NodeShape, label: 'Rounded' },
};

export const Circle: Story = {
  args: { shape: 'circle' as NodeShape, label: 'Circle' },
};

export const Ellipse: Story = {
  args: { shape: 'ellipse' as NodeShape, label: 'Ellipse' },
};

export const Diamond: Story = {
  args: { shape: 'diamond' as NodeShape, label: 'Diamond' },
};

export const Triangle: Story = {
  args: { shape: 'triangle' as NodeShape, label: 'Triangle' },
};

export const Hexagon: Story = {
  args: { shape: 'hexagon' as NodeShape, label: 'Hexagon' },
};

export const Parallelogram: Story = {
  args: { shape: 'parallelogram' as NodeShape, label: 'Parallelogram' },
};

export const Pentagon: Story = {
  args: { shape: 'pentagon' as NodeShape, label: 'Pentagon' },
};

export const Cross: Story = {
  args: { shape: 'cross' as NodeShape, label: 'Cross' },
};

export const Selected: Story = {
  args: { shape: 'rectangle' as NodeShape, selected: true, label: 'Selected' },
};

export const WithPorts: Story = {
  args: { shape: 'rectangle' as NodeShape, label: 'With in/out ports' },
};

export const CustomShape: Story = {
  args: {
    shape: 'custom' as NodeShape,
    label: 'Star',
    customShapeId: 'shapes/star.svg',
  },
};
