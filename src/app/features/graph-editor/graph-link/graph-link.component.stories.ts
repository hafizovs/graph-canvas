import type { Meta, StoryObj } from '@storybook/angular';
import { GraphLinkStoryWrapperComponent } from './graph-link-story-wrapper.component';

const meta: Meta<GraphLinkStoryWrapperComponent> = {
  title: 'Graph Editor/Graph Link',
  component: GraphLinkStoryWrapperComponent,
  tags: ['autodocs'],
  args: {
    selected: false,
    selectedWaypointIndex: null,
    renderTick: 0,
    previewTarget: null,
  },
};

export default meta;
type Story = StoryObj<GraphLinkStoryWrapperComponent>;

export const Straight: Story = {
  args: { routing: 'straight' },
};

export const Orthogonal: Story = {
  args: { routing: 'orthogonal' },
};

export const Selected: Story = {
  args: { selected: true },
};

export const WithWaypoints: Story = {
  args: { withWaypoints: true },
};

export const Preview: Story = {
  args: {
    previewTarget: { x: 400, y: 200 },
  },
};

export const SelectedWaypoint: Story = {
  args: {
    selected: true,
    selectedWaypointIndex: 0,
  },
};
