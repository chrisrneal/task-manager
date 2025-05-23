import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../../../utils/supabaseClient'
import { uploadTaskFile } from '../../../../utils/taskFileUtils'

export const config = {
	api: {
		bodyParser: {
			sizeLimit: '10mb',
		},
	},
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
) {
	// Only allow POST requests
	if (req.method !== 'POST') {
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

	// Check if the user has permission to upload to this task
	const { data: taskData, error: taskError } = await supabase
		.from('tasks')
		.select('owner_id')
		.eq('id', taskId)
		.single()

	if (taskError || !taskData) {
		return res.status(404).json({ error: 'Task not found' })
	}

	if (
		taskData.owner_id !== authData.user.id &&
		authData.user.user_metadata?.role !== 'admin'
	) {
		return res.status(403).json({ error: 'Not authorized to upload to this task' })
	}

	try {
		// req.body should contain the file data and metadata
		const { file, fileName, fileType, fileSize } = req.body

		if (!file || !fileName || !fileType) {
			return res.status(400).json({ error: 'File data is incomplete' })
		}

		// Convert base64 file data to a File object
		const base64Data = file.split(',')[1]
		const buffer = Buffer.from(base64Data, 'base64')
		const blobFile = new Blob([buffer], { type: fileType })
		
		// Create a File object
		const fileObj = new File([blobFile], fileName, { type: fileType })

		// Upload the file
		const { filePath } = await uploadTaskFile(taskId, fileObj)

		return res.status(200).json({ 
			success: true, 
			filePath 
		})
	} catch (error: any) {
		console.error('Upload error:', error)
		return res.status(500).json({ 
			error: error.message || 'Failed to upload file' 
		})
	}
}