/**
 * @fileoverview Task Field Values Management API
 * 
 * This API endpoint manages custom field values for individual tasks, enabling:
 * - Retrieving all field values for a task with field definitions
 * - Batch creation/update of field values with comprehensive validation
 * - Enforcing required field constraints and type validation
 * - Ensuring field assignments are valid for the task's type
 * - Bulk deletion of all field values for a task
 * 
 * Field values store the actual data entered for custom fields on tasks,
 * linking tasks to their custom field data with proper validation.
 * 
 * @route GET    /api/tasks/[taskId]/field-values - Get all field values for a task
 * @route POST   /api/tasks/[taskId]/field-values - Create/update field values (batch)
 * @route DELETE /api/tasks/[taskId]/field-values - Delete all field values for a task
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { TaskFieldValue } from '@/types/database';
import { validateFieldValues } from '../../../../utils/customFieldUtils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Task Field Values API Handler - Manages custom field values for tasks
 * 
 * Handles GET, POST, and DELETE operations for task field values with comprehensive
 * validation using the custom fields utility functions. Ensures field values
 * comply with field definitions and task type assignments.
 * 
 * @param req - Next.js API request object
 * @param req.query.taskId - UUID of the task for which to manage field values
 * @param req.body.field_values - Array of field value objects (for POST requests)
 * @param req.body.field_values[].field_id - UUID of the field
 * @param req.body.field_values[].value - Value to store for the field
 * @param res - Next.js API response object
 * @returns JSON response with field values, validation errors, or operation status
 */
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { taskId } = req.query;

  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/tasks/${taskId}/field-values - Request received`);

  // Extract user token from request
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined;

  if (!token) {
    console.log(`[${traceId}] Error: No authorization token provided`);
    return res.status(401).json({ 
      error: 'Authentication required',
      traceId
    });
  }

  if (!taskId || typeof taskId !== 'string') {
    console.log(`[${traceId}] Error: Invalid task ID`);
    return res.status(400).json({ 
      error: 'Task ID is required',
      traceId
    });
  }

  // Create a Supabase client with the user's token for RLS
  const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  // Verify the user session
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.log(`[${traceId}] Error: Invalid authentication - ${userError?.message}`);
    return res.status(401).json({ 
      error: 'Invalid authentication',
      traceId
    });
  }

  try {
    // First verify user has access to the task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, project_id, task_type_id, owner_id')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      console.log(`[${traceId}] Error: Task not found or access denied - ${taskId}`);
      return res.status(404).json({ 
        error: 'Task not found or access denied',
        traceId
      });
    }

    // Handle GET request - Get all field values for a task
    if (method === 'GET') {
      const { data: fieldValues, error } = await supabase
        .from('task_field_values')
        .select(`
          *,
          fields (
            id,
            name,
            input_type,
            is_required,
            project_id
          )
        `)
        .eq('task_id', taskId);

      if (error) {
        console.error(`[${traceId}] Error fetching task field values: ${error.message}`);
        return res.status(500).json({ 
          error: 'Failed to fetch task field values',
          traceId
        });
      }

      console.log(`[${traceId}] GET /api/tasks/${taskId}/field-values - Success: ${fieldValues.length} field values`);
      return res.status(200).json({ 
        data: fieldValues,
        traceId
      });
    }

    // Handle POST request - Create or update field values for a task (batch operation)
    if (method === 'POST') {
      const { field_values } = req.body;

      if (!field_values || !Array.isArray(field_values)) {
        console.log(`[${traceId}] Error: field_values array is required`);
        return res.status(400).json({ 
          error: 'field_values array is required',
          traceId
        });
      }

      // Validate each field value object structure
      for (const fieldValue of field_values) {
        if (!fieldValue.field_id) {
          console.log(`[${traceId}] Error: field_id is required for all field values`);
          return res.status(400).json({ 
            error: 'field_id is required for all field values',
            traceId
          });
        }
      }

      // Use comprehensive validation utility function
      // This validates field types, required constraints, project scope, and task type assignments
      try {
        const validationResult = await validateFieldValues(
          supabase,
          task.task_type_id,
          task.project_id,
          field_values
        );

        if (!validationResult.isValid) {
          // Format validation errors for client consumption
          const errorMessages = validationResult.errors.map((e: any) => 
            `${e.field_name}: ${e.error}`
          ).join('; ');
          
          console.log(`[${traceId}] Error: Field validation failed - ${errorMessages}`);
          return res.status(400).json({ 
            error: 'Field validation failed',
            details: validationResult.errors,
            traceId
          });
        }
      } catch (validationError: any) {
        console.error(`[${traceId}] Error during field validation: ${validationError.message}`);
        return res.status(500).json({ 
          error: 'Failed to validate field values',
          traceId
        });
      }

      // Prepare field values for database upsert operation
      // Normalize empty strings to null for consistent database representation
      const fieldValuesToUpsert = field_values.map(fv => ({
        task_id: taskId,
        field_id: fv.field_id,
        value: fv.value || null
      }));

      // Use upsert to create or update field values atomically
      // The unique constraint (task_id, field_id) ensures one value per field per task
      const { data: upsertedValues, error: upsertError } = await supabase
        .from('task_field_values')
        .upsert(fieldValuesToUpsert, {
          onConflict: 'task_id,field_id'
        })
        .select();

      if (upsertError) {
        console.error(`[${traceId}] Error upserting field values: ${upsertError.message}`);
        return res.status(500).json({ 
          error: 'Failed to update field values',
          traceId
        });
      }

      console.log(`[${traceId}] POST /api/tasks/${taskId}/field-values - Success: ${upsertedValues.length} field values updated`);
      return res.status(200).json({ 
        data: upsertedValues,
        message: 'Field values updated successfully',
        traceId
      });
    }

    // Handle DELETE request - Delete all field values for a task
    if (method === 'DELETE') {
      const { error } = await supabase
        .from('task_field_values')
        .delete()
        .eq('task_id', taskId);

      if (error) {
        console.error(`[${traceId}] Error deleting field values: ${error.message}`);
        return res.status(500).json({ 
          error: 'Failed to delete field values',
          traceId
        });
      }

      console.log(`[${traceId}] DELETE /api/tasks/${taskId}/field-values - Success`);
      return res.status(200).json({ 
        message: 'Field values deleted successfully',
        traceId
      });
    }

    // Method not allowed
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    return res.status(405).json({ 
      error: 'Method not allowed',
      traceId
    });

  } catch (err: any) {
    console.error(`[${traceId}] Unexpected error: ${err.message}`);
    return res.status(500).json({ 
      error: 'Internal server error',
      traceId
    });
  }
};

export default handler;
