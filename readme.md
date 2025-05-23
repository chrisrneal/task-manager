<p align="center">
	<img alt="Task Manager" src="public/images/icon-512.png" width="90">
	<h2 align="center">Task Manager</h2>
</p>

<p align="center">A modern, workflow-driven task management application</p>

<p align="center">
	<a href="https://task-manager-demo.vercel.app">Live demo</a>
</p>

<p align="center">
	<a href="https://web.dev/measure">
		<img alt="100% lighthouse scores" src="https://img.shields.io/badge/lighthouse-100%25-845EF7.svg?logo=lighthouse&logoColor=white&style=flat-square" />
	</a>
</p>

## Features

- ✨ Modern PWA using Next.js
- 🌗 Dark and light themes
- 📱 Responsive design for all devices
- 🔄 Real-time updates with Supabase
- 🔐 Secure authentication
- 📊 Customizable project dashboards
- 🚀 Dynamic task board with workflow states
- 🔄 Workflow-driven task transitions
- 📎 Secure file uploads for task attachments

## Task Management

The application allows users to:

- Create and manage projects
- Add tasks with details like name, description, priority, and due date
- Organize tasks in customizable boards
- Track task progress through workflows
- Attach files (images, PDFs) to tasks with secure access control

## Task Files

### Security Features

- **Supabase Storage Integration**: Files are stored in a secure, private bucket
- **Row-Level Security**: Files inherit the same access control as their parent tasks
- **Signed URLs**: File downloads use temporary signed URLs with 60-minute expiry
- **Type Validation**: Only allowed file types (JPEG, PNG, PDF) can be uploaded
- **Size Limits**: Maximum file size of 10 MB enforced

### Implementation

Files can be uploaded to tasks using a drag-and-drop interface. Each task can have multiple file attachments, with thumbnails for previewing images and icons for PDFs. File deletion is available with confirmation to prevent accidental removal.

## Workflow System

### Key Features

- **Dynamic Board Columns**: Task boards render columns from workflow states instead of hardcoded statuses
- **Workflow State Transitions**: Tasks can only move to valid next states in their workflow
- **Task Type Integration**: Changing a task's type automatically updates its workflow and resets to the first state
- **Two-layer Validation**:
  - Frontend: UI only shows valid state options based on current workflow position
  - Backend: Database constraints validate state transitions server-side

### How It Works

1. Each project can have multiple task types (e.g., Bug, Feature, Epic)
2. Task types are associated with specific workflows
3. Workflows define a sequence of states (columns on the board)
4. When creating or editing a task:
   - Selecting a task type assigns its workflow
   - Only valid state transitions are allowed
   - Changing task type resets the workflow state

### Technical Implementation

The workflow system is implemented with:

- Database schema with `workflows`, `workflow_steps`, `task_types`, and `project_states` tables
- PostgreSQL trigger function to validate state transitions
- React components for dynamic board rendering
- Frontend logic to manage workflow state changes

## Getting started

1. Clone the repository
2. Install dependencies with `npm install`
3. Set up your Supabase environment variables
4. Run the development server with `npm run dev`
5. Visit `http://localhost:3000` to see the app

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Deployment**: Vercel

## AI Automation

This repository is configured for GitHub Copilot to help maintain documentation and code consistency. When code changes are made:

- Copilot may suggest or open PRs that update documentation to reflect code changes
- All PRs will be reviewed through the normal process
- Copilot follows the existing code standards and styles in the repository
