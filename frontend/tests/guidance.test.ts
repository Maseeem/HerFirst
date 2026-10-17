import test from 'node:test';
import assert from 'node:assert';
import { GuidanceService } from '../src/services/guidanceService.ts';
import { PlanService } from '../src/services/planService.ts';
import { AIService } from '../src/services/aiService.ts';
import type { Task, Project } from '../src/types/project.ts';

test('1. Failed Inventory Task: Generates project-specific instructions for Pepsi Factory Inventory', () => {
  const pepsiProject: Project = {
    id: 'pepsi-inv-01',
    title: 'Pepsi Factory Inventory Management System',
    description: 'An industrial system for tracking beverage factory warehouse stock, batch production, and supply pallets.',
    category: 'web',
    difficulty: 'beginner',
    commitment_pace: 'steady',
    created_at: new Date().toISOString(),
    progress_percentage: 0,
    milestones: [],
  };

  const inventoryInputTask: Task = {
    id: 't-input-01',
    milestone_id: 'm-2',
    title: 'Build the main interactive input control',
    description: 'Construct the form component where operators log stock entries.',
    why_it_matters: '',
    step_by_step_tips: [],
    estimated_minutes: 45,
    is_completed: false,
  };

  const guidance = GuidanceService.generateGuidance(inventoryInputTask, pepsiProject);

  // 1. Check title & summary
  assert.strictEqual(guidance.task_title, 'Build the main interactive input control');
  assert.match(guidance.summary, /inventory stock-entry/i);
  assert.match(guidance.summary, /Pepsi factory products|inventory items/i);

  // 2. Check Action Steps coverage
  const allActionStepsText = guidance.action_steps.join(' ');
  assert.match(allActionStepsText, /product name/i, 'Must cover Product Name input');
  assert.match(allActionStepsText, /quantity/i, 'Must cover Quantity input');
  
  // Verify all 5 required units: bottles, cartons, packs, kilograms, and liters
  assert.match(allActionStepsText, /bottles/i, 'Must include "bottles" unit');
  assert.match(allActionStepsText, /cartons/i, 'Must include "cartons" unit');
  assert.match(allActionStepsText, /packs/i, 'Must include "packs" unit');
  assert.match(allActionStepsText, /kilograms/i, 'Must include "kilograms" unit');
  assert.match(allActionStepsText, /liters/i, 'Must include "liters" unit');

  // Verify validation: empty product names and invalid or negative quantities
  assert.match(allActionStepsText, /empty|whitespace/i, 'Must validate empty product names');
  assert.match(allActionStepsText, /zero|negative|valid number/i, 'Must validate non-positive or negative quantities');
  assert.match(allActionStepsText, /error message/i, 'Must mention inline validation error messages');

  // 3. Check Realistic Stock-Entry Example
  assert.ok(guidance.realistic_example, 'Must include a realistic stock-entry example');
  assert.match(guidance.realistic_example, /productName/i);
  assert.match(guidance.realistic_example, /quantity/i);
  assert.match(guidance.realistic_example, /bottles|cartons|packs|kilograms|liters/i);
  assert.match(guidance.realistic_example, /Pepsi/i, 'Example should reflect Pepsi inventory item');

  // 4. Check Expected Result and Verification Steps
  assert.ok(guidance.expected_result, 'Must include expected result');
  assert.match(guidance.expected_result, /stock-entry form/i);
  assert.ok(guidance.verification_steps && guidance.verification_steps.length >= 3, 'Must have at least 3 verification steps');
  
  const verifyText = guidance.verification_steps.join(' ');
  assert.match(verifyText, /empty/i, 'Verification must test empty name');
  assert.match(verifyText, /negative/i, 'Verification must test negative quantity');
  assert.match(verifyText, /cartons|liters/i, 'Verification must test valid submission with unit');

  // 5. Check Why This Step Matters (project-specific)
  assert.match(guidance.why_it_matters, /factory warehouse/i);
  assert.match(guidance.why_it_matters, /negative/i);
  assert.match(guidance.why_it_matters, /stock/i);

  // 6. Check Common Pitfalls
  const pitfallsText = guidance.common_pitfalls.join(' ');
  assert.match(pitfallsText, /negative/i, 'Pitfalls must warn against negative numbers');
  assert.match(pitfallsText, /string/i, 'Pitfalls must warn against string concatenation');
  assert.match(pitfallsText, /unit/i, 'Pitfalls must warn against missing units');

  // 7. Check Mentor Tip
  assert.match(guidance.beginner_encouragement, /manufacturing|factory/i);
});

