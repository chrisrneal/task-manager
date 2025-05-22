import React, { createContext, useContext, useCallback, useState, useEffect, ReactNode } from 'react'
import useSWR, { mutate } from 'swr'
import { supabase } from '@/utils/supabaseClient'
import { Task } from '@/types/database'
import { v4 as uuidv4 } from 'uuid'

// Task statuses
export const TASK_STATUSES = {
  BACKLOG: 'backlog',
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  BLOCKED: 'blocked',
  DONE: 'done',
}

// Define the context type
interface TaskContextType {
  tasks: Task[]
  isLoading: boolean
  error: Error | null
  mutateTask: (updatedTask: Task, optimistic?: boolean) => Promise<void>
  createTask: (newTask: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => Promise<Task>
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<Task>
  deleteTask: (taskId: string) => Promise<void>
  toggleTaskStatus: (taskId: string, status: string) => Promise<Task>
}

// Create context with a default value
const TaskContext = createContext<TaskContextType | undefined>(undefined)

// Provider props
interface TaskProviderProps {
  projectId: string
  userId: string
  children: ReactNode
}

// Fetcher function for SWR
const fetcher = async (url: string) => {
  // Get the session token
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  if (!token) {
    throw new Error('No authentication token available')
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    }
  })

  if (!response.ok) {
    throw new Error(`Error: ${response.status}`)
  }

  const result = await response.json()
  return result.data
}

