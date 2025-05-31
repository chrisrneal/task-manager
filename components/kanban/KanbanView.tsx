import React from 'react';
import KanbanBoard from './KanbanBoard';
import LegacyKanbanBoard from './LegacyKanbanBoard';
import { ProjectState, Task, TaskType, ProjectMemberWithUser } from '@/types/database';

interface KanbanViewProps {
  states: ProjectState[];
  tasks: Task[];
  taskTypes: TaskType[];
  projectMembers: ProjectMemberWithUser[];
  groupedTasks: Record<string, Task[]>;
  handleDragStart: (e: React.DragEvent, taskId: string, stateId: string, taskTypeId: string | null) => void;
  handleDragEnd: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent, stateId: string) => void;
  handleDrop: (e: React.DragEvent, stateId: string) => void;
  validDropStates: string[];
  draggedTaskId: string | null;
  handleDeleteTask: (taskId: string) => void;
  handleToggleTaskStatus: (taskId: string, currentStatus: string) => void;
  getNextValidStates: (task: Task, forDragAndDrop?: boolean) => ProjectState[];
  TASK_STATUSES: {
    TODO: string;
    IN_PROGRESS: string;
    DONE: string;
  };
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
  projectMembers,
  groupedTasks,
  handleDragStart,
  handleDragEnd,
  handleDragOver,
  handleDrop,
  validDropStates,
  draggedTaskId,
  handleDeleteTask,
  handleToggleTaskStatus,
  getNextValidStates,
  TASK_STATUSES
}) => {
  // Use workflow-based kanban if states are available, otherwise fall back to legacy view
  if (states.length > 0) {
    return (
      <KanbanBoard
        states={states}
        tasks={tasks}
        taskTypes={taskTypes}
        projectMembers={projectMembers}
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
    return (
      <LegacyKanbanBoard
        tasks={tasks}
        taskTypes={taskTypes}
        states={states}
        projectMembers={projectMembers}
        groupedTasks={groupedTasks}
        TASK_STATUSES={TASK_STATUSES}
        handleToggleTaskStatus={handleToggleTaskStatus}
        handleDeleteTask={handleDeleteTask}
        getNextValidStates={getNextValidStates}
      />
    );
  }
};

export default KanbanView;