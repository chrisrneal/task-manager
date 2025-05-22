'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Page from '@/components/page';
import Section from '@/components/section';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/utils/supabaseClient';
import { Project, Task } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

// Task statuses for organization
const TASK_STATUSES = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  DONE: 'done'
};

const ProjectDetail = () => {
  const router = useRouter();
  const { id: projectId } = router.query;
  const { user, loading } = useAuth();
  
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Task form state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskFormMode, setTaskFormMode] = useState<'create' | 'edit'>('create');
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStatus, setTaskStatus] = useState(TASK_STATUSES.TODO);
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth protection
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Fetch project details
  useEffect(() => {
    const fetchProject = async () => {
      if (!user || !projectId) return;

      setIsLoading(true);
      setError(null);
      
      try {
        const traceId = uuidv4();
        console.log(`[${traceId}] Fetching project details for: ${projectId}`);
        
        // Get the session token
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        const response = await fetch(`/api/projects/${projectId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          }
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            setProject(null);
            setError('Project not found');
            throw new Error('Project not found');
          }
          throw new Error(`Error: ${response.status}`);
        }
        
        const result = await response.json();
        console.log(`[${traceId}] Fetched project successfully`);
        setProject(result.data);

        // Now fetch tasks for this project
        await fetchTasks();
      } catch (err: any) {
        console.error('Error fetching project:', err.message);
        if (err.message !== 'Project not found') {
          setError('Failed to load project');
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (user && projectId) {
      fetchProject();
    }
  }, [user, projectId]);

  // Fetch tasks for the project
  const fetchTasks = async () => {
    if (!user || !projectId) return;

    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Fetching tasks for project: ${projectId}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch(`/api/tasks?projectId=${projectId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`[${traceId}] Fetched ${result.data.length} tasks successfully`);
      setTasks(result.data || []);
    } catch (err: any) {
      console.error('Error fetching tasks:', err.message);
      setError('Failed to load tasks');
    }
  };

  // Handle opening the task modal for creating a new task
  const handleAddTask = () => {
    setTaskFormMode('create');
    setCurrentTask(null);
    setTaskName('');
    setTaskDescription('');
    setTaskStatus(TASK_STATUSES.TODO);
    setTaskPriority('medium');
    setTaskDueDate('');
    setIsTaskModalOpen(true);
  };

  // Handle opening the task modal for editing a task
  const handleEditTask = (task: Task) => {
    setTaskFormMode('edit');
    setCurrentTask(task);
    setTaskName(task.name);
    setTaskDescription(task.description || '');
    setTaskStatus(task.status);
    setTaskPriority(task.priority);
    setTaskDueDate(task.due_date || '');
    setIsTaskModalOpen(true);
  };

  // Handle form submission for creating/editing a task
  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !projectId) return;
    if (!taskName.trim()) {
      setError('Task name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      const isEditing = taskFormMode === 'edit' && currentTask;
      console.log(`[${traceId}] ${isEditing ? 'Updating' : 'Creating'} task: ${taskName}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      // First add optimistically to the UI
      const tempId = `temp-${Date.now()}`;
      const optimisticTask: Task = {
        id: isEditing ? currentTask!.id : tempId,
        name: taskName,
        description: taskDescription || null,
        project_id: projectId as string,
        owner_id: user.id,
        status: taskStatus,
        priority: taskPriority,
        due_date: taskDueDate || null,
        created_at: isEditing ? currentTask!.created_at : new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      if (isEditing) {
        // Replace the existing task in the list
        setTasks(prev => prev.map(t => t.id === currentTask!.id ? optimisticTask : t));
      } else {
        // Add the new task to the list
        setTasks(prev => [optimisticTask, ...prev]);
      }
      
      // Then save to the database via API
      const endpoint = isEditing ? `/api/tasks/${currentTask!.id}` : '/api/tasks';
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          name: taskName,
          description: taskDescription || null,
          project_id: projectId,
          status: taskStatus,
          priority: taskPriority,
          due_date: taskDueDate || null
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`[${traceId}] Task ${isEditing ? 'updated' : 'created'} successfully: ${result.data.id}`);
      
      if (!isEditing) {
        // Replace the temporary item with the real one
        setTasks(prev => prev.map(t => t.id === tempId ? result.data : t));
      }
      
      // Close the modal and reset form
      setIsTaskModalOpen(false);
      setTaskName('');
      setTaskDescription('');
      setTaskStatus(TASK_STATUSES.TODO);
      setTaskPriority('medium');
      setTaskDueDate('');
      setCurrentTask(null);
    } catch (err: any) {
      // Revert the optimistic update
      if (taskFormMode === 'edit' && currentTask) {
        setTasks(prev => prev.map(t => t.id === currentTask.id ? currentTask : t));
      } else {
        setTasks(prev => prev.filter(t => !t.id.toString().startsWith('temp-')));
      }
      
      setError('Failed to save task. Please try again.');
      console.error('Error saving task:', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle deleting a task
  const handleDeleteTask = async (taskId: string) => {
    if (!user || !projectId) return;

    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Deleting task: ${taskId}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Remove optimistically from the UI
      const taskToDelete = tasks.find(t => t.id === taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      
      // Then delete from the database
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      console.log(`[${traceId}] Task deleted successfully`);
    } catch (err: any) {
      // Restore the deleted task if there was an error
      setTasks(prev => [...prev, tasks.find(t => t.id === taskId)!].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
      
      setError('Failed to delete task. Please try again.');
      console.error('Error deleting task:', err.message);
    }
  };

  // Handle marking a task as done/undone
  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    if (!user || !projectId) return;

    const newStatus = currentStatus === TASK_STATUSES.DONE ? TASK_STATUSES.TODO : TASK_STATUSES.DONE;

    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Toggling task ${taskId} status from ${currentStatus} to ${newStatus}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Get the task to update
      const taskToUpdate = tasks.find(t => t.id === taskId);
      if (!taskToUpdate) {
        throw new Error('Task not found');
      }

      // Update optimistically in the UI
      const updatedTask = { ...taskToUpdate, status: newStatus, updated_at: new Date().toISOString() };
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      
      // Then update in the database
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          name: taskToUpdate.name,
          description: taskToUpdate.description,
          status: newStatus,
          priority: taskToUpdate.priority,
          due_date: taskToUpdate.due_date
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      console.log(`[${traceId}] Task status updated successfully`);
    } catch (err: any) {
      // Revert the optimistic update if there was an error
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return { ...t, status: currentStatus };
        }
        return t;
      }));
      
      setError('Failed to update task status. Please try again.');
      console.error('Error updating task status:', err.message);
    }
  };

  // Group tasks by status
  const groupedTasks = {
    [TASK_STATUSES.TODO]: tasks.filter(task => task.status === TASK_STATUSES.TODO),
    [TASK_STATUSES.IN_PROGRESS]: tasks.filter(task => task.status === TASK_STATUSES.IN_PROGRESS),
    [TASK_STATUSES.DONE]: tasks.filter(task => task.status === TASK_STATUSES.DONE)
  };

  // Loading and not found states
  if (loading || !user) return null;
  
  if (isLoading) {
    return (
      <Page title="Project Details">
        <Section>
          <div className="text-center py-10">
            <p className="text-zinc-600 dark:text-zinc-400">Loading project...</p>
          </div>
        </Section>
      </Page>
    );
  }

  if (!project && !isLoading) {
    return (
      <Page title="Project Not Found">
        <Section>
          <div className="text-center py-10">
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
              Project Not Found
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              The project you're looking for doesn't exist or you don't have access to it.
            </p>
            <button
              onClick={() => router.push('/projects')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Back to Projects
            </button>
          </div>
        </Section>
      </Page>
    );
  }

  return (
    <Page title={project?.name}>
      <Section>
        {/* Project Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              {project?.name}
            </h2>
            {project?.description && (
              <p className="text-zinc-600 dark:text-zinc-400 mt-1">{project.description}</p>
            )}
          </div>
          <button
            onClick={() => router.push('/projects')}
            className="px-3 py-1 bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 text-sm"
          >
            Back to Projects
          </button>
        </div>

        {/* Tasks Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Tasks</h3>
            <button
              onClick={handleAddTask}
              className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
            >
              Add Task
            </button>
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {/* Task List */}
          <div className="space-y-6">
            {/* To Do Tasks */}
            <div>
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                To Do ({groupedTasks[TASK_STATUSES.TODO].length})
              </h4>
              {groupedTasks[TASK_STATUSES.TODO].length === 0 ? (
                <p className="text-zinc-500 dark:text-zinc-500 text-sm italic">No tasks to do</p>
              ) : (
                <div className="space-y-2">
                  {groupedTasks[TASK_STATUSES.TODO].map(task => (
                    <div
                      key={task.id}
                      className="border rounded-md p-3 bg-white dark:bg-zinc-800 dark:border-zinc-700 flex items-start"
                    >
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => handleToggleTaskStatus(task.id, task.status)}
                        className="mt-1 mr-3"
                        aria-label={`Mark ${task.name} as done`}
                      />
                      <div className="flex-grow">
                        <h5 className="font-medium">{task.name}</h5>
                        {task.description && (
                          <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center mt-2 text-xs text-zinc-500">
                          <span className="mr-3">Priority: {task.priority}</span>
                          {task.due_date && (
                            <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center ml-2">
                        <button
                          onClick={() => handleEditTask(task)}
                          className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mr-2"
                          aria-label={`Edit ${task.name}`}
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-zinc-500 hover:text-red-500"
                          aria-label={`Delete ${task.name}`}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* In Progress Tasks */}
            <div>
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                In Progress ({groupedTasks[TASK_STATUSES.IN_PROGRESS].length})
              </h4>
              {groupedTasks[TASK_STATUSES.IN_PROGRESS].length === 0 ? (
                <p className="text-zinc-500 dark:text-zinc-500 text-sm italic">No tasks in progress</p>
              ) : (
                <div className="space-y-2">
                  {groupedTasks[TASK_STATUSES.IN_PROGRESS].map(task => (
                    <div
                      key={task.id}
                      className="border rounded-md p-3 bg-white dark:bg-zinc-800 dark:border-zinc-700 flex items-start"
                    >
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => handleToggleTaskStatus(task.id, task.status)}
                        className="mt-1 mr-3"
                        aria-label={`Mark ${task.name} as done`}
                      />
                      <div className="flex-grow">
                        <h5 className="font-medium">{task.name}</h5>
                        {task.description && (
                          <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center mt-2 text-xs text-zinc-500">
                          <span className="mr-3">Priority: {task.priority}</span>
                          {task.due_date && (
                            <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center ml-2">
                        <button
                          onClick={() => handleEditTask(task)}
                          className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mr-2"
                          aria-label={`Edit ${task.name}`}
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-zinc-500 hover:text-red-500"
                          aria-label={`Delete ${task.name}`}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Done Tasks */}
            <div>
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Done ({groupedTasks[TASK_STATUSES.DONE].length})
              </h4>
              {groupedTasks[TASK_STATUSES.DONE].length === 0 ? (
                <p className="text-zinc-500 dark:text-zinc-500 text-sm italic">No completed tasks</p>
              ) : (
                <div className="space-y-2">
                  {groupedTasks[TASK_STATUSES.DONE].map(task => (
                    <div
                      key={task.id}
                      className="border rounded-md p-3 bg-white dark:bg-zinc-800 dark:border-zinc-700 flex items-start opacity-70"
                    >
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => handleToggleTaskStatus(task.id, task.status)}
                        className="mt-1 mr-3"
                        aria-label={`Mark ${task.name} as not done`}
                      />
                      <div className="flex-grow">
                        <h5 className="font-medium line-through">{task.name}</h5>
                        {task.description && (
                          <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1 line-through">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center mt-2 text-xs text-zinc-500">
                          <span className="mr-3">Priority: {task.priority}</span>
                          {task.due_date && (
                            <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center ml-2">
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-zinc-500 hover:text-red-500"
                          aria-label={`Delete ${task.name}`}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Task Modal */}
        {isTaskModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-lg w-full max-w-md p-6">
              <h3 className="text-lg font-medium mb-4">
                {taskFormMode === 'create' ? 'Add New Task' : 'Edit Task'}
              </h3>
              
              <form onSubmit={handleTaskSubmit}>
                <div className="mb-4">
                  <label htmlFor="taskName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Task Name*
                  </label>
                  <input
                    type="text"
                    id="taskName"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
                    placeholder="Enter task name"
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="taskDescription" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Description
                  </label>
                  <textarea
                    id="taskDescription"
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
                    placeholder="Enter task description"
                    rows={3}
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="taskStatus" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Status
                  </label>
                  <select
                    id="taskStatus"
                    value={taskStatus}
                    onChange={(e) => setTaskStatus(e.target.value)}
                    className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
                  >
                    <option value={TASK_STATUSES.TODO}>To Do</option>
                    <option value={TASK_STATUSES.IN_PROGRESS}>In Progress</option>
                    <option value={TASK_STATUSES.DONE}>Done</option>
                  </select>
                </div>
                
                <div className="mb-4">
                  <label htmlFor="taskPriority" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Priority
                  </label>
                  <select
                    id="taskPriority"
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                
                <div className="mb-6">
                  <label htmlFor="taskDueDate" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    id="taskDueDate"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
                  />
                </div>
                
                {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsTaskModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !taskName.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Section>
    </Page>
  );
};

export default ProjectDetail;