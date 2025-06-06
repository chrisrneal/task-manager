'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Page from '@/components/page';
import Section from '@/components/section';
import ProjectCreateWizard from '@/components/ProjectCreateWizard';
import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'next/router';
import { Project } from '@/types/database';
import { supabase } from '@/utils/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

const Projects = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);

  // Check for deletion success message from query params
  useEffect(() => {
    if (router.query.deleted === 'true') {
      setShowDeleteSuccess(true);
      // Remove the query parameter from URL
      router.replace('/projects', undefined, { shallow: true });
      // Hide success message after 5 seconds
      setTimeout(() => {
        setShowDeleteSuccess(false);
      }, 5000);
    }
  }, [router]);

  // Auth protection
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) return;

      setIsLoading(true);
      setError(null);
      
      try {
        const traceId = uuidv4();
        console.log(`[${traceId}] Fetching projects for user: ${user.id}`);
        
        // Get the session token
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        const response = await fetch('/api/projects', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        
        const result = await response.json();
        console.log(`[${traceId}] Fetched ${result.data.length} projects successfully`);
        setProjects(result.data || []);
      } catch (err: any) {
        setError('Failed to load projects');
        console.error('Error fetching projects:', err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchProjects();
    }
  }, [user]);

  // Handle project creation from wizard
  const handleCreateProject = async (projectData: {
    name: string;
    description: string;
    template_id?: string;
  }) => {
    if (!user) return;

    setIsSubmitting(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Creating new project: ${projectData.name}`);
      
      // First add optimistically to the UI
      const newProject: Partial<Project> = {
        id: `temp-${Date.now()}`,
        name: projectData.name,
        description: projectData.description || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: user.id,
      };
      
      setProjects(prev => [newProject as Project, ...prev]);
      
      // Then save to the database via API
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          name: projectData.name,
          description: projectData.description || null,
          ...(projectData.template_id ? { template_id: projectData.template_id } : {})
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`[${traceId}] Project created successfully: ${result.data.id}`);
      
      // Replace the temporary item with the real one
      setProjects(prev => 
        prev.map(p => 
          p.id === newProject.id ? result.data : p
        )
      );
      
      // Close the wizard
      setShowWizard(false);
    } catch (err: any) {
      // Remove the optimistic update
      setProjects(prev => prev.filter(p => p.id !== `temp-${Date.now()}`.substring(0, 13)));
      setError('Failed to create project. Please try again.');
      console.error('Error creating project:', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !user) return null;

  return (
    <Page title="Projects">
      <Section>
        <h2 className='text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-4'>
          Projects
        </h2>

        {/* Success message for project deletion */}
        {showDeleteSuccess && (
          <div className="bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-300 px-4 py-2 rounded-md mb-4">
            Project deleted successfully.
          </div>
        )}
        
        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-2 rounded-md mb-4">
            {error}
          </div>
        )}
        
        {/* Create Project Wizard */}
        {showWizard ? (
          <div className="mb-6">
            <ProjectCreateWizard
              onSubmit={handleCreateProject}
              onCancel={() => {
                setShowWizard(false);
                setError(null);
              }}
              isSubmitting={isSubmitting}
              error={error}
            />
          </div>
        ) : (
          <div className='bg-white dark:bg-zinc-800 rounded-lg p-4 mb-6 shadow-sm'>
            <h3 className='font-medium mb-3'>Create New Project</h3>
            <p className='text-sm text-zinc-600 dark:text-zinc-400 mb-4'>
              Start a new project from a template or create one manually.
            </p>
            <button
              onClick={() => setShowWizard(true)}
              className='px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700'
            >
              Create Project
            </button>
          </div>
        )}
        
        {/* Projects List */}
        <div>
          <h3 className='font-medium mb-3'>Your Projects</h3>
          {isLoading ? (
            <p className='text-zinc-600 dark:text-zinc-400'>Loading projects...</p>
          ) : projects.length === 0 ? (
            <p className='text-zinc-600 dark:text-zinc-400'>No projects yet. Create your first project above.</p>
          ) : (
            <div className='space-y-3'>
              {projects.map((project) => (
                <Link 
                  key={project.id} 
                  href={`/projects/${project.id}`}
                  className='block border rounded-md p-4 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-500 cursor-pointer'
                >
                  <h4 className='font-medium'>{project.name}</h4>
                  {project.description && (
                    <p className='text-zinc-600 dark:text-zinc-400 text-sm mt-1'>{project.description}</p>
                  )}
                  <p className='text-zinc-500 dark:text-zinc-500 text-xs mt-2'>
                    Created: {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Section>
    </Page>
  );
};

export default Projects;