test('2. Unrelated Task A: Generates sustainability-specific guidance for EcoPledge habit task', () => {
  const ecoProject: Project = {
    id: 'eco-01',
    title: 'EcoPledge — Daily Sustainability Tracker',
    description: 'A platform helping individuals track daily eco-habits and compute carbon reductions.',
    category: 'web',
    difficulty: 'beginner',
    commitment_pace: 'steady',
    created_at: new Date().toISOString(),
    progress_percentage: 0,
    milestones: [],
  };

  const habitTask: Task = {
    id: 't-habit-01',
    milestone_id: 'm-1',
    title: 'Define 3 core habits for users to track',
    description: 'Choose 3 tangible eco-actions for users to log daily.',
    why_it_matters: '',
    step_by_step_tips: [],
    estimated_minutes: 25,
    is_completed: false,
  };

  const guidance = GuidanceService.generateGuidance(habitTask, ecoProject);

  assert.strictEqual(guidance.task_title, 'Define 3 core habits for users to track');
  assert.match(guidance.summary, /eco-habits|sustainability/i);
  assert.match(guidance.why_it_matters, /sustainability|habit/i);
  assert.doesNotMatch(guidance.why_it_matters, /factory warehouse/i, 'Should not mention factory warehouse');

  const actionText = guidance.action_steps.join(' ');
  assert.match(actionText, /environmental|eco-habit|reusable/i);
  assert.doesNotMatch(actionText, /bottles, cartons, packs, kilograms, and liters/i, 'Should not copy inventory units');

  assert.match(guidance.beginner_encouragement, /behavioral|habit/i);
});

test('3. Unrelated Task B: Generates timing-engine guidance for StudySprint Pomodoro task', () => {
  const studyProject: Project = {
    id: 'study-01',
    title: 'StudySprint — Micro-Task Pomodoro Companion',
    description: 'A focused study timer app using 25-minute Pomodoro sessions and micro-breaks.',
    category: 'web',
    difficulty: 'beginner',
    commitment_pace: 'steady',
    created_at: new Date().toISOString(),
    progress_percentage: 0,
    milestones: [],
  };

  const timerTask: Task = {
    id: 't-timer-01',
    milestone_id: 'm-2',
    title: 'Build the countdown timer engine',
    description: 'Create a 25-minute study timer with pause, resume, and completion chime.',
    why_it_matters: '',
    step_by_step_tips: [],
    estimated_minutes: 40,
    is_completed: false,
  };

  const guidance = GuidanceService.generateGuidance(timerTask, studyProject);

  assert.strictEqual(guidance.task_title, 'Build the countdown timer engine');
  assert.match(guidance.summary, /countdown timer|pomodoro/i);
  assert.match(guidance.why_it_matters, /throttle|interval|drift|background tab/i);

  const actionText = guidance.action_steps.join(' ');
  assert.match(actionText, /interval|timestamp|seconds/i);

  const pitfallsText = guidance.common_pitfalls.join(' ');
  assert.match(pitfallsText, /drift|clearInterval|wall-clock/i);

  assert.match(guidance.beginner_encouragement, /timer|delta/i);
});

