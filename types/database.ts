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

export interface Database {
  projects: Project[];
}