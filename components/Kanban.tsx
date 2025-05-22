import React, { useState } from 'react'
import { 
  DndContext, 
  closestCenter,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  DragStartEvent,
  DragEndEvent
} from '@dnd-kit/core'
import { Task } from '@/types/database'
import { useTaskContext, TASK_STATUSES } from '@/components/TaskProvider'

// Define the column structure
const COLUMNS = [
  { id: TASK_STATUSES.BACKLOG, title: 'Backlog' },
  { id: TASK_STATUSES.TODO, title: 'To Do' },
  { id: TASK_STATUSES.IN_PROGRESS, title: 'In Progress' },
  { id: TASK_STATUSES.BLOCKED, title: 'Blocked' },
  { id: TASK_STATUSES.DONE, title: 'Done' }
]

// Task card component
const TaskCard = ({ 
  task, 
  onEdit, 
  onDelete 
}: { 
  task: Task,
  onEdit: (task: Task) => void,
  onDelete: (taskId: string) => void
}) => {
  return (
    <div 
      className="border rounded-md p-3 mb-2 bg-white dark:bg-zinc-800 dark:border-zinc-700 flex flex-col cursor-move"
      data-task-id={task.id}
    >
      <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{task.name}</h3>
      
      {task.description && (
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1 line-clamp-2">
          {task.description}
        </p>
      )}
      
      <div className="flex items-center justify-between mt-2 text-xs text-zinc-500">
        <div className="flex items-center space-x-2">
          <span className={`
            px-1.5 py-0.5 rounded-full
            ${task.priority === 'high' 
              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
              : task.priority === 'medium'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            }
          `}>
            {task.priority}
          </span>
          
          {task.due_date && (
            <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
          )}
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(task)
            }}
            className="p-1 hover:text-zinc-700 dark:hover:text-zinc-300"
            aria-label={`Edit ${task.name}`}
          >
            ✎
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(task.id)
            }}
            className="p-1 hover:text-red-500"
            aria-label={`Delete ${task.name}`}
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  )
}

// Droppable column component
const TaskColumn = ({ 
  title, 
  tasks, 
  status,
  onEdit,
  onDelete
}: { 
  title: string, 
  tasks: Task[], 
  status: string,
  onEdit: (task: Task) => void,
  onDelete: (taskId: string) => void
}) => {
  return (
    <div 
      className="flex-1 min-w-[250px] max-w-[350px] bg-gray-50 dark:bg-zinc-900 rounded-md p-3"
      data-column-id={status}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">{title}</h3>
        <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-zinc-800 rounded-full">
          {tasks.length}
        </span>
      </div>
      
      <div className="min-h-[200px]">
        {tasks.map(task => (
          <TaskCard 
            key={task.id} 
            task={task} 
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}

// Kanban board component
interface KanbanProps {
  onEditTask: (task: Task) => void
}

const Kanban: React.FC<KanbanProps> = ({ onEditTask }) => {
  const { tasks, isLoading, error, updateTask, deleteTask } = useTaskContext()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  
  // Group tasks by status
  const groupedTasks = COLUMNS.reduce((acc, column) => {
    acc[column.id] = tasks.filter(task => task.status === column.id)
    return acc
  }, {} as Record<string, Task[]>)
  
  // Configure sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance before activation
      },
    })
  )
  
  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.data.current?.taskId || event.active.id.toString()
    const task = tasks.find(t => t.id === taskId)
    
    if (task) {
      setActiveTask(task)
      setIsDragging(true)
    }
  }
  
  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    setIsDragging(false)
    setActiveTask(null)
    
    const taskId = event.active.data.current?.taskId || event.active.id.toString()
    const task = tasks.find(t => t.id === taskId)
    
    // Get the destination column ID
    const overId = event.over?.id.toString()
    if (!task || !overId || task.status === overId) return
    
    try {
      // Update the task with the new status
      await updateTask(task.id, { status: overId })
    } catch (error) {
      console.error('Error moving task:', error)
    }
  }
  
  // Handle task edit
  const handleEdit = (task: Task) => {
    onEditTask(task)
  }
  
  // Handle task delete
  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return
    }
    
    try {
      await deleteTask(taskId)
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }
  
  if (isLoading) {
    return <div className="h-96 flex items-center justify-center">Loading tasks...</div>
  }
  
  if (error) {
    return <div className="text-red-500">Error: {error.message}</div>
  }
  
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex space-x-4 overflow-x-auto pb-4 -mx-4 px-4">
        {COLUMNS.map(column => (
          <TaskColumn
            key={column.id}
            title={column.title}
            tasks={groupedTasks[column.id] || []}
            status={column.id}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>
      
      {/* Drag overlay for visual feedback */}
      <DragOverlay>
        {activeTask && isDragging && (
          <div className="border rounded-md p-3 mb-2 bg-white dark:bg-zinc-800 dark:border-zinc-700 shadow-lg opacity-80 w-[250px]">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{activeTask.name}</h3>
            
            {activeTask.description && (
              <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1 line-clamp-2">
                {activeTask.description}
              </p>
            )}
            
            <div className="flex items-center mt-2 text-xs text-zinc-500">
              <span className={`
                px-1.5 py-0.5 rounded-full mr-2
                ${activeTask.priority === 'high' 
                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
                  : activeTask.priority === 'medium'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                }
              `}>
                {activeTask.priority}
              </span>
              
              {activeTask.due_date && (
                <span>Due: {new Date(activeTask.due_date).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

export default Kanban