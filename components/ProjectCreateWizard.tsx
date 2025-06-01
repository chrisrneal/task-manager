/**
 * @fileoverview ProjectCreateWizard Component
 * 
 * A multi-step wizard for creating projects with optional template selection.
 * Provides a smooth user experience for browsing templates and setting up
 * new projects with pre-configured structures.
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { ProjectTemplateWithDetails } from '@/types/database';
import { supabase } from '@/utils/supabaseClient';
import TemplateCard from './TemplateCard';

interface ProjectCreateWizardProps {
  onSubmit: (projectData: {
    name: string;
    description: string;
    template_id?: string;
  }) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  error?: string | null;
}

type WizardStep = 'template-selection' | 'project-details';

const ProjectCreateWizard: React.FC<ProjectCreateWizardProps> = ({
  onSubmit,
  onCancel,
  isSubmitting = false,
  error = null
}) => {
  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('template-selection');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplateWithDetails | null>(null);
  const [skipTemplate, setSkipTemplate] = useState(false);

  // Project form data
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Template loading state
  const [templates, setTemplates] = useState<ProjectTemplateWithDetails[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Load templates on mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setIsLoadingTemplates(true);
        setTemplateError(null);
        
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
          throw new Error(`Error: ${response.status}`);
        }
        
        const result = await response.json();
        const data = result.data || [];
        setTemplates(data);
        
        // If no templates available, skip to project details
        if (data.length === 0) {
          setSkipTemplate(true);
          setCurrentStep('project-details');
        }
      } catch (err: any) {
        console.error('Error loading templates:', err.message);
        setTemplateError('Failed to load templates. You can still create a project manually.');
        setSkipTemplate(true);
        setCurrentStep('project-details');
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, []);

  const handleTemplateSelect = (template: ProjectTemplateWithDetails) => {
    setSelectedTemplate(template);
    setSkipTemplate(false);
  };

  const handleSkipTemplate = () => {
    setSelectedTemplate(null);
    setSkipTemplate(true);
    setCurrentStep('project-details');
  };

  const handleContinueWithTemplate = () => {
    setCurrentStep('project-details');
  };

  const handleBackToTemplates = () => {
    setCurrentStep('template-selection');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      return;
    }

    const projectData = {
      name: name.trim(),
      description: description.trim(),
      ...(selectedTemplate && !skipTemplate ? { template_id: selectedTemplate.id } : {})
    };

    onSubmit(projectData);
  };

  const renderTemplateSelection = () => (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
          Choose a Template
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Select a pre-configured template to quickly set up your project, or start from scratch.
        </p>
      </div>

      {/* Template loading state */}
      {isLoadingTemplates && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Loading templates...</p>
        </div>
      )}

      {/* Template error */}
      {templateError && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">{templateError}</p>
        </div>
      )}

      {/* Templates grid */}
      {!isLoadingTemplates && templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              selected={selectedTemplate?.id === template.id}
              onSelect={handleTemplateSelect}
              showPreview={true}
            />
          ))}
        </div>
      )}

      {/* No templates message */}
      {!isLoadingTemplates && templates.length === 0 && !templateError && (
        <div className="text-center py-8">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No templates are currently available. You can create a project manually.
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={handleSkipTemplate}
          className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        >
          Skip - Create Manually
        </button>
        
        <div className="space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          
          {selectedTemplate && (
            <button
              type="button"
              onClick={handleContinueWithTemplate}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Continue with {selectedTemplate.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderProjectDetails = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
          Project Details
        </h3>
        {selectedTemplate ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Creating project with template: <span className="font-medium">{selectedTemplate.name}</span>
          </p>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Creating project with manual setup
          </p>
        )}
      </div>

      {/* Selected template summary */}
      {selectedTemplate && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-md p-4">
          <div className="flex items-start">
            <div className="w-8 h-8 flex items-center justify-center bg-indigo-100 dark:bg-indigo-800 rounded-lg mr-3 flex-shrink-0">
              {selectedTemplate.icon ? (
                <span className="text-sm">{selectedTemplate.icon}</span>
              ) : (
                <svg
                  className="w-4 h-4 text-indigo-600 dark:text-indigo-400"
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
            <div className="flex-1">
              <h4 className="font-medium text-indigo-800 dark:text-indigo-200">
                {selectedTemplate.name}
              </h4>
              {selectedTemplate.description && (
                <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
                  {selectedTemplate.description}
                </p>
              )}
              <div className="flex items-center space-x-4 mt-2 text-xs text-indigo-600 dark:text-indigo-400">
                <span>{selectedTemplate.states.length} states</span>
                <span>{selectedTemplate.task_types.length} task types</span>
                <span>{selectedTemplate.fields.length} custom fields</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Project name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Project Name
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
          placeholder="Enter project name"
          required
        />
      </div>

      {/* Project description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Description (optional)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
          placeholder="Enter project description"
          rows={3}
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-between">
        {templates.length > 0 && !skipTemplate && (
          <button
            type="button"
            onClick={handleBackToTemplates}
            className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            ← Back to Templates
          </button>
        )}
        
        <div className={`space-x-3 ${templates.length === 0 || skipTemplate ? 'ml-auto' : ''}`}>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm max-w-4xl">
      {currentStep === 'template-selection' && renderTemplateSelection()}
      {currentStep === 'project-details' && renderProjectDetails()}
    </div>
  );
};

export default ProjectCreateWizard;