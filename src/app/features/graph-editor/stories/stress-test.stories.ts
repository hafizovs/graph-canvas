import type { Meta, StoryObj } from '@storybook/angular';
import { StressTestStoryWrapperComponent } from './stress-test-story-wrapper.component';

const meta: Meta<StressTestStoryWrapperComponent> = {
  title: 'Graph Editor/Stress Tests',
  component: StressTestStoryWrapperComponent,
  tags: ['autodocs'],
  args: {
    nodeCount: 500,
  },
};

export default meta;
type Story = StoryObj<StressTestStoryWrapperComponent>;

export const Stress500: Story = {
  args: {
    nodeCount: 500,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Stress test with 500 nodes and 499 links. Performance overlay shows creation time and FPS.',
      },
    },
  },
};

export const Stress1000: Story = {
  args: {
    nodeCount: 1000,
  },
  parameters: {
    docs: {
      description: {
        story: 'Stress test with 1000 nodes and 999 links. Higher load for performance analysis.',
      },
    },
  },
};

export const Stress10000: Story = {
  args: {
    nodeCount: 10000,
  },
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: {
      description: {
        story:
          'Extreme stress test with 10000 nodes and 9999 links. May cause UI slowdown. Chromatic snapshots disabled.',
      },
    },
  },
};

export const Stress100000: Story = {
  args: {
    nodeCount: 100000,
  },
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: {
      description: {
        story:
          'Maximum stress test with 100000 nodes and 99999 links. Use LOD and viewport culling for acceptable performance. Chromatic snapshots disabled.',
      },
    },
  },
};
