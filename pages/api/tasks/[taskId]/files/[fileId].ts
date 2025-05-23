import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../../../../utils/supabaseClient'
import { deleteTaskFile } from '../../../../../utils/taskFileUtils'

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
) {
	// Only allow DELETE requests
	if (req.method !== 'DELETE') {
		return res.status(405).json({ error: 'Method not allowed' })
	}

	// Get the auth token from the request
	const authHeader = req.headers.authorization
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return res.status(401).json({ error: 'Unauthorized' })
	}

	const token = authHeader.substring(7)

	// Verify the token with Supabase
	const { data: authData, error: authError } = await supabase.auth.getUser(token)
	if (authError || !authData.user) {
		return res.status(401).json({ error: 'Invalid token' })
	}

	const { taskId, fileId } = req.query
	if (!taskId || typeof taskId !== 'string') {
		return res.status(400).json({ error: 'Task ID is required' })
	}
	if (!fileId || typeof fileId !== 'string') {
		return res.status(400).json({ error: 'File ID is required' })
	}

	// First get the file details
	const { data: fileData, error: fileError } = await supabase
		.from('task_files')
		.select('path, task_id')
		.eq('id', fileId)
		.single()

	if (fileError || !fileData) {
		return res.status(404).json({ error: 'File not found' })
	}

	// Make sure the file belongs to the specified task
	if (fileData.task_id !== taskId) {
		return res.status(400).json({ error: 'File does not belong to the specified task' })
	}

	// Check if the user has permission to delete this file
	const { data: taskData, error: taskError } = await supabase
		.from('tasks')
		.select('owner_id')
		.eq('id', taskId)
		.single()

	if (taskError || !taskData) {
		return res.status(404).json({ error: 'Task not found' })
	}

	const isOwnerOrAdmin =
		taskData.owner_id === authData.user.id ||
		authData.user.user_metadata?.role === 'admin'

	if (!isOwnerOrAdmin) {
		return res.status(403).json({ error: 'Not authorized to delete this file' })
	}

	try {
		await deleteTaskFile(fileData.path)
		return res.status(200).json({ success: true })
	} catch (error: any) {
		console.error('Error deleting file:', error)
		return res.status(500).json({ 
			error: error.message || 'Failed to delete file' 
		})
	}
}