import { v4 as uuidv4 } from 'uuid'
import { supabase } from './supabaseClient'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const BUCKET_NAME = 'task-files'

/**
 * Validates file before upload
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
 * Deletes a file
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