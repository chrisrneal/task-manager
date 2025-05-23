import React, { useState, useRef, useEffect } from 'react'
import {
	uploadTaskFile,
	listTaskFiles,
	getTaskFileUrl,
	deleteTaskFile,
} from '../utils/taskFileUtils'

type FileUploadProps = {
	taskId: string
}

type TaskFile = {
	id: string
	task_id: string
	path: string
	mime_type: string
	size: number
	created_at: string
	signedUrl?: string
}

const FileUpload: React.FC<FileUploadProps> = ({ taskId }) => {
	const [files, setFiles] = useState<TaskFile[]>([])
	const [isUploading, setIsUploading] = useState(false)
	const [uploadProgress, setUploadProgress] = useState(0)
	const [errorMessage, setErrorMessage] = useState('')
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

	// Load existing files on component mount
	useEffect(() => {
		const fetchFiles = async () => {
			try {
				const taskFiles = await listTaskFiles(taskId)
				// Get signed URLs for each file
				const filesWithUrls = await Promise.all(
					taskFiles.map(async (file) => {
						try {
							const signedUrl = await getTaskFileUrl(file.path)
							return { ...file, signedUrl }
						} catch (error) {
							console.error(`Error getting signed URL for ${file.path}:`, error)
							return file
						}
					})
				)
				setFiles(filesWithUrls)
			} catch (error) {
				console.error('Error fetching task files:', error)
				setErrorMessage('Failed to load files')
			}
		}

		if (taskId) {
			fetchFiles()
		}
	}, [taskId])

	const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFiles = event.target.files
		if (!selectedFiles || selectedFiles.length === 0) return

		setIsUploading(true)
		setUploadProgress(0)
		setErrorMessage('')

		try {
			// Upload each file
			for (let i = 0; i < selectedFiles.length; i++) {
				const file = selectedFiles[i]
				const progress = Math.round(((i + 1) / selectedFiles.length) * 100)
				setUploadProgress(progress)

				await uploadTaskFile(taskId, file)
			}

			// Refresh file list
			const taskFiles = await listTaskFiles(taskId)
			const filesWithUrls = await Promise.all(
				taskFiles.map(async (file) => {
					const signedUrl = await getTaskFileUrl(file.path)
					return { ...file, signedUrl }
				})
			)
			setFiles(filesWithUrls)
		} catch (error: any) {
			console.error('Upload error:', error)
			setErrorMessage(error.message || 'Upload failed')
		} finally {
			setIsUploading(false)
			setUploadProgress(0)
			if (fileInputRef.current) {
				fileInputRef.current.value = ''
			}
		}
	}

	const handleDelete = async (filePath: string) => {
		try {
			await deleteTaskFile(filePath)
			setFiles(files.filter((file) => file.path !== filePath))
			setShowDeleteConfirm(null)
		} catch (error: any) {
			console.error('Delete error:', error)
			setErrorMessage(error.message || 'Delete failed')
		}
	}

	const formatFileSize = (bytes: number) => {
		if (bytes < 1024) return bytes + ' B'
		else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
		else return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
	}

	const getFileIcon = (mimeType: string) => {
		if (mimeType.startsWith('image/')) {
			return '🖼️'
		} else if (mimeType === 'application/pdf') {
			return '📄'
		} else {
			return '📎'
		}
	}

	return (
		<div className='my-4 w-full'>
			<div
				className='border-2 border-dashed border-gray-300 dark:border-gray-600 p-4 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
				onClick={() => fileInputRef.current?.click()}
			>
				<div className='text-center'>
					<p className='text-gray-500 dark:text-gray-400'>
						Drag and drop files here or click to browse
					</p>
					<p className='text-xs text-gray-400 dark:text-gray-500 mt-1'>
						Accepted formats: JPG, PNG, PDF (Max 10MB)
					</p>
				</div>
				<input
					type='file'
					ref={fileInputRef}
					onChange={handleFileChange}
					accept='.jpg,.jpeg,.png,.pdf'
					className='hidden'
					multiple
					disabled={isUploading}
				/>
			</div>

			{isUploading && (
				<div className='mt-4'>
					<div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5'>
						<div
							className='bg-blue-600 h-2.5 rounded-full'
							style={{ width: `${uploadProgress}%` }}
						></div>
					</div>
					<p className='text-center text-sm mt-1 text-gray-500 dark:text-gray-400'>
						Uploading... {uploadProgress}%
					</p>
				</div>
			)}

			{errorMessage && (
				<p className='text-red-500 text-sm mt-2'>{errorMessage}</p>
			)}

			{files.length > 0 && (
				<div className='mt-4'>
					<h3 className='text-lg font-medium mb-2'>Attachments</h3>
					<ul className='space-y-2'>
						{files.map((file) => (
							<li
								key={file.id}
								className='border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex justify-between items-center'
							>
								<div className='flex items-center'>
									<span className='text-2xl mr-3'>
										{getFileIcon(file.mime_type)}
									</span>
									<div>
										<a
											href={file.signedUrl}
											target='_blank'
											rel='noopener noreferrer'
											className='text-blue-500 hover:underline'
										>
											{file.path.split('/').pop()}
										</a>
										<p className='text-xs text-gray-500 dark:text-gray-400'>
											{formatFileSize(file.size)}
										</p>
									</div>
								</div>
								{showDeleteConfirm === file.path ? (
									<div className='flex space-x-2'>
										<button
											onClick={() => handleDelete(file.path)}
											className='text-xs bg-red-500 text-white px-2 py-1 rounded'
										>
											Confirm
										</button>
										<button
											onClick={() => setShowDeleteConfirm(null)}
											className='text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded'
										>
											Cancel
										</button>
									</div>
								) : (
									<button
										onClick={() => setShowDeleteConfirm(file.path)}
										className='text-gray-500 hover:text-red-500'
									>
										🗑️
									</button>
								)}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	)
}

export default FileUpload