import type { Meta, StoryObj } from '@storybook/angular';
import { GraphGroupNodeStoryWrapperComponent } from './graph-group-node-story-wrapper.component';

const meta: Meta<GraphGroupNodeStoryWrapperComponent> = {
  title: 'Graph Editor/Graph Group Node',
  component: GraphGroupNodeStoryWrapperComponent,
  tags: ['autodocs'],
  args: {
    selected: false,
    renderTick: 0,
    showPlaceholder: false,
  },
};

export default meta;
type Story = StoryObj<GraphGroupNodeStoryWrapperComponent>;

export const Default: Story = {
  args: {},
};

export const Selected: Story = {
  args: { selected: true },
};

export const ResizeHandlesVisible: Story = {
  args: { selected: true },
};

export const Placeholder: Story = {
  args: { showPlaceholder: true },
};
