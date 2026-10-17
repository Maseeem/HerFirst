import type { Project } from '../types/project';

export const SAMPLE_PROJECTS: Project[] = [
  {
    id: 'sample-ecopledge',
    title: 'EcoPledge — Daily Sustainability Tracker',
    tagline: 'Turn small everyday actions into meaningful environmental impact',
    description:
      'A beginner-friendly web application where users can log daily eco-habits (like using public transport or reusable bags), calculate their positive environmental impact, and celebrate small weekly wins.',
    category: 'web',
    difficulty: 'beginner',
    commitment_pace: 'steady',
    created_at: '2026-10-14T10:00:00Z',
    progress_percentage: 33,
    milestones: [
      {
        id: 'm1',
        project_id: 'sample-ecopledge',
        order: 1,
        title: 'Milestone 1: Project Setup & Core Wireframe',
        description: 'Set up your development workspace, design your user flow, and sketch the basic interface.',
        tasks: [
          {
            id: 't1-1',
            milestone_id: 'm1',
            title: 'Define 3 core habits for users to track',
            description: 'Choose 3 simple, tangible eco-habits to focus on first (e.g. Bring Reusable Bag, Skip Plastic Bottle, Plant-based Meal).',
            why_it_matters: 'Limiting your initial scope prevents feature creep and makes your application easier to build and test.',
            step_by_step_tips: [
              'Write down 5 candidate habits on paper',
              'Pick the 3 easiest for an average person to record in under 10 seconds',
              'Decide what data point matters (e.g. Yes/No checkmark vs quantity)',
            ],
            estimated_minutes: 25,
            is_completed: true,
          },
          {
            id: 't1-2',
            milestone_id: 'm1',
            title: 'Sketch the main dashboard on paper or Figma',
            description: 'Draw how the habit cards, progress bar, and completion button look on mobile and desktop.',
            why_it_matters: 'Visualizing before coding prevents hours of layout refactoring later.',
            step_by_step_tips: [
              'Sketch a header with user name and weekly streak',
              'Draw 3 habit cards with clickable toggle buttons',
              'Add a simple summary banner at the bottom',
            ],
            estimated_minutes: 40,
            is_completed: true,
          },
          {
            id: 't1-3',
            milestone_id: 'm1',
            title: 'Initialize repository and front-end scaffold',
            description: 'Create a clean React + Vite workspace with TypeScript and verify local dev server runs.',
            why_it_matters: 'A stable build environment guarantees smooth component iteration without tooling headaches.',
            step_by_step_tips: [
              'Run Vite template creation',
              'Verify npm run dev loads at localhost',
              'Set up clean folder structure for components and types',
            ],
            estimated_minutes: 30,
            is_completed: false,
          },
        ],
      },
      {
        id: 'm2',
        project_id: 'sample-ecopledge',
        order: 2,
        title: 'Milestone 2: Interactive Habit Logging UI',
        description: 'Build the interactive habit cards and state management so users can mark habits done.',
        tasks: [
          {
            id: 't2-1',
            milestone_id: 'm2',
            title: 'Build reusable HabitCard component',
            description: 'Create a component that displays the habit icon, title, impact summary, and a toggle checkmark button.',
            why_it_matters: 'Reusable components keep your code DRY (Don’t Repeat Yourself) and easy to maintain.',
            step_by_step_tips: [
              'Accept props for habit title, icon, and isCompleted status',
              'Add accessible aria-pressed attribute to the toggle button',
              'Style active vs inactive states with clear visual contrast',
            ],
            estimated_minutes: 45,
            is_completed: false,
          },
          {
            id: 't2-2',
            milestone_id: 'm2',
            title: 'Implement dynamic progress percentage calculation',
            description: 'Calculate (completedHabits / totalHabits) * 100 and feed it into a visual progress bar.',
            why_it_matters: 'Instant visual feedback motivates users and makes the application feel alive.',
            step_by_step_tips: [
              'Use React useState to track active habit states',
              'Derive completion percentage inside the render cycle',
              'Add a celebratory message when 100% is reached',
            ],
            estimated_minutes: 35,
            is_completed: false,
          },
        ],
      },
      {
        id: 'm3',
        project_id: 'sample-ecopledge',
        order: 3,
        title: 'Milestone 3: Data Persistence & Next Steps',
        description: 'Store progress in the database so the user can return tomorrow and keep their streak.',
        tasks: [
          {
            id: 't3-1',
            milestone_id: 'm3',
            title: 'Connect Supabase table for user habit logs',
            description: 'Create a habit_logs table in Supabase PostgreSQL with user_id and logged_date columns.',
            why_it_matters: 'Persistent storage transforms a static demo into a genuine product users can rely on.',
            step_by_step_tips: [
              'Design table schema with user_id foreign key',
              'Enable Row Level Security (RLS) so users only see their own logs',
              'Test inserting a record via FastAPI backend',
            ],
            estimated_minutes: 60,
            is_completed: false,
          },
        ],
      },
    ],
  },
];
