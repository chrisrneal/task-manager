/**
 * @fileoverview TemplateCard Component
 * 
 * Displays a project template with its metadata including name, description,
 * icon, and a preview of what it contains (states, task types, etc.).
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import React from 'react';
import { ProjectTemplateWithDetails } from '@/types/database';

interface TemplateCardProps {
  template: ProjectTemplateWithDetails;
  selected?: boolean;
  onSelect?: (template: ProjectTemplateWithDetails) => void;
  showPreview?: boolean;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  selected = false,
  onSelect,
  showPreview = true
}) => {
  const handleClick = () => {
    if (onSelect) {
      onSelect(template);
    }
  };

  const getStateCount = () => template.states.length;
  const getTaskTypeCount = () => template.task_types.length;
  const getFieldCount = () => template.fields.length;

  return (
    <div
      className={`relative border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
        selected
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-400'
          : 'border-gray-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-500'
      }`}
      onClick={handleClick}
    >
      {/* Selection indicator */}
      {selected && (
        <div className="absolute top-2 right-2">
          <div className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs">
            ✓
          </div>
        </div>
      )}

      {/* Template header */}
      <div className="flex items-start mb-3">
        {/* Icon */}
        <div className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-zinc-700 rounded-lg mr-3 flex-shrink-0">
          {template.icon ? (
            <span className="text-lg">{template.icon}</span>
          ) : (
            <svg
              className="w-5 h-5 text-gray-500 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          )}
        </div>

        {/* Title and description */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 truncate">
            {template.name}
          </h3>
          {template.description && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
              {template.description}
            </p>
          )}
        </div>
      </div>

      {/* Preview information */}
      {showPreview && (
        <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="text-center p-2 bg-gray-50 dark:bg-zinc-800 rounded">
            <div className="font-medium text-zinc-700 dark:text-zinc-300">
              {getStateCount()}
            </div>
            <div>States</div>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-zinc-800 rounded">
            <div className="font-medium text-zinc-700 dark:text-zinc-300">
              {getTaskTypeCount()}
            </div>
            <div>Task Types</div>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-zinc-800 rounded">
            <div className="font-medium text-zinc-700 dark:text-zinc-300">
              {getFieldCount()}
            </div>
            <div>Fields</div>
          </div>
        </div>
      )}

      {/* Template details (expanded view) */}
      {showPreview && selected && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-zinc-600">
          <div className="space-y-2 text-sm">
            {template.states.length > 0 && (
              <div>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">States: </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {template.states.map(state => state.name).join(', ')}
                </span>
              </div>
            )}
            {template.task_types.length > 0 && (
              <div>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Task Types: </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {template.task_types.map(type => type.name).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateCard;