import React, { useState } from 'react';
import { ProjectState } from '@/types/database';
import { supabase } from '@/utils/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

interface StateListEditorProps {
  projectId: string;
  states: ProjectState[];
  onStatesChange: (states: ProjectState[]) => void;
}

const StateListEditor = ({ projectId, states, onStatesChange }: StateListEditorProps) => {
  const [newStateName, setNewStateName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingStateId, setEditingStateId] = useState<string | null>(null);
  const [editStateName, setEditStateName] = useState('');

  // Handle adding a new state
  const handleAddState = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStateName.trim()) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Adding new state: ${newStateName}`);
      
      // Create new state in database
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Calculate next position
      const nextPosition = states.length > 0 
        ? Math.max(...states.map(s => s.position)) + 1 
        : 0;
      
      // Add optimistically to the UI
      const tempId = `temp-${Date.now()}`;
      const optimisticState: ProjectState = {
        id: tempId,
        project_id: projectId,
        name: newStateName,
        position: nextPosition
      };
      
      const updatedStates = [...states, optimisticState];
      onStatesChange(updatedStates);
      
      // Then save to the database
      const { data, error: insertError } = await supabase
        .from('project_states')
        .insert([{
          project_id: projectId,
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
      
      onStatesChange(finalStates);
      setNewStateName('');
      console.log(`[${traceId}] State added successfully: ${data.id}`);
    } catch (err: any) {
      // Revert optimistic update
      onStatesChange(states);
      setError('Failed to add state. Please try again.');
      console.error('Error adding state:', err.message);
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
    onStatesChange(reorderedStates);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Reordering states`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Update positions in database - one at a time for each affected state
      const updates = reorderedStates.map(state => 
        supabase
          .from('project_states')
          .update({ position: state.position })
          .eq('id', state.id)
      );
      
      await Promise.all(updates);
      console.log(`[${traceId}] States reordered successfully`);
    } catch (err: any) {
      // Revert optimistic update
      onStatesChange(states);
      setError('Failed to reorder states. Please try again.');
      console.error('Error reordering states:', err.message);
    }
  };

  // Handle renaming a state
  const handleStartEdit = (state: ProjectState) => {
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
    
    if (editStateName === states.find(s => s.id === id)?.name) {
      handleCancelEdit();
      return;
    }
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Renaming state ${id} to: ${editStateName}`);
      
      // Update optimistically in the UI
      const updatedStates = states.map(state => 
        state.id === id ? { ...state, name: editStateName } : state
      );
      onStatesChange(updatedStates);
      
      // Then update in the database
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const { error: updateError } = await supabase
        .from('project_states')
        .update({ name: editStateName })
        .eq('id', id);
      
      if (updateError) throw updateError;
      
      console.log(`[${traceId}] State renamed successfully`);
    } catch (err: any) {
      // Revert optimistic update
      onStatesChange(states);
      setError('Failed to rename state. Please try again.');
      console.error('Error renaming state:', err.message);
    } finally {
      handleCancelEdit();
    }
  };

  // Handle deleting a state
  const handleDeleteState = async (id: string) => {
    if (!confirm('Are you sure you want to delete this state? This may affect existing workflows.')) {
      return;
    }
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Deleting state: ${id}`);
      
      // Remove optimistically from the UI
      const stateToDelete = states.find(s => s.id === id);
      const filteredStates = states.filter(s => s.id !== id);
      
      // Recalculate positions
      const updatedStates = filteredStates.map((state, idx) => ({
        ...state,
        position: idx
      }));
      
      onStatesChange(updatedStates);
      
      // Then delete from the database
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const { error: deleteError } = await supabase
        .from('project_states')
        .delete()
        .eq('id', id);
      
      if (deleteError) {
        // Check if delete failed because of foreign key constraint
        if (deleteError.message.includes('violates foreign key constraint')) {
          throw new Error('This state is used in workflows or tasks and cannot be deleted.');
        }
        throw deleteError;
      }
      
      // Update positions for all remaining states
      const updates = updatedStates.map(state => 
        supabase
          .from('project_states')
          .update({ position: state.position })
          .eq('id', state.id)
      );
      
      await Promise.all(updates);
      console.log(`[${traceId}] State deleted and positions updated successfully`);
    } catch (err: any) {
      // Restore the deleted state if there was an error
      onStatesChange(states);
      setError(err.message || 'Failed to delete state. Please try again.');
      console.error('Error deleting state:', err.message);
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-red-500 text-sm">{error}</p>}
      
      {/* List of existing states */}
      <div className="space-y-2">
        {states.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400 text-sm italic">No states defined yet. Add your first state below.</p>
        ) : (
          states.map((state) => (
            <div 
              key={state.id} 
              className="flex items-center justify-between bg-gray-50 dark:bg-zinc-700 p-3 rounded-md"
            >
              {/* State name (or edit input) */}
              <div className="flex-grow">
                {editingStateId === state.id ? (
                  <input
                    type="text"
                    value={editStateName}
                    onChange={(e) => setEditStateName(e.target.value)}
                    className="w-full p-1 border rounded-md dark:bg-zinc-600 dark:border-zinc-500"
                    autoFocus
                  />
                ) : (
                  <span>{state.name}</span>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex items-center space-x-2">
                {editingStateId === state.id ? (
                  <>
                    <button
                      onClick={() => handleSaveEdit(state.id)}
                      className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleReorderState(state.id, 'up')}
                      disabled={state.position === 0}
                      className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleReorderState(state.id, 'down')}
                      disabled={state.position === states.length - 1}
                      className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => handleStartEdit(state)}
                      className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      aria-label={`Edit ${state.name}`}
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDeleteState(state.id)}
                      className="text-zinc-500 hover:text-red-500"
                      aria-label={`Delete ${state.name}`}
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Form to add new state */}
      <form onSubmit={handleAddState} className="flex mt-4">
        <input
          type="text"
          value={newStateName}
          onChange={(e) => setNewStateName(e.target.value)}
          placeholder="New state name"
          className="flex-grow p-2 border rounded-l-md dark:bg-zinc-700 dark:border-zinc-600"
        />
        <button
          type="submit"
          disabled={isSubmitting || !newStateName.trim()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-r-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Adding...' : 'Add State'}
        </button>
      </form>
    </div>
  );
};

export default StateListEditor;