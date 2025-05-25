# Task Manager

A modern task management application built with Next.js, TypeScript, and Supabase.

## Features

- Project management
- Task management with custom fields
- Workflow management
- Team collaboration
- File attachments

## Implementation Status

### Completed
- [x] Basic task CRUD operations
- [x] Project management
- [x] User authentication
- [x] Custom fields implementation
- [x] Workflow management
- [x] Data migration from legacy columns to custom fields

### In Progress
- [ ] Advanced reporting
- [ ] Mobile application

## Migration Checklist

### Custom Fields Migration
- [ ] Run migration script on staging database
- [ ] Verify all data successfully migrated
- [ ] Confirm API endpoints work with new structure
- [ ] Run migration script on production database
- [ ] Validate production data integrity
- [ ] Update documentation to reflect changes

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- Supabase account

### Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Run development server: `npm run dev`

## Database Migrations

To run migrations:

```bash
npx supabase migration up
```

## License

MIT