test('4. Guidance across all 3 tasks is meaningfully different and specialized', () => {
  const pepsiProject: Project = {
    id: 'pepsi-01',
    title: 'Pepsi Factory Inventory Management System',
    description: 'Inventory warehouse management.',
    category: 'web',
    difficulty: 'beginner',
    commitment_pace: 'steady',
    created_at: new Date().toISOString(),
    progress_percentage: 0,
    milestones: [],
  };

  const ecoProject: Project = {
    id: 'eco-01',
    title: 'EcoPledge — Daily Sustainability Tracker',
    description: 'Eco habits tracker.',
    category: 'web',
    difficulty: 'beginner',
    commitment_pace: 'steady',
    created_at: new Date().toISOString(),
    progress_percentage: 0,
    milestones: [],
  };

  const studyProject: Project = {
    id: 'study-01',
    title: 'StudySprint — Micro-Task Pomodoro Companion',
    description: 'Study timer application.',
    category: 'web',
    difficulty: 'beginner',
    commitment_pace: 'steady',
    created_at: new Date().toISOString(),
    progress_percentage: 0,
    milestones: [],
  };

  const g1 = GuidanceService.generateGuidance(
    { id: '1', milestone_id: 'm1', title: 'Build the main interactive input control', description: 'Stock entry form', why_it_matters: '', step_by_step_tips: [], estimated_minutes: 45, is_completed: false },
    pepsiProject
  );

  const g2 = GuidanceService.generateGuidance(
    { id: '2', milestone_id: 'm1', title: 'Define 3 core habits for users to track', description: 'Daily habits', why_it_matters: '', step_by_step_tips: [], estimated_minutes: 25, is_completed: false },
    ecoProject
  );

  const g3 = GuidanceService.generateGuidance(
    { id: '3', milestone_id: 'm1', title: 'Build the countdown timer engine', description: 'Pomodoro timer engine', why_it_matters: '', step_by_step_tips: [], estimated_minutes: 40, is_completed: false },
    studyProject
  );

  // Assert why_it_matters are distinct
  assert.notStrictEqual(g1.why_it_matters, g2.why_it_matters);
  assert.notStrictEqual(g2.why_it_matters, g3.why_it_matters);
  assert.notStrictEqual(g1.why_it_matters, g3.why_it_matters);

  // Assert common pitfalls are distinct
  assert.notStrictEqual(g1.common_pitfalls[0], g2.common_pitfalls[0]);
  assert.notStrictEqual(g2.common_pitfalls[0], g3.common_pitfalls[0]);

  // Assert beginner encouragement tips are distinct
  assert.notStrictEqual(g1.beginner_encouragement, g2.beginner_encouragement);
  assert.notStrictEqual(g2.beginner_encouragement, g3.beginner_encouragement);
});

test('5. PlanService generates tailored blueprint for Pepsi Factory Inventory with enriched guidance', () => {
  const generated = PlanService.generatePlan({
    idea_title: 'Pepsi Factory Inventory Management System',
    idea_description: 'Manage warehouse stock of Pepsi beverages, syrup liters, and packaging pallets.',
    category: 'web',
    difficulty: 'beginner',
    commitment_pace: 'steady',
  });

  assert.strictEqual(generated.title, 'Pepsi Factory Inventory Management System');
  assert.ok(generated.milestones.length >= 3, 'Must generate at least 3 milestones');
  const milestoneIds = new Set(generated.milestones.map((m) => m.id));
  const tasks = generated.milestones.flatMap((m) => m.tasks);
  assert.strictEqual(new Set(tasks.map((task) => task.id)).size, tasks.length, 'Task IDs must be unique');
  for (const milestone of generated.milestones) {
    assert.strictEqual(milestone.project_id, generated.id, 'Milestone must reference its project');
    for (const task of milestone.tasks) {
      assert.strictEqual(task.milestone_id, milestone.id, 'Task must reference its parent milestone');
      assert.ok(milestoneIds.has(task.milestone_id));
    }
  }

  const inputTask = generated.milestones
    .flatMap((m) => m.tasks)
    .find((t) => t.title === 'Build the main interactive input control');

  assert.ok(inputTask, 'Must contain input control task');
  assert.ok(inputTask.guidance, 'Task must contain pre-attached enriched guidance');
  assert.match(inputTask.guidance.action_steps.join(' '), /bottles, cartons, packs, kilograms, and liters/);
});

test('6. AIService honestly reports backend / AMD Token Factory configuration status', async () => {
  const status = await AIService.inspectIntegration();
  assert.strictEqual(status.provider, 'AMD Token Factory');
  assert.strictEqual(status.isConfigured, false);
  assert.ok(status.status === 'backend_unreachable' || status.status === 'missing_credentials');
  assert.match(status.diagnosticMessage, /AMD Token Factory|offline|unreachable/i);
});


// ---------------------------------------------------------------------------
// Task Guide backend integration (mocked fetch; no network or AMD credentials)
// ---------------------------------------------------------------------------
const pantryProject = {
  title: 'PocketPantry',
  description: 'A simple app that helps people track the ingredients in their kitchen and see what expires soon.',
  category: 'web' as const,
};

