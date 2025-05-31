/**
 * @fileoverview Task File Management API Endpoint
 * 
 * This API endpoint handles file retrieval for tasks with proper authorization
 * and security checks. It provides secure access to task files through signed URLs
 * with proper authentication and ownership validation.
 * 
 * Supported Operations:
 * - GET: List all files associated with a task with signed download URLs
 * 
 * Key Features:
 * - Task ownership verification and access control
 * - Integration with task file utilities for file operations
 * - Signed URL generation for secure file access
 * - Proper authentication and authorization checks
 * - Admin role support for broader access
 * 
 * Security:
 * - Bearer token authentication required
 * - Task ownership validation (owner or admin)
 * - Signed URLs with time-limited access
 * - File path validation through utility functions
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../../../utils/supabaseClient'
import { getTaskFileUrl, listTaskFiles } from '../../../../utils/taskFileUtils'

/**
 * Task Files API Handler
 * 
 * Handles HTTP requests for task file operations. Currently supports GET method
 * for listing files with comprehensive security checks and signed URL generation.
 * 
 * @param {NextApiRequest} req - Next.js API request object
 * @param {NextApiResponse} res - Next.js API response object
 * @returns {Promise<void>} Handles response directly, no return value
 */
export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
) {
	/**
	 * GET /api/tasks/[taskId]/files
	 * 
	 * Retrieves all files associated with a task, generating signed URLs
	 * for secure access. Includes proper authorization checks.
	 */
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' })
	}

	// Extract and validate Bearer token from Authorization header
	const authHeader = req.headers.authorization
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return res.status(401).json({ error: 'Unauthorized' })
	}

	const token = authHeader.substring(7)

	// Verify authentication token with Supabase Auth
	const { data: authData, error: authError } = await supabase.auth.getUser(token)
	if (authError || !authData.user) {
		return res.status(401).json({ error: 'Invalid token' })
	}

	// Validate task ID parameter
	const { taskId } = req.query
	if (!taskId || typeof taskId !== 'string') {
		return res.status(400).json({ error: 'Task ID is required' })
	}

	// Verify user has permission to access this task
	// Check task ownership or admin role
	const { data: taskData, error: taskError } = await supabase
		.from('tasks')
		.select('owner_id')
		.eq('id', taskId)
		.single()

	if (taskError || !taskData) {
		return res.status(404).json({ error: 'Task not found' })
	}

	// Authorization check: user must own the task or have admin role
	const isOwnerOrAdmin =
		taskData.owner_id === authData.user.id ||
		authData.user.user_metadata?.role === 'admin'

	if (!isOwnerOrAdmin) {
		return res.status(403).json({ error: 'Not authorized to view this task' })
	}

	try {
		// Get file list using utility function
		const files = await listTaskFiles(taskId)
		
		// Generate signed URLs for secure file access
		// Each URL is time-limited for security
		const filesWithUrls = await Promise.all(
			files.map(async (file) => {
				const signedUrl = await getTaskFileUrl(file.path)
				return { ...file, signedUrl }
			})
		)

		return res.status(200).json({ files: filesWithUrls })
	} catch (error: any) {
		console.error('Error retrieving files:', error)
		return res.status(500).json({ 
			error: error.message || 'Failed to retrieve files' 
		})
	}
}