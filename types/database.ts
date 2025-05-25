// Database types for Supabase
import { User } from '@supabase/supabase-js';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export type ProjectMemberRole = 'owner' | 'admin' | 'member';

export interface ProjectMember {
  project_id: string;
  user_id: string;
  role: ProjectMemberRole;
  created_at: string;
  updated_at: string;
}

export type ProjectInviteStatus = 'pending' | 'accepted' | 'declined';

export interface ProjectInvite {
  id: string;
  project_id: string;
  email: string;
  role: ProjectMemberRole;
  status: ProjectInviteStatus;
  token: string;
  invited_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectState {
  id: string;
  project_id: string;
  name: string;
  position: number;
}

export interface Workflow {
  id: string;
  project_id: string;
  name: string;
}

export interface WorkflowStep {
  workflow_id: string;
  state_id: string;
  step_order: number;
}

export interface WorkflowTransition {
  workflow_id: string;
  from_state: string | null; // For "any state", use '00000000-0000-0000-0000-000000000000' instead of null due to DB constraints
  to_state: string;
}

export interface TaskType {
  id: string;
  project_id: string;
  name: string;
  workflow_id: string;
}

export interface Task {
  id: string;
  name: string;
  description: string | null;
  project_id: string;
  owner_id: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  task_type_id: string | null;
  state_id: string | null;
}

export interface Subtask {
  id: string;
  name: string;
  description: string | null;
  task_id: string;
  owner_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// Custom Field Types
export type FieldInputType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'radio';

export interface Field {
  id: string;
  project_id: string;
  name: string;
  input_type: FieldInputType;
  is_required: boolean;
  created_at: string;
  updated_at: string;
  // Optional configuration for select/radio fields
  options?: string[];
  default_value?: string;
}

export interface TaskTypeField {
  task_type_id: string;
  field_id: string;
}

export interface TaskFieldValue {
  task_id: string;
  field_id: string;
  value: string | null;
}

// Extended interfaces with joined data
export interface FieldWithAssignments extends Field {
  task_type_ids: string[];
}

export interface TaskWithFieldValues extends Task {
  field_values: TaskFieldValue[];
}

export interface Database {
  projects: Project[];
  project_states: ProjectState[];
  workflows: Workflow[];
  workflow_steps: WorkflowStep[];
  workflow_transitions: WorkflowTransition[];
  task_types: TaskType[];
  tasks: Task[];
  subtasks: Subtask[];
  project_members: ProjectMember[];
  project_invites: ProjectInvite[];
  fields: Field[];
  task_type_fields: TaskTypeField[];
  task_field_values: TaskFieldValue[];
}