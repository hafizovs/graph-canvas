import type { Meta, StoryObj } from '@storybook/angular';
import { fn } from 'storybook/test';
import { GraphToolbarComponent } from './graph-toolbar.component';

const meta: Meta<GraphToolbarComponent> = {
  title: 'Graph Editor/Graph Toolbar',
  component: GraphToolbarComponent,
  tags: ['autodocs'],
  args: {
    addNode: fn(),
    deleteSelection: fn(),
    rotateCw: fn(),
    rotateCcw: fn(),
    group: fn(),
    ungroup: fn(),
    panToolToggle: fn(),
    zoomIn: fn(),
    zoomOut: fn(),
    resetZoom: fn(),
    fitToView: fn(),
    zoomToSelection: fn(),
    snapToGridToggle: fn(),
    saveRequest: fn(),
    loadFromStorage: fn(),
    bringToFront: fn(),
    sendToBack: fn(),
    lockUnlock: fn(),
    linkRoutingChange: fn(),
    align: fn(),
  },
};

export default meta;
type Story = StoryObj<GraphToolbarComponent>;

export const Default: Story = {
  args: {
    disabled: false,
    hasSelection: false,
    hasNodeSelection: false,
    canGroup: false,
    canUngroup: false,
    canAlign: false,
    canDistribute: false,
    snapToGridEnabled: true,
    linkRouting: 'orthogonal',
    hasLockedSelection: false,
    panToolActive: false,
    zoomPercent: 100,
  },
};

export const WithSelection: Story = {
  args: {
    ...Default.args,
    hasSelection: true,
    hasNodeSelection: true,
  },
};

export const CanGroup: Story = {
  args: {
    ...Default.args,
    hasSelection: true,
    hasNodeSelection: true,
    canGroup: true,
  },
};

export const CanUngroup: Story = {
  args: {
    ...Default.args,
    hasSelection: true,
    hasNodeSelection: true,
    canUngroup: true,
  },
};

export const CanAlign: Story = {
  args: {
    ...Default.args,
    hasSelection: true,
    hasNodeSelection: true,
    canAlign: true,
  },
};

export const Disabled: Story = {
  args: {
    ...Default.args,
    disabled: true,
  },
};

export const SnapOff: Story = {
  args: {
    ...Default.args,
    snapToGridEnabled: false,
  },
};

export const LinkRoutingStraight: Story = {
  args: {
    ...Default.args,
    linkRouting: 'straight',
  },
};

export const LockedSelection: Story = {
  args: {
    ...Default.args,
    hasSelection: true,
    hasNodeSelection: true,
    hasLockedSelection: true,
  },
};

export const AllFeaturesVisible: Story = {
  args: {
    ...Default.args,
    hasSelection: true,
    hasNodeSelection: true,
    canGroup: true,
    canAlign: true,
    canDistribute: true,
    toolbarConfig: {
      visible: true,
      addNode: true,
      delete: true,
      rotate: true,
      align: true,
      groupUngroup: true,
      bringToFrontSendToBack: true,
      lockUnlock: true,
      connectorStyle: true,
      zoom: true,
      panTool: true,
      zoomReset100: true,
      zoomIndicator: true,
      tooltips: true,
      snapToGrid: true,
      examples: true,
      saveLoad: true,
    },
  },
};
