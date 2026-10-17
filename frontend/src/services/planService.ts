import { GuidanceService } from './guidanceService.ts';
import type { Milestone, PlanGenerationRequest, Project } from '../types/project.ts';

function localSetupMetadata(request: PlanGenerationRequest): Pick<Project, 'technology_stack' | 'architecture_overview' | 'required_tools' | 'folder_structure' | 'deployment_plan'> {
  if (request.category === 'mobile') {
    return {
      technology_stack: ['Choose one mobile path: React Native + Expo (TypeScript/JavaScript) or Flutter (Dart).', 'Add a backend only if shared accounts/data or server-side secrets are required.', 'Use Git + GitHub for version control.'],
      architecture_overview: 'Build the mobile client first. Choose either Expo or Flutter, not both. Add an API/backend only when the feature requirements need shared or private server-side data.',
      required_tools: ['VS Code (free): https://code.visualstudio.com/', 'React Native/Expo: https://reactnative.dev/docs/getting-started and https://docs.expo.dev/', 'Flutter (alternative): https://docs.flutter.dev/', 'GitHub: https://github.com/'],
      folder_structure: ['app/ or src/: mobile screens/components according to the selected framework', 'services/: API client only if a backend exists', 'backend/: optional API, only if needed', 'README.md, .gitignore, and .env.example'],
      deployment_plan: ['Test on a real device or emulator first.', 'Expo: https://docs.expo.dev/eas/; Flutter: https://docs.flutter.dev/deployment.', 'Check current app-store account, signing, and publishing requirements/costs before release.'],
    };
  }
  if (request.category === 'ai') {
    return {
      technology_stack: ['For a small AI/data demo, consider Python + Streamlit; use FastAPI when a separate API is needed.', 'Use a separate React/TypeScript frontend only if the experience requires it.', 'Keep model/API credentials in server-side environment variables.'],
      architecture_overview: 'Start with the smallest demo that proves the AI workflow. A Streamlit app can be simpler than a separate frontend/backend; add a separate API or database only when requirements justify it.',
      required_tools: ['Python: https://www.python.org/downloads/', 'Streamlit: https://docs.streamlit.io/', 'FastAPI (if required): https://fastapi.tiangolo.com/tutorial/', 'GitHub: https://github.com/'],
      folder_structure: ['app.py or the confirmed app entry point', 'requirements.txt for Python dependencies', 'tests/ for response and error behavior', '.env.example, .gitignore, README.md'],
      deployment_plan: ['Consider https://share.streamlit.io/ for supported Streamlit projects or https://huggingface.co/spaces for supported ML demos.', 'For a separate backend, choose a compatible host and configure private secrets there.', 'Verify current usage limits, API charges and hosting pricing before launch.'],
    };
  }
  if (request.category === 'hardware') {
    return {
      technology_stack: ['Choose the runtime from the actual hardware: Arduino IDE/C++ for Arduino or Python for supported Raspberry Pi projects.', 'Add a dashboard/backend only if remote control or reporting is required.', 'Use Git + GitHub for version control.'],
      architecture_overview: 'The device program reads the selected input/sensor, performs the required logic, and produces an observable output. Physical safety and board compatibility must be checked before wiring/flashing.',
      required_tools: ['Arduino docs: https://docs.arduino.cc/', 'Raspberry Pi docs: https://www.raspberrypi.com/documentation/', 'GitHub: https://github.com/'],
      folder_structure: ['src/ or board-specific sketch folder', 'tests/ or simulation notes', 'README.md with board, wiring and install/flash steps', '.gitignore and .env.example if required'],
      deployment_plan: ['Test with a simulator or safe setup first.', 'Installation may mean flashing firmware to the actual device, not hosting a web URL.', 'Keep a known-good build and documented recovery steps.'],
    };
  }
  return {
    technology_stack: ['For a browser app, React + TypeScript + Vite is a reasonable starting UI stack.', 'Add FastAPI or another backend only for APIs, accounts, shared data, or server-side secrets.', 'Use a database only when persistence requirements are clear; use Git + GitHub from the start.'],
    architecture_overview: `Build ${request.idea_title} around one main user action. Start with the smallest useful version; add a backend, database, authentication, or paid services only when the requirements justify them.`,
    required_tools: ['VS Code (free): https://code.visualstudio.com/', 'ChatGPT: https://chatgpt.com/ or Claude: https://claude.ai/ (plans/limits vary)', 'GitHub: https://github.com/ and https://docs.github.com/', 'Verify hosting price/free-tier limits at official pages before launch.'],
    folder_structure: ['frontend/src/: pages, components, and UI services if a frontend is selected', 'backend/app/: APIs/business logic only if a backend is needed', 'tests/: focused automated tests', 'README.md, .gitignore, .env.example'],
    deployment_plan: ['For a suitable frontend, evaluate Vercel or Netlify; for a supported backend, evaluate Render or Railway.', 'Verify official pricing, free-tier limits, resource quotas and database/AI charges.', 'Configure private server secrets on the host and test the real live user journey.'],
  };
}

