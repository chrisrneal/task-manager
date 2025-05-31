/**
 * @fileoverview Task File Management Utilities
 * 
 * This module provides comprehensive utilities for handling file uploads, validation,
 * and management for tasks in the task management system. It includes security measures,
 * file type validation, and integration with Supabase Storage.
 * 
 * Key Features:
 * - File upload validation (size, type, content)
 * - Secure file storage in Supabase Storage with organized folder structure
 * - Metadata tracking in database with automatic cleanup on failures
 * - Signed URL generation for secure file access
 * - File listing and deletion with proper error handling
 * 
 * Security Considerations:
 * - File size limits to prevent abuse
 * - MIME type validation to prevent malicious uploads
 * - Unique filename generation to prevent collisions
 * - Proper error handling to prevent information leakage
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { v4 as uuidv4 } from 'uuid'
import { supabase } from './supabaseClient'

// Configuration constants for file handling
/** Maximum allowed file size in bytes (10 MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

/** Allowed MIME types for file uploads */
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

/** Supabase Storage bucket name for task files */
const BUCKET_NAME = 'task-files'

/**
 * Validates file before upload to ensure security and compliance
 * 
 * Performs multiple validation checks:
 * - File existence validation
 * - File size validation against MAX_FILE_SIZE limit
 * - MIME type validation against ALLOWED_FILE_TYPES whitelist
 * 
 * This prevents:
 * - Large file uploads that could consume storage/bandwidth
 * - Malicious file types that could pose security risks
 * - Empty or null file submissions
 * 
 * @param {File} file - The File object to validate
 * @returns {{valid: boolean, error?: string}} Validation result with error message if invalid
 * 
 * @example
 * ```typescript
 * const result = validateFile(selectedFile);
 * if (!result.valid) {
 *   alert(result.error);
 *   return;
 * }
 * // Proceed with upload
 * ```
 */
export const validateFile = (file: File): { valid: boolean; error?: string } => {
	// Check if file exists
	if (!file) {
		return { valid: false, error: 'No file provided' }
	}

	// Validate file size to prevent abuse and storage issues
	if (file.size > MAX_FILE_SIZE) {
		return {
			valid: false,
			error: `File is too large. Maximum size is ${
				MAX_FILE_SIZE / (1024 * 1024)
			} MB`,
		}
	}

	// Validate MIME type against whitelist to prevent malicious uploads
	if (!ALLOWED_FILE_TYPES.includes(file.type)) {
		return {
			valid: false,
			error: 'Invalid file type. Only JPG, PNG, and PDF files are allowed',
		}
	}

	return { valid: true }
}

/**
 * Uploads a file to Supabase Storage and adds entry to task_files table
 * 
 * This function performs a two-phase upload process:
 * 1. Upload file to Supabase Storage with unique filename
 * 2. Store metadata in database for tracking and permissions
 * 
 * Features:
 * - Automatic file validation before upload
 * - Unique filename generation to prevent conflicts
 * - Organized storage structure (files grouped by taskId)
 * - Atomic operation with automatic cleanup on failure
 * - Comprehensive error handling and logging
 * 
 * @param {string} taskId - ID of the task to associate the file with
 * @param {File} file - The File object to upload
 * @returns {Promise<{filePath: string}>} Object containing the storage path of uploaded file
 * @throws {Error} If validation fails, upload fails, or metadata storage fails
 * 
 * @example
 * ```typescript
 * try {
 *   const result = await uploadTaskFile('task-123', selectedFile);
 *   console.log('File uploaded to:', result.filePath);
 * } catch (error) {
 *   console.error('Upload failed:', error.message);
 * }
 * ```
 */
