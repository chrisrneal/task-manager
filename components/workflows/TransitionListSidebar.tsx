import React from 'react';
import { ProjectState, WorkflowTransition } from '@/types/database';
import { ANY_STATE_UUID } from './WorkflowGraphEditor';

/**
 * TransitionListSidebar displays a list of all transitions in a workflow
 * 
 * Features:
 * - Shows all transitions including branching paths and cycles
 * - Highlights "Any state" transitions
 * - Allows deleting transitions
 * - Displays transition direction with "from" and "to" states
 */

interface TransitionListSidebarProps {
  transitions: WorkflowTransition[];
  states: ProjectState[];
  onTransitionDelete: (fromStateId: string | null, toStateId: string) => void;
}

const TransitionListSidebar: React.FC<TransitionListSidebarProps> = ({
  transitions,
  states,
  onTransitionDelete
}) => {
  // Get state name by ID for display
  const getStateName = (stateId: string | null) => {
    if (stateId === null || stateId === ANY_STATE_UUID) return "Any State";
    const state = states.find(s => s.id === stateId);
    return state ? state.name : "Unknown State";
  };

  return (
    <div className="bg-gray-50 dark:bg-zinc-700 rounded-md p-3 mt-4">
      <h5 className="text-sm font-medium mb-2">Workflow Transitions</h5>
      
      {transitions.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400 text-sm italic">
          No transitions defined. Create transitions by shift+dragging from one state to another in the editor.
        </p>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {transitions.map((transition, index) => (
            <div
              key={`${transition.from_state || 'any'}-${transition.to_state}`}
              className="flex justify-between items-center bg-white dark:bg-zinc-800 p-2 rounded border border-gray-200 dark:border-zinc-600"
            >
              <div className="flex items-center">
                <span className="text-sm">
                  {getStateName(transition.from_state)} 
                  <span className="mx-2">→</span> 
                  {getStateName(transition.to_state)}
                </span>
                {(transition.from_state === null || transition.from_state === ANY_STATE_UUID) && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded">
                    Global
                  </span>
                )}
              </div>
              <button
                onClick={() => onTransitionDelete(transition.from_state, transition.to_state)}
                className="text-red-500 hover:text-red-700"
                aria-label={`Delete transition from ${getStateName(transition.from_state)} to ${getStateName(transition.to_state)}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TransitionListSidebar;