const pantryTask: Task = {
  id: 't-1-1',
  milestone_id: 'm-1',
  title: 'Clarify the single primary user action',
  description: 'Write down exactly what one primary action a person will take in PocketPantry.',
  why_it_matters: 'Beginning with a singular clear focus prevents overwhelm and scope creep.',
  step_by_step_tips: ['List the minimal data required for that action'],
  estimated_minutes: 20,
  is_completed: false,
};

function backendReply(overrides: Record<string, unknown> = {}) {
  return {
    task_id: 't-1-1',
    task_title: 'Clarify the single primary user action',
    summary: 'You will have one sentence describing the first thing a person can do.',
    what_to_do_next: 'Open a notes app and write the heading.',
    why_it_matters: 'A single clear action keeps version 1 small.',
    action_steps: ['Open notes', 'Write the sentence', 'List the fields'],
    common_pitfalls: ['Choosing two actions'],
    beginner_encouragement: 'Planning is progress.',
    realistic_example: 'Add Milk with an expiry date.',
    expected_result: 'Five lines of notes.',
    verification_steps: ['Read the sentence aloud'],
    source: 'amd_ai',
    source_status: 'Generated by AMD model DeepSeek-V4-Flash.',
    ...overrides,
  };
}

function fakeFetch(handler: (url: string, init: RequestInit) => Promise<unknown> | unknown) {
  const calls: { url: string; body: any }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const result: any = await handler(url, init);
    if (result instanceof Error) throw result;
    return {
      ok: result.status === undefined || (result.status >= 200 && result.status < 300),
      status: result.status ?? 200,
      json: async () => {
        if (result.badJson) throw new SyntaxError('bad json');
        return result.body;
      },
    };
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test('7. Task guidance request sends the real task and project to POST /api/tasks/guidance', async () => {
  GuidanceService.clearGuidanceCache();
  const { impl, calls } = fakeFetch(() => ({ body: backendReply() }));
  const result = await GuidanceService.requestBackendGuidance(pantryTask, pantryProject, {
    fetchImpl: impl,
    backendUrl: 'http://test-backend',
  });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, 'http://test-backend/api/tasks/guidance');
  assert.deepStrictEqual(calls[0].body.task, {
    id: 't-1-1',
    milestone_id: 'm-1',
    title: 'Clarify the single primary user action',
    description: pantryTask.description,
    why_it_matters: pantryTask.why_it_matters,
    step_by_step_tips: pantryTask.step_by_step_tips,
    estimated_minutes: 20,
    is_completed: false,
  });
  assert.deepStrictEqual(calls[0].body.project, pantryProject);
  assert.ok(result.ok);
});

test('8. Backend response is mapped completely and labelled from the real source fields', async () => {
  GuidanceService.clearGuidanceCache();
  const { impl } = fakeFetch(() => ({ body: backendReply() }));
  const result = await GuidanceService.requestBackendGuidance(pantryTask, pantryProject, { fetchImpl: impl });
  assert.ok(result.ok);
  if (!result.ok) return;
  const g = result.guidance;
  assert.match(g.summary, /one sentence/);
  assert.strictEqual(g.what_to_do_next, 'Open a notes app and write the heading.');
  assert.strictEqual(g.why_it_matters, 'A single clear action keeps version 1 small.');
  assert.deepStrictEqual(g.action_steps, ['Open notes', 'Write the sentence', 'List the fields']);
  assert.deepStrictEqual(g.common_pitfalls, ['Choosing two actions']);
  assert.strictEqual(g.beginner_encouragement, 'Planning is progress.');
  assert.strictEqual(g.realistic_example, 'Add Milk with an expiry date.');
  assert.strictEqual(g.expected_result, 'Five lines of notes.');
  assert.deepStrictEqual(g.verification_steps, ['Read the sentence aloud']);
  const info = GuidanceService.describeSource(g);
  assert.strictEqual(info.kind, 'amd');
  assert.match(info.detail, /DeepSeek-V4-Flash/);
});

