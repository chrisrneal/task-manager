// Database types for Supabase
import { User } from '@supabase/supabase-js';

export interface AppUser {
  id: string;
  email: string;
  display_name: string;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  timezone: string;
  locale: string;
  email_verified: boolean;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  domain?: string | null;
  logo_url?: string | null;
  website_url?: string | null;
  billing_email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state_province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type UserOrganizationRole = 'owner' | 'admin' | 'member' | 'billing' | 'readonly';

export interface UserOrganization {
  id: string;
  user_id: string;
  organization_id: string;
  role: UserOrganizationRole;
  is_primary: boolean;
  invited_by?: string | null;
  invited_at?: string | null;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

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
  is_dummy?: boolean;
  dummy_name?: string | null;
}

export interface ProjectMemberWithUser extends ProjectMember {
  name: string;
  email: string | null;
  avatar_url: string | null;
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
  assignee_id: string | null;
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

export interface TaskWithAssignee extends Task {
  assignee?: ProjectMemberWithUser | null;
}

export interface UserWithOrganizations extends AppUser {
  organizations: (UserOrganization & { organization: Organization })[];
  primary_organization?: Organization | null;
}

export interface OrganizationWithMembers extends Organization {
  members: (UserOrganization & { user: AppUser })[];
  member_count: number;
}

// Project Template Types
export interface ProjectTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateState {
  id: string;
  template_id: string;
  name: string;
  position: number;
}

export interface TemplateWorkflow {
  id: string;
  template_id: string;
  name: string;
}

export interface TemplateWorkflowStep {
  workflow_id: string;
  state_id: string;
  step_order: number;
}

export interface TemplateWorkflowTransition {
  workflow_id: string;
  from_state: string | null; // For "any state", use '00000000-0000-0000-0000-000000000000' instead of null due to DB constraints
  to_state: string;
}

export interface TemplateTaskType {
  id: string;
  template_id: string;
  name: string;
  workflow_id: string;
}

export interface TemplateField {
  id: string;
  template_id: string;
  name: string;
  input_type: FieldInputType;
  is_required: boolean;
  options?: string[];
  default_value?: string;
}

export interface TemplateTaskTypeField {
  task_type_id: string;
  field_id: string;
}

// Extended template interfaces with joined data
export interface ProjectTemplateWithDetails extends ProjectTemplate {
  states: TemplateState[];
  workflows: TemplateWorkflow[];
  task_types: TemplateTaskType[];
  fields: TemplateField[];
}

export interface Database {
  users: AppUser[];
  organizations: Organization[];
  user_organizations: UserOrganization[];
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
  // Template tables
  project_templates: ProjectTemplate[];
  template_states: TemplateState[];
  template_workflows: TemplateWorkflow[];
  template_workflow_steps: TemplateWorkflowStep[];
  template_workflow_transitions: TemplateWorkflowTransition[];
  template_task_types: TemplateTaskType[];
  template_fields: TemplateField[];
  template_task_type_fields: TemplateTaskTypeField[];
}