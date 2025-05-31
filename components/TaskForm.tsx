import React, { useState, useEffect } from 'react';
import { useProjectFields } from '@/hooks/useProjectFields';
import { supabase } from '@/utils/supabaseClient';
import { Field, Task, TaskFieldValue, TaskWithFieldValues, TaskType, ProjectMemberWithUser } from '@/types/database';
import { validateFieldValueType } from '@/utils/customFieldUtils';
import FileUpload from '@/components/FileUpload';
import MemberSelector from '@/components/members/MemberSelector';

interface TaskFormProps {
  mode: 'create' | 'edit' | 'view';
  projectId: string | undefined | null;
  taskTypeId: string | null;
  stateId?: string | null;
  initialValues?: TaskWithFieldValues;
  onSubmit: (task: TaskWithFieldValues) => void;
  onCancel: () => void;
  taskTypes?: TaskType[];
  workflowStates?: { id: string, name: string }[];
  validNextStates?: string[]; // IDs of states that are valid transitions
  allowEditing?: boolean; // Whether to allow editing in view mode
  projectMembers?: ProjectMemberWithUser[]; // Available project members for assignment
}

const TaskForm: React.FC<TaskFormProps> = ({
  mode,
  projectId,
  taskTypeId,
  stateId,
  initialValues,
  onSubmit,
  onCancel,
  taskTypes = [],
  workflowStates = [],
  validNextStates = [],
  allowEditing = false,
  projectMembers = []
}) => {
  // State for standard task fields
  const [name, setName] = useState(initialValues?.name || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [assigneeId, setAssigneeId] = useState(initialValues?.assignee_id || null);
  const [selectedTaskTypeId, setSelectedTaskTypeId] = useState(taskTypeId);
  const [selectedStateId, setSelectedStateId] = useState(stateId || null);
  
  // State for custom fields
  const [fieldValues, setFieldValues] = useState<{ [key: string]: string }>({});
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  
  // Get field definitions
  const { fields, loading: fieldsLoading, error: fieldsError } = useProjectFields(projectId, selectedTaskTypeId);
  
  // Initialize field values from initialValues
  useEffect(() => {
    if (initialValues?.field_values && initialValues.field_values.length > 0) {
      const values: { [key: string]: string } = {};
      initialValues.field_values.forEach(fv => {
        if (fv.value !== null) {
          values[fv.field_id] = fv.value;
        }
      });
      setFieldValues(values);
    } else {
      setFieldValues({});
    }
  }, [initialValues?.field_values]);
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    let isValid = true;
    const newErrors: { [key: string]: string } = {};
    
    // Validate task name
    if (!name.trim()) {
      isValid = false;
      setFormError('Task name is required');
      return;
    }
    
    // Validate custom fields
    fields.forEach(field => {
      const value = fieldValues[field.id] || '';
      const error = validateFieldValueType(field, value);
      
      if (error) {
        newErrors[field.id] = error;
        isValid = false;
      }
    });
    
    setFieldErrors(newErrors);
    
    if (!isValid) {
      setFormError('Please fix the validation errors');
      return;
    }
    
    // Clear errors
    setFormError(null);
    
    // Prepare field values for submission
    const fieldValuesArray: TaskFieldValue[] = fields.map(field => ({
      field_id: field.id,
      task_id: initialValues?.id || '',
      value: fieldValues[field.id] || null
    }));
    
    // Create task object with field values
    const task: TaskWithFieldValues = {
      id: initialValues?.id || '',
      name,
      description,
      assignee_id: assigneeId,
      task_type_id: selectedTaskTypeId,
      state_id: selectedStateId,
      project_id: projectId || '',
      owner_id: initialValues?.owner_id || '',
      created_at: initialValues?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      field_values: fieldValuesArray
    };
    
    // Submit the form
    onSubmit(task);
  };
  
  // Handle field value change
  const handleFieldChange = (fieldId: string, value: string) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldId]: value
    }));
    
    // Clear error for this field
    if (fieldErrors[fieldId]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };
  
  // Render field based on its type
  const renderField = (field: Field) => {
    const value = fieldValues[field.id] || '';
    const error = fieldErrors[field.id];
    const isDisabled = mode === 'view';
    
    const commonProps = {
      id: `field_${field.id}`,
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => 
        handleFieldChange(field.id, e.target.value),
      disabled: isDisabled,
      className: `w-full p-2 border rounded-md ${
        isDisabled ? 'bg-gray-100 dark:bg-zinc-800 cursor-not-allowed' : 'dark:bg-zinc-700'
      } dark:border-zinc-600 ${
        error ? 'border-red-500' : 'border-gray-300'
      }`
    };
    
    switch (field.input_type) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            rows={3}
          />
        );
        
      case 'number':
        return (
          <input
            {...commonProps}
            type="number"
            step="any"
          />
        );
        
      case 'date':
        return (
          <input
            {...commonProps}
            type="date"
          />
        );
        
      case 'select':
        return (
          <select {...commonProps}>
            <option value="">Select an option</option>
            {field.options?.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            )) || <option value="">No options available</option>}
          </select>
        );
        
      case 'checkbox':
        return (
          <div className="flex items-center">
            <input
              id={`field_${field.id}`}
              type="checkbox"
              checked={value === 'true' || value === '1'}
              onChange={(e) => handleFieldChange(field.id, e.target.checked ? 'true' : 'false')}
              disabled={isDisabled}
              className={`h-4 w-4 rounded ${
                isDisabled ? 'bg-gray-100 dark:bg-zinc-800 cursor-not-allowed' : ''
              } ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            <label htmlFor={`field_${field.id}`} className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
              {field.name}
            </label>
          </div>
        );
        
      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map(option => (
              <div key={option} className="flex items-center">
                <input
                  id={`field_${field.id}_${option}`}
                  type="radio"
                  value={option}
                  checked={value === option}
                  onChange={() => handleFieldChange(field.id, option)}
                  disabled={isDisabled}
                  className={`h-4 w-4 ${
                    isDisabled ? 'bg-gray-100 dark:bg-zinc-800 cursor-not-allowed' : ''
                  } ${
                    error ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                <label htmlFor={`field_${field.id}_${option}`} className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                  {option}
                </label>
              </div>
            )) || <div>No options available</div>}
          </div>
        );
        
      case 'text':
      default:
        return (
          <input
            {...commonProps}
            type="text"
          />
        );
    }
  };
  
  const isViewOnly = mode === 'view' && !allowEditing;
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Task Name */}
      <div>
        <label htmlFor="taskName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Task Name*
        </label>
        <input
          type="text"
          id="taskName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`w-full p-2 border rounded-md ${
            isViewOnly ? 'bg-gray-100 dark:bg-zinc-800 cursor-not-allowed' : 'dark:bg-zinc-700'
          } dark:border-zinc-600`}
          placeholder="Enter task name"
          required
          disabled={isViewOnly}
        />
      </div>
      
      {/* Task Description */}
      <div>
        <label htmlFor="taskDescription" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Description
        </label>
        <textarea
          id="taskDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`w-full p-2 border rounded-md ${
            isViewOnly ? 'bg-gray-100 dark:bg-zinc-800 cursor-not-allowed' : 'dark:bg-zinc-700'
          } dark:border-zinc-600`}
          placeholder="Enter task description"
          rows={3}
          disabled={isViewOnly}
        />
      </div>
      
      {/* Assignee */}
      <MemberSelector
        projectId={projectId || ''}
        members={projectMembers}
        selectedMemberId={assigneeId}
        onMemberSelect={setAssigneeId}
        disabled={isViewOnly}
      />
      
      {/* Task Type - Always visible */}
      <div className="mb-4">
        <label htmlFor="taskType" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Task Type
        </label>
        <select
          id="taskType"
          value={selectedTaskTypeId || ''}
          onChange={(e) => setSelectedTaskTypeId(e.target.value || null)}
          className={`w-full p-2 border rounded-md ${
            isViewOnly ? 'bg-gray-100 dark:bg-zinc-800 cursor-not-allowed' : 'dark:bg-zinc-700'
          } dark:border-zinc-600`}
          disabled={isViewOnly}
        >
          <option value="">Select a task type</option>
          {taskTypes.map(type => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>
      
      {/* State Selection - Improved UI when in edit/create mode */}
      <div className="mb-4">
        <label htmlFor="taskState" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          State
        </label>
        <div className={`${!isViewOnly ? "flex flex-col sm:flex-row sm:items-center sm:space-x-2" : ""}`}>
          <select
            id="taskState"
            value={selectedStateId || ''}
            onChange={(e) => setSelectedStateId(e.target.value || null)}
            className={`w-full p-2 border rounded-md ${
              isViewOnly ? 'bg-gray-100 dark:bg-zinc-800 cursor-not-allowed' : 'dark:bg-zinc-700'
            } dark:border-zinc-600`}
            disabled={isViewOnly}
          >
            <option value="">Select a state</option>
            {workflowStates
              .filter(state => 
                // In view mode, only show the current state
                isViewOnly 
                  ? state.id === selectedStateId 
                  // In create/edit mode:
                  // - If validNextStates is provided and not empty, filter by it
                  // - Otherwise show all states (backwards compatibility)
                  : validNextStates.length > 0
                    ? validNextStates.includes(state.id)
                    : true
              )
              .map(state => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
          </select>
        </div>
        {!isViewOnly && validNextStates.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Only valid state transitions are shown based on workflow rules.
          </p>
        )}
      </div>
      
      {/* Custom Fields */}
      {fieldsLoading ? (
        <div className="text-zinc-600 dark:text-zinc-400 text-sm">Loading custom fields...</div>
      ) : fieldsError ? (
        <div className="text-red-500 text-sm">Error loading custom fields: {fieldsError}</div>
      ) : fields.length > 0 ? (
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-2 text-zinc-800 dark:text-zinc-200">Custom Fields</h4>
          <div className="space-y-4">
            {fields.map(field => (
              <div key={field.id}>
                {field.input_type !== 'checkbox' && (
                  <label htmlFor={`field_${field.id}`} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {field.name}{field.is_required ? '*' : ''}
                  </label>
                )}
                {renderField(field)}
                {fieldErrors[field.id] && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors[field.id]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : taskTypeId ? (
        <div className="text-zinc-600 dark:text-zinc-400 text-sm">No custom fields for this task type</div>
      ) : null}
      
      {/* Form Error */}
      {formError && (
        <div className="text-red-500 text-sm">{formError}</div>
      )}
      
      {/* File Upload - Only for tasks that have been saved (have an ID) */}
      {initialValues?.id && (
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-2 text-zinc-800 dark:text-zinc-200">Attachments</h4>
          <FileUpload taskId={initialValues.id} />
        </div>
      )}
      
      {/* Form Actions */}
      {mode === 'view' ? (
        <div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700"
          >
            Back
          </button>
          {allowEditing ? (
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Update Task
            </button>
          ) : null}
        </div>
      ) : !isViewOnly && (
        <div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {mode === 'create' ? 'Create Task' : 'Update Task'}
          </button>
        </div>
      )}
    </form>
  );
};

export default TaskForm;