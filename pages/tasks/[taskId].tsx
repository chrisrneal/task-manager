import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import FileUpload from '@/components/FileUpload'
import TaskForm from '@/components/TaskForm'
import { Task, TaskFieldValue, TaskWithFieldValues, TaskType } from '@/types/database'

export default function TaskDetail() {
	const router = useRouter()
	const { taskId } = router.query
	const [task, setTask] = useState<TaskWithFieldValues | null>(null)
	const [fieldValues, setFieldValues] = useState<TaskFieldValue[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [taskTypes, setTaskTypes] = useState<TaskType[]>([])
	const [workflowStates, setWorkflowStates] = useState<{ id: string, name: string }[]>([])
	const [validNextStates, setValidNextStates] = useState<string[]>([])

	useEffect(() => {
		if (!taskId) return

		const fetchTask = async () => {
			setLoading(true)
			setError(null)

			try {
				// Fetch task data
				const { data, error } = await supabase
					.from('tasks')
					.select('*')
					.eq('id', taskId)
					.single()

				if (error) throw error
				setTask({...data, field_values: []})

				// Fetch task field values if task has a type
				if (data.task_type_id) {
					const { data: fieldValuesData, error: fieldValuesError } = await supabase
						.from('task_field_values')
						.select('*')
						.eq('task_id', taskId)

					if (fieldValuesError) throw fieldValuesError
					setTask(prev => prev ? {...prev, field_values: fieldValuesData || []} : null)
				}

				// Fetch task types for the project
				if (data.project_id) {
					const { data: typesData, error: typesError } = await supabase
						.from('task_types')
						.select('*')
						.eq('project_id', data.project_id)

					if (typesError) throw typesError
					setTaskTypes(typesData || [])
				}

				// Fetch states for the project
				if (data.project_id) {
					const { data: statesData, error: statesError } = await supabase
						.from('project_states')
						.select('*')
						.eq('project_id', data.project_id)

					if (statesError) throw statesError
					setWorkflowStates(statesData.map(state => ({
						id: state.id,
						name: state.name
					})) || [])

					// Set valid next states (for this view, all states are valid)
					setValidNextStates(statesData.map(state => state.id))
				}
			} catch (err: any) {
				console.error('Error fetching task:', err)
				setError(err.message || 'Failed to fetch task details')
			} finally {
				setLoading(false)
			}
		}

		fetchTask()
	}, [taskId])

	const handleTaskFormSubmit = (task: TaskWithFieldValues) => {
		// This is view-only mode, so this won't be called
		console.log('Task form submitted:', task)
	}

	const handleTaskFormCancel = () => {
		// Navigate back to projects
		router.back()
	}

	if (loading) {
		return <div className='p-4'>Loading...</div>
	}

	if (error) {
		return <div className='p-4 text-red-500'>Error: {error}</div>
	}

	if (!task) {
		return <div className='p-4'>Task not found</div>
	}

	// Prepare task with field values for the form
	const taskWithFieldValues = {
		...task,
		field_values: fieldValues
	}

	return (
		<div className='p-4'>
			<h1 className='text-2xl font-bold mb-4'>{task.name}</h1>
			
			<div className='bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6'>
				<div className='mb-4'>
					<h2 className='text-lg font-semibold mb-2'>Task Details</h2>
					
					<TaskForm
						mode="view"
						projectId={task.project_id}
						taskTypeId={task.task_type_id}
						stateId={task.state_id}
						initialValues={taskWithFieldValues}
						validNextStates={[task.state_id || '']}
						taskTypes={taskTypes}
						workflowStates={workflowStates}
						onSubmit={handleTaskFormSubmit}
						onCancel={handleTaskFormCancel}
					/>
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