function localDeliveryMilestones(projectId: string, category: PlanGenerationRequest['category'], firstOrder: number): Milestone[] {
  const mobile = category === 'mobile';
  const hardware = category === 'hardware';
  const releaseTitle = mobile ? 'Build and Distribute the Mobile App' : hardware ? 'Install and Verify on Target Hardware' : 'Hosting and Deployment';
  const releaseDescription = mobile
    ? 'Prepare a device build and test release flow for the selected mobile framework.'
    : hardware
      ? 'Install or flash a tested build safely on the target device.'
      : 'Choose suitable hosting, configure build commands and deploy the tested project.';
  const releaseTasks: Array<{ title: string; description: string; tips: string[]; minutes: number }> = mobile
    ? [
        { title: 'Choose a suitable mobile build and test route', description: 'Confirm the selected framework before following platform-specific instructions.', tips: ['Confirm Expo/React Native or Flutter from the actual project files', 'Read its official build documentation', 'Check signing, target-device and store requirements/costs'], minutes: 25 },
        { title: 'Build and test on a device', description: 'Verify the app beyond the development server.', tips: ['Use the official build command for the selected framework', 'Install on a simulator or real device', 'Test main navigation and inspect crash logs'], minutes: 45 },
      ]
    : hardware
      ? [
          { title: 'Confirm target hardware and install method', description: 'Match instructions to the actual board and operating system.', tips: ['Record the exact board and runtime', 'Check official safe wiring/power information', 'Keep a known-good build for recovery'], minutes: 25 },
          { title: 'Install and test on target hardware', description: 'Check the program on the actual or simulated device.', tips: ['Follow the board/toolchain official upload instructions', 'Test one normal and one safe failure case', 'Record logs and recovery steps'], minutes: 45 },
        ]
      : [
          { title: 'Choose a suitable host and confirm costs', description: 'Select hosting based on the real frontend, backend, database and budget.', tips: ['Identify each service and runtime from project manifests', 'Compare compatible hosts and verify official current pricing/free-tier limits', 'Record the actual build command, start command and needed environment variables'], minutes: 25 },
          { title: 'Deploy the application and configure secrets', description: 'Publish a tested version without exposing private credentials.', tips: ['Connect the correct GitHub repository and branch', 'Configure verified build/start commands', 'Add secrets in private host settings, never frontend source or Git', 'Read logs and open the generated live URL'], minutes: 45 },
        ];
  const phases: Array<{ title: string; description: string; tasks: Array<{ title: string; description: string; tips: string[]; minutes: number }> }> = [
    {
      title: 'Version Control and GitHub',
      description: 'Prepare a reviewed, secret-safe repository to share and recover project code.',
      tasks: [
        { title: 'Prepare a secret-safe repository', description: 'Review project files and prevent credentials or generated dependencies from being published.', tips: ['Open the true project root and inspect README/.gitignore', 'Exclude .env, API keys, virtual environments, node_modules, caches and builds', 'Run git status and inspect all files before staging'], minutes: 25 },
        { title: 'Commit and upload the project to GitHub', description: 'Push a known-good version to the intended repository without overwriting unrelated work.', tips: ['Create or select a public/private repository', 'Use Git or GitHub Desktop', 'Commit only reviewed files and push the intended branch', 'Verify source, README and manifests in the browser'], minutes: 30 },
      ],
    },
    { title: releaseTitle, description: releaseDescription, tasks: releaseTasks },
    {
      title: 'Live Verification and Maintenance',
      description: 'Verify the release and document how to update, monitor and recover it.',
      tasks: [
        { title: 'Run release acceptance checks', description: 'Test the complete main user journey in the real release environment.', tips: ['Test the main user journey with fresh sample data', 'Test an invalid/missing value and an error state', 'Check API/device logs and record remaining issues'], minutes: 30 },
        { title: 'Document updates, monitoring and recovery', description: 'Leave clear instructions for maintenance after submission.', tips: ['Update README with install/run/test/release instructions', 'Document how to update from a reviewed commit or known-good build', 'Record backup/recovery steps and current service/API costs or quotas'], minutes: 25 },
      ],
    },
  ];
  return phases.map((phase, idx) => {
    const order = firstOrder + idx;
    const milestoneId = `${projectId}-milestone-${order}`;
    return {
      id: milestoneId,
      project_id: projectId,
      order,
      title: `Milestone ${order}: ${phase.title}`,
      description: phase.description,
      tasks: phase.tasks.map((task, taskIndex) => ({
        id: `${milestoneId}-task-${taskIndex + 1}`,
        milestone_id: milestoneId,
        title: task.title,
        description: task.description,
        why_it_matters: `This step helps make ${projectId} safer to share, release, and maintain.`,
        step_by_step_tips: task.tips,
        estimated_minutes: task.minutes,
        is_completed: false,
      })),
    };
  });
}


