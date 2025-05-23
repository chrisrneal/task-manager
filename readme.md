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

## Task Management

The application allows users to:

- Create and manage projects
- Edit project names and descriptions from Project Settings (for project owners and admins)
- Add tasks with details like name, description, priority, and due date
- Organize tasks in customizable boards
- Track task progress through workflows

## Project Management

### Project Settings

Project owners and administrators can access the Project Settings page to:

- **Edit Project Details**: Update the project name and description
- **Manage Workflow States**: Configure custom states for task organization
- **Create Workflows**: Define sequences of states for different task types
- **Configure Task Types**: Set up different task types (Bug, Feature, Epic, etc.) with associated workflows

Access to project settings is restricted to project owners and users with admin privileges.

## Workflow System

### Key Features

- **Dynamic Board Columns**: Task boards render columns from workflow states instead of hardcoded statuses
- **Workflow State Transitions**: Tasks can only move to valid next states in their workflow
- **Task Type Integration**: Changing a task's type automatically updates its workflow and resets to the first state
- **Branching & Cyclical Workflows**: States can have multiple outgoing transitions, enabling complex workflow patterns
- **Any-State Transitions**: Special transitions that allow moving to a specific state from any other state
- **Interactive Workflow Editor**: Canvas-based UI for visually creating and managing workflow transitions
- **Two-layer Validation**:
  - Frontend: UI only shows valid state options based on current workflow position
  - Backend: Database constraints validate state transitions server-side

### How It Works

1. Each project can have multiple task types (e.g., Bug, Feature, Epic)
2. Task types are associated with specific workflows
3. Workflows define a graph of states with transitions between them (shown as columns on the board)
4. States can branch to multiple possible next states (e.g., "In Progress" → "Needs Review" or "Blocked")
5. Cyclical workflows allow returning to previous states
6. When creating or editing a task:
   - Selecting a task type assigns its workflow
   - Only valid state transitions are allowed
   - Changing task type resets the workflow state

### Technical Implementation

The workflow system is implemented with:

- Database schema with `workflows`, `workflow_steps`, `workflow_transitions`, `task_types`, and `project_states` tables
- Transitions with placeholder UUID (all zeros) for from_state represent "any state" transitions
- PostgreSQL trigger function to validate state transitions
- Interactive canvas-based workflow editor with SVG for transition visualization
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
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Deployment**: Vercel

## AI Automation

This repository is configured for GitHub Copilot to help maintain documentation and code consistency. When code changes are made:

- Copilot may suggest or open PRs that update documentation to reflect code changes
- All PRs will be reviewed through the normal process
- Copilot follows the existing code standards and styles in the repository
