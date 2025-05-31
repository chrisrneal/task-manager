import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import TaskForm from '@/components/TaskForm'
import { Task, TaskFieldValue, TaskWithFieldValues, TaskType, ProjectMemberWithUser } from '@/types/database'

export default function TaskDetail() {
	const router = useRouter()
	const { taskId, edit } = router.query
	const [task, setTask] = useState<TaskWithFieldValues | null>(null)
	const [fieldValues, setFieldValues] = useState<TaskFieldValue[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [taskTypes, setTaskTypes] = useState<TaskType[]>([])
	const [workflowStates, setWorkflowStates] = useState<{ id: string, name: string }[]>([])
	const [validNextStates, setValidNextStates] = useState<string[]>([])
	const [isEditing, setIsEditing] = useState(false)
	const [projectMembers, setProjectMembers] = useState<ProjectMemberWithUser[]>([])

	// Update isEditing when router query becomes available
	useEffect(() => {
		if (edit === 'true') {
			setIsEditing(true)
		}
	}, [edit])

	// Fetch project members
	const fetchProjectMembers = async (projectId: string) => {
		try {
			const { data: sessionData } = await supabase.auth.getSession()
			const token = sessionData.session?.access_token
			if (!token) throw new Error('No authentication token available')
			
			const response = await fetch(`/api/projects/${projectId}/members`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer ' + token
				}
			})
			
			if (!response.ok) throw new Error(`Error: ${response.status}`)
			const result = await response.json()
			setProjectMembers(result.data || [])
		} catch (err: any) {
			console.error('Error fetching project members:', err.message)
			// Not critical for main functionality, so we don't throw
		}
	}

	// Calculate valid next states for a given task state and task type
	const calculateValidNextStates = async (taskTypeId: string, currentStateId: string): Promise<string[]> => {
		try {
			// Get the task type to find its workflow
			const { data: taskType, error: taskTypeError } = await supabase
				.from('task_types')
				.select('workflow_id')
				.eq('id', taskTypeId)
				.single()

			if (taskTypeError) throw taskTypeError

			if (taskType?.workflow_id) {
				// Get the workflow transitions
				const { data: transitions, error: transitionsError } = await supabase
					.from('workflow_transitions')
					.select('*')
					.eq('workflow_id', taskType.workflow_id)

				if (transitionsError) throw transitionsError

				// Get the valid next states based on the current state
				const validStates = transitions
					.filter(t => 
						// Include transitions from the current state
						t.from_state === currentStateId || 
						// Also include "any state" transitions (stored as NULL in DB)
						t.from_state === null
					)
					.map(t => t.to_state)

				return validStates
			}
		} catch (err: any) {
			console.error('Error calculating valid next states:', err)
		}
		return []
	}

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

					// Fetch project members
					await fetchProjectMembers(data.project_id)

					// Calculate valid next states for the current task state
					if (data.task_type_id && data.state_id) {
						const validStates = await calculateValidNextStates(data.task_type_id, data.state_id)
						setValidNextStates(validStates)
					}
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

	const handleTaskFormSubmit = async (updatedTask: TaskWithFieldValues) => {
		if (!task) return

		setLoading(true)
		setError(null)

		try {
			// Get the session token
			const { data: sessionData } = await supabase.auth.getSession()
			const token = sessionData.session?.access_token

			if (!token) {
				throw new Error('No authentication token available')
			}

			// Update task in database
			const response = await fetch(`/api/tasks/${task.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer ' + token
				},
				body: JSON.stringify({
					name: updatedTask.name,
					description: updatedTask.description || null,
					project_id: updatedTask.project_id,
					task_type_id: updatedTask.task_type_id,
					state_id: updatedTask.state_id,
					field_values: updatedTask.field_values
				})
			})

			if (!response.ok) {
				throw new Error(`Error: ${response.status}`)
			}

			const result = await response.json()
			console.log('Task updated successfully:', result.data.id)

			// Update local state
			setTask(result.data)

			// Recalculate valid next states if the task type or state changed
			if (result.data.task_type_id && result.data.state_id) {
				const newValidStates = await calculateValidNextStates(result.data.task_type_id, result.data.state_id)
				setValidNextStates(newValidStates)
			}
		} catch (err: any) {
			console.error('Error updating task:', err)
			setError(err.message || 'Failed to update task')
		} finally {
			setLoading(false)
		}
	}

	const handleTaskFormCancel = () => {
		// If in edit mode, just disable editing without navigating away
		if (isEditing) {
			setIsEditing(false)
			return
		}
		
		// Otherwise, navigate back
		router.back()
	}
	
	const toggleEditMode = () => {
		setIsEditing(!isEditing)
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
		field_values: task?.field_values || []
	}

	return (
		<div className='p-4'>
			<div className="flex justify-between items-center mb-4">
				<h1 className='text-2xl font-bold'>{task.name}</h1>
				<div className="flex items-center space-x-2">
					<button
						onClick={toggleEditMode}
						className="px-3 py-1 bg-gray-200 dark:bg-zinc-700 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 text-sm"
					>
						{isEditing ? 'Cancel Editing' : 'Edit'}
					</button>
					<button
						onClick={() => router.back()}
						className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
						aria-label="Close"
					>
						✕
					</button>
				</div>
			</div>
			
			<div className='bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6 overflow-auto max-h-[calc(100vh-8rem)]'>
				<TaskForm
					mode="view"
					projectId={task.project_id}
					taskTypeId={task.task_type_id}
					stateId={task.state_id}
					initialValues={taskWithFieldValues}
					validNextStates={validNextStates}
					taskTypes={taskTypes}
					workflowStates={workflowStates}
					onSubmit={handleTaskFormSubmit}
					onCancel={handleTaskFormCancel}
					allowEditing={isEditing}
					projectMembers={projectMembers}
				/>
			</div>
		</div>
	)
}