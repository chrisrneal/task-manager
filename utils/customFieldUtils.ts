import { createClient } from '@supabase/supabase-js';

// Define types locally to avoid import issues
export interface Field {
  id: string;
  name: string;
  input_type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'radio';
  is_required: boolean;
  project_id: string;
  created_at: string;
  updated_at: string;
}

export interface TaskFieldValue {
  id?: string;
  task_id: string;
  field_id: string;
  value: string | null;
  created_at?: string;
  updated_at?: string;
}

export type FieldInputType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'radio';

/**
 * Utility functions for custom field validation and operations
 */

export interface FieldValidationError {
  field_id: string;
  field_name: string;
  error: string;
}

export interface FieldValidationResult {
  isValid: boolean;
  errors: FieldValidationError[];
}

/**
 * Validates field values against their definitions and requirements
 */
export async function validateFieldValues(
  supabase: any,
  taskTypeId: string | null,
  projectId: string,
  fieldValues: { field_id: string; value: string | null }[]
): Promise<FieldValidationResult> {
  const errors: FieldValidationError[] = [];

  if (!fieldValues || fieldValues.length === 0) {
    return { isValid: true, errors: [] };
  }

  try {
    // Get field definitions
    const fieldIds = fieldValues.map(fv => fv.field_id);
    const { data: fields, error: fieldsError } = await supabase
      .from('fields')
      .select('*')
      .in('id', fieldIds);

    if (fieldsError) {
      throw new Error(`Failed to fetch field definitions: ${fieldsError.message}`);
    }

    // Validate that all fields belong to the project
    const invalidProjectFields = fields.filter((field: any) => field.project_id !== projectId);
    if (invalidProjectFields.length > 0) {
      for (const field of invalidProjectFields) {
        errors.push({
          field_id: field.id,
          field_name: field.name,
          error: 'Field does not belong to the task\'s project'
        });
      }
    }

    // If task has a task type, validate field assignments
    if (taskTypeId) {
      const { data: taskTypeFields, error: ttfError } = await supabase
        .from('task_type_fields')
        .select('field_id')
        .eq('task_type_id', taskTypeId);

      if (ttfError) {
        throw new Error(`Failed to fetch task type fields: ${ttfError.message}`);
      }

      const assignedFieldIds = taskTypeFields.map((ttf: any) => ttf.field_id);
      const unassignedFields = fieldValues.filter(fv => !assignedFieldIds.includes(fv.field_id));
      
      for (const fieldValue of unassignedFields) {
        const field = fields.find((f: any) => f.id === fieldValue.field_id);
        errors.push({
          field_id: fieldValue.field_id,
          field_name: field?.name || 'Unknown',
          error: 'Field is not assigned to the task type'
        });
      }

      // Get required fields that should be assigned to this task type
      const { data: requiredFieldsData, error: reqFieldsError } = await supabase
        .from('task_type_fields')
        .select(`
          field_id,
          fields (
            id,
            name,
            is_required
          )
        `)
        .eq('task_type_id', taskTypeId);

      if (reqFieldsError) {
        throw new Error(`Failed to fetch required fields: ${reqFieldsError.message}`);
      }

      const requiredFields = requiredFieldsData
        .map((ttf: any) => ttf.fields)
        .filter((field: any) => field && field.is_required);

      // Check that all required fields have values
      for (const requiredField of requiredFields) {
        const fieldValue = fieldValues.find(fv => fv.field_id === requiredField.id);
        if (!fieldValue || !fieldValue.value || fieldValue.value.trim() === '') {
          errors.push({
            field_id: requiredField.id,
            field_name: requiredField.name,
            error: 'Required field must have a value'
          });
        }
      }
    }

    // Validate individual field values based on their types
    for (const fieldValue of fieldValues) {
      const field = fields.find((f: any) => f.id === fieldValue.field_id);
      if (!field) continue;

      const validationError = validateFieldValueType(field, fieldValue.value);
      if (validationError) {
        errors.push({
          field_id: field.id,
          field_name: field.name,
          error: validationError
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };

  } catch (error: any) {
    throw new Error(`Field validation failed: ${error.message}`);
  }
}

/**
 * Validates a single field value against its type definition
 */
export function validateFieldValueType(field: Field, value: string | null): string | null {
  if (!value || value.trim() === '') {
    if (field.is_required) {
      return 'Required field cannot be empty';
    }
    return null; // Empty values are valid for non-required fields
  }

  switch (field.input_type) {
    case 'number':
      if (isNaN(Number(value))) {
        return 'Value must be a valid number';
      }
      break;

    case 'date':
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) {
        return 'Value must be a valid date';
      }
      break;

    case 'checkbox':
      if (value !== 'true' && value !== 'false' && value !== '1' && value !== '0') {
        return 'Value must be true/false or 1/0';
      }
      break;

    case 'select':
    case 'radio':
      // For select and radio fields, we'd need to validate against allowed options
      // This would require extending the Field interface to include options
      // For now, we'll accept any non-empty string
      break;

    case 'text':
    case 'textarea':
      // Text fields accept any non-empty string
      break;

    default:
      return `Unknown field type: ${field.input_type}`;
  }

  return null; // Value is valid
}

/**
 * Checks if a field can be safely deleted (not used in any tasks)
 */
export async function canDeleteField(supabase: any, fieldId: string): Promise<boolean> {
  try {
    const { data: fieldValues, error } = await supabase
      .from('task_field_values')
      .select('task_id')
      .eq('field_id', fieldId)
      .limit(1);

    if (error) {
      throw new Error(`Failed to check field usage: ${error.message}`);
    }

    return !fieldValues || fieldValues.length === 0;
  } catch (error: any) {
    throw new Error(`Field deletion check failed: ${error.message}`);
  }
}

/**
 * Gets all fields assigned to a task type with their definitions
 */
export async function getTaskTypeFields(supabase: any, taskTypeId: string) {
  try {
    const { data: taskTypeFields, error } = await supabase
      .from('task_type_fields')
      .select(`
        field_id,
        fields (
          id,
          name,
          input_type,
          is_required,
          project_id,
          created_at,
          updated_at
        )
      `)
      .eq('task_type_id', taskTypeId);

    if (error) {
      throw new Error(`Failed to fetch task type fields: ${error.message}`);
    }

    return taskTypeFields.map((ttf: any) => ttf.fields).filter(Boolean);
  } catch (error: any) {
    throw new Error(`Get task type fields failed: ${error.message}`);
  }
}

/**
 * Validates input type for field creation/update
 */
export function isValidFieldInputType(inputType: string): inputType is FieldInputType {
  const validTypes: FieldInputType[] = ['text', 'textarea', 'number', 'date', 'select', 'checkbox', 'radio'];
  return validTypes.includes(inputType as FieldInputType);
}

/**
 * Sanitizes and validates field name
 */
export function validateFieldName(name: string): string | null {
  if (!name || typeof name !== 'string') {
    return 'Field name is required';
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return 'Field name cannot be empty';
  }

  if (trimmedName.length > 100) {
    return 'Field name cannot exceed 100 characters';
  }

  // Check for invalid characters (basic validation)
  if (!/^[a-zA-Z0-9\s\-_()]+$/.test(trimmedName)) {
    return 'Field name contains invalid characters';
  }

  return null; // Valid
}

/**
 * Formats field value for display based on field type
 */
export function formatFieldValue(field: Field, value: string | null): string {
  if (!value) return '';

  switch (field.input_type) {
    case 'checkbox':
      return value === 'true' || value === '1' ? 'Yes' : 'No';
    
    case 'date':
      try {
        const date = new Date(value);
        return date.toLocaleDateString();
      } catch {
        return value;
      }
    
    case 'number':
      const num = Number(value);
      return isNaN(num) ? value : num.toLocaleString();
    
    default:
      return value;
  }
}
