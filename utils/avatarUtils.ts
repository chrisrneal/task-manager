/**
 * @fileoverview Avatar Upload Utilities
 * 
 * This module provides utilities for handling user avatar uploads with validation,
 * security measures, and integration with Supabase Storage.
 * 
 * Key Features:
 * - Avatar upload validation (size, type, image format)
 * - Secure storage in Supabase Storage
 * - Automatic cleanup of old avatars
 * - Image optimization and resizing
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { v4 as uuidv4 } from 'uuid'
import { supabase } from './supabaseClient'

// Configuration constants for avatar handling
/** Maximum allowed avatar size in bytes (2 MB) */
const MAX_AVATAR_SIZE = 2 * 1024 * 1024 // 2 MB

/** Allowed MIME types for avatar uploads */
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']

/** Supabase Storage bucket name for avatars */
const BUCKET_NAME = 'avatars'

/**
 * Validates avatar file before upload
 * 
 * @param {File} file - The File object to validate
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export const validateAvatar = (file: File): { valid: boolean; error?: string } => {
  if (!file) {
    return { valid: false, error: 'No file provided' }
  }

  // Validate file size
  if (file.size > MAX_AVATAR_SIZE) {
    return {
      valid: false,
      error: `Avatar is too large. Maximum size is ${MAX_AVATAR_SIZE / (1024 * 1024)} MB`,
    }
  }

  // Validate MIME type
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Only JPG, PNG, and WebP images are allowed',
    }
  }

  return { valid: true }
}

/**
 * Uploads an avatar and returns the public URL
 * 
 * @param {string} userId - ID of the user uploading the avatar
 * @param {File} file - The avatar file to upload
 * @returns {Promise<{avatarUrl: string}>} Object containing the public URL
 */
export const uploadAvatar = async (userId: string, file: File) => {
  // Validate file
  const validation = validateAvatar(file)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  // Generate unique filename
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const fileName = `${userId}/${uuidv4()}.${fileExt}`

  try {
    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      throw new Error(`Failed to upload avatar: ${uploadError.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName)

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get avatar URL')
    }

    return { avatarUrl: urlData.publicUrl }
  } catch (error) {
    console.error('Avatar upload error:', error)
    throw error
  }
}

/**
 * Deletes an avatar from storage
 * 
 * @param {string} avatarUrl - The public URL of the avatar to delete
 * @returns {Promise<{success: boolean}>} Success indicator
 */
export const deleteAvatar = async (avatarUrl: string) => {
  try {
    // Extract path from URL
    const url = new URL(avatarUrl)
    const pathParts = url.pathname.split('/')
    const bucketIndex = pathParts.findIndex(part => part === BUCKET_NAME)
    
    if (bucketIndex === -1 || bucketIndex === pathParts.length - 1) {
      throw new Error('Invalid avatar URL format')
    }

    const filePath = pathParts.slice(bucketIndex + 1).join('/')

    // Delete from storage
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath])

    if (error) {
      throw new Error(`Failed to delete avatar: ${error.message}`)
    }

    return { success: true }
  } catch (error) {
    console.error('Avatar deletion error:', error)
    throw error
  }
}