import type { TreeNode, Mapping } from './models/field-mapper.model';

export const DEMO_SOURCES_TREE: TreeNode = {
  id: 'sources-root',
  label: 'Sources',
  isLeaf: false,
  children: [
    {
      id: 'sources-group-1',
      label: 'Group A',
      isLeaf: false,
      children: [
        {
          id: 'src-1',
          label: 'Item 1',
          isLeaf: true,
          columns: ['id', 'name', 'email', 'role'],
        },
        {
          id: 'src-2',
          label: 'Item 2',
          isLeaf: true,
          columns: ['2', 'Jane', 'jane@example.com', 'user'],
        },
      ],
    },
    {
      id: 'sources-group-2',
      label: 'Group B',
      isLeaf: false,
      children: [
        {
          id: 'src-3',
          label: 'Item 3',
          isLeaf: true,
          columns: ['3', 'Bob', 'bob@example.com', 'admin'],
        },
      ],
    },
  ],
};

export const DEMO_RECEIVERS_TREE: TreeNode = {
  id: 'receivers-root',
  label: 'Receivers',
  isLeaf: false,
  children: [
    {
      id: 'receivers-group-1',
      label: 'Targets',
      isLeaf: false,
      children: [
        {
          id: 'tgt-1',
          label: 'Field A',
          isLeaf: true,
          columns: ['userId', 'fullName', 'email', 'type'],
        },
        {
          id: 'tgt-2',
          label: 'Field B',
          isLeaf: true,
          columns: ['', '', '', ''],
        },
      ],
    },
  ],
};

export const DEMO_MAPPINGS: Mapping[] = [
  { sourceLeafId: 'src-1', targetLeafId: 'tgt-1' },
  { sourceLeafId: 'src-2', targetLeafId: 'tgt-1' },
];