export const TaskProvider: React.FC<TaskProviderProps> = ({ projectId, userId, children }) => {
  const [optimisticTasks, setOptimisticTasks] = useState<Task[]>([])
  const [hasOptimisticUpdate, setHasOptimisticUpdate] = useState(false)

  // Use SWR for fetching tasks
  const { data: fetchedTasks, error, isLoading, mutate: mutateTasks } = useSWR<Task[]>(
    projectId ? `/api/tasks?projectId=${projectId}` : null,
    fetcher
  )

  // Merge fetched tasks with optimistic tasks
  const tasks = hasOptimisticUpdate ? optimisticTasks : fetchedTasks || []

  // Initialize optimistic tasks with fetched tasks
  useEffect(() => {
    if (fetchedTasks && !hasOptimisticUpdate) {
      setOptimisticTasks(fetchedTasks)
    }
  }, [fetchedTasks, hasOptimisticUpdate])

  // Subscribe to realtime updates
  useEffect(() => {
    if (!projectId) return

    console.log('Setting up realtime subscription for tasks in TaskProvider...')

    const subscription = supabase
      .channel(`tasks:project_id=eq.${projectId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tasks',
        filter: `project_id=eq.${projectId}`
      }, (payload) => {
        console.log('Realtime task update in TaskProvider:', payload)
        
        // Mutate the SWR cache
        mutateTasks(async (currentTasks) => {
          if (!currentTasks) return []

          // Handle different events
          switch (payload.eventType) {
            case 'INSERT':
              // Only add if it's not already in the list
              if (!currentTasks.some(t => t.id === payload.new.id)) {
                return [payload.new as Task, ...currentTasks]
              }
              return currentTasks
            case 'UPDATE':
              return currentTasks.map(t => 
                t.id === payload.new.id ? payload.new as Task : t
              )
            case 'DELETE':
              return currentTasks.filter(t => t.id !== payload.old.id)
            default:
              return currentTasks
          }
        }, { revalidate: false }) // Don't revalidate after mutation
        
        // Reset optimistic state if we get an update
        setHasOptimisticUpdate(false)
      })
      .subscribe()
    
    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(subscription)
    }
  }, [projectId, mutateTasks])

  // Optimistic mutation handler
  const mutateTask = useCallback(async (updatedTask: Task, optimistic = true) => {
    if (optimistic) {
      setHasOptimisticUpdate(true)
      setOptimisticTasks(prev => 
        prev.map(t => t.id === updatedTask.id ? updatedTask : t)
      )
    }

    // Update SWR cache
    mutateTasks(async (currentTasks) => {
      if (!currentTasks) return []
      return currentTasks.map(t => t.id === updatedTask.id ? updatedTask : t)
    }, false) // Don't revalidate after mutation
  }, [mutateTasks])

  // Create a task
  const createTask = useCallback(async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    const traceId = uuidv4()
    console.log(`[${traceId}] Creating task: ${taskData.name}`)
    
    // Get the session token
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    
    if (!token) {
      throw new Error('No authentication token available')
    }

    // Create a temporary ID
    const tempId = `temp-${Date.now()}`
    
    // Create optimistic task
    const optimisticTask: Task = {
      id: tempId,
      ...taskData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Add optimistically to the UI
    setHasOptimisticUpdate(true)
    setOptimisticTasks(prev => [optimisticTask, ...prev])

    try {
      // Save to the database via API
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(taskData)
      })
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }
      
      const result = await response.json()
      const createdTask = result.data
      
      console.log(`[${traceId}] Task created successfully: ${createdTask.id}`)

      // Replace the optimistic task with the real one
      setOptimisticTasks(prev => prev.map(t => 
        t.id === tempId ? createdTask : t
      ))

      // Update the SWR cache
      mutateTasks()
      setHasOptimisticUpdate(false)
      
      return createdTask
    } catch (error) {
      console.error('Error creating task:', error)
      
      // Remove the optimistic update
      setOptimisticTasks(prev => prev.filter(t => t.id !== tempId))
      setHasOptimisticUpdate(false)
      
      throw error
    }
  }, [projectId, userId, mutateTasks])

  // Update a task
  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    const traceId = uuidv4()
    console.log(`[${traceId}] Updating task: ${taskId}`)
    
    // Get the session token
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    
    if (!token) {
      throw new Error('No authentication token available')
    }

    // Find the task to update
    const taskToUpdate = tasks.find(t => t.id === taskId)
    if (!taskToUpdate) {
      throw new Error('Task not found')
    }

    // Create updated task
    const updatedTask = { 
      ...taskToUpdate, 
      ...updates,
      updated_at: new Date().toISOString() 
    }

    // Update optimistically
    setHasOptimisticUpdate(true)
    setOptimisticTasks(prev => 
      prev.map(t => t.id === taskId ? updatedTask : t)
    )

    try {
      // Save to the database via API
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          name: updatedTask.name,
          description: updatedTask.description,
          status: updatedTask.status,
          priority: updatedTask.priority,
          due_date: updatedTask.due_date
        })
      })
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }
      
      const result = await response.json()
      console.log(`[${traceId}] Task updated successfully: ${result.data.id}`)
      
      // Update the SWR cache
      mutateTasks()
      setHasOptimisticUpdate(false)
      
      return result.data
    } catch (error) {
      console.error('Error updating task:', error)
      
      // Revert optimistic update
      setOptimisticTasks(prev => 
        prev.map(t => t.id === taskId ? taskToUpdate : t)
      )
      setHasOptimisticUpdate(false)
      
      throw error
    }
  }, [tasks, mutateTasks])

  // Delete a task
  const deleteTask = useCallback(async (taskId: string) => {
    const traceId = uuidv4()
    console.log(`[${traceId}] Deleting task: ${taskId}`)
    
    // Get the session token
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    
    if (!token) {
      throw new Error('No authentication token available')
    }

    // Find the task to delete
    const taskToDelete = tasks.find(t => t.id === taskId)
    if (!taskToDelete) {
      throw new Error('Task not found')
    }

    // Remove optimistically
    setHasOptimisticUpdate(true)
    setOptimisticTasks(prev => prev.filter(t => t.id !== taskId))

    try {
      // Delete from the database
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      })
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }
      
      console.log(`[${traceId}] Task deleted successfully`)
      
      // Update the SWR cache
      mutateTasks()
      setHasOptimisticUpdate(false)
    } catch (error) {
      console.error('Error deleting task:', error)
      
      // Restore the deleted task
      setOptimisticTasks(prev => [...prev, taskToDelete])
      setHasOptimisticUpdate(false)
      
      throw error
    }
  }, [tasks, mutateTasks])

  // Toggle task status
  const toggleTaskStatus = useCallback(async (taskId: string, newStatus: string) => {
    return updateTask(taskId, { status: newStatus })
  }, [updateTask])

  return (
    <TaskContext.Provider
      value={{
        tasks,
        isLoading,
        error: error as Error,
        mutateTask,
        createTask,
        updateTask,
        deleteTask,
        toggleTaskStatus
      }}
    >
      {children}
    </TaskContext.Provider>
  )
}

// Hook to use the task context
export const useTaskContext = () => {
  const context = useContext(TaskContext)
  if (context === undefined) {
    throw new Error('useTaskContext must be used within a TaskProvider')
  }
  return context
}