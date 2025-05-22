import React, { useState, useCallback, useEffect } from 'react'
import { Task } from '@/types/database'
import { useTaskContext, TASK_STATUSES } from '@/components/TaskProvider'

// Define column configuration
interface Column {
  id: keyof Task | 'actions'
  label: string
  visible: boolean
  sortable: boolean
  render?: (task: Task) => React.ReactNode
}

// Default configuration for columns
const defaultColumns: Column[] = [
  { id: 'name', label: 'Name', visible: true, sortable: true },
  { id: 'description', label: 'Description', visible: true, sortable: false },
  { id: 'status', label: 'Status', visible: true, sortable: true },
  { id: 'priority', label: 'Priority', visible: true, sortable: true },
  { id: 'due_date', label: 'Due Date', visible: true, sortable: true },
  { id: 'updated_at', label: 'Last Updated', visible: true, sortable: true },
  { id: 'actions', label: 'Actions', visible: true, sortable: false }
]

// Status display mapping
const statusLabels: Record<string, string> = {
  [TASK_STATUSES.BACKLOG]: 'Backlog',
  [TASK_STATUSES.TODO]: 'To Do',
  [TASK_STATUSES.IN_PROGRESS]: 'In Progress',
  [TASK_STATUSES.BLOCKED]: 'Blocked',
  [TASK_STATUSES.DONE]: 'Done'
}

// Sort type
type SortConfig = {
  key: keyof Task
  direction: 'asc' | 'desc'
}

// Component for inline editing of task name
const InlineEdit = ({ 
  value, 
  onSave,
  isEditing,
  onEditToggle
}: { 
  value: string,
  onSave: (value: string) => void,
  isEditing: boolean,
  onEditToggle: () => void
}) => {
  const [inputValue, setInputValue] = useState(value)
  
  useEffect(() => {
    setInputValue(value)
  }, [value])
  
  const handleSave = () => {
    if (inputValue.trim() !== '') {
      onSave(inputValue)
    } else {
      setInputValue(value)
    }
    onEditToggle()
  }
  
  if (!isEditing) {
    return (
      <div className="flex items-center">
        <span>{value}</span>
        <button 
          onClick={onEditToggle}
          className="ml-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          aria-label="Edit"
        >
          ✎
        </button>
      </div>
    )
  }
  
  return (
    <div className="flex items-center">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="border rounded p-1 mr-1 text-sm"
        autoFocus
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave()
          if (e.key === 'Escape') {
            setInputValue(value)
            onEditToggle()
          }
        }}
      />
    </div>
  )
}

