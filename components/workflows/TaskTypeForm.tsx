import React, { useState } from 'react';
import { TaskType, Workflow } from '@/types/database';
import { supabase } from '@/utils/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

interface TaskTypeFormProps {
  projectId: string;
  workflows: Workflow[];
  taskTypes: TaskType[];
  onTaskTypesChange: (taskTypes: TaskType[]) => void;
}

const TaskTypeForm = ({ projectId, workflows, taskTypes, onTaskTypesChange }: TaskTypeFormProps) => {
  const [newTaskTypeName, setNewTaskTypeName] = useState('');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTaskTypeId, setEditingTaskTypeId] = useState<string | null>(null);
  const [editTaskTypeName, setEditTaskTypeName] = useState('');
  const [editWorkflowId, setEditWorkflowId] = useState<string>('');

  // Handle adding a new task type
  const handleAddTaskType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTypeName.trim() || !selectedWorkflowId) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Adding new task type: ${newTaskTypeName} with workflow: ${selectedWorkflowId}`);
      
      // Create new task type in database
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Add optimistically to the UI
      const tempId = `temp-${Date.now()}`;
      const optimisticTaskType: TaskType = {
        id: tempId,
        project_id: projectId,
        name: newTaskTypeName,
        workflow_id: selectedWorkflowId
      };
      
      const updatedTaskTypes = [...taskTypes, optimisticTaskType];
      onTaskTypesChange(updatedTaskTypes);
      
      // Then save to the database
      const { data, error: insertError } = await supabase
        .from('task_types')
        .insert([{
          project_id: projectId,
          name: newTaskTypeName,
          workflow_id: selectedWorkflowId
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Replace the temporary item with the real one
      const finalTaskTypes = updatedTaskTypes.map(tt => 
        tt.id === tempId ? data : tt
      );
      
      onTaskTypesChange(finalTaskTypes);
      setNewTaskTypeName('');
      setSelectedWorkflowId('');
      console.log(`[${traceId}] Task type added successfully: ${data.id}`);
    } catch (err: any) {
      // Revert optimistic update
      onTaskTypesChange(taskTypes);
      setError('Failed to add task type. Please try again.');
      console.error('Error adding task type:', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle editing a task type
  const handleStartEdit = (taskType: TaskType) => {
    setEditingTaskTypeId(taskType.id);
    setEditTaskTypeName(taskType.name);
    setEditWorkflowId(taskType.workflow_id);
  };

  const handleCancelEdit = () => {
    setEditingTaskTypeId(null);
    setEditTaskTypeName('');
    setEditWorkflowId('');
  };

  const handleSaveEdit = async (taskTypeId: string) => {
    if (!editTaskTypeName.trim() || !editWorkflowId) {
      handleCancelEdit();
      return;
    }
    
    const taskType = taskTypes.find(tt => tt.id === taskTypeId);
    if (!taskType || (editTaskTypeName === taskType.name && editWorkflowId === taskType.workflow_id)) {
      handleCancelEdit();
      return;
    }
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Editing task type ${taskTypeId} to name: ${editTaskTypeName}, workflow: ${editWorkflowId}`);
      
      // Update optimistically in the UI
      const updatedTaskTypes = taskTypes.map(tt => 
        tt.id === taskTypeId 
          ? { ...tt, name: editTaskTypeName, workflow_id: editWorkflowId } 
          : tt
      );
      onTaskTypesChange(updatedTaskTypes);
      
      // Then update in the database
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const { error: updateError } = await supabase
        .from('task_types')
        .update({ 
          name: editTaskTypeName,
          workflow_id: editWorkflowId
        })
        .eq('id', taskTypeId);
      
      if (updateError) throw updateError;
      
      console.log(`[${traceId}] Task type updated successfully`);
    } catch (err: any) {
      // Revert optimistic update
      onTaskTypesChange(taskTypes);
      setError('Failed to update task type. Please try again.');
      console.error('Error updating task type:', err.message);
    } finally {
      handleCancelEdit();
    }
  };

  // Handle deleting a task type
  const handleDeleteTaskType = async (taskTypeId: string) => {
    if (!confirm('Are you sure you want to delete this task type? Tasks using this type will need to be reassigned.')) {
      return;
    }
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Deleting task type: ${taskTypeId}`);
      
      // Remove optimistically from the UI
      const updatedTaskTypes = taskTypes.filter(tt => tt.id !== taskTypeId);
      onTaskTypesChange(updatedTaskTypes);
      
      // Then delete from the database
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const { error: deleteError } = await supabase
        .from('task_types')
        .delete()
        .eq('id', taskTypeId);
      
      if (deleteError) throw deleteError;
      
      console.log(`[${traceId}] Task type deleted successfully`);
    } catch (err: any) {
      // Restore the deleted task type if there was an error
      onTaskTypesChange(taskTypes);
      setError('Failed to delete task type. Please try again.');
      console.error('Error deleting task type:', err.message);
    }
  };

  // Get workflow name by id
  const getWorkflowName = (workflowId: string) => {
    return workflows.find(w => w.id === workflowId)?.name || 'Unknown workflow';
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-red-500 text-sm">{error}</p>}
      
      {/* List of existing task types */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Defined Task Types</h4>
        
        {taskTypes.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400 text-sm italic">No task types defined yet. Add your first task type below.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
              <thead className="bg-gray-50 dark:bg-zinc-800">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Task Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Workflow
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-800 divide-y divide-gray-200 dark:divide-zinc-700">
                {taskTypes.map(taskType => (
                  <tr key={taskType.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingTaskTypeId === taskType.id ? (
                        <input
                          type="text"
                          value={editTaskTypeName}
                          onChange={(e) => setEditTaskTypeName(e.target.value)}
                          className="w-full p-1 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
                          autoFocus
                        />
                      ) : (
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {taskType.name}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingTaskTypeId === taskType.id ? (
                        <select
                          value={editWorkflowId}
                          onChange={(e) => setEditWorkflowId(e.target.value)}
                          className="w-full p-1 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
                        >
                          <option value="">Select a workflow</option>
                          {workflows.map(workflow => (
                            <option key={workflow.id} value={workflow.id}>
                              {workflow.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {getWorkflowName(taskType.workflow_id)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {editingTaskTypeId === taskType.id ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(taskType.id)}
                            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 mr-3"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStartEdit(taskType)}
                            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 mr-3"
                            aria-label={`Edit ${taskType.name}`}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTaskType(taskType.id)}
                            className="text-red-600 hover:text-red-800"
                            aria-label={`Delete ${taskType.name}`}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Form to add new task type */}
      <form onSubmit={handleAddTaskType} className="bg-gray-50 dark:bg-zinc-700 p-4 rounded-md">
        <h4 className="font-medium text-sm mb-3">Add New Task Type</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="taskTypeName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              id="taskTypeName"
              type="text"
              value={newTaskTypeName}
              onChange={(e) => setNewTaskTypeName(e.target.value)}
              placeholder="Enter task type name"
              className="w-full p-2 border rounded-md dark:bg-zinc-600 dark:border-zinc-500"
            />
          </div>
          <div>
            <label htmlFor="workflowSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Workflow
            </label>
            <select
              id="workflowSelect"
              value={selectedWorkflowId}
              onChange={(e) => setSelectedWorkflowId(e.target.value)}
              className="w-full p-2 border rounded-md dark:bg-zinc-600 dark:border-zinc-500"
            >
              <option value="">Select a workflow</option>
              {workflows.map(workflow => (
                <option key={workflow.id} value={workflow.id}>
                  {workflow.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !newTaskTypeName.trim() || !selectedWorkflowId}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Adding...' : 'Add Task Type'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskTypeForm;