'use client';

import { useState, useEffect } from 'react';
import Page from '@/components/page';
import Section from '@/components/section';
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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Creating new project: ${name}`);
      
      // First add optimistically to the UI
      const newProject: Partial<Project> = {
        id: `temp-${Date.now()}`,
        name,
        description: description || null,
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
          name,
          description: description || null
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
      
      // Clear the form
      setName('');
      setDescription('');
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
        
        {/* Create Project Form */}
        <div className='bg-white dark:bg-zinc-800 rounded-lg p-4 mb-6 shadow-sm'>
          <h3 className='font-medium mb-3'>Create New Project</h3>
          <form onSubmit={handleSubmit}>
            <div className='mb-3'>
              <label htmlFor='name' className='block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1'>
                Project Name
              </label>
              <input
                type='text'
                id='name'
                value={name}
                onChange={(e) => setName(e.target.value)}
                className='w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600'
                placeholder='Enter project name'
                required
              />
            </div>
            <div className='mb-4'>
              <label htmlFor='description' className='block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1'>
                Description (optional)
              </label>
              <textarea
                id='description'
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className='w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600'
                placeholder='Enter project description'
                rows={3}
              />
            </div>
            {error && <p className='text-red-500 text-sm mb-3'>{error}</p>}
            <button
              type='submit'
              disabled={isSubmitting || !name.trim()}
              className='px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50'
            >
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </button>
          </form>
        </div>
        
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
                <div 
                  key={project.id} 
                  className='border rounded-md p-4 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-500 cursor-pointer'
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <h4 className='font-medium'>{project.name}</h4>
                  {project.description && (
                    <p className='text-zinc-600 dark:text-zinc-400 text-sm mt-1'>{project.description}</p>
                  )}
                  <p className='text-zinc-500 dark:text-zinc-500 text-xs mt-2'>
                    Created: {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>
    </Page>
  );
};

export default Projects;
