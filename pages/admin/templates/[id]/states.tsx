/**
 * @fileoverview Template States Configuration Interface
 * 
 * This page provides admin users with tools to configure template states,
 * mirroring the project states management interface.
 * 
 * Features:
 * - View and manage template states
 * - Add, edit, delete, and reorder states
 * - State position management
 * - Consistent with project states UI
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Page from '@/components/page';
import Section from '@/components/section';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/utils/supabaseClient';
import { ProjectTemplate, TemplateState } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

const TemplateStatesSettings = () => {
  const router = useRouter();
  const { id: templateId } = router.query;
  const { user, loading } = useAuth();
  
  const [template, setTemplate] = useState<ProjectTemplate | null>(null);
  const [states, setStates] = useState<TemplateState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // State management
  const [newStateName, setNewStateName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingStateId, setEditingStateId] = useState<string | null>(null);
  const [editStateName, setEditStateName] = useState('');

  // Auth protection and admin role check
  useEffect(() => {
    const checkAuth = async () => {
      if (!loading) {
        if (!user) {
          router.replace('/login');
          return;
        }
        
        // Check if user is admin
        if (user.app_metadata?.role !== 'admin') {
          router.replace('/projects');
          return;
        }
        
        setIsAdmin(true);
      }
    };
    
    checkAuth();
  }, [user, loading, router]);

  // Fetch template and states data
  useEffect(() => {
    const fetchData = async () => {
      if (!user || !templateId || !isAdmin) return;

      setIsLoading(true);
      setError(null);
      
      try {
        const traceId = uuidv4();
        console.log(`[${traceId}] Fetching template and states data: ${templateId}`);
        
        // Fetch template data
        const { data: templateData, error: templateError } = await supabase
          .from('project_templates')
          .select('*')
          .eq('id', templateId)
          .single();
          
        if (templateError) throw templateError;
        
        if (!templateData) {
          router.replace('/admin/templates');
          return;
        }
        
        setTemplate(templateData);
        
        // Fetch template states
        const { data: statesData, error: statesError } = await supabase
          .from('template_states')
          .select('*')
          .eq('template_id', templateId)
          .order('position', { ascending: true });
          
        if (statesError) throw statesError;
        setStates(statesData || []);
        
        console.log(`[${traceId}] Fetched template and ${statesData?.length || 0} states successfully`);
      } catch (err: any) {
        console.error('Error fetching template data:', err.message);
        setError('Failed to load template data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, templateId, isAdmin, router]);

  // Handle adding a new state
  const handleAddState = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStateName.trim()) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Adding new template state: ${newStateName}`);
      
      // Calculate next position
      const nextPosition = states.length > 0 
        ? Math.max(...states.map(s => s.position)) + 1 
        : 0;
      
      // Add optimistically to the UI
      const tempId = `temp-${Date.now()}`;
      const optimisticState: TemplateState = {
        id: tempId,
        template_id: templateId as string,
        name: newStateName,
        position: nextPosition
      };
      
      const updatedStates = [...states, optimisticState];
      setStates(updatedStates);
      
      // Then save to the database
      const { data, error: insertError } = await supabase
        .from('template_states')
        .insert([{
          template_id: templateId,
          name: newStateName,
          position: nextPosition
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Replace the temporary item with the real one
      const finalStates = updatedStates.map(s => 
        s.id === tempId ? data : s
      );
      
      setStates(finalStates);
      setNewStateName('');
      console.log(`[${traceId}] Template state added successfully: ${data.id}`);
    } catch (err: any) {
      // Revert optimistic update
      setStates(states);
      setError('Failed to add state. Please try again.');
      console.error('Error adding template state:', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle reordering states (move up/down)
  const handleReorderState = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = states.findIndex(s => s.id === id);
    if (
      (direction === 'up' && currentIndex === 0) || 
      (direction === 'down' && currentIndex === states.length - 1)
    ) {
      return; // Can't move further in this direction
    }
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const updatedStates = [...states];
    
    // Swap positions
    [updatedStates[currentIndex], updatedStates[newIndex]] = 
      [updatedStates[newIndex], updatedStates[currentIndex]];
    
    // Update position values
    const reorderedStates = updatedStates.map((state, idx) => ({
      ...state,
      position: idx
    }));
    
    // Update UI optimistically
    setStates(reorderedStates);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Reordering template states`);
      
      // Update positions in database - one at a time for each affected state
      const updates = reorderedStates.map(state => 
        supabase
          .from('template_states')
          .update({ position: state.position })
          .eq('id', state.id)
      );
      
      await Promise.all(updates);
      console.log(`[${traceId}] Template states reordered successfully`);
    } catch (err: any) {
      // Revert optimistic update
      setStates(states);
      setError('Failed to reorder states. Please try again.');
      console.error('Error reordering template states:', err.message);
    }
  };

  // Handle renaming a state
  const handleStartEdit = (state: TemplateState) => {
    setEditingStateId(state.id);
    setEditStateName(state.name);
  };

  const handleCancelEdit = () => {
    setEditingStateId(null);
    setEditStateName('');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editStateName.trim()) {
      handleCancelEdit();
      return;
    }
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Updating template state name: ${id}`);
      
      // Optimistically update UI
      const updatedStates = states.map(state => 
        state.id === id ? { ...state, name: editStateName } : state
      );
      setStates(updatedStates);
      
      // Update in database
      const { error: updateError } = await supabase
        .from('template_states')
        .update({ name: editStateName })
        .eq('id', id);
      
      if (updateError) throw updateError;
      
      setEditingStateId(null);
      setEditStateName('');
      console.log(`[${traceId}] Template state updated successfully`);
    } catch (err: any) {
      // Revert optimistic update
      setStates(states);
      setError('Failed to update state. Please try again.');
      console.error('Error updating template state:', err.message);
    }
  };

  // Handle deleting a state
  const handleDeleteState = async (id: string) => {
    const state = states.find(s => s.id === id);
    if (!state) return;
    
    if (!confirm(`Are you sure you want to delete the state "${state.name}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Deleting template state: ${id}`);
      
      // Optimistically remove from UI
      const updatedStates = states.filter(s => s.id !== id);
      setStates(updatedStates);
      
      // Delete from database
      const { error: deleteError } = await supabase
        .from('template_states')
        .delete()
        .eq('id', id);
      
      if (deleteError) throw deleteError;
      
      console.log(`[${traceId}] Template state deleted successfully`);
    } catch (err: any) {
      // Revert optimistic update
      setStates(states);
      setError('Failed to delete state. Please try again.');
      console.error('Error deleting template state:', err.message);
    }
  };

  // Loading state
  if (loading || isLoading) {
    return (
      <Page title="Template States">
        <Section>
          <div className="text-center py-10">
            <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
          </div>
        </Section>
      </Page>
    );
  }

  // Not authorized state
  if (!isAdmin) {
    return null; // Already redirected in useEffect
  }

  return (
    <Page title={`${template?.name} - States Settings`}>
      <Section>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              Template States
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Manage states for {template?.name}
            </p>
          </div>
          <Link
            href="/admin/templates"
            className="px-3 py-1 bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 text-sm"
          >
            Back to Templates
          </Link>
        </div>
        
        {/* Settings Navigation */}
        <div className="flex border-b border-gray-200 dark:border-zinc-700 mb-6 overflow-x-auto">
          <Link
            href={`/admin/templates/${templateId}`}
            className="px-4 py-2 text-sm font-medium whitespace-nowrap text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            General
          </Link>
          <Link
            href={`/admin/templates/${templateId}/states`}
            className="px-4 py-2 text-sm font-medium whitespace-nowrap text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
          >
            States
          </Link>
          <Link
            href={`/admin/templates/${templateId}/workflows`}
            className="px-4 py-2 text-sm font-medium whitespace-nowrap text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Workflows
          </Link>
          <Link
            href={`/admin/templates/${templateId}/fields`}
            className="px-4 py-2 text-sm font-medium whitespace-nowrap text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Fields
          </Link>
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {/* States Management */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
            <h3 className="font-medium mb-4">Template States</h3>
            
            {/* Add New State Form */}
            <form onSubmit={handleAddState} className="mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newStateName}
                  onChange={(e) => setNewStateName(e.target.value)}
                  placeholder="Enter state name"
                  className="flex-1 p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
                  disabled={isSubmitting}
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !newStateName.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add State'}
                </button>
              </div>
            </form>

            {/* States List */}
            {states.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-zinc-600 dark:text-zinc-400">No states defined for this template.</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-2">
                  Add your first state to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {states.map((state, index) => (
                  <div
                    key={state.id}
                    className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-750"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-zinc-500 dark:text-zinc-400 w-8">
                        #{index + 1}
                      </span>
                      {editingStateId === state.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editStateName}
                            onChange={(e) => setEditStateName(e.target.value)}
                            className="p-1 border border-zinc-300 dark:border-zinc-600 rounded dark:bg-zinc-700 dark:text-zinc-200"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEdit(state.id);
                              } else if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(state.id)}
                            className="text-green-600 hover:text-green-700"
                            title="Save"
                          >
                            ✓
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-zinc-500 hover:text-zinc-700"
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {state.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleReorderState(state.id, 'up')}
                        disabled={index === 0}
                        className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-30"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => handleReorderState(state.id, 'down')}
                        disabled={index === states.length - 1}
                        className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-30"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => handleStartEdit(state)}
                        className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDeleteState(state.id)}
                        className="text-zinc-500 hover:text-red-500"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Section>
    </Page>
  );
};

export default TemplateStatesSettings;