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

const LegacyKanbanBoard: React.FC<LegacyKanbanBoardProps> = ({
  tasks,
  taskTypes,
  states,
  groupedTasks,
  TASK_STATUSES,
  handleToggleTaskStatus,
  handleDeleteTask,
  getNextValidStates
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* To Do Column */}
      <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            To Do
            <span className="ml-1 text-zinc-500 dark:text-zinc-400 text-xs">
              ({groupedTasks[TASK_STATUSES.TODO]?.length || 0})
            </span>
          </h4>
        </div>
        
        <div 
          className="min-h-[150px] transition-colors duration-150 rounded-md"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            try {
              const data = JSON.parse(e.dataTransfer.getData('text/plain'));
              const { taskId } = data;
              const taskToMove = tasks.find(t => t.id === taskId);
              if (taskToMove && taskToMove.status !== TASK_STATUSES.TODO) {
                // Check if this transition is valid according to workflow rules
                const validStates = getNextValidStates(taskToMove, true);
                const todoState = states.find(s => s.name.toLowerCase().includes('todo') || s.name.toLowerCase().includes('backlog'));
                
                // Only allow transition if it's valid in the workflow or if no workflow states defined
                if (!todoState || validStates.some(s => s.id === todoState.id) || validStates.length === states.length) {
                  handleToggleTaskStatus(taskId, taskToMove.status);
                } else {
                  console.warn('Invalid workflow transition attempted');
                }
              }
            } catch (err) {
              console.error('Error in drop handling:', err);
            }
          }}
        >
          {!groupedTasks[TASK_STATUSES.TODO] || groupedTasks[TASK_STATUSES.TODO].length === 0 ? (
            <div className="h-full flex items-center justify-center p-4">
              <p className="text-zinc-500 dark:text-zinc-500 text-sm italic">No tasks to do</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedTasks[TASK_STATUSES.TODO].map(task => (
                <div
                  key={task.id}
                  className={`border rounded-md p-3 bg-white dark:bg-zinc-800 dark:border-zinc-700 
                    shadow-sm hover:shadow transition-all cursor-move
                    ${task.priority === 'high' ? 'border-l-4 border-l-red-500' : 
                      task.priority === 'medium' ? 'border-l-4 border-l-yellow-500' : 
                      'border-l-4 border-l-green-500'}`}
                  draggable={true}
                >
                  <div className="flex justify-between items-start">
                    <h5 className="font-medium text-sm">
                      <Link href={`/tasks/${task.id}`} className="text-blue-600 hover:text-blue-800 cursor-pointer">
                        {task.name}
                      </Link>
                    </h5>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-zinc-400 hover:text-red-500 ml-2 text-sm"
                      aria-label={`Delete ${task.name}`}
                    >
                      🗑️
                    </button>
                  </div>
                  
                  {task.description && (
                    <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  
                  <div className="flex items-center mt-2 text-xs text-zinc-500 flex-wrap gap-1">
                    <span className={`px-1.5 py-0.5 rounded-full text-xs
                      ${task.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : 
                        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>
                      {task.priority}
                    </span>
                    
                    {task.due_date && (
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300 rounded-full text-xs">
                        Due: {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                    
                    {task.task_type_id && (
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-full text-xs">
                        {taskTypes.find(tt => tt.id === task.task_type_id)?.name || 'Unknown Type'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* In Progress Column */}
      <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            In Progress
            <span className="ml-1 text-zinc-500 dark:text-zinc-400 text-xs">
              ({groupedTasks[TASK_STATUSES.IN_PROGRESS]?.length || 0})
            </span>
          </h4>
        </div>
        
        <div 
          className="min-h-[150px] transition-colors duration-150 rounded-md"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            try {
              const data = JSON.parse(e.dataTransfer.getData('text/plain'));
              const { taskId } = data;
              const taskToMove = tasks.find(t => t.id === taskId);
              if (taskToMove && taskToMove.status !== TASK_STATUSES.IN_PROGRESS) {
                // Check if this transition is valid according to workflow rules
                const validStates = getNextValidStates(taskToMove, true);
                const inProgressState = states.find(s => s.name.toLowerCase().includes('progress') || s.name.toLowerCase().includes('doing'));
                
                // Only allow transition if it's valid in the workflow or if no workflow states defined
                if (!inProgressState || validStates.some(s => s.id === inProgressState.id) || validStates.length === states.length) {
                  // Update the task to "in progress"
                  handleToggleTaskStatus(taskId, taskToMove.status);
                } else {
                  console.warn('Invalid workflow transition attempted');
                }
              }
            } catch (err) {
              console.error('Error in drop handling:', err);
            }
          }}
        >
          {!groupedTasks[TASK_STATUSES.IN_PROGRESS] || groupedTasks[TASK_STATUSES.IN_PROGRESS].length === 0 ? (
            <div className="h-full flex items-center justify-center p-4">
              <p className="text-zinc-500 dark:text-zinc-500 text-sm italic">No tasks in progress</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedTasks[TASK_STATUSES.IN_PROGRESS].map(task => (
                <div
                  key={task.id}
                  className={`border rounded-md p-3 bg-white dark:bg-zinc-800 dark:border-zinc-700 
                    shadow-sm hover:shadow transition-all cursor-move
                    ${task.priority === 'high' ? 'border-l-4 border-l-red-500' : 
                      task.priority === 'medium' ? 'border-l-4 border-l-yellow-500' : 
                      'border-l-4 border-l-green-500'}`}
                  draggable={true}
                >
                  <div className="flex justify-between items-start">
                    <h5 className="font-medium text-sm">
                      <Link href={`/tasks/${task.id}`} className="text-blue-600 hover:text-blue-800 cursor-pointer">
                        {task.name}
                      </Link>
                    </h5>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-zinc-400 hover:text-red-500 ml-2 text-sm"
                      aria-label={`Delete ${task.name}`}
                    >
                      🗑️
                    </button>
                  </div>
                  
                  {task.description && (
                    <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  
                  <div className="flex items-center mt-2 text-xs text-zinc-500 flex-wrap gap-1">
                    <span className={`px-1.5 py-0.5 rounded-full text-xs
                      ${task.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : 
                        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>
                      {task.priority}
                    </span>
                    
                    {task.due_date && (
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300 rounded-full text-xs">
                        Due: {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                    
                    {task.task_type_id && (
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-full text-xs">
                        {taskTypes.find(tt => tt.id === task.task_type_id)?.name || 'Unknown Type'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Done Column */}
      <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Done
            <span className="ml-1 text-zinc-500 dark:text-zinc-400 text-xs">
              ({groupedTasks[TASK_STATUSES.DONE]?.length || 0})
            </span>
          </h4>
        </div>
        
        <div 
          className="min-h-[150px] transition-colors duration-150 rounded-md"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            try {
              const data = JSON.parse(e.dataTransfer.getData('text/plain'));
              const { taskId } = data;
              const taskToMove = tasks.find(t => t.id === taskId);
              if (taskToMove && taskToMove.status !== TASK_STATUSES.DONE) {
                // Check if this transition is valid according to workflow rules
                const validStates = getNextValidStates(taskToMove, true);
                const doneState = states.find(s => s.name.toLowerCase().includes('done') || s.name.toLowerCase().includes('complete'));
                
                // Only allow transition if it's valid in the workflow or if no workflow states defined
                if (!doneState || validStates.some(s => s.id === doneState.id) || validStates.length === states.length) {
                  handleToggleTaskStatus(taskId, taskToMove.status);
                } else {
                  console.warn('Invalid workflow transition attempted');
                }
              }
            } catch (err) {
              console.error('Error in drop handling:', err);
            }
          }}
        >
          {!groupedTasks[TASK_STATUSES.DONE] || groupedTasks[TASK_STATUSES.DONE].length === 0 ? (
            <div className="h-full flex items-center justify-center p-4">
              <p className="text-zinc-500 dark:text-zinc-500 text-sm italic">No completed tasks</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedTasks[TASK_STATUSES.DONE].map(task => (
                <div
                  key={task.id}
                  className={`border rounded-md p-3 bg-white dark:bg-zinc-800 dark:border-zinc-700 
                    shadow-sm hover:shadow transition-all cursor-move opacity-70
                    ${task.priority === 'high' ? 'border-l-4 border-l-red-500' : 
                      task.priority === 'medium' ? 'border-l-4 border-l-yellow-500' : 
                      'border-l-4 border-l-green-500'}`}
                  draggable={true}
                >
                  <div className="flex justify-between items-start">
                    <h5 className="font-medium text-sm line-through">
                      <Link href={`/tasks/${task.id}`} className="text-blue-600 hover:text-blue-800 cursor-pointer">
                        {task.name}
                      </Link>
                    </h5>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-zinc-400 hover:text-red-500 ml-2 text-sm"
                      aria-label={`Delete ${task.name}`}
                    >
                      🗑️
                    </button>
                  </div>
                  
                  {task.description && (
                    <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1 line-clamp-2 line-through">
                      {task.description}
                    </p>
                  )}
                  
                  <div className="flex items-center mt-2 text-xs text-zinc-500 flex-wrap gap-1">
                    <span className={`px-1.5 py-0.5 rounded-full text-xs
                      ${task.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : 
                        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>
                      {task.priority}
                    </span>
                    
                    {task.due_date && (
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300 rounded-full text-xs">
                        Due: {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                    
                    {task.task_type_id && (
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-full text-xs">
                        {taskTypes.find(tt => tt.id === task.task_type_id)?.name || 'Unknown Type'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LegacyKanbanBoard;