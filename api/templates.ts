/**
 * @fileoverview Frontend Templates API
 * 
 * Client-side API utilities for fetching and working with project templates.
 * Provides a clean interface for the frontend to interact with template data.
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { ProjectTemplateWithDetails } from '@/types/database';
import { supabase } from '@/utils/supabaseClient';

export interface TemplatesApiResponse {
  data: ProjectTemplateWithDetails[];
  traceId: string;
}

export interface TemplatesApiError {
  error: string;
  traceId: string;
  details?: any;
}

/**
 * Fetches all available project templates
 * @returns Promise resolving to templates or throwing an error
 */
export async function fetchTemplates(): Promise<ProjectTemplateWithDetails[]> {
  try {
    // Get the session token
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    const response = await fetch('/api/templates', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      }
    });
    
    if (!response.ok) {
      const errorData: TemplatesApiError = await response.json();
      throw new Error(errorData.error || `Error: ${response.status}`);
    }
    
    const result: TemplatesApiResponse = await response.json();
    return result.data || [];
    
  } catch (error: any) {
    console.error('Error fetching templates:', error.message);
    throw error;
  }
}

/**
 * Checks if templates are available
 * @returns Promise resolving to boolean indicating template availability
 */
export async function hasAvailableTemplates(): Promise<boolean> {
  try {
    const templates = await fetchTemplates();
    return templates.length > 0;
  } catch (error) {
    console.error('Error checking template availability:', error);
    return false;
  }
}