import { createClient } from '@supabase/supabase-js';

/**
 * @fileoverview Custom Fields Utility Functions
 * 
 * This module provides comprehensive utilities for managing custom fields in the task management system.
 * It includes validation logic, type definitions, and helper functions for field operations.
 * 
 * Key Features:
 * - Field definition validation and type checking
 * - Task field value validation against field definitions
 * - Field assignment verification for task types
 * - Required field enforcement
 * - Type-specific value validation (numbers, dates, etc.)
 * - Field deletion safety checks
 * - Value formatting for display
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

/**
 * Represents a custom field definition in the system
 * @interface Field
 */
export interface Field {
  /** Unique identifier for the field */
  id: string;
  /** Human-readable field name (1-100 characters) */
  name: string;
  /** Type of input control for the field */
  input_type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'radio';
  /** Whether this field must have a value when saving tasks */
  is_required: boolean;
  /** ID of the project this field belongs to */
  project_id: string;
  /** Timestamp when the field was created */
  created_at: string;
  /** Timestamp when the field was last updated */
  updated_at: string;
}

/**
 * Represents a field value associated with a specific task
 * @interface TaskFieldValue
 */
export interface TaskFieldValue {
  /** Unique identifier for the field value (optional for new values) */
  id?: string;
  /** ID of the task this value belongs to */
  task_id: string;
  /** ID of the field definition this value is for */
  field_id: string;
  /** The actual value stored (string representation, null for empty) */
  value: string | null;
  /** Timestamp when the value was created (optional) */
  created_at?: string;
  /** Timestamp when the value was last updated (optional) */
  updated_at?: string;
}

/**
 * Valid input types for custom fields
 * @typedef {string} FieldInputType
 */
export type FieldInputType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'radio';

/**
 * Represents a validation error for a specific field
 * @interface FieldValidationError
 */
export interface FieldValidationError {
  /** ID of the field that failed validation */
  field_id: string;
  /** Human-readable name of the field */
  field_name: string;
  /** Description of the validation error */
  error: string;
}

/**
 * Result of field validation operations
 * @interface FieldValidationResult
 */
export interface FieldValidationResult {
  /** Whether all fields passed validation */
  isValid: boolean;
  /** Array of validation errors (empty if validation passed) */
  errors: FieldValidationError[];
}

/**
 * Validates field values against their definitions and requirements
 * 
 * This function performs comprehensive validation of field values including:
 * - Project ownership verification (fields must belong to task's project)
 * - Task type assignment validation (fields must be assigned to task's type)
 * - Required field enforcement (required fields must have non-empty values)
 * - Type-specific value validation (numbers, dates, checkboxes, etc.)
 * 
 * @param {any} supabase - Supabase client instance with user authentication
 * @param {string | null} taskTypeId - ID of the task type (null if no type assigned)
 * @param {string} projectId - ID of the project the task belongs to
 * @param {Array<{field_id: string, value: string | null}>} fieldValues - Array of field values to validate
 * @returns {Promise<FieldValidationResult>} Validation result with errors if any
 * @throws {Error} If database queries fail or validation cannot be performed
 * 
 * @example
 * ```typescript
 * const result = await validateFieldValues(supabase, 'task-type-123', 'project-456', [
 *   { field_id: 'field-1', value: 'Some text' },
 *   { field_id: 'field-2', value: '42' }
 * ]);
 * 
 * if (!result.isValid) {
 *   console.log('Validation errors:', result.errors);
 * }
 * ```
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
    // Step 1: Fetch field definitions for all provided field IDs
    // This validates that the fields exist and gives us their configurations
    const fieldIds = fieldValues.map(fv => fv.field_id);
    const { data: fields, error: fieldsError } = await supabase
      .from('fields')
      .select('*')
      .in('id', fieldIds);

    if (fieldsError) {
      throw new Error(`Failed to fetch field definitions: ${fieldsError.message}`);
    }

    // Step 2: Validate that all fields belong to the correct project
    // This prevents cross-project field value injection attacks
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

    // Step 3: If task has a task type, validate field assignments
    // Only fields assigned to the task type should be allowed
    if (taskTypeId) {
      const { data: taskTypeFields, error: ttfError } = await supabase
        .from('task_type_fields')
        .select('field_id')
        .eq('task_type_id', taskTypeId);

      if (ttfError) {
        throw new Error(`Failed to fetch task type fields: ${ttfError.message}`);
      }

      // Check if any provided fields are not assigned to this task type
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

      // Step 4: Validate required fields have values
      // Get all required fields assigned to this task type
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

      // Check that all required fields have non-empty values
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

    // Step 5: Validate individual field values based on their types
    // Each field type has specific validation rules (numbers, dates, etc.)
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
 * Performs type-specific validation for field values:
 * - Numbers: Must be valid numeric values
 * - Dates: Must be valid ISO date strings  
 * - Checkboxes: Must be boolean-like values (true/false/1/0)
 * - Select/Radio: Accepts any non-empty string (options validation would need schema extension)
 * - Text/Textarea: Accepts any non-empty string
 * 
 * @param {Field} field - The field definition containing type and requirement info
 * @param {string | null} value - The value to validate (null/empty for optional fields)
 * @returns {string | null} Error message if validation fails, null if valid
 * 
 * @example
 * ```typescript
 * const field = { input_type: 'number', is_required: true, name: 'Age' };
 * const error = validateFieldValueType(field, 'not-a-number');
 * // Returns: "Value must be a valid number"
 * ```
 */
