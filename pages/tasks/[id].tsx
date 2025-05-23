import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../../utils/supabaseClient'
import FileUpload from '../../components/FileUpload'

type Task = {
	id: string
	name: string
	description: string
	status: string
	priority: string
	due_date: string
	owner_id: string
}

export default function TaskDetail() {
	const router = useRouter()
	const { id } = router.query
	const [task, setTask] = useState<Task | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!id) return

		const fetchTask = async () => {
			setLoading(true)
			setError(null)

			try {
				const { data, error } = await supabase
					.from('tasks')
					.select('*')
					.eq('id', id)
					.single()

				if (error) throw error
				setTask(data)
			} catch (err: any) {
				console.error('Error fetching task:', err)
				setError(err.message || 'Failed to fetch task details')
			} finally {
				setLoading(false)
			}
		}

		fetchTask()
	}, [id])

	if (loading) {
		return <div className='p-4'>Loading...</div>
	}

	if (error) {
		return <div className='p-4 text-red-500'>Error: {error}</div>
	}

	if (!task) {
		return <div className='p-4'>Task not found</div>
	}

	return (
		<div className='p-4'>
			<h1 className='text-2xl font-bold mb-4'>{task.name}</h1>
			
			<div className='bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6'>
				<div className='mb-4'>
					<h2 className='text-lg font-semibold mb-2'>Details</h2>
					<p className='text-gray-700 dark:text-gray-300 whitespace-pre-wrap'>
						{task.description || 'No description provided.'}
					</p>
				</div>
				
				<div className='grid grid-cols-2 gap-4 mb-4'>
					<div>
						<span className='text-gray-500 dark:text-gray-400 text-sm'>Status</span>
						<p className='font-medium'>{task.status}</p>
					</div>
					<div>
						<span className='text-gray-500 dark:text-gray-400 text-sm'>Priority</span>
						<p className='font-medium'>{task.priority}</p>
					</div>
					{task.due_date && (
						<div>
							<span className='text-gray-500 dark:text-gray-400 text-sm'>Due Date</span>
							<p className='font-medium'>
								{new Date(task.due_date).toLocaleDateString()}
							</p>
						</div>
					)}
				</div>
			</div>
			
			<div className='bg-white dark:bg-gray-800 rounded-lg shadow-md p-4'>
				<h2 className='text-lg font-semibold mb-4'>Attachments</h2>
				<div data-testid="file-upload">
					<FileUpload taskId={task.id} />
				</div>
			</div>
		</div>
	)
}