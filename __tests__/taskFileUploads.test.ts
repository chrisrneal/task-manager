import { test, expect } from '@playwright/test'
import { supabase } from '../utils/supabaseClient'

test.describe('Task file uploads', () => {
	// This test assumes we have two test users already set up in the system
	// owner@example.com - who owns the task
	// other@example.com - who should not have access

	let taskId: string
	let ownerId: string
	let filePath: string

	test.beforeAll(async () => {
		// Authentication - sign in as owner
		const { data: ownerAuth } = await supabase.auth.signInWithPassword({
			email: 'owner@example.com',
			password: 'password123',
		})

		ownerId = ownerAuth?.user?.id || ''

		// Create a test task
		const { data: task } = await supabase
			.from('tasks')
			.insert({
				name: 'Test File Upload Task',
				description: 'Task for testing file uploads',
				owner_id: ownerId,
			})
			.select()
			.single()

		taskId = task?.id
	})

	test.afterAll(async () => {
		// Clean up - delete the task and any associated files
		if (taskId) {
			await supabase.from('tasks').delete().eq('id', taskId)
		}
	})

	test('Owner can upload and access files', async ({ page }) => {
		// Login as owner
		await page.goto('/auth/signin')
		await page.fill('input[name="email"]', 'owner@example.com')
		await page.fill('input[name="password"]', 'password123')
		await page.click('button[type="submit"]')

		// Navigate to the task page
		await page.goto(`/tasks/${taskId}`)

		// Wait for the file upload component to be visible
		await page.waitForSelector('[data-testid="file-upload"]')

		// Upload a test file
		const fileInput = await page.locator('input[type="file"]')
		await fileInput.setInputFiles({
			name: 'test-image.png',
			mimeType: 'image/png',
			buffer: Buffer.from('fake image content'),
		})

		// Wait for upload to complete
		await page.waitForSelector('text=Attachments')

		// Verify file appears in the list
		const fileListItem = await page.locator('li:has-text("test-image")')
		await expect(fileListItem).toBeVisible()

		// Store the file path for the next test
		const { data: taskFiles } = await supabase
			.from('task_files')
			.select('path')
			.eq('task_id', taskId)
			.single()

		filePath = taskFiles?.path || ''
	})

	test('Unauthorized user cannot access files', async ({ page }) => {
		// Login as different user
		await page.goto('/auth/signin')
		await page.fill('input[name="email"]', 'other@example.com')
		await page.fill('input[name="password"]', 'password123')
		await page.click('button[type="submit"]')

		// Try to access the file directly via the signed URL path pattern
		await page.goto(`/api/file/${filePath}`)

		// Should get unauthorized or not found
		await expect(page.locator('body')).toContainText(
			/unauthorized|forbidden|not found/i
		)

		// Try to access the task page
		await page.goto(`/tasks/${taskId}`)

		// Should not see the task or get a "not found" message
		await expect(page.locator('body')).not.toContainText('Test File Upload Task')
	})
})