export function validateFieldValueType(field: Field, value: string | null): string | null {
  // Handle empty values - only invalid if field is required
  if (!value || value.trim() === '') {
    if (field.is_required) {
      return 'Required field cannot be empty';
    }
    return null; // Empty values are valid for non-required fields
  }

  // Type-specific validation logic
  switch (field.input_type) {
    case 'number':
      // Validate numeric values - must be parseable as a number
      if (isNaN(Number(value))) {
        return 'Value must be a valid number';
      }
      break;

    case 'date':
      // Validate date values - must be valid ISO date string
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) {
        return 'Value must be a valid date';
      }
      break;

    case 'checkbox':
      // Validate boolean values - accept various boolean representations
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
      // Text fields accept any non-empty string - no additional validation needed
      break;

    default:
      // Unknown field type - this should not happen with proper field creation
      return `Unknown field type: ${field.input_type}`;
  }

  return null; // Value passed all validation checks
}

/**
 * Checks if a field can be safely deleted (not used in any tasks)
 * 
 * This safety check prevents deletion of fields that are currently in use,
 * which would leave orphaned field values and break data integrity.
 * 
 * @param {any} supabase - Supabase client instance with user authentication
 * @param {string} fieldId - ID of the field to check for deletion safety
 * @returns {Promise<boolean>} True if field can be safely deleted, false if in use
 * @throws {Error} If database query fails
 * 
 * @example
 * ```typescript
 * const canDelete = await canDeleteField(supabase, 'field-123');
 * if (canDelete) {
 *   // Safe to delete field
 * } else {
 *   // Field is in use, cannot delete
 * }
 * ```
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
 * Retrieves the complete field definitions for all fields that are assigned
 * to a specific task type. This is used to determine which fields should be
 * available when creating or editing tasks of that type.
 * 
 * @param {any} supabase - Supabase client instance with user authentication
 * @param {string} taskTypeId - ID of the task type to get fields for
 * @returns {Promise<Field[]>} Array of field definitions assigned to the task type
 * @throws {Error} If database query fails
 * 
 * @example
 * ```typescript
 * const fields = await getTaskTypeFields(supabase, 'task-type-123');
 * // Returns array of Field objects with full definitions
 * ```
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
 * Type guard function that validates whether a string value is a valid
 * field input type. Used during field creation and updates to ensure
 * only supported field types are allowed.
 * 
 * @param {string} inputType - The input type string to validate
 * @returns {boolean} True if the input type is valid and supported
 * 
 * @example
 * ```typescript
 * if (isValidFieldInputType('text')) {
 *   // Safe to use as FieldInputType
 * }
 * ```
 */
export function isValidFieldInputType(inputType: string): inputType is FieldInputType {
  const validTypes: FieldInputType[] = ['text', 'textarea', 'number', 'date', 'select', 'checkbox', 'radio'];
  return validTypes.includes(inputType as FieldInputType);
}

/**
 * Sanitizes and validates field name
 * 
 * Validates field names according to system requirements:
 * - Must be a non-empty string
 * - Length between 1-100 characters after trimming
 * - Can only contain alphanumeric characters, spaces, hyphens, underscores, and parentheses
 * - Used to prevent invalid field names and potential security issues
 * 
 * @param {string} name - The field name to validate
 * @returns {string | null} Error message if invalid, null if valid
 * 
 * @example
 * ```typescript
 * const error = validateFieldName('My Field Name (Required)');
 * if (error) {
 *   // Handle validation error
 * }
 * ```
 */
export function validateFieldName(name: string): string | null {
  // Basic type and existence validation
  if (!name || typeof name !== 'string') {
    return 'Field name is required';
  }

  // Trim whitespace and validate length
  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return 'Field name cannot be empty';
  }

  if (trimmedName.length > 100) {
    return 'Field name cannot exceed 100 characters';
  }

  // Character validation - allow alphanumeric, spaces, hyphens, underscores, and parentheses
  // This prevents injection attacks and ensures field names are safe for UI display
  if (!/^[a-zA-Z0-9\s\-_()]+$/.test(trimmedName)) {
    return 'Field name contains invalid characters';
  }

  return null; // Field name is valid
}

/**
 * Formats field value for display based on field type
 * 
 * Converts stored field values into human-readable format for UI display:
 * - Checkboxes: Converts boolean values to "Yes"/"No"
 * - Dates: Formats ISO date strings to localized date format
 * - Numbers: Formats numbers with locale-appropriate separators
 * - Other types: Returns the value as-is
 * 
 * @param {Field} field - The field definition containing type information
 * @param {string | null} value - The raw value to format (null returns empty string)
 * @returns {string} Formatted value ready for display
 * 
 * @example
 * ```typescript
 * const checkboxField = { input_type: 'checkbox', name: 'Completed' };
 * const formatted = formatFieldValue(checkboxField, 'true');
 * // Returns: "Yes"
 * 
 * const dateField = { input_type: 'date', name: 'Due Date' };
 * const formatted = formatFieldValue(dateField, '2023-12-25');
 * // Returns: "12/25/2023" (or locale-specific format)
 * ```
 */
export function formatFieldValue(field: Field, value: string | null): string {
  // Handle null/empty values
  if (!value) return '';

  switch (field.input_type) {
    case 'checkbox':
      // Convert boolean-like values to user-friendly Yes/No
      return value === 'true' || value === '1' ? 'Yes' : 'No';
    
    case 'date':
      // Format date values for display using locale settings
      try {
        const date = new Date(value);
        return date.toLocaleDateString();
      } catch {
        // If date parsing fails, return original value
        return value;
      }
    
    case 'number':
      // Format numbers with locale-appropriate thousand separators
      const num = Number(value);
      return isNaN(num) ? value : num.toLocaleString();
    
    default:
      // Text, textarea, select, radio - return as-is
      return value;
  }
}
