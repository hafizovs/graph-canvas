import type { Meta, StoryObj } from '@storybook/angular';
import { EditorPageComponent } from './editor-page.component';

const meta: Meta<EditorPageComponent> = {
  title: 'Graph Editor/Editor Page',
  component: EditorPageComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<EditorPageComponent>;

export const Default: Story = {
  args: {},
};
