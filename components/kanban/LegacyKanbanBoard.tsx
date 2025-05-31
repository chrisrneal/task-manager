import React from 'react';
import Link from 'next/link';
import { Task, TaskType, ProjectState } from '@/types/database';

interface LegacyKanbanBoardProps {
  tasks: Task[];
  taskTypes: TaskType[];
  states: ProjectState[];
  groupedTasks: Record<string, Task[]>;
  TASK_STATUSES: {
    TODO: string;
    IN_PROGRESS: string;
    DONE: string;
  };
  handleToggleTaskStatus: (taskId: string, currentStatus: string) => void;
  handleDeleteTask: (taskId: string) => void;
  getNextValidStates: (task: Task, forDragAndDrop?: boolean) => ProjectState[];
}

/**
 * LegacyKanbanBoard Component
 * 
 * This component is deprecated and no longer used as the system now relies 
 * entirely on workflow states instead of built-in status fields.
 */
const LegacyKanbanBoard: React.FC<LegacyKanbanBoardProps> = () => {
  return (
    <div className="text-center py-10">
      <p className="text-zinc-600 dark:text-zinc-400">
        Legacy Kanban view is no longer supported. Please configure workflow states for your project.
      </p>
    </div>
  );
};

export default LegacyKanbanBoard;