// Column configurator component
const ColumnConfigurator = ({ 
  columns, 
  onChange 
}: { 
  columns: Column[], 
  onChange: (columns: Column[]) => void 
}) => {
  const [isOpen, setIsOpen] = useState(false)
  
  // Handle toggling a column's visibility
  const toggleColumn = (id: string) => {
    const updated = columns.map(col => 
      col.id === id ? { ...col, visible: !col.visible } : col
    )
    onChange(updated)
  }
  
  // Handle reordering columns
  const moveColumn = (id: string, direction: 'up' | 'down') => {
    const index = columns.findIndex(col => col.id === id)
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === columns.length - 1)
    ) {
      return
    }
    
    const newIndex = direction === 'up' ? index - 1 : index + 1
    const updated = [...columns]
    const [removed] = updated.splice(index, 1)
    updated.splice(newIndex, 0, removed)
    
    onChange(updated)
  }
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1 bg-gray-200 dark:bg-zinc-700 rounded-md text-sm"
      >
        Configure Columns
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-md shadow-lg p-3 z-10 w-64">
          <h4 className="text-sm font-medium mb-2">Column Settings</h4>
          
          <ul className="space-y-2">
            {columns.map(column => (
              <li key={column.id.toString()} className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id={`col-${column.id}`}
                    checked={column.visible}
                    onChange={() => toggleColumn(column.id.toString())}
                    className="mr-2"
                  />
                  <label htmlFor={`col-${column.id}`} className="text-sm">
                    {column.label}
                  </label>
                </div>
                
                <div className="flex space-x-1">
                  <button
                    onClick={() => moveColumn(column.id.toString(), 'up')}
                    className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-1"
                    disabled={columns.indexOf(column) === 0}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveColumn(column.id.toString(), 'down')}
                    className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-1"
                    disabled={columns.indexOf(column) === columns.length - 1}
                  >
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ul>
          
          <div className="flex justify-end mt-3">
            <button
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// List view component
interface ListViewProps {
  onEditTask: (task: Task) => void
}

const ListView: React.FC<ListViewProps> = ({ onEditTask }) => {
  const { tasks, isLoading, error, updateTask, deleteTask } = useTaskContext()
  const [columns, setColumns] = useState<Column[]>(defaultColumns)
  const [filter, setFilter] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'updated_at',
    direction: 'desc'
  })
  
  // Get visible columns
  const visibleColumns = columns.filter(col => col.visible)
  
  // Handle sort request
  const requestSort = (key: keyof Task) => {
    // Only sort if the column is sortable
    if (!columns.find(col => col.id === key)?.sortable) return
    
    setSortConfig(current => {
      // If we're already sorting by this key, toggle direction
      if (current.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc'
        }
      }
      
      // Otherwise, sort ascending by the new key
      return { key, direction: 'asc' }
    })
  }
  
  // Sort and filter tasks
  const sortedAndFilteredTasks = React.useMemo(() => {
    // First, filter the tasks
    let filtered = tasks
    
    if (filter) {
      const lowerFilter = filter.toLowerCase()
      filtered = filtered.filter(task => 
        task.name.toLowerCase().includes(lowerFilter) ||
        (task.description && task.description.toLowerCase().includes(lowerFilter))
      )
    }
    
    // Then sort them
    return [...filtered].sort((a, b) => {
      const key = sortConfig.key
      
      // Special handling for dates
      if (key === 'due_date' || key === 'created_at' || key === 'updated_at') {
        const aValue = a[key] ? new Date(a[key] as string).getTime() : 0
        const bValue = b[key] ? new Date(b[key] as string).getTime() : 0
        
        return sortConfig.direction === 'asc'
          ? aValue - bValue
          : bValue - aValue
      }
      
      // Normal string comparison
      const aValue = a[key] || ''
      const bValue = b[key] || ''
      
      if (sortConfig.direction === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })
  }, [tasks, sortConfig, filter])
  
  // Handle name edit
  const handleNameEdit = async (taskId: string, newName: string) => {
    try {
      await updateTask(taskId, { name: newName })
    } catch (error) {
      console.error('Error updating task name:', error)
    }
  }
  
  // Handle status change
  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await updateTask(taskId, { status: newStatus })
    } catch (error) {
      console.error('Error updating task status:', error)
    }
  }
  
  // Handle priority change
  const handlePriorityChange = async (taskId: string, newPriority: string) => {
    try {
      await updateTask(taskId, { priority: newPriority })
    } catch (error) {
      console.error('Error updating task priority:', error)
    }
  }
  
  // Handle delete
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
  
  // Cell renderers
  const cellRenderers: Record<string, (task: Task) => React.ReactNode> = {
    name: (task) => (
      <InlineEdit
        value={task.name}
        onSave={(newName) => handleNameEdit(task.id, newName)}
        isEditing={editingTaskId === `name-${task.id}`}
        onEditToggle={() => setEditingTaskId(editingTaskId === `name-${task.id}` ? null : `name-${task.id}`)}
      />
    ),
    description: (task) => (
      task.description ? (
        <div className="max-w-xs truncate">{task.description}</div>
      ) : (
        <span className="text-zinc-400 dark:text-zinc-600">No description</span>
      )
    ),
    status: (task) => (
      <select
        value={task.status}
        onChange={(e) => handleStatusChange(task.id, e.target.value)}
        className="p-1 text-sm border rounded bg-white dark:bg-zinc-700 dark:border-zinc-600"
      >
        {Object.entries(statusLabels).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    ),
    priority: (task) => (
      <select
        value={task.priority}
        onChange={(e) => handlePriorityChange(task.id, e.target.value)}
        className="p-1 text-sm border rounded bg-white dark:bg-zinc-700 dark:border-zinc-600"
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    ),
    due_date: (task) => (
      task.due_date ? (
        <span>{new Date(task.due_date).toLocaleDateString()}</span>
      ) : (
        <span className="text-zinc-400 dark:text-zinc-600">No due date</span>
      )
    ),
    updated_at: (task) => (
      <span title={new Date(task.updated_at).toLocaleString()}>
        {new Date(task.updated_at).toLocaleDateString()}
      </span>
    ),
    actions: (task) => (
      <div className="flex space-x-2">
        <button
          onClick={() => onEditTask(task)}
          className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          aria-label={`Edit ${task.name}`}
        >
          ✎
        </button>
        <button
          onClick={() => handleDelete(task.id)}
          className="text-zinc-500 hover:text-red-500"
          aria-label={`Delete ${task.name}`}
        >
          🗑️
        </button>
      </div>
    )
  }
  
  if (isLoading) {
    return <div className="h-96 flex items-center justify-center">Loading tasks...</div>
  }
  
  if (error) {
    return <div className="text-red-500">Error: {error.message}</div>
  }
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Filter tasks..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1 pl-8 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
          />
          <span className="absolute left-2 top-2 text-zinc-400">🔍</span>
        </div>
        
        <ColumnConfigurator 
          columns={columns} 
          onChange={setColumns} 
        />
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
          <thead>
            <tr>
              {visibleColumns.map(column => (
                <th
                  key={column.id.toString()}
                  onClick={() => {
                    if (column.id !== 'actions' && column.sortable) {
                      requestSort(column.id as keyof Task)
                    }
                  }}
                  className={`
                    px-4 py-2 text-left text-sm font-medium text-zinc-600 dark:text-zinc-300
                    ${column.sortable ? 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800' : ''}
                  `}
                >
                  <div className="flex items-center">
                    {column.label}
                    {column.sortable && column.id === sortConfig.key && (
                      <span className="ml-1">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
            {sortedAndFilteredTasks.length === 0 ? (
              <tr>
                <td 
                  colSpan={visibleColumns.length} 
                  className="px-4 py-4 text-center text-zinc-500"
                >
                  No tasks found
                </td>
              </tr>
            ) : (
              sortedAndFilteredTasks.map(task => (
                <tr 
                  key={task.id}
                  className="hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  {visibleColumns.map(column => (
                    <td key={`${task.id}-${column.id}`} className="px-4 py-2">
                      {cellRenderers[column.id.toString()]
                        ? cellRenderers[column.id.toString()](task)
                        : task[column.id as keyof Task] as string}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ListView