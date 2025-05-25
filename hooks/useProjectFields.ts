import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabaseClient';
import type { Field } from '@/types/database';

/**
 * Hook to fetch field definitions for a project and task type
 * @param projectId - Project ID to fetch fields for
 * @param taskTypeId - Task type ID to fetch fields for (optional)
 * @returns Object containing fields, loading state, and error message
 */
export function useProjectFields(projectId: string | undefined | null, taskTypeId: string | null) {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state when dependencies change
    setLoading(true);
    setError(null);
    
    const fetchFields = async () => {
      try {
        if (!projectId) {
          setFields([]);
          setLoading(false);
          return;
        }

        // Get the session token
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        
        if (!token) {
          throw new Error('No authentication token available');
        }

        let fieldData: Field[] = [];
        
        // If we have a task type ID, fetch fields assigned to that task type
        if (taskTypeId) {
          const response = await fetch(`/api/task-types/${taskTypeId}/fields`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            }
          });
          
          if (!response.ok) {
            throw new Error(`Error fetching task type fields: ${response.status}`);
          }
          
          const result = await response.json();
          fieldData = result.data || [];
        } else {
          // Otherwise, fetch all fields for the project
          const response = await fetch(`/api/projects/${projectId}/fields`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            }
          });
          
          if (!response.ok) {
            throw new Error(`Error fetching project fields: ${response.status}`);
          }
          
          const result = await response.json();
          fieldData = result.data || [];
        }
        
        // Sort fields: required fields first, then by name
        const sortedFields = [...fieldData].sort((a, b) => {
          // Required fields first
          if (a.is_required && !b.is_required) return -1;
          if (!a.is_required && b.is_required) return 1;
          
          // Then sort by name
          return a.name.localeCompare(b.name);
        });
        
        setFields(sortedFields);
      } catch (err: any) {
        console.error('Error fetching fields:', err.message);
        setError('Failed to load fields');
      } finally {
        setLoading(false);
      }
    };
    
    fetchFields();
  }, [projectId, taskTypeId]);
  
  return { fields, loading, error };
}