export class PlanService {
  /**
   * Generates a structured, domain-tailored project blueprint based on user input.
   */
  public static generatePlan(request: PlanGenerationRequest): Project {
    const projectId = `proj-${Date.now()}`;
    const domain = GuidanceService.detectDomain({
      title: request.idea_title,
      description: request.idea_description,
      category: request.category,
    });

    const isPepsiOrBeverage =
      `${request.idea_title} ${request.idea_description}`.toLowerCase().includes('pepsi') ||
      `${request.idea_title} ${request.idea_description}`.toLowerCase().includes('beverage');

    let milestones;

    if (domain === 'inventory_factory') {
      const brand = isPepsiOrBeverage ? 'Pepsi' : 'Factory';
      milestones = [
        {
          id: `m-1-${Date.now()}`,
          project_id: projectId,
          order: 1,
          title: `Milestone 1: ${brand} Inventory Scope & Warehouse Architecture`,
          description: `Define SKU schemas, unit specifications, and factory tracking requirements for ${request.idea_title}.`,
          tasks: [
            {
              id: `t-1-1-${Date.now()}`,
              milestone_id: `m-1-${Date.now()}`,
              title: 'Define product catalog and unit standards',
              description: `Map out initial ${brand} product lines (e.g. Regular, Diet, Zero) and standardized factory measurement units.`,
              why_it_matters: 'Standardizing product designations and packaging units up front prevents mismatched inventory tallies across bottling shifts.',
              step_by_step_tips: [
                'List primary finished products (e.g. 330ml cans, 500ml bottles, 2L family packs)',
                'Establish required unit classifications: bottles, cartons, packs, kilograms, and liters',
                'Design initial JSON data schema representing a single inventory item',
              ],
              estimated_minutes: 25,
              is_completed: false,
            },
            {
              id: `t-1-2-${Date.now()}`,
              milestone_id: `m-1-${Date.now()}`,
              title: 'Initialize inventory management workspace',
              description: 'Configure front-end structure and state container for active warehouse stock.',
              why_it_matters: 'A structured state foundation ensures stock additions, deductions, and filters update reliably across all views.',
              step_by_step_tips: [
                'Set up inventory context or root state',
                'Create layout shell with factory metrics header',
                'Confirm fast hot-reload is operational',
              ],
              estimated_minutes: 30,
              is_completed: false,
            },
          ],
        },
        {
          id: `m-2-${Date.now()}`,
          project_id: projectId,
          order: 2,
          title: 'Milestone 2: Core Feature Implementation',
          description: 'Build interactive stock-entry controls and the live warehouse inventory dashboard.',
          tasks: [
            {
              id: `t-2-1-${Date.now()}`,
              milestone_id: `m-2-${Date.now()}`,
              title: 'Build the main interactive input control',
              description: 'Construct the form component where operators log stock entries with product name, quantity, unit selection, and validation.',
              why_it_matters: `In a factory warehouse like ${request.idea_title}, inventory records drive purchasing, bottling schedules, and fulfillment. If the input allows negative quantities or blank product names, the warehouse database corrupts immediately, causing stock discrepancies and costly manufacturing halts.`,
              step_by_step_tips: [
                'Create a Product Name text input (<input type="text" />) to capture product designations (e.g. "Pepsi Regular 500ml Pack", "Diet Pepsi Syrup").',
                'Create a Quantity number input (<input type="number" min="1" step="any" />) to capture incoming or outgoing stock volume.',
                'Create a Unit selection dropdown (<select>) containing the required options: bottles, cartons, packs, kilograms, and liters.',
                'Implement client-side validation that immediately blocks submission if the product name is empty/whitespace, or if the quantity is zero, negative, or not a valid number.',
                'Render clear inline validation error messages (e.g. "Product name is required" and "Quantity must be greater than zero") below the invalid fields.',
                'On successful validation, create a clean stock-entry record and append it to your active inventory state.',
              ],
              estimated_minutes: 45,
              is_completed: false,
            },
            {
              id: `t-2-2-${Date.now()}`,
              milestone_id: `m-2-${Date.now()}`,
              title: 'Render dynamic output results',
              description: 'Display recorded stock in a live warehouse table with unit labels, low-stock threshold badges, and timestamps.',
              why_it_matters: 'Plant managers need immediate visual confirmation of inventory levels to prevent production downtime and reorder supplies on time.',
              step_by_step_tips: [
                'Construct an inventory table with columns: Product, Quantity, Unit, Stock Status, and Actions',
                'Add visual indicator badges (e.g. green for healthy stock, amber for low stock < 50 units)',
                'Handle empty table state with helpful onboarding instructions',
              ],
              estimated_minutes: 40,
              is_completed: false,
            },
          ],
        },
        {
          id: `m-3-${Date.now()}`,
          project_id: projectId,
          order: 3,
          title: 'Milestone 3: Polish, Persistence & Hackathon Review',
          description: 'Validate stock bounds, test edge cases, and verify warehouse audit logs.',
          tasks: [
            {
              id: `t-3-1-${Date.now()}`,
              milestone_id: `m-3-${Date.now()}`,
              title: 'Test edge cases and mobile responsiveness',
              description: 'Verify the inventory form rejects negative stock, zero quantities, and whitespace names on warehouse tablets.',
              why_it_matters: 'Rigorous boundary testing ensures the system will not crash or corrupt numbers during high-speed factory shift changes.',
              step_by_step_tips: [
                'Test empty product names and confirm warning appears',
                'Test negative quantity inputs and verify immediate rejection',
                'Verify responsiveness on tablet and handheld warehouse scanner viewports',
              ],
              estimated_minutes: 30,
              is_completed: false,
            },
          ],
        },
      ];
    } else {
      // General Domain Generator with custom project context
      milestones = [
        {
          id: `m-1-${Date.now()}`,
          project_id: projectId,
          order: 1,
          title: 'Milestone 1: Project Scope & Foundational Setup',
          description: `Define your core user journey and configure a clean development environment for ${request.idea_title}.`,
          tasks: [
            {
              id: `t-1-1-${Date.now()}`,
              milestone_id: `m-1-${Date.now()}`,
              title: 'Clarify the single primary user action',
              description: `Write down exactly what one primary action a person will take in ${request.idea_title}.`,
              why_it_matters: 'Beginning with a singular clear focus prevents overwhelm and scope creep.',
              step_by_step_tips: [
                `Define the primary user story for ${request.idea_title}`,
                'List the minimal data required for that action',
                'Defer secondary nice-to-have features for future iterations',
              ],
              estimated_minutes: 20,
              is_completed: false,
            },
            {
              id: `t-1-2-${Date.now()}`,
              milestone_id: `m-1-${Date.now()}`,
              title: 'Set up development workspace and libraries',
              description: 'Initialize your frontend structure and confirm the local preview works.',
              why_it_matters: 'Setting up cleanly at the start ensures no dependency friction later.',
              step_by_step_tips: [
                'Verify Node and package versions',
                'Create layout structure and navigation',
                'Confirm fast hot-module reload works in browser',
              ],
              estimated_minutes: 35,
              is_completed: false,
            },
          ],
        },
        {
          id: `m-2-${Date.now()}`,
          project_id: projectId,
          order: 2,
          title: 'Milestone 2: Core Feature Implementation',
          description: 'Build the primary interface and connect user actions to reactive state.',
          tasks: [
            {
              id: `t-2-1-${Date.now()}`,
              milestone_id: `m-2-${Date.now()}`,
              title: 'Build the main interactive input control',
              description: `Construct the primary input control or form where users enter data for ${request.idea_title}.`,
              why_it_matters: 'Input is the catalyst for any interactive software experience.',
              step_by_step_tips: [
                'Use semantic HTML input elements with accessible labels',
                'Attach reactive state handlers for user input changes',
                'Provide instant visual validation feedback for invalid entries',
              ],
              estimated_minutes: 45,
              is_completed: false,
            },
            {
              id: `t-2-2-${Date.now()}`,
              milestone_id: `m-2-${Date.now()}`,
              title: 'Render dynamic output results',
              description: `Display calculated or saved results for ${request.idea_title} with clear status indicators.`,
              why_it_matters: 'Users need unambiguous visual confirmation that their action succeeded.',
              step_by_step_tips: [
                'Create output cards or result view component',
                'Handle empty state with helpful onboarding instructions',
                'Ensure high-contrast readability across screen sizes',
              ],
              estimated_minutes: 40,
              is_completed: false,
            },
          ],
        },
        {
          id: `m-3-${Date.now()}`,
          project_id: projectId,
          order: 3,
          title: 'Milestone 3: Polish, Persistence & Hackathon Review',
          description: 'Refine styling, test error conditions, and verify that progress saves securely.',
          tasks: [
            {
              id: `t-3-1-${Date.now()}`,
              milestone_id: `m-3-${Date.now()}`,
              title: 'Test edge cases and mobile responsiveness',
              description: `Verify ${request.idea_title} handles edge cases, empty inputs, and responsive layouts cleanly.`,
              why_it_matters: 'Polished error handling is what separates beginner experiments from production-grade apps.',
              step_by_step_tips: [
                'Resize viewport to mobile width and test layout flow',
                'Submit empty or boundary values to verify graceful error handling',
                'Check console for clean zero-error execution',
              ],
              estimated_minutes: 30,
              is_completed: false,
            },
          ],
        },
      ];
    }

    // Normalize IDs after assembling the offline blueprint. Older branches used
    // separate Date.now() calls for a task and its parent milestone, which could
    // leave the relationship broken or create duplicate IDs in the same millisecond.
    milestones = milestones.map((milestone, milestoneIndex) => {
      const milestoneId = `${projectId}-milestone-${milestoneIndex + 1}`;
      return {
        ...milestone,
        id: milestoneId,
        project_id: projectId,
        tasks: milestone.tasks.map((task, taskIndex) => ({
          ...task,
          id: `${milestoneId}-task-${taskIndex + 1}`,
          milestone_id: milestoneId,
        })),
      };
    });

    const project: Project = {
      id: projectId,
      title: request.idea_title,
      tagline: isPepsiOrBeverage
        ? 'Real-Time Beverage Factory Inventory & Warehouse Control'
        : 'Your structured journey from idea to working reality',
      description: request.idea_description,
      category: request.category,
      difficulty: request.difficulty,
      commitment_pace: request.commitment_pace,
      created_at: new Date().toISOString(),
      progress_percentage: 0,
      milestones: [],
      ...localSetupMetadata(request),
    };

    milestones.push(...localDeliveryMilestones(projectId, request.category, milestones.length + 1));

    // Attach domain-aware guidance to every task
    project.milestones = milestones.map((milestone) => ({
      ...milestone,
      tasks: milestone.tasks.map((task) => {
        const enrichedGuidance = GuidanceService.generateGuidance(task, project);
        return {
          ...task,
          why_it_matters: enrichedGuidance.why_it_matters,
          step_by_step_tips: enrichedGuidance.action_steps,
          guidance: enrichedGuidance,
        };
      }),
    }));

    return project;
  }

