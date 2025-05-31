/**
 * @fileoverview Custom Fields Utility Functions
 * 
 * This module provides comprehensive utility functions for managing custom fields
 * and their values within the task management system. It includes:
 * - Field validation logic for different input types
 * - Required field constraint enforcement
 * - Project scope and task type assignment validation
 * - Field value formatting for display
 * - Field deletion safety checks
 * 
 * These utilities are used across the API endpoints to ensure consistent
 * validation and business rule enforcement for the custom fields system.
 */

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
 * 
 * This is the primary validation function for custom field values, performing
 * comprehensive checks including:
 * - Field type validation (ensuring values match field input types)
 * - Required field enforcement (ensuring required fields have values)
 * - Project scope validation (ensuring fields belong to the task's project)
 * - Task type assignment validation (ensuring fields are assigned to the task type)
 * 
 * @param supabase - Supabase client instance for database queries
 * @param taskTypeId - Task type ID for assignment validation (null if no task type)
 * @param projectId - Project ID for scope validation
 * @param fieldValues - Array of field values to validate
 * @returns Promise resolving to validation result with errors array
 * @throws Error if database queries fail
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
 * 
 * Performs type-specific validation for field values based on the field's input type.
 * Each field type has specific validation rules:
 * - number: Must be a valid numeric value
 * - date: Must be a valid date string
 * - checkbox: Must be boolean-like (true/false or 1/0)
 * - text/textarea: Accept any string value
 * - select/radio: Accept any string (options validation would be future enhancement)
 * 
 * @param field - Field definition with type and requirement information
 * @param value - Value to validate (string or null)
 * @returns Error message string if validation fails, null if valid
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
 * 
 * Before allowing field deletion, this function verifies that no tasks
 * currently have values for this field. This prevents data integrity
 * issues and ensures existing task data is preserved.
 * 
 * @param supabase - Supabase client instance for database queries
 * @param fieldId - UUID of the field to check for deletion safety
 * @returns Promise resolving to true if field can be deleted, false otherwise
 * @throws Error if database query fails
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
 * 
 * Retrieves complete field information for all fields assigned to a specific
 * task type. This is useful for determining which fields should be available
 * when creating or editing tasks of this type.
 * 
 * @param supabase - Supabase client instance for database queries
 * @param taskTypeId - UUID of the task type to get fields for
 * @returns Promise resolving to array of field definitions
 * @throws Error if database query fails
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
 * 
 * Type guard function that ensures only supported field input types
 * are accepted. This prevents creation of fields with unsupported types
 * that could cause issues in the UI or validation logic.
 * 
 * @param inputType - String to validate as a field input type
 * @returns True if inputType is a valid FieldInputType, false otherwise
 */
export function isValidFieldInputType(inputType: string): inputType is FieldInputType {
  const validTypes: FieldInputType[] = ['text', 'textarea', 'number', 'date', 'select', 'checkbox', 'radio'];
  return validTypes.includes(inputType as FieldInputType);
}

/**
 * Sanitizes and validates field name
 * 
 * Performs comprehensive validation of field names to ensure they meet
 * system requirements:
 * - Must be non-empty string
 * - Must be 1-100 characters in length
 * - Must contain only alphanumeric characters, spaces, hyphens, underscores, and parentheses
 * - Prevents creation of fields with invalid or problematic names
 * 
 * @param name - Field name string to validate
 * @returns Error message string if validation fails, null if valid
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
 * 
 * Transforms raw field values into user-friendly display formats based on
 * the field's input type. This provides consistent formatting across the UI:
 * - checkbox: Converts boolean-like values to "Yes"/"No"
 * - date: Formats date strings using locale-specific formatting
 * - number: Formats numbers with locale-specific thousand separators
 * - text/textarea/select/radio: Returns value as-is
 * 
 * @param field - Field definition containing input type information
 * @param value - Raw field value to format (string or null)
 * @returns Formatted string ready for display
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
