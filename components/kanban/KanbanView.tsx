import React from 'react';
import KanbanBoard from './KanbanBoard';
import LegacyKanbanBoard from './LegacyKanbanBoard';
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
  handleToggleTaskStatus: (taskId: string, currentStatus: string) => void;
  getNextValidStates: (task: Task, forDragAndDrop?: boolean) => ProjectState[];
  TASK_STATUSES: {
    TODO: string;
    IN_PROGRESS: string;
    DONE: string;
  };
}

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