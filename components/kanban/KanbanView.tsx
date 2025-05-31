import React from 'react';
import KanbanBoard from './KanbanBoard';
import { ProjectState, Task, TaskType } from '@/types/database';

interface KanbanViewProps {
  states: ProjectState[];
  tasks: Task[];
  taskTypes: TaskType[];
  groupedTasks: Record<string, Task[]>;
  handleDragStart: (e: React.DragEvent, taskId: string, stateId: string, taskTypeId: string | null) => void;
  handleDragEnd: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent, stateId: string) => void;
  handleDrop: (e: React.DragEvent, stateId: string) => void;
  validDropStates: string[];
  draggedTaskId: string | null;
  handleDeleteTask: (taskId: string) => void;
  getNextValidStates: (task: Task, forDragAndDrop?: boolean) => ProjectState[];
}

/**
 * KanbanView Component
 * 
 * A container component that handles the rendering of the appropriate Kanban board view
 * based on whether the project has workflow states configured.
 * 
 * Features:
 * - Automatically selects between workflow-based or legacy Kanban views
 * - Passes all necessary props to the selected component
 * - Provides consistent Kanban experience regardless of project configuration
 */
const KanbanView: React.FC<KanbanViewProps> = ({
  states,
  tasks,
  taskTypes,
  groupedTasks,
  handleDragStart,
  handleDragEnd,
  handleDragOver,
  handleDrop,
  validDropStates,
  draggedTaskId,
  handleDeleteTask,
  getNextValidStates
}) => {
  // Use workflow-based kanban if states are available
  if (states.length > 0) {
    return (
      <KanbanBoard
        states={states}
        tasks={tasks}
        taskTypes={taskTypes}
        groupedTasks={groupedTasks}
        handleDragStart={handleDragStart}
        handleDragEnd={handleDragEnd}
        handleDragOver={handleDragOver}
        handleDrop={handleDrop}
        validDropStates={validDropStates}
        draggedTaskId={draggedTaskId}
        handleDeleteTask={handleDeleteTask}
      />
    );
  } else {
    // No workflow states configured - show empty state
    return (
      <div className="text-center py-10">
        <p className="text-zinc-600 dark:text-zinc-400">
          No workflow states configured. Please set up workflow states in project settings.
        </p>
      </div>
    );
  }
};

export default KanbanView;