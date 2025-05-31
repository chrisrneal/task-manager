import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Page from '@/components/page';
import Section from '@/components/section';
import { useProjectAdminAuth } from '@/hooks/useProjectAuth';
import { supabase } from '@/utils/supabaseClient';
import { Project, TaskType } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';
import FieldManager from '@/components/fields/FieldManager';

const FieldSettings = () => {
  const router = useRouter();
  const { id: projectId } = router.query;
  
  // Use the new auth hook for admin access
  const { isLoading, isAdmin, project, error: authError } = useProjectAdminAuth(projectId);
  
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch task types for the project
  useEffect(() => {
    const fetchData = async () => {
      if (!isAdmin || !projectId) return;

      setDataLoading(true);
      setError(null);
      
      try {
        const traceId = uuidv4();
        console.log(`[${traceId}] Fetching task types for project: ${projectId}`);
        
        // Get the session token
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        // Fetch task types
        const { data: taskTypesData, error: taskTypesError } = await supabase
          .from('task_types')
          .select('*')
          .eq('project_id', projectId);
          
        if (taskTypesError) throw taskTypesError;
        setTaskTypes(taskTypesData || []);
        
        console.log(`[${traceId}] Fetched ${taskTypesData?.length || 0} task types successfully`);
      } catch (err: any) {
        console.error('Error fetching task types:', err.message);
        setError('Failed to load task types');
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [projectId, isAdmin]);

  // Loading state
  if (isLoading || dataLoading) {
    return (
      <Page title="Field Settings">
        <Section>
          <div className="text-center py-10">
            <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
          </div>
        </Section>
      </Page>
    );
  }

  // Error state
  if (authError || error) {
    return (
      <Page title="Field Settings">
        <Section>
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">
              {authError || error}
            </p>
          </div>
        </Section>
      </Page>
    );
  }

  // Not authorized state
  if (!isAdmin) {
    return null; // Already redirected by useProjectAdminAuth
  }

  return (
    <Page title={`${project?.name} - Field Settings`}>
      <Section>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              Field Manager
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Manage custom fields for {project?.name}
            </p>
          </div>
          <Link
            href={`/projects/${projectId}`}
            className="px-3 py-1 bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 text-sm"
          >
            Back to Project
          </Link>
        </div>
        
        {/* Settings Navigation */}
        <div className="flex space-x-4 mb-6">
          <Link
            href={`/projects/${projectId}/settings`}
            className="px-3 py-1.5 border border-indigo-200 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          >
            General
          </Link>
          <Link
            href={`/projects/${projectId}/settings/members`}
            className="px-3 py-1.5 border border-indigo-200 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          >
            Members
          </Link>
          <Link
            href={`/projects/${projectId}/settings/fields`}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Fields
          </Link>
          <Link
            href={`/projects/${projectId}/settings/workflows`}
            className="px-3 py-1.5 border border-indigo-200 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          >
            Workflows
          </Link>
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {/* Settings sections */}
        <div className="space-y-8">
          {/* Field Manager */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
            <FieldManager 
              projectId={projectId as string}
              taskTypes={taskTypes}
            />
          </div>
        </div>
      </Section>
    </Page>
  );
};

export default FieldSettings;