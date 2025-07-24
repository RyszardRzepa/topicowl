export type ArticleStatus = 'idea' | 'to_generate' | 'generating' | 'wait_for_publish' | 'published';

export const STATUS_FLOW: Record<ArticleStatus, ArticleStatus[]> = {
  idea: ['to_generate'],
  to_generate: ['generating'], // Only through generate button, not drag
  generating: ['wait_for_publish'], // Automatically moved by system after generation
  wait_for_publish: ['published'],
  published: [], // Cannot be moved
};

export const isValidStatusTransition = (from: ArticleStatus, to: ArticleStatus): boolean => {
  return STATUS_FLOW[from].includes(to);
};

export const isDraggable = (status: ArticleStatus): boolean => {
  // Only allow dragging for idea and wait_for_publish status
  return status === 'idea' || status === 'wait_for_publish';
};

export const isDroppable = (fromStatus: ArticleStatus, toStatus: ArticleStatus): boolean => {
  return isValidStatusTransition(fromStatus, toStatus);
};

export const getStatusDisplayName = (status: ArticleStatus): string => {
  const displayNames: Record<ArticleStatus, string> = {
    idea: 'Ideas',
    to_generate: 'To Generate',
    generating: 'Generating',
    wait_for_publish: 'Wait for Publish',
    published: 'Published',
  };
  return displayNames[status];
};

export const getStatusColor = (status: ArticleStatus): string => {
  const colors: Record<ArticleStatus, string> = {
    idea: '#6B7280', // gray
    to_generate: '#F59E0B', // yellow
    generating: '#3B82F6', // blue
    wait_for_publish: '#8B5CF6', // purple
    published: '#10B981', // green
  };
  return colors[status];
};