test('9. Offline guidance returned by the backend is never labelled as AMD', async () => {
  GuidanceService.clearGuidanceCache();
  const { impl } = fakeFetch(() => ({
    body: backendReply({ source: 'domain_synthesizer', source_status: 'AMD response unavailable; offline beginner guidance used.' }),
  }));
  const result = await GuidanceService.requestBackendGuidance(pantryTask, pantryProject, { fetchImpl: impl });
  assert.ok(result.ok);
  if (!result.ok) return;
  const info = GuidanceService.describeSource(result.guidance);
  assert.strictEqual(info.kind, 'offline');
  assert.doesNotMatch(info.label, /Generated by AMD/i);

  const local = GuidanceService.asOfflineGuidance(GuidanceService.generateGuidance(pantryTask, pantryProject), 'Backend offline.');
  assert.strictEqual(local.source, 'domain_synthesizer');
  assert.strictEqual(GuidanceService.describeSource(local).kind, 'offline');
  assert.doesNotMatch(local.source_status ?? '', /Generated by AMD|project-aware domain engine/i);
  assert.match(local.source_status ?? '', /offline/i);
});

test('10. Identical requests share one network call and AMD answers are cached', async () => {
  GuidanceService.clearGuidanceCache();
  const { impl, calls } = fakeFetch(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { body: backendReply() };
  });
  const opts = { fetchImpl: impl };
  // Simulates React StrictMode firing the effect twice, then a "mark as done" re-render.
  const [a, b] = await Promise.all([
    GuidanceService.requestBackendGuidance(pantryTask, pantryProject, opts),
    GuidanceService.requestBackendGuidance(pantryTask, pantryProject, opts),
  ]);
  assert.ok(a.ok && b.ok);
  assert.strictEqual(calls.length, 1, 'concurrent identical requests must share one call');

  await GuidanceService.requestBackendGuidance({ ...pantryTask, is_completed: true }, pantryProject, opts);
  assert.strictEqual(calls.length, 1, 'ticking the task must not refetch');

  await GuidanceService.requestBackendGuidance(pantryTask, pantryProject, { ...opts, force: true });
  assert.strictEqual(calls.length, 2, '"Try again" must bypass the cache');
});

test('11. Failures return a clear reason (network, HTTP error, bad JSON, invalid shape, timeout)', async () => {
  const cases: [string, any, RegExp][] = [
    ['network', () => new TypeError('Failed to fetch'), /Could not reach the HerFirst backend/],
    ['http 500', () => ({ status: 500, body: {} }), /HTTP 500/],
    ['http 422', () => ({ status: 422, body: {} }), /HTTP 422/],
    ['bad json', () => ({ badJson: true }), /not valid JSON/],
    ['missing fields', () => ({ body: { task_id: 't-1-1', source: 'amd_ai' } }), /missing required guidance fields/],
    ['unknown source', () => ({ body: backendReply({ source: 'somewhere' }) }), /missing required guidance fields/],
    ['stale task', () => ({ body: backendReply({ task_id: 'other' }) }), /missing required guidance fields/],
  ];
  for (const [name, handler, expected] of cases) {
    GuidanceService.clearGuidanceCache();
    const { impl } = fakeFetch(handler);
    const result = await GuidanceService.requestBackendGuidance(pantryTask, pantryProject, { fetchImpl: impl });
    assert.strictEqual(result.ok, false, name);
    if (!result.ok) assert.match(result.reason, expected, name);
  }

  GuidanceService.clearGuidanceCache();
  const hanging = ((_: string, init: RequestInit) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    })) as unknown as typeof fetch;
  const timedOut = await GuidanceService.requestBackendGuidance(pantryTask, pantryProject, { fetchImpl: hanging, timeoutMs: 30 });
  assert.strictEqual(timedOut.ok, false);
  if (!timedOut.ok) assert.match(timedOut.reason, /did not answer within/);

  // A failed request must not be cached: the next attempt calls the backend again.
  const { impl, calls } = fakeFetch(() => ({ body: backendReply() }));
  const retry = await GuidanceService.requestBackendGuidance(pantryTask, pantryProject, { fetchImpl: impl });
  assert.ok(retry.ok);
  assert.strictEqual(calls.length, 1);
});

