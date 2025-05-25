'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { Field, FieldInputType, TaskType, FieldWithAssignments } from '@/types/database';

interface FieldManagerProps {
  projectId: string;
  taskTypes: TaskType[];
}

const FieldManager: React.FC<FieldManagerProps> = ({ projectId, taskTypes }) => {
  const [fields, setFields] = useState<FieldWithAssignments[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state for adding a new field
  const [newField, setNewField] = useState({
    name: '',
    input_type: 'text' as FieldInputType,
    is_required: false,
    default_value: '',
    task_type_ids: [] as string[]
  });
  
  // State for editing a field
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Field drag-and-drop state
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [dragOverField, setDragOverField] = useState<string | null>(null);

  // Fetch fields for the project
  const fetchFields = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Fetching fields for project: ${projectId}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Fetch fields via API
      const response = await fetch(`/api/projects/${projectId}/fields`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch fields');
      }
      
      const { data } = await response.json();
      setFields(data || []);
      
      console.log(`[${traceId}] Fetched ${data.length} fields successfully`);
    } catch (err: any) {
      console.error('Error fetching fields:', err.message);
      setError('Failed to load fields');
    } finally {
      setLoading(false);
    }
  };

  // Setup real-time subscription for fields
  useEffect(() => {
    if (!projectId) return;
    
    console.log('Setting up realtime subscription for fields...');
    
    // Subscribe to field changes
    const subscription = supabase
      .channel(`fields:project_id=eq.${projectId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'fields',
        filter: `project_id=eq.${projectId}`
      }, () => {
        console.log('Field change detected, refreshing fields...');
        fetchFields();
      })
      .subscribe();
    
    fetchFields();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [projectId]);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setNewField(prev => ({ ...prev, [name]: checked }));
    } else {
      setNewField(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handle task type selection
  const handleTaskTypeChange = (taskTypeId: string) => {
    setNewField(prev => {
      const taskTypeIds = [...prev.task_type_ids];
      
      if (taskTypeIds.includes(taskTypeId)) {
        return { ...prev, task_type_ids: taskTypeIds.filter(id => id !== taskTypeId) };
      } else {
        return { ...prev, task_type_ids: [...taskTypeIds, taskTypeId] };
      }
    });
  };

  // Add a new field
  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Creating new field: ${newField.name}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Create field via API
      const response = await fetch(`/api/projects/${projectId}/fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          name: newField.name,
          input_type: newField.input_type,
          is_required: newField.is_required,
          default_value: newField.default_value
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create field');
      }
      
      const { data: field } = await response.json();
      
      // If task types are selected, assign the field to them
      if (newField.task_type_ids.length > 0) {
        for (const taskTypeId of newField.task_type_ids) {
          // Get current fields for this task type
          const fieldsResponse = await fetch(`/api/task-types/${taskTypeId}/fields`, {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer ' + token
            }
          });
          
          if (!fieldsResponse.ok) {
            console.error(`Failed to get fields for task type ${taskTypeId}`);
            continue;
          }
          
          const { data: taskTypeFields } = await fieldsResponse.json();
          const existingFieldIds = taskTypeFields.map((f: Field) => f.id);
          const updatedFieldIds = [...existingFieldIds, field.id];
          
          // Update task type fields
          await fetch(`/api/task-types/${taskTypeId}/fields`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
              field_ids: updatedFieldIds
            })
          });
        }
      }
      
      // Reset form
      setNewField({
        name: '',
        input_type: 'text',
        is_required: false,
        default_value: '',
        task_type_ids: []
      });
      
      setSuccess('Field created successfully');
      console.log(`[${traceId}] Field created successfully: ${field.id}`);
      
      // Refresh fields
      fetchFields();
    } catch (err: any) {
      console.error('Error creating field:', err.message);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete a field
  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('Are you sure you want to delete this field? This action cannot be undone if the field has no values.')) {
      return;
    }
    
    setError(null);
    setSuccess(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Deleting field: ${fieldId}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Delete field via API
      const response = await fetch(`/api/projects/${projectId}/fields/${fieldId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete field');
      }
      
      setSuccess('Field deleted successfully');
      console.log(`[${traceId}] Field deleted successfully`);
      
      // Refresh fields
      fetchFields();
    } catch (err: any) {
      console.error('Error deleting field:', err.message);
      setError(err.message);
    }
  };

  // Handle drag start
  const handleDragStart = (fieldId: string) => {
    setDraggedField(fieldId);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, fieldId: string) => {
    e.preventDefault();
    if (draggedField === fieldId) return;
    setDragOverField(fieldId);
  };

  // Handle drop - reorder fields
  const handleDrop = async (e: React.DragEvent, targetFieldId: string) => {
    e.preventDefault();
    if (!draggedField || draggedField === targetFieldId) {
      setDraggedField(null);
      setDragOverField(null);
      return;
    }
    
    // Find indices
    const draggedIndex = fields.findIndex(f => f.id === draggedField);
    const targetIndex = fields.findIndex(f => f.id === targetFieldId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    // Create a copy of fields array
    const newFields = [...fields];
    
    // Remove dragged item
    const [draggedItem] = newFields.splice(draggedIndex, 1);
    
    // Insert at new position
    newFields.splice(targetIndex, 0, draggedItem);
    
    // Update UI optimistically
    setFields(newFields);
    
    // Reset drag state
    setDraggedField(null);
    setDragOverField(null);

    // For now, we don't need to persist the order to the backend as it's not currently 
    // used for anything. When the backend adds support for field ordering, we would
    // implement an API call here to update the order.
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedField(null);
    setDragOverField(null);
  };

  // Input type options
  const inputTypeOptions = [
    { value: 'text', label: 'Text' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'select', label: 'Select' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'radio', label: 'Radio' }
  ];

  if (loading) {
    return <div className="text-center py-4">Loading fields...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Field List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Current Fields</h4>
        {fields.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">No fields have been created yet.</p>
        ) : (
          <ul className="space-y-2">
            {fields.map((field) => (
              <li 
                key={field.id}
                draggable
                onDragStart={() => handleDragStart(field.id)}
                onDragOver={(e) => handleDragOver(e, field.id)}
                onDrop={(e) => handleDrop(e, field.id)}
                onDragEnd={handleDragEnd}
                className={`
                  p-3 border rounded-md flex items-center justify-between
                  ${dragOverField === field.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-zinc-200 dark:border-zinc-700'}
                  ${draggedField === field.id ? 'opacity-50' : 'opacity-100'}
                  cursor-move
                `}
              >
                <div className="flex-1 mr-4">
                  <div className="flex items-center">
                    <div className="text-sm font-medium">{field.name}</div>
                    {field.is_required && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
                        Required
                      </span>
                    )}
                    <span className="ml-2 text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded">
                      {field.input_type}
                    </span>
                  </div>
                  
                  {field.task_type_ids && field.task_type_ids.length > 0 && (
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Used in: {field.task_type_ids.map(typeId => {
                        const taskType = taskTypes.find(t => t.id === typeId);
                        return taskType?.name;
                      }).filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleDeleteField(field.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                    aria-label="Delete field"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add Field Form */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
        <h4 className="text-sm font-medium mb-4">Add New Field</h4>
        
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        {success && <p className="text-green-500 text-sm mb-4">{success}</p>}
        
        <form onSubmit={handleAddField} className="space-y-4">
          {/* Field name */}
          <div>
            <label htmlFor="fieldName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Field Label
            </label>
            <input
              type="text"
              id="fieldName"
              name="name"
              value={newField.name}
              onChange={handleInputChange}
              className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
              placeholder="Enter field name"
              required
            />
          </div>
          
          {/* Input type */}
          <div>
            <label htmlFor="fieldType" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Input Type
            </label>
            <select
              id="fieldType"
              name="input_type"
              value={newField.input_type}
              onChange={handleInputChange}
              className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
              required
            >
              {inputTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Default value */}
          <div>
            <label htmlFor="defaultValue" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Default Value (optional)
            </label>
            <input
              type="text"
              id="defaultValue"
              name="default_value"
              value={newField.default_value}
              onChange={handleInputChange}
              className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
              placeholder="Enter default value"
            />
          </div>
          
          {/* Required checkbox */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isRequired"
              name="is_required"
              checked={newField.is_required}
              onChange={handleInputChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="isRequired" className="ml-2 block text-sm text-zinc-700 dark:text-zinc-300">
              Required field
            </label>
          </div>
          
          {/* Task type mapping */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Assign to Task Types
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto p-2 border rounded-md dark:border-zinc-600">
              {taskTypes.length === 0 ? (
                <p className="text-zinc-500 text-sm">No task types available</p>
              ) : (
                taskTypes.map(taskType => (
                  <div key={taskType.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`taskType_${taskType.id}`}
                      checked={newField.task_type_ids.includes(taskType.id)}
                      onChange={() => handleTaskTypeChange(taskType.id)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`taskType_${taskType.id}`} className="ml-2 block text-sm text-zinc-700 dark:text-zinc-300">
                      {taskType.name}
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div>
            <button
              type="submit"
              disabled={isSubmitting || !newField.name}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? "Adding..." : "Add Field"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FieldManager;