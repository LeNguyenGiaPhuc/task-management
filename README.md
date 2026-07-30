# Task Manager

A full-stack Jira-style task management application built with Next.js, Express.js, Prisma, and PostgreSQL. The system supports workspace management, Kanban boards, role-based access control, Google OAuth login, task collaboration, analytics dashboards, file attachments, and an AI assistant that can propose and execute task-related actions after user confirmation.

This project is designed as a practical full-stack product for learning and internship portfolio purposes, with a stronger focus on backend architecture, REST APIs, authorization, database modeling, and real application workflows.

## Key Features

### Authentication and Access Control

- Email/password login and registration.
- Google OAuth login.
- JWT-based authentication.
- Board-level RBAC with:
  - `OWNER`
  - `ADMIN`
  - `MEMBER`
- Permission checks on board, column, task, member, archive, restore, and AI action APIs.
- Real users are used instead of only demo users.

### Workspace and Board Management

- View all accessible workspaces.
- Create new boards.
- Edit board name and description.
- Duplicate boards with columns, tasks, and checklists.
- Archive boards instead of permanently deleting them.
- Restore archived boards.
- Search and sort boards.
- Sidebar workspace navigation.
- Embedded board detail view inside the workspace layout.

### Kanban Board

- Create, rename, reorder, and delete columns.
- Create tasks inside columns.
- Drag and drop tasks between columns.
- Persist task order in the database.
- Search tasks.
- Filter tasks by:
  - priority
  - assignee
  - due-date status
- Disable drag and drop while filtering to avoid invalid ordering.

### Task Management

- Task detail modal.
- Edit task title, description, type, priority, assignee, and due date.
- Supported task types:
  - `TASK`
  - `BUG`
  - `STORY`
  - `EPIC`
- Archive and restore tasks.
- Checklist/subtask management.
- Checklist completion tracking.
- Task comments.
- File attachments using local upload storage.
- Task activity logging.

### Team and Role Management

- Add members to a board.
- Assign board role and project role.
- Edit member roles.
- Remove members from a board.
- Display member workload and project roles.

### Dashboard and Analytics

- Workspace-level analytics API.
- Board-level analytics API.
- Board health status:
  - on track
  - high priority
  - needs attention
- Summary metrics:
  - open tasks
  - completed tasks
  - completion rate
  - checklist completion rate
  - overdue tasks
  - due-soon tasks
  - urgent tasks
  - unassigned tasks
- Breakdown by:
  - column
  - priority
  - task type
  - member workload

### AI Assistant

- Floating AI assistant available across the application.
- Uses workspace or current board context.
- Can analyze board health, bottlenecks, priorities, overdue work, and workload.
- Can suggest next tasks and implementation checklists.
- AI action mode:
  - AI proposes actions.
  - User must confirm before database changes are applied.
  - Backend validates permissions again before executing.
- Supported AI actions:
  - create tasks
  - create checklist items/subtasks

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- App Router
- `@hello-pangea/dnd` for drag and drop

### Backend

- Node.js
- Express.js
- Prisma ORM v7
- PostgreSQL
- `pg`
- `@prisma/adapter-pg`
- `jsonwebtoken`
- `bcryptjs`
- `multer`
- `cors`
- `dotenv`

### Database

- PostgreSQL
- Supabase-compatible PostgreSQL setup
- UUID primary keys
- Enum types for board role and task priority
- Indexed board, column, task, checklist, and activity-log queries
- Trigger-based `updated_at` updates

### AI Integration

- Gemini API
- Configurable model through environment variables
- Default model: `gemini-2.5-flash`

## Folder Structure