test('12. Offline PocketPantry "primary user action" guide is concrete and does not suggest a standalone index.html', () => {
  const g = GuidanceService.generateGuidance(pantryTask, pantryProject);
  const text = [...g.action_steps, g.realistic_example ?? '', g.expected_result ?? ''].join(' ');
  assert.match(text, /ingredient/i);
  assert.match(text, /expiry date/i);
  assert.match(text, /Done when/i);
  assert.match(g.what_to_do_next, /do not need to write or change any code/i);
  assert.doesNotMatch(text, /index\.html/i);
  assert.ok(g.action_steps.length >= 6);
  assert.ok((g.verification_steps ?? []).length >= 3);
  assert.ok(g.common_pitfalls.length >= 3);
});


test('universal builder enrichment adds a code prompt and delivery guidance', () => {
  const task = { id: 't-workflow', milestone_id: 'm-github', title: 'Prepare GitHub repository', description: 'Review files and push the source repository.', why_it_matters: 'Keep source changes recoverable.', step_by_step_tips: ['Review .gitignore'], estimated_minutes: 25, is_completed: false };
  const project = { id: 'p-workflow', title: 'StudyBuddy', description: 'Study planner web app', category: 'web' as const, difficulty: 'beginner' as const, commitment_pace: 'intensive' as const, created_at: new Date().toISOString(), milestones: [{id:'m-github', project_id:'p-workflow', order:1, title:'Version Control and GitHub', description:'Prepare repository', tasks:[task]}], progress_percentage: 0 };
  const base = GuidanceService.generateGuidance(task, project);
  const enriched = GuidanceService.enrichWithWorkflow(base, task, project, 'Version Control and GitHub', 'Prepare repository');
  assert.equal(enriched.guide_stage, 'github');
  assert.ok(enriched.code_generation_prompt?.includes('StudyBuddy'));
  assert.ok(enriched.tools_and_links?.some((item) => item.includes('github.com')));
  assert.ok(enriched.github_deployment_steps?.length);
});

test('offline StudyBuddy setup task gets setup commands, not planning-only instructions', () => {
  const task: Task = {
    id: 'setup-studybuddy',
    milestone_id: 'm-setup',
    title: 'Set up development workspace and libraries',
    description: 'Initialize your frontend structure and confirm the local preview works.',
    why_it_matters: 'Setting up cleanly at the start ensures no dependency friction later.',
    step_by_step_tips: ['Verify Node and package versions', 'Create layout structure and navigation', 'Confirm hot module reload'],
    estimated_minutes: 35,
    is_completed: false,
  };
  const milestone = { id: 'm-setup', project_id: 'studybuddy', order: 1, title: 'Project Scope & Foundational Setup', description: 'Define your core user journey and configure a clean development environment for StudyBuddy.', tasks: [task] };
  const project: Project = {
    id: 'studybuddy', title: 'StudyBuddy', description: 'A study planner for students to start study sessions.', category: 'web', difficulty: 'beginner', commitment_pace: 'intensive',
    created_at: new Date().toISOString(), milestones: [milestone], progress_percentage: 0,
    technology_stack: ['React + TypeScript + Vite'],
  };
  const base = GuidanceService.generateGuidance(task, project);
  const guide = GuidanceService.enrichWithWorkflow(base, task, project, milestone.title, milestone.description);
  assert.equal(guide.guide_stage, 'setup');
  assert.ok(guide.action_steps.some((step) => step.includes('node --version') && step.includes('npm --version')));
  assert.ok(guide.file_instructions?.some((step) => step.includes('npm create vite@latest')));
  assert.ok(guide.run_instructions?.some((step) => step.includes('npm run dev')));
  assert.ok(!guide.run_instructions?.some((step) => step.includes('No terminal command is needed')));
});

