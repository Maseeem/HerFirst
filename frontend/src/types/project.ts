export type ProjectCategory = 'web' | 'mobile' | 'ai' | 'hardware' | 'creative' | 'community' | 'other';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export type CommitmentPace = 'casual' | 'steady' | 'intensive';

export interface TaskGuidance {
  task_id: string;
  task_title: string;
  summary: string;
  what_to_do_next: string;
  why_it_matters: string;
  action_steps: string[];
  common_pitfalls: string[];
  beginner_encouragement: string;
  realistic_example?: string;
  expected_result?: string;
  verification_steps?: string[];
  guide_stage?: string;
  tools_and_links?: string[];
  file_instructions?: string[];
  code_generation_prompt?: string;
  run_instructions?: string[];
  troubleshooting_steps?: string[];
  github_deployment_steps?: string[];
  source?: 'amd_ai' | 'domain_synthesizer';
  source_status?: string;
}

export interface Task {
  id: string;
  milestone_id: string;
  title: string;
  description: string;
  why_it_matters: string;
  step_by_step_tips: string[];
  estimated_minutes: number;
  is_completed: boolean;
  guidance?: TaskGuidance;
}

export interface Milestone {
  id: string;
  project_id: string;
  order: number;
  title: string;
  description: string;
  tasks: Task[];
}

export interface Project {
  id: string;
  user_id?: string;
  title: string;
  tagline?: string;
  description: string;
  category: ProjectCategory;
  difficulty: DifficultyLevel;
  commitment_pace: CommitmentPace;
  created_at: string;
  milestones: Milestone[];
  progress_percentage: number;
  technology_stack?: string[];
  architecture_overview?: string;
  required_tools?: string[];
  folder_structure?: string[];
  deployment_plan?: string[];
}

export interface PlanGenerationRequest {
  idea_title: string;
  idea_description: string;
  category: ProjectCategory;
  difficulty: DifficultyLevel;
  commitment_pace: CommitmentPace;
}
