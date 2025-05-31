import React, { useState } from 'react';
import Link from 'next/link';
import { ProjectState, Task, TaskType, ProjectMemberWithUser } from '@/types/database';

interface KanbanBoardProps {
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
}

/**
 * KanbanBoard Component
 * 
 * A modern, grid-based Kanban board for viewing tasks organized by workflow states.
 * This component is used when a project has configured workflow states.
 * 
 * Features:
 * - Responsive grid layout (1 column on mobile, 2 on medium screens, 3 on large screens)
 * - Visual distinction of different task priorities with colored borders
 * - Drag and drop support with visual feedback
 * - Compact but informative task cards with tags for priority, due date, and task type
 */
const KanbanBoard: React.FC<KanbanBoardProps> = ({
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
  handleDeleteTask
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {states.map(state => (
        <div 
          key={state.id} 
          className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg shadow p-4"
        >
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {state.name}
              <span className="ml-1 text-zinc-500 dark:text-zinc-400 text-xs">
                ({(groupedTasks[state.id] || []).length})
              </span>
            </h4>
          </div>
          
          {/* Drop zone for tasks - shows visual feedback when a valid drop target */}
          <div 
            className={`min-h-[150px] transition-colors duration-150 rounded-md ${
              validDropStates.includes(state.id) 
                ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-2 border-dashed border-indigo-300 dark:border-indigo-700' 
                : ''
            }`}
            onDragOver={(e) => handleDragOver(e, state.id)}
            onDrop={(e) => handleDrop(e, state.id)}
          >
            {(groupedTasks[state.id] || []).length === 0 ? (
              <div className="h-full flex items-center justify-center p-4">
                <p className="text-zinc-500 dark:text-zinc-500 text-sm italic">
                  No tasks in this state
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {(groupedTasks[state.id] || []).map(task => (
                  <div
                    key={task.id}
                    className={`border rounded-md p-3 bg-white dark:bg-zinc-800 dark:border-zinc-700 
                      shadow-sm hover:shadow transition-all cursor-move
                      ${draggedTaskId === task.id ? 'opacity-50 border-indigo-300 dark:border-indigo-600' : ''}
                      ${task.priority === 'high' ? 'border-l-4 border-l-red-500' : 
                        task.priority === 'medium' ? 'border-l-4 border-l-yellow-500' : 
                        'border-l-4 border-l-green-500'}`}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, task.id, state.id, task.task_type_id)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="flex-grow">
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
                      
                      {/* Show description with 2-line limit */}
                      {task.description && (
                        <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      
                      {/* Task metadata as tags */}
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
                        
                        {task.assignee_id && (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded-full text-xs">
                            👤 {projectMembers.find(m => m.user_id === task.assignee_id)?.name || 'Unknown'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default KanbanBoard;