test('offline guide refreshes stale cached setup instructions instead of retaining planning-only text', () => {
  const task: Task = {
    id: 'setup-cached-studybuddy', milestone_id: 'm-setup', title: 'Set up development workspace and libraries',
    description: 'Initialize your frontend structure and confirm the local preview works.',
    why_it_matters: 'Setting up cleanly at the start ensures no dependency friction later.',
    step_by_step_tips: ['Verify Node and package versions', 'Confirm hot module reload'],
    estimated_minutes: 35, is_completed: false,
    guidance: {
      task_id: 'setup-cached-studybuddy', task_title: 'Set up development workspace and libraries',
      summary: 'Old cached generic guide.', what_to_do_next: 'Do a planning exercise.', why_it_matters: 'Old cached text.',
      action_steps: ['Generic old step one.', 'Generic old step two.', 'Generic old step three.'],
      common_pitfalls: ['Old pitfall.'], beginner_encouragement: 'Old encouragement.',
      expected_result: 'Old result.', verification_steps: ['Old verification.'],
      source: 'domain_synthesizer', source_status: 'Old offline guide', guide_stage: 'planning',
      file_instructions: ['For this planning task, write notes only.'],
      run_instructions: ['No terminal command is needed unless this task explicitly includes implementation.'],
      code_generation_prompt: 'Old generic prompt',
    },
  };
  const milestone = { id: 'm-setup', project_id: 'studybuddy', order: 1, title: 'Project Scope & Foundational Setup', description: 'Define your core user journey and configure a clean development environment for StudyBuddy.', tasks: [task] };
  const project: Project = {
    id: 'studybuddy', title: 'StudyBuddy', description: 'A study planner for students to start study sessions.',
    category: 'web', difficulty: 'beginner', commitment_pace: 'intensive', created_at: new Date().toISOString(),
    milestones: [milestone], progress_percentage: 0, technology_stack: ['React + TypeScript + Vite'],
  };
  const base = GuidanceService.generateGuidance(task, project);
  const guide = GuidanceService.enrichWithWorkflow(base, task, project, milestone.title, milestone.description);
  assert.equal(guide.guide_stage, 'setup');
  assert.ok(guide.action_steps.some((step) => step.includes('node --version')));
  assert.ok(guide.file_instructions?.some((step) => step.includes('npm create vite@latest')));
  assert.ok(guide.run_instructions?.some((step) => step.includes('npm run dev')));
  assert.doesNotMatch(guide.file_instructions?.join(' ') ?? '', /For this planning task/i);
  assert.doesNotMatch(guide.code_generation_prompt ?? '', /beginner beginner/i);
});

test('offline StudyBuddy input-control guide gives a concrete form, validation, and tests', () => {
  const task: Task = {
    id: 'studybuddy-input', milestone_id: 'm-core', title: 'Build the main interactive input control',
    description: 'Construct the primary input control or form where users enter data for StudyBuddy.',
    why_it_matters: 'Input is the catalyst for any interactive software experience.',
    step_by_step_tips: ['Use semantic inputs', 'Attach reactive state handlers', 'Provide validation feedback'],
    estimated_minutes: 45, is_completed: false,
  };
  const project: Project = {
    id: 'studybuddy', title: 'StudyBuddy', description: 'A web app that helps students organize subjects, homework deadlines, study sessions and progress.',
    category: 'web', difficulty: 'beginner', commitment_pace: 'intensive', created_at: new Date().toISOString(), milestones: [], progress_percentage: 0,
    technology_stack: ['React + TypeScript + Vite'],
  };
  const guide = GuidanceService.generateGuidance(task, project);
  const allText = [...guide.action_steps, guide.realistic_example ?? '', guide.expected_result ?? '', ...(guide.verification_steps ?? [])].join(' ');
  assert.match(allText, /Subject/i);
  assert.match(allText, /25 minutes/i);
  assert.match(allText, /blank subject/i);
  assert.match(allText, /mobile/i);
  assert.ok(guide.action_steps.length >= 7);
});

test('offline StudyBuddy testing guide includes valid, invalid, mobile and console checks', () => {
  const task: Task = {
    id: 'studybuddy-test', milestone_id: 'm-test', title: 'Test edge cases and mobile responsiveness',
    description: 'Verify StudyBuddy handles edge cases, empty inputs, and responsive layouts cleanly.',
    why_it_matters: 'Polished error handling improves reliability.',
    step_by_step_tips: ['Test empty input', 'Check mobile width', 'Inspect Console'], estimated_minutes: 30, is_completed: false,
  };
  const project: Project = {
    id: 'studybuddy', title: 'StudyBuddy', description: 'A study planner for students.', category: 'web', difficulty: 'beginner', commitment_pace: 'intensive',
    created_at: new Date().toISOString(), milestones: [], progress_percentage: 0,
  };
  const guide = GuidanceService.generateGuidance(task, project);
  const text = [...guide.action_steps, ...(guide.verification_steps ?? [])].join(' ');
  assert.match(text, /empty subject/i);
  assert.match(text, /375 px/i);
  assert.match(text, /Console/i);
});
