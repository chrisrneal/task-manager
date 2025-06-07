/**
 * @fileoverview User Profile Page
 * 
 * This page allows users to view and edit their personal profile information.
 * Users can update their display name, contact information, preferences, and avatar.
 * 
 * Key Features:
 * - View current profile information
 * - Edit profile fields with validation
 * - Save changes securely
 * - Consistent UI with the rest of the application
 * - Responsive design for mobile and desktop
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/utils/supabaseClient';
import Link from 'next/link';

interface ProfileData {
  id: string;
  email: string;
  display_name: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
  phone: string;
  timezone: string;
  locale: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    display_name: '',
    first_name: '',
    last_name: '',
    phone: '',
    timezone: 'UTC',
    locale: 'en'
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        if (!token) {
          throw new Error('No authentication token available');
        }

        const response = await fetch('/api/profile', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch profile');
        }

        const data = await response.json();
        setProfile(data.profile);
        setFormData({
          display_name: data.profile.display_name || '',
          first_name: data.profile.first_name || '',
          last_name: data.profile.last_name || '',
          phone: data.profile.phone || '',
          timezone: data.profile.timezone || 'UTC',
          locale: data.profile.locale || 'en'
        });
      } catch (err: any) {
        console.error('Error fetching profile:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear messages when user starts editing
    if (error) setError(null);
    if (successMessage) setSuccessMessage(null);
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Validation
      if (!formData.display_name.trim()) {
        throw new Error('Display name is required');
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      const data = await response.json();
      setProfile(data.profile);
      setIsEditing(false);
      setSuccessMessage('Profile updated successfully!');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (!profile) return;
    
    setFormData({
      display_name: profile.display_name || '',
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      phone: profile.phone || '',
      timezone: profile.timezone || 'UTC',
      locale: profile.locale || 'en'
    });
    setIsEditing(false);
    setError(null);
    setSuccessMessage(null);
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 pt-24 pb-16">
        <div className="max-w-2xl mx-auto px-6">
          <div className="animate-pulse">
            <div className="h-8 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3 mb-8"></div>
            <div className="space-y-6">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/4"></div>
              <div className="h-10 bg-zinc-200 dark:bg-zinc-700 rounded"></div>
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/4"></div>
              <div className="h-10 bg-zinc-200 dark:bg-zinc-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              Profile
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 mt-2">
              Manage your personal information and preferences
            </p>
          </div>
          <Link
            href="/projects"
            className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            ← Back to Projects
          </Link>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">{successMessage}</p>
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700">
          <div className="p-6">
            {/* Avatar Section */}
            <div className="flex items-center mb-8">
              <div
                className="h-16 w-16 rounded-full bg-zinc-200 bg-cover bg-center shadow-inner dark:bg-zinc-700"
                style={{
                  backgroundImage: profile?.avatar_url
                    ? `url(${profile.avatar_url})`
                    : 'url(https://images.unsplash.com/photo-1612480797665-c96d261eae09?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80)',
                }}
              />
              <div className="ml-4">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {profile?.display_name || 'User'}
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {profile?.email}
                </p>
                {profile?.email_verified && (
                  <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded mt-1">
                    Email Verified
                  </span>
                )}
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-6">
              {/* Display Name */}
              <div>
                <label htmlFor="display_name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Display Name *
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) => handleInputChange('display_name', e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-100"
                    placeholder="Enter your display name"
                    required
                  />
                ) : (
                  <p className="text-zinc-900 dark:text-zinc-100 py-2">
                    {profile?.display_name || 'Not set'}
                  </p>
                )}
              </div>

              {/* First Name */}
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  First Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-100"
                    placeholder="Enter your first name"
                  />
                ) : (
                  <p className="text-zinc-900 dark:text-zinc-100 py-2">
                    {profile?.first_name || 'Not set'}
                  </p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Last Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-100"
                    placeholder="Enter your last name"
                  />
                ) : (
                  <p className="text-zinc-900 dark:text-zinc-100 py-2">
                    {profile?.last_name || 'Not set'}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Phone
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-100"
                    placeholder="Enter your phone number"
                  />
                ) : (
                  <p className="text-zinc-900 dark:text-zinc-100 py-2">
                    {profile?.phone || 'Not set'}
                  </p>
                )}
              </div>

              {/* Timezone */}
              <div>
                <label htmlFor="timezone" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Timezone
                </label>
                {isEditing ? (
                  <select
                    id="timezone"
                    value={formData.timezone}
                    onChange={(e) => handleInputChange('timezone', e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-100"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Paris">Paris</option>
                    <option value="Asia/Tokyo">Tokyo</option>
                    <option value="Asia/Shanghai">Shanghai</option>
                    <option value="Australia/Sydney">Sydney</option>
                  </select>
                ) : (
                  <p className="text-zinc-900 dark:text-zinc-100 py-2">
                    {profile?.timezone || 'UTC'}
                  </p>
                )}
              </div>

              {/* Locale */}
              <div>
                <label htmlFor="locale" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Language
                </label>
                {isEditing ? (
                  <select
                    id="locale"
                    value={formData.locale}
                    onChange={(e) => handleInputChange('locale', e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-100"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="ja">Japanese</option>
                    <option value="zh">Chinese</option>
                  </select>
                ) : (
                  <p className="text-zinc-900 dark:text-zinc-100 py-2">
                    {profile?.locale === 'en' ? 'English' :
                     profile?.locale === 'es' ? 'Spanish' :
                     profile?.locale === 'fr' ? 'French' :
                     profile?.locale === 'de' ? 'German' :
                     profile?.locale === 'ja' ? 'Japanese' :
                     profile?.locale === 'zh' ? 'Chinese' :
                     profile?.locale || 'English'}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-700">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-zinc-700 dark:text-zinc-300 dark:border-zinc-600 dark:hover:bg-zinc-600"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Additional Info */}
        {profile && (
          <div className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
            <p>
              Account created: {new Date(profile.created_at).toLocaleDateString()}
            </p>
            {profile.updated_at && (
              <p>
                Last updated: {new Date(profile.updated_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}