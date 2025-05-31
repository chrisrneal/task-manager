/**
 * @fileoverview Task File Management Utilities
 * 
 * This module provides utility functions for managing file attachments on tasks,
 * including file upload, validation, storage, and retrieval operations. It integrates
 * with Supabase Storage for file hosting and maintains file metadata in the database.
 * 
 * Features:
 * - File validation (size, type restrictions)
 * - Secure file upload to Supabase Storage
 * - File metadata management in database
 * - Signed URL generation for secure file access
 * - File deletion with cleanup
 * 
 * File constraints:
 * - Maximum size: 10 MB
 * - Allowed types: JPEG, PNG, PDF
 * - Storage bucket: 'task-files'
 */

import { v4 as uuidv4 } from 'uuid'
import { supabase } from './supabaseClient'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const BUCKET_NAME = 'task-files'

/**
 * Validates file before upload
 * 
 * Performs comprehensive validation to ensure uploaded files meet system requirements:
 * - File must be provided
 * - File size must not exceed maximum limit (10 MB)
 * - File type must be in allowed list (JPEG, PNG, PDF)
 * 
 * @param file - File object to validate
 * @returns Validation result with success status and error message if applicable
 */
export const validateFile = (file: File): { valid: boolean; error?: string } => {
	if (!file) {
		return { valid: false, error: 'No file provided' }
	}

	if (file.size > MAX_FILE_SIZE) {
		return {
			valid: false,
			error: `File is too large. Maximum size is ${
				MAX_FILE_SIZE / (1024 * 1024)
			} MB`,
		}
	}

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
 * Performs a complete file upload workflow:
 * 1. Validates the file using validateFile()
 * 2. Generates unique filename to prevent conflicts
 * 3. Uploads file to Supabase Storage in task-specific folder
 * 4. Stores file metadata in task_files table
 * 5. Cleans up uploaded file if metadata storage fails
 * 
 * @param taskId - UUID of the task to associate the file with
 * @param file - File object to upload
 * @returns Promise resolving to object with filePath on success
 * @throws Error if validation fails, upload fails, or metadata storage fails
 */
export const uploadTaskFile = async (taskId: string, file: File) => {
	const validation = validateFile(file)
	if (!validation.valid) {
		throw new Error(validation.error)
	}

	// Create a unique filename with original extension
	const fileExt = file.name.split('.').pop()
	const fileName = `${uuidv4()}.${fileExt}`
	const filePath = `${taskId}/${fileName}`

	// Upload to Supabase Storage
	const { data: uploadData, error: uploadError } = await supabase.storage
		.from(BUCKET_NAME)
		.upload(filePath, file)

	if (uploadError) {
		throw new Error(`Error uploading file: ${uploadError.message}`)
	}

	// Store metadata in task_files table
	const { error: insertError } = await supabase.from('task_files').insert({
		task_id: taskId,
		path: filePath,
		mime_type: file.type,
		size: file.size,
	})

	if (insertError) {
		// If metadata insert fails, delete the uploaded file
		await supabase.storage.from(BUCKET_NAME).remove([filePath])
		throw new Error(`Error storing file metadata: ${insertError.message}`)
	}

	return { filePath }
}

/**
 * Gets a signed URL for a file
 * 
 * Generates a temporary signed URL for secure file access without requiring
 * authentication. The URL expires after 1 hour for security purposes.
 * 
 * @param filePath - Path to the file in Supabase Storage
 * @returns Promise resolving to signed URL string
 * @throws Error if URL generation fails
 */
export const getTaskFileUrl = async (filePath: string) => {
	const { data, error } = await supabase.storage
		.from(BUCKET_NAME)
		.createSignedUrl(filePath, 60 * 60) // 1 hour expiry

	if (error) {
		throw new Error(`Error generating signed URL: ${error.message}`)
	}

	return data.signedUrl
}

/**
 * Lists all files for a task
 * 
 * Retrieves file metadata for all files associated with a specific task,
 * ordered by creation date (newest first). Returns database records from
 * the task_files table.
 * 
 * @param taskId - UUID of the task to list files for
 * @returns Promise resolving to array of file metadata objects
 * @throws Error if database query fails
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
 * Deletes a file from storage and database
 * 
 * Performs complete file deletion workflow:
 * 1. Removes file from Supabase Storage
 * 2. Removes file metadata from task_files table
 * Both operations must succeed for complete cleanup.
 * 
 * @param filePath - Path to the file in Supabase Storage
 * @returns Promise resolving to success object
 * @throws Error if storage deletion or database deletion fails
 */
export const deleteTaskFile = async (filePath: string) => {
	// Delete from storage
	const { error: deleteError } = await supabase.storage
		.from(BUCKET_NAME)
		.remove([filePath])

	if (deleteError) {
		throw new Error(`Error deleting file: ${deleteError.message}`)
	}

	// Delete metadata
	const { error: deleteMetaError } = await supabase
		.from('task_files')
		.delete()
		.eq('path', filePath)

	if (deleteMetaError) {
		throw new Error(`Error deleting file metadata: ${deleteMetaError.message}`)
	}

	return { success: true }
}