```txt
Task-Manager/
├── backend/
│   ├── lib/
│   │   └── prisma.js
│   ├── middleware/
│   │   └── auth.middleware.js
│   ├── prisma/
│   │   └── schema.prisma
│   ├── routes/
│   │   ├── ai.routes.js
│   │   ├── analytics.routes.js
│   │   ├── auth.routes.js
│   │   ├── boards.routes.js
│   │   ├── columns.routes.js
│   │   ├── subtasks.routes.js
│   │   ├── tasks.routes.js
│   │   └── users.routes.js
│   ├── services/
│   │   ├── activity.service.js
│   │   ├── ai.service.js
│   │   ├── analytics.service.js
│   │   ├── auth.service.js
│   │   ├── comments.service.js
│   │   └── users.service.js
│   ├── utils/
│   │   └── text.js
│   ├── seed.js
│   ├── server.js
│   └── package.json
│
├── frontend/
│   ├── app/
│   │   ├── boards/
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── ai-chat-widget.tsx
│   │   ├── api.ts
│   │   ├── create-board-button.tsx
│   │   ├── globals.css
│   │   ├── home-workspaces.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── public/
│   ├── next.config.ts
│   ├── package.json
│   └── postcss.config.mjs
│
├── README.md
└── .gitignore
```

## Database Design

Main tables:

| Table | Purpose |
| --- | --- |
| `users` | Stores user accounts, password auth data, Google OAuth data, and profile info |
| `boards` | Stores workspaces/boards |
| `board_members` | Stores board membership, board role, and project role |
| `columns` | Stores Kanban columns/lists |
| `tasks` | Stores task cards |
| `sub_tasks` | Stores task checklists/subtasks |
| `task_attachments` | Stores uploaded task attachments |
| `activity_logs` | Stores board activity history |

Main enums:

```sql
task_priority = LOW | MEDIUM | HIGH | URGENT
board_role = OWNER | ADMIN | MEMBER
```

The following authentication, archive, task-type, and project-role fields are included in the Prisma schema and baseline migration:

- `users.password_hash`
- `users.google_id`
- `users.auth_provider`
- `boards.archived_at`
- `tasks.task_type`
- `tasks.archived_at`
- `board_members.project_role`
- `task_comments`

## Environment Requirements

Required tools:

- Node.js 20+
- npm
- PostgreSQL or Supabase PostgreSQL
- Git

## Setup

Clone the repository:

```bash
git clone <your-repository-url>
cd Task-Manager
```

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd ../frontend
npm install
```

## Environment Variables

Create `backend/.env`.

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
PORT=5000

FRONTEND_URL="http://localhost:3000"
CORS_ORIGIN="http://localhost:3000,http://127.0.0.1:3000"
JSON_BODY_LIMIT="1mb"

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=600
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=30
AI_RATE_LIMIT_WINDOW_MS=60000
AI_RATE_LIMIT_MAX=20
UPLOAD_RATE_LIMIT_WINDOW_MS=900000
UPLOAD_RATE_LIMIT_MAX=80

GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:5000/api/auth/google/callback"

GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"
```

Do not commit the `.env` file. It contains private credentials.

For Google OAuth local development, configure this redirect URI in Google Cloud:

```txt
http://localhost:5000/api/auth/google/callback
```

If PostgreSQL uses `gen_random_uuid()`, enable the extension:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## Prisma

The existing Supabase database was baselined with the migration in
`backend/prisma/migrations/20260730000000_baseline`. The baseline is marked as
applied in the current production database; it is not re-run against that database.

For a new schema change during development:

```bash
cd backend
npx prisma migrate dev --name describe_the_change
```

For deployment:

```bash
cd backend
npx prisma migrate deploy
```

Generate Prisma Client:

```bash
cd backend
npx prisma generate
```

Validate Prisma schema:

```bash
npx prisma validate
```

Execute a one-off SQL patch if needed:

```bash
echo "ALTER TABLE board_members ADD COLUMN IF NOT EXISTS project_role VARCHAR(255);" | npx prisma db execute --stdin
```

## Running the Project

Run the backend:

```bash
cd backend
node server.js
```

Backend URL:

```txt
http://localhost:5000
```

Run the frontend:

```bash
cd frontend
npm run dev
```

Frontend URL:

```txt
http://localhost:3000
```

The frontend dev script uses Webpack:

```json
"dev": "next dev --webpack"
```

