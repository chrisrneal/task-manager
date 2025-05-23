import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../../../utils/supabaseClient'
import { getTaskFileUrl, listTaskFiles } from '../../../../utils/taskFileUtils'

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
) {
	// Only allow GET requests
	if (req.method !== 'GET') {
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

	const { taskId } = req.query
	if (!taskId || typeof taskId !== 'string') {
		return res.status(400).json({ error: 'Task ID is required' })
	}

	// Check if the user has permission to view this task
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
		return res.status(403).json({ error: 'Not authorized to view this task' })
	}

	try {
		const files = await listTaskFiles(taskId)
		
		// Generate signed URLs for each file
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