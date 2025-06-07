import React from 'react';
import { ProjectState, WorkflowTransition } from '@/types/database';

interface TaskProgressBarProps {
  /** Current state ID of the task */
  currentStateId: string | null;
  /** All available states for this workflow */
  workflowStates: ProjectState[];
  /** Workflow transitions to determine state relationships */
  workflowTransitions?: WorkflowTransition[];
  /** CSS class for custom styling */
  className?: string;
}

/**
 * TaskProgressBar displays a visual progress indicator showing all workflow states
 * with the current state highlighted. Supports complex workflows with branching.
 */
const TaskProgressBar: React.FC<TaskProgressBarProps> = ({
  currentStateId,
  workflowStates,
  workflowTransitions = [],
  className = ''
}) => {
  // Sort states by position to maintain consistent order
  const sortedStates = [...workflowStates].sort((a, b) => a.position - b.position);

  // Find the index of the current state
  const currentStateIndex = sortedStates.findIndex(state => state.id === currentStateId);
  
  // If no current state, don't render anything
  if (!currentStateId || currentStateIndex === -1) {
    return null;
  }

  const getStateStyle = (stateIndex: number) => {
    const isCurrent = stateIndex === currentStateIndex;
    const isPast = stateIndex < currentStateIndex;
    const isFuture = stateIndex > currentStateIndex;

    let baseClasses = 'flex-1 text-center py-2 px-1 text-xs font-medium relative transition-colors duration-200';
    
    if (isCurrent) {
      // Current state - highlighted with accent color
      return `${baseClasses} bg-indigo-600 text-white shadow-md`;
    } else if (isPast) {
      // Completed states - green with checkmark
      return `${baseClasses} bg-green-500 text-white`;
    } else {
      // Future states - muted
      return `${baseClasses} bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-zinc-400`;
    }
  };

  const getConnectorStyle = (connectorIndex: number) => {
    const isBeforeCurrent = connectorIndex < currentStateIndex;
    
    if (isBeforeCurrent) {
      return 'bg-green-500 dark:bg-green-400';
    } else {
      return 'bg-gray-300 dark:bg-zinc-600';
    }
  };

  return (
    <div 
      className={`w-full ${className}`}
      role="progressbar"
      aria-label="Task workflow progress"
      aria-valuenow={currentStateIndex + 1}
      aria-valuemin={1}
      aria-valuemax={sortedStates.length}
      aria-valuetext={`Step ${currentStateIndex + 1} of ${sortedStates.length}: ${sortedStates[currentStateIndex]?.name}`}
    >
      {/* Progress bar container */}
      <div className="flex items-center w-full">
        {sortedStates.map((state, index) => (
          <React.Fragment key={state.id}>
            {/* State segment */}
            <div 
              className={`${getStateStyle(index)} ${index === 0 ? 'rounded-l-md' : ''} ${index === sortedStates.length - 1 ? 'rounded-r-md' : ''}`}
              title={state.name}
            >
              <div className="flex items-center justify-center space-x-1">
                {/* Icon for completed states */}
                {index < currentStateIndex && (
                  <span className="text-white" aria-hidden="true">✓</span>
                )}
                {/* State number/indicator */}
                <span className="truncate">
                  {state.name}
                </span>
              </div>
            </div>
            
            {/* Connector line between states (except after last state) */}
            {index < sortedStates.length - 1 && (
              <div 
                className={`h-1 w-2 ${getConnectorStyle(index)}`}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        ))}
      </div>
      
      {/* Accessible state list for screen readers */}
      <div className="sr-only">
        <p>Workflow progress: {sortedStates.length} states total</p>
        <ul>
          {sortedStates.map((state, index) => (
            <li key={state.id}>
              {index < currentStateIndex && 'Completed: '}
              {index === currentStateIndex && 'Current: '}
              {index > currentStateIndex && 'Upcoming: '}
              {state.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default TaskProgressBar;