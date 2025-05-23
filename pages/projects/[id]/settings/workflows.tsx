'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/AuthContext';

// This file now redirects to the new settings page
const WorkflowSettingsRedirect = () => {
  const router = useRouter();
  const { id: projectId } = router.query;
  const { loading } = useAuth();
  // Redirect to new project settings page
  useEffect(() => {
    if (!loading && projectId) {
      // Use status 301 for permanent redirect
      router.replace(`/projects/${projectId}/settings`, undefined, { shallow: true });
    }
  }, [loading, projectId, router]);

  return null; // No UI rendered for redirect page
};

export default WorkflowSettingsRedirect;