This avoids heavy Turbopack behavior on some local Windows machines.

## Seed Data

Run the seed script:

```bash
cd backend
npm run seed
```

The seed script creates demo users, boards, columns, tasks, subtasks, attachments, and activity logs.

Default seed accounts:

| Role | Email | Password |
| --- | --- | --- |
| OWNER | `demo@task-manager.local` | `password123` |
| ADMIN | `designer@task-manager.local` | `password123` |
| MEMBER | `engineer@task-manager.local` | `password123` |

## Main API Routes

### Authentication

```txt
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
GET    /api/auth/google
GET    /api/auth/google/callback
```

### Boards

```txt
GET    /api/boards
GET    /api/boards/archived
POST   /api/boards
GET    /api/boards/:id
PUT    /api/boards/:id
DELETE /api/boards/:id
POST   /api/boards/:id/duplicate
POST   /api/boards/:id/restore
POST   /api/boards/:id/members
PUT    /api/boards/:id/members/:userId
DELETE /api/boards/:id/members/:userId
```

### Columns

```txt
POST   /api/columns
PUT    /api/columns/:id
DELETE /api/columns/:id
```

### Tasks

```txt
GET    /api/tasks
GET    /api/tasks/archived
POST   /api/tasks
PUT    /api/tasks/:id
DELETE /api/tasks/:id
POST   /api/tasks/:id/restore
GET    /api/tasks/:id/comments
POST   /api/tasks/:id/comments
DELETE /api/tasks/:taskId/comments/:commentId
GET    /api/tasks/:id/attachments
POST   /api/tasks/:id/attachments
DELETE /api/tasks/:taskId/attachments/:attachmentId
```

### Subtasks

```txt
POST   /api/subtasks
PUT    /api/subtasks/:id
DELETE /api/subtasks/:id
```

### Analytics

```txt
GET    /api/analytics/workspace
GET    /api/analytics/boards/:id
```

### AI

```txt
POST   /api/ai/chat
POST   /api/ai/actions/apply
POST   /api/ai/tasks/:taskId/subtasks
```

## AI Action Mode

The AI assistant can propose database actions, but it does not directly mutate data during chat.

Workflow:

1. User asks the AI to create tasks or checklist items.
2. AI returns a normal reply plus structured pending actions.
3. Frontend displays the pending actions.
4. User clicks `Apply actions`.
5. Backend validates the action target and RBAC permission.
6. Backend writes to the database and logs activity.
7. Board UI refreshes automatically.

Supported action types:

```txt
CREATE_TASK
CREATE_SUBTASKS
```

This design keeps AI useful while avoiding uncontrolled database writes.

## Validation and Checks

Frontend lint:

```bash
cd frontend
npm run lint
```

Frontend TypeScript check:

```bash
cd frontend
npm exec tsc -- --noEmit
```

Backend syntax check:

```bash
cd backend
node --check server.js
node --check routes/ai.routes.js
node --check services/ai.service.js
```

## Technical Highlights

- Separated frontend and backend architecture.
- REST API design with authentication middleware.
- JWT authentication and Google OAuth integration.
- Board-level RBAC enforced on backend routes.
- Prisma ORM connected to PostgreSQL.
- Kanban drag and drop with persisted ordering.
- Soft archive and restore for boards and tasks.
- Activity logging for important board events.
- File attachment upload flow with `multer`.
- AI assistant with confirmation-based action execution.
- Backend analytics APIs for dashboard metrics.
- Seed data for quick demonstration.

## Current Limitations and Future Improvements

- File upload currently uses local storage. A production version should use Supabase Storage, S3, or another object storage service.
- Test coverage is not implemented yet. Backend API tests with Supertest or Vitest would be a strong next step.
- Notification and invitation systems are not implemented yet.
- AI action mode currently supports task and checklist creation only.
- Request validation can be improved with a schema validation library such as Zod or Joi.

## Author

This project was built for learning full-stack development and demonstrating a practical backend-oriented task management system for internship portfolio use.