  /**
   * Prefer the local FastAPI blueprint endpoint when it is available.
   * The existing deterministic generator remains the safe offline fallback.
   */
  public static async generatePlanWithBackend(request: PlanGenerationRequest): Promise<Project> {
    const backendUrl =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) ||
      'http://localhost:8000';

    const healthController = new AbortController();
    const healthTimeout = setTimeout(() => healthController.abort(), 1200);
    try {
      const health = await fetch(`${backendUrl}/api/health`, {
        signal: healthController.signal,
      });
      if (!health.ok) return this.generatePlan(request);
    } catch {
      return this.generatePlan(request);
    } finally {
      clearTimeout(healthTimeout);
    }

    const controller = new AbortController();
    const requestTimeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`${backendUrl}/api/blueprints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok) return this.generatePlan(request);
      const generated = (await response.json()) as Project;
      if (!generated.title || !Array.isArray(generated.milestones) || generated.milestones.length === 0) {
        return this.generatePlan(request);
      }
      const metadata = localSetupMetadata(request);
      return {
        ...metadata,
        ...generated,
        technology_stack: generated.technology_stack?.length ? generated.technology_stack : metadata.technology_stack,
        architecture_overview: generated.architecture_overview || metadata.architecture_overview,
        required_tools: generated.required_tools?.length ? generated.required_tools : metadata.required_tools,
        folder_structure: generated.folder_structure?.length ? generated.folder_structure : metadata.folder_structure,
        deployment_plan: generated.deployment_plan?.length ? generated.deployment_plan : metadata.deployment_plan,
      };
    } catch {
      return this.generatePlan(request);
    } finally {
      clearTimeout(requestTimeout);
    }
  }
}