export const uploadTaskFile = async (taskId: string, file: File) => {
	// Phase 1: Validate file before attempting upload
	const validation = validateFile(file)
	if (!validation.valid) {
		throw new Error(validation.error)
	}

	// Generate unique filename while preserving original extension
	// This prevents filename conflicts and maintains file type information
	const fileExt = file.name.split('.').pop()
	const fileName = `${uuidv4()}.${fileExt}`
	const filePath = `${taskId}/${fileName}` // Organize files by task ID

	// Phase 2: Upload file to Supabase Storage
	const { data: uploadData, error: uploadError } = await supabase.storage
		.from(BUCKET_NAME)
		.upload(filePath, file)

	if (uploadError) {
		throw new Error(`Error uploading file: ${uploadError.message}`)
	}

	// Phase 3: Store file metadata in database for tracking and permissions
	// This creates a record that can be used for access control and file management
	const { error: insertError } = await supabase.from('task_files').insert({
		task_id: taskId,
		path: filePath,
		mime_type: file.type,
		size: file.size,
	})

	if (insertError) {
		// If metadata insert fails, clean up the uploaded file to maintain consistency
		// This prevents orphaned files in storage
		await supabase.storage.from(BUCKET_NAME).remove([filePath])
		throw new Error(`Error storing file metadata: ${insertError.message}`)
	}

	return { filePath }
}

/**
 * Gets a signed URL for secure file access
 * 
 * Generates a time-limited signed URL that allows secure access to files
 * stored in Supabase Storage. The URL expires after the specified time
 * to prevent unauthorized long-term access.
 * 
 * Security Benefits:
 * - Time-limited access (1 hour expiry)
 * - No direct storage access required
 * - Automatic URL invalidation after expiry
 * - Proper access control through Supabase
 * 
 * @param {string} filePath - Storage path of the file to generate URL for
 * @returns {Promise<string>} Signed URL for file access
 * @throws {Error} If signed URL generation fails
 * 
 * @example
 * ```typescript
 * const url = await getTaskFileUrl('task-123/file.pdf');
 * // URL expires in 1 hour
 * window.open(url, '_blank');
 * ```
 */
export const getTaskFileUrl = async (filePath: string) => {
	const { data, error } = await supabase.storage
		.from(BUCKET_NAME)
		.createSignedUrl(filePath, 60 * 60) // 1 hour expiry for security

	if (error) {
		throw new Error(`Error generating signed URL: ${error.message}`)
	}

	return data.signedUrl
}

/**
 * Lists all files associated with a specific task
 * 
 * Retrieves file metadata for all files belonging to a task, ordered by
 * creation date (newest first). This provides the information needed to
 * display file lists in the UI and generate download links.
 * 
 * @param {string} taskId - ID of the task to list files for
 * @returns {Promise<Array>} Array of file metadata objects from task_files table
 * @throws {Error} If database query fails
 * 
 * @example
 * ```typescript
 * const files = await listTaskFiles('task-123');
 * files.forEach(file => {
 *   console.log(`File: ${file.path}, Size: ${file.size} bytes`);
 * });
 * ```
 */
export const listTaskFiles = async (taskId: string) => {
	const { data: files, error } = await supabase
		.from('task_files')
		.select('*')
		.eq('task_id', taskId)
		.order('created_at', { ascending: false })

	if (error) {
		throw new Error(`Error fetching task files: ${error.message}`)
	}

	return files
}

/**
 * Deletes a file from both storage and database
 * 
 * Performs a two-phase deletion process to ensure data consistency:
 * 1. Remove file from Supabase Storage
 * 2. Remove metadata record from task_files table
 * 
 * This ensures no orphaned files remain in storage and no broken
 * references remain in the database.
 * 
 * @param {string} filePath - Storage path of the file to delete
 * @returns {Promise<{success: boolean}>} Success indicator
 * @throws {Error} If deletion from storage or database fails
 * 
 * @example
 * ```typescript
 * try {
 *   await deleteTaskFile('task-123/file.pdf');
 *   console.log('File deleted successfully');
 * } catch (error) {
 *   console.error('Delete failed:', error.message);
 * }
 * ```
 */
export const deleteTaskFile = async (filePath: string) => {
	// Phase 1: Delete file from Supabase Storage
	const { error: deleteError } = await supabase.storage
		.from(BUCKET_NAME)
		.remove([filePath])

	if (deleteError) {
		throw new Error(`Error deleting file: ${deleteError.message}`)
	}

	// Phase 2: Remove metadata record from database
	const { error: deleteMetaError } = await supabase
		.from('task_files')
		.delete()
		.eq('path', filePath)

	if (deleteMetaError) {
		throw new Error(`Error deleting file metadata: ${deleteMetaError.message}`)
	}

	return { success: true }
}