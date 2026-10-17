import type { Project, Task, TaskGuidance } from '../types/project.ts';

/** The backend waits up to 45 s per AI model; leave room for that plus network time. */
export const GUIDANCE_TIMEOUT_MS = 60000;

export type BackendGuidanceResult =
  | { ok: true; guidance: TaskGuidance }
  | { ok: false; reason: string };

export interface GuidanceRequestOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  backendUrl?: string;
  /** Skip the cache of earlier AMD answers (used by "Try again"). */
  force?: boolean;
}

export interface GuidanceSourceInfo {
  kind: 'amd' | 'offline';
  label: string;
  detail: string;
}

interface ProjectContext {
  title: string;
  description: string;
  category?: string;
  difficulty?: Project['difficulty'];
  commitment_pace?: Project['commitment_pace'];
  milestones?: Array<{ id: string; title: string; description: string }>;
  technology_stack?: string[];
  architecture_overview?: string;
  folder_structure?: string[];
}

export type DomainType =
  | 'inventory_factory'
  | 'sustainability_habits'
  | 'study_productivity'
  | 'transport_carpool'
  | 'recipe_food'
  | 'general_software';

export type TaskIntentType =
  | 'input_control'
  | 'output_display'
  | 'persistence_database'
  | 'scope_setup'
  | 'timer_engine'
  | 'testing_polish'
  | 'general';

export class GuidanceService {
  /**
   * Detects the domain context from the project title and description.
   */
  public static detectDomain(project?: ProjectContext): DomainType {
    if (!project) return 'general_software';
    const text = `${project.title} ${project.description}`.toLowerCase();

    if (
      text.includes('inventory') ||
      text.includes('warehouse') ||
      text.includes('factory') ||
      text.includes('stock') ||
      text.includes('pepsi') ||
      text.includes('beverage') ||
      text.includes('bottling') ||
      text.includes('logistics') ||
      text.includes('supply')
    ) {
      return 'inventory_factory';
    }

    if (
      text.includes('habit') ||
      text.includes('eco') ||
      text.includes('sustainability') ||
      text.includes('carbon') ||
      text.includes('pledge') ||
      text.includes('green')
    ) {
      return 'sustainability_habits';
    }

    if (
      text.includes('study') ||
      text.includes('pomodoro') ||
      text.includes('timer') ||
      text.includes('exam') ||
      text.includes('quiz') ||
      text.includes('student') ||
      text.includes('focus')
    ) {
      return 'study_productivity';
    }

    if (
      text.includes('carpool') ||
      text.includes('ride') ||
      text.includes('commute') ||
      text.includes('campus ride') ||
      text.includes('transit')
    ) {
      return 'transport_carpool';
    }

    if (
      text.includes('recipe') ||
      text.includes('meal') ||
      text.includes('cooking') ||
      text.includes('ingredient') ||
      text.includes('food') ||
      text.includes('pantry')
    ) {
      return 'recipe_food';
    }

    return 'general_software';
  }

  /**
   * Detects task intent from task title and description.
   */
  public static detectTaskIntent(task: Task): TaskIntentType {
    const text = `${task.title} ${task.description}`.toLowerCase();

    if (
      text.includes('input') ||
      text.includes('form') ||
      text.includes('entry') ||
      text.includes('control') ||
      text.includes('submit') ||
      text.includes('enter') ||
      text.includes('field')
    ) {
      return 'input_control';
    }

    if (
      text.includes('render') ||
      text.includes('output') ||
      text.includes('display') ||
      text.includes('list') ||
      text.includes('table') ||
      text.includes('dashboard') ||
      text.includes('results')
    ) {
      return 'output_display';
    }

    if (
      text.includes('persist') ||
      text.includes('database') ||
      text.includes('supabase') ||
      text.includes('storage') ||
      text.includes('sql') ||
      text.includes('save')
    ) {
      return 'persistence_database';
    }

    if (
      text.includes('timer') ||
      text.includes('countdown') ||
      text.includes('interval') ||
      text.includes('clock')
    ) {
      return 'timer_engine';
    }

    if (
      text.includes('scope') ||
      text.includes('action') ||
      text.includes('user story') ||
      /\bset up\b/.test(text) ||
      text.includes('setup') ||
      text.includes('workspace') ||
      text.includes('environment') ||
      text.includes('libraries') ||
      text.includes('dependencies') ||
      text.includes('install') ||
      text.includes('initialize') ||
      text.includes('initialise') ||
      text.includes('scaffold') ||
      text.includes('wireframe') ||
      text.includes('define')
    ) {
      return 'scope_setup';
    }

    if (
      text.includes('test') ||
      text.includes('edge case') ||
      text.includes('polish') ||
      text.includes('responsive') ||
      text.includes('mobile')
    ) {
      return 'testing_polish';
    }

    return 'general';
  }

  /**
   * Generates tailored, project-specific and task-specific guidance.
   */
  public static generateGuidance(
    task: Task,
    project?: ProjectContext | Project
  ): TaskGuidance {
    const domain = this.detectDomain(project);
    const intent = this.detectTaskIntent(task);

    // Preserve a genuinely AMD-generated task guide, but refresh any locally cached
    // offline guide. Older blueprints may embed generic offline guidance; returning it
    // here bypasses improved task-specific setup/form/testing instructions.
    if (
      task.guidance?.source === 'amd_ai' &&
      task.guidance.action_steps?.length > 0 &&
      task.guidance.expected_result
    ) {
      return task.guidance;
    }
    const projectName = project?.title || 'Your Project';
    const projectFolderName = projectName.replace(/[^A-Za-z0-9_-]+/g, '').replace(/^[-_]+|[-_]+$/g, '') || 'my-app';

    // 1. INVENTORY / FACTORY DOMAIN + INPUT CONTROL (Target for failed test)
    if (domain === 'inventory_factory' && intent === 'input_control') {
      const isPepsi = `${projectName} ${project?.description || ''}`.toLowerCase().includes('pepsi');
      const brandNoun = isPepsi ? 'Pepsi factory products' : 'inventory items';
      const sampleItem = isPepsi ? 'Pepsi Regular 500ml Pack' : 'Standard Raw Material A';

      return {
        task_id: task.id,
        task_title: task.title,
        summary: `Build an interactive inventory stock-entry form allowing operators to log ${brandNoun} with quantity, unit selection, and real-time validation.`,
        what_to_do_next: `Implement a structured entry form with Product Name, Quantity, and Unit selection (bottles, cartons, packs, kilograms, liters), preventing negative numbers or empty names.`,
        why_it_matters: `In a factory warehouse like ${projectName}, inventory records drive purchasing, bottling schedules, and fulfillment. If the input allows negative quantities or blank product names, the warehouse database corrupts immediately, causing stock discrepancies and costly manufacturing halts.`,
        action_steps: [
          'Create a Product Name text input (<input type="text" />) to capture product designations (e.g. "Pepsi Regular 500ml Pack", "Diet Pepsi Syrup").',
          'Create a Quantity number input (<input type="number" min="1" step="any" />) to capture incoming or outgoing stock volume.',
          'Create a Unit selection dropdown (<select>) containing the required options: bottles, cartons, packs, kilograms, and liters.',
          'Implement client-side validation that immediately blocks submission if the product name is empty/whitespace, or if the quantity is zero, negative, or not a valid number.',
          'Render clear inline validation error messages (e.g. "Product name is required" and "Quantity must be greater than zero") below the invalid fields.',
          'On successful validation, create a clean stock-entry record and append it to your active inventory state.',
        ],
        common_pitfalls: [
          'Allowing negative numbers: Entering -50 cartons will silently decrement warehouse totals instead of logging a controlled deduction.',
          'String concatenation bug: Forgetting to parse input with Number(quantity) or parseFloat(), turning 10 + 5 into "105" units.',
          'Missing unit designation: Storing a quantity without a unit creates chaos between bulk raw liquid (liters/kilograms) and packaged units (bottles/cartons/packs).',
          'Empty product names: Allowing blank submissions produces "ghost items" in factory tracking tables.',
        ],
        beginner_encouragement: `In industrial manufacturing applications like ${projectName}, data integrity is your greatest superpower. Building strict validation with explicit units (bottles, cartons, packs, kilograms, liters) ensures factory managers can always trust your dashboard!`,
        realistic_example: `// Realistic Stock-Entry Example & State Handler
interface StockEntry {
  productName: string;
  quantity: number;
  unit: 'bottles' | 'cartons' | 'packs' | 'kilograms' | 'liters';
}

const [formState, setFormState] = useState<StockEntry>({
  productName: '${sampleItem}',
  quantity: 150,
  unit: 'cartons', // Options: 'bottles' | 'cartons' | 'packs' | 'kilograms' | 'liters'
});

const handleStockSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!formState.productName.trim()) {
    return alert('Error: Product name is required.');
  }
  const qty = Number(formState.quantity);
  if (isNaN(qty) || qty <= 0) {
    return alert('Error: Quantity must be greater than zero. Negative quantities are invalid.');
  }
  
  // Submit verified stock item to inventory store
  addStockItem({ ...formState, quantity: qty });
};`,
        expected_result: `A styled stock-entry form with 3 input controls (Product Name, Quantity, Unit select with bottles, cartons, packs, kilograms, liters). Submitting valid values adds the item to the warehouse stock table; submitting blank names or negative quantities halts submission with visible error notices.`,
        verification_steps: [
          'Test empty name: Clear Product Name, enter quantity 10, select "cartons", and click Submit -> Verify that "Product name is required" error appears.',
          'Test negative quantity: Enter product name "${sampleItem}", enter quantity -25, and click Submit -> Verify that "Quantity must be greater than zero" error appears.',
          'Test zero quantity: Enter quantity 0 -> Verify that zero is rejected with a validation error.',
          'Test valid stock entry: Enter "${sampleItem}", quantity 150, select unit "cartons" -> Verify that the item appears in the inventory list with 150 cartons recorded.',
          'Test liquid raw unit: Enter "Pepsi Beverage Base Syrup", quantity 500, select unit "liters" -> Verify that 500 liters is successfully logged.',
        ],
        source: 'domain_synthesizer',
        source_status: 'Built-in offline guide (not AI-generated)',
      };
    }

    // 2. INVENTORY / FACTORY DOMAIN + OUTPUT DISPLAY
    if (domain === 'inventory_factory' && intent === 'output_display') {
      return {
        task_id: task.id,
        task_title: task.title,
        summary: `Render a structured factory inventory table displaying product SKUs, current quantities, units of measure, and stock health indicators.`,
        what_to_do_next: `Build an inventory data table or grid that lists each recorded batch, displaying Product Name, Quantity, Unit, and low-stock warning thresholds.`,
        why_it_matters: `Factory managers cannot make production decisions from raw logs. Visualizing live stock with status badges (e.g. "Low Stock", "Optimal", "Overstock") prevents production line stoppages.`,
        action_steps: [
          'Create an inventory table component with columns: Item Name, Stock Level, Unit of Measure, Status Badge, and Actions.',
          'Format quantities with their corresponding unit (e.g. "1,200 cartons" or "450 liters").',
          'Add conditional badge styling: green for healthy inventory, amber for low stock (e.g. < 50 cartons), and red for depleted stock.',
          'Implement empty state messaging when zero factory items are recorded.',
        ],
        common_pitfalls: [
          'Failing to display the unit next to quantity, confusing pallets with individual bottles.',
          'Not sorting inventory by most recently updated or by urgent low-stock priority.',
        ],
        beginner_encouragement: `Dashboards provide the "aha!" moment for factory users. Keeping units and status badges front and center will make your application look instantly professional!`,
        realistic_example: `// Example Inventory Row Display
<tr key={item.id}>
  <td>{item.productName}</td>
  <td><strong>{item.quantity}</strong> {item.unit}</td>
  <td>
    <Badge variant={item.quantity < 50 ? 'warning' : 'success'}>
      {item.quantity < 50 ? 'Low Stock' : 'Adequate'}
    </Badge>
  </td>
</tr>`,
        expected_result: `A clean warehouse stock table showing recorded items with accurate quantities and unit labels.`,
        verification_steps: [
          'Add items with different units (bottles, cartons, liters) and verify that each unit appears clearly in the table.',
          'Add an item with quantity below 50 and verify that the warning badge triggers.',
        ],
        source: 'domain_synthesizer',
        source_status: 'Built-in offline guide (not AI-generated)',
      };
    }

    // 3. SUSTAINABILITY / HABIT DOMAIN + SCOPE / DEFINE (e.g. EcoPledge Task)
    if (domain === 'sustainability_habits' && (intent === 'scope_setup' || task.title.toLowerCase().includes('habit'))) {
      return {
        task_id: task.id,
        task_title: task.title,
        summary: `Define 3 concrete, low-barrier daily eco-habits with clear binary completion metrics and measurable environmental benefits.`,
        what_to_do_next: `Select 3 simple, non-vague daily sustainability actions that can be checked off in under 5 seconds (e.g. Skip single-use plastic, Bring reusable mug, Choose vegetarian meal).`,
        why_it_matters: `Vague goals like "live more sustainably" fail because users never know when they've succeeded. Defining concrete binary actions provides instantaneous positive feedback and creates habit streaks that stick.`,
        action_steps: [
          'Brainstorm 5 potential everyday environmental actions and eliminate any that require complex manual calculations.',
          'Select 3 specific actions: e.g. "Used Reusable Tote/Bag", "Refilled Reusable Water Bottle", "Chose Active or Public Transit".',
          'Assign an estimated positive impact metric to each (e.g. "Diverts 1 plastic bag from landfill" or "Saves 2.5 kg CO2e").',
          'Store the habit definitions in a configuration object or state array for easy rendering in habit cards.',
        ],
        common_pitfalls: [
          'Choosing overly burdensome habits (e.g. "Compost 100% of organic waste") that beginners abandon after 2 days.',
          'Ambiguous completion rules: Make sure each habit has a clear Yes/No status rather than fractional logging.',
        ],
        beginner_encouragement: `The secret of behavioral software is reducing friction. Make each habit effortless to log, and users will return daily!`,
        realistic_example: `export const CORE_HABITS = [
  { id: 'h1', title: 'Bring Reusable Bottle', impact: 'Saves 1 single-use plastic bottle', icon: '💧' },
  { id: 'h2', title: 'Meatless Lunch', impact: 'Reduces carbon footprint by ~1.5kg CO2', icon: '🥗' },
  { id: 'h3', title: 'Public or Bike Commute', impact: 'Cuts ~2.8kg vehicular emissions', icon: '🚲' },
];`,
        expected_result: `A defined list of 3 distinct, accessible sustainability habits ready to be rendered as interactive daily check-off cards.`,
        verification_steps: [
          'Verify that each habit can be answered with a simple Done / Not Done toggle.',
          'Confirm that all 3 habits have an inspiring impact description for positive reinforcement.',
        ],
        source: 'domain_synthesizer',
        source_status: 'Built-in offline guide (not AI-generated)',
      };
    }

    // 4. STUDY / INPUT FORM: concrete, project-specific offline guide.
    if (domain === 'study_productivity' && intent === 'input_control') {
      return {
        task_id: task.id,
        task_title: task.title,
        summary: `Build the first useful ${projectName} input: a small form to prepare one study session.`,
        what_to_do_next: 'Start with two fields—Subject and Session length (default 25 minutes)—and a Start session button. Keep homework, statistics, and saved history out of this task.',
        why_it_matters: 'StudyBuddy needs a small amount of information before it can prepare a useful study session. A validated form proves the first user journey before extra features are added.',
        action_steps: [
          `Open the ${projectName} project root in VS Code. Read README.md and the package.json scripts so you know the real frontend folder and start command.`,
          'Press Ctrl+Shift+F and search for "session", "form", "subject", or text shown on the current screen. Extend an existing screen/component if one already collects study details; do not create a duplicate.',
          'Define the first form fields: Subject name (required text) and Session length (whole number, default 25 minutes). Choose and display a clear allowed range such as 5–120 minutes.',
          'Use the framework already selected in the project overview. If it is React + TypeScript, use labelled form controls and the existing component state pattern; do not make a standalone index.html.',
          'When Start session is pressed, reject a blank subject and any duration that is not a whole number inside the chosen range. Show a readable inline message next to the field.',
          'For valid input, show a visible confirmation such as "Ready to study Biology for 25 minutes", or call the existing start-session handler if it already exists. Do not build a second timer in this form task.',
          'Use the Copy-Ready AI Prompt to ask ChatGPT or Claude to inspect the files and implement only this form. Review each relative path it proposes; save code to source files, never paste source code into the terminal.',
          'Run the existing frontend script from its actual frontend folder. Test a blank subject, duration 0, duration 25, and a mobile-width screen before marking the task complete.',
        ],
        common_pitfalls: [
          'Do not build the whole homework planner, analytics, and history in one input-form task.',
          'Do not invent a filename; search first and reuse the current screen/component.',
          'Do not accept blank subject names or values outside the duration rule you selected.',
          'Do not paste React/TypeScript source code into PowerShell or the terminal; save it to the identified source file.',
          'Do not mark the task complete until normal and invalid submissions have been tested in the browser.',
        ],
        beginner_encouragement: 'This is one small interaction, not the whole app. A form that accepts one valid session and explains invalid values is a real, testable milestone.',
        realistic_example: `Illustrative ${projectName} form: Subject = "Biology"; Session length = 25; button = "Start session". Valid result: "Ready to study Biology for 25 minutes". Blank subject shows "Enter a subject"; duration 0 shows "Choose 5–120 minutes".`,
        expected_result: 'The existing StudyBuddy screen has labelled Subject and Session length fields, a 25-minute default, a Start session button, helpful inline validation, and a visible valid-submit result.',
        verification_steps: [
          'Submit with an empty subject: expect an "Enter a subject" message and no successful confirmation.',
          'Enter Biology and duration 0: expect a duration validation message.',
          'Enter Biology and duration 25: expect a confirmation or the existing start-session behavior.',
          'Resize to about 375 px wide: fields and button remain visible without horizontal scrolling.',
          'Check Chrome Console and confirm the other project screens still open.',
        ],
        source: 'domain_synthesizer',
        source_status: 'Built-in offline guide (not AMD-generated)',
      };
    }

    // 4a. SETUP WORKFLOW: this generated project may not have a code folder yet.
    if (intent === 'scope_setup' && /(workspace|environment|libraries|dependencies|install|scaffold|setup|set up|initialize|initialise)/i.test(`${task.title} ${task.description}`)) {
      const stackText = (project?.technology_stack ?? []).join(' ').toLowerCase();
      const reactVite = /react/.test(stackText) && /vite/.test(stackText);
      const actionSteps = reactVite ? [
        `Open the parent folder where you want ${projectName} to live in VS Code. Open Terminal > New Terminal and run \`node --version\` and \`npm --version\`. If a command is not found, install Node.js LTS from https://nodejs.org/ and reopen VS Code.`,
        `Check whether a ${projectFolderName} folder already contains package.json. If it does, reuse that folder and do not scaffold a second app. If it does not, run \`npm create vite@latest ${projectFolderName} -- --template react-ts\` from the parent folder, then run \`cd ${projectFolderName}\`.`,
        'From the folder containing package.json, run `npm install` and wait for it to finish. If it fails, copy the first error and stop rather than deleting the lockfile.',
        'Run `npm run dev`. Open the exact Local URL printed in the terminal (often http://localhost:5173) and keep the terminal open.',
        'In the new React + TypeScript starter, open `src/App.tsx`, change one visible heading, save with Ctrl+S, and confirm the browser updates without a restart. Undo this test edit afterward.',
        'If the port is already in use, first open the existing Local URL rather than starting multiple server copies. If the URL does not load, copy the terminal output and check the browser Console.',
      ] : [
        'Open the project overview and read the Suggested Technology Stack. Open the parent folder where the code should live in VS Code; install only the selected stack’s official runtime/editor tools.',
        'Check whether the project folder already contains its dependency manifest. Reuse it if present. If no starter exists yet, follow the selected framework’s official starter instructions rather than mixing commands from several frameworks.',
        'Open Terminal > New Terminal in the folder containing the manifest. Read README and its scripts, then install missing dependencies using the package manager that belongs to this stack.',
        'Run the start/dev command documented by the selected framework or project. Open the exact local URL printed by the terminal and keep the server running.',
        'Edit one visible label in the actual starter screen, save, confirm it changes in the browser, then undo the edit.',
        'If any command fails, copy the first red error and current folder path. Do not delete package locks, node_modules, or project files as a first fix.',
      ];
      return {
        task_id: task.id,
        task_title: task.title,
        summary: `Create or verify the ${projectName} development workspace and confirm that a saved change appears in the local preview.`,
        what_to_do_next: reactVite
          ? `Check Node.js and npm first, then reuse an existing ${projectFolderName} app folder or scaffold the React + TypeScript + Vite starter if no app exists yet.`
          : 'Read the Selected Technology Stack on the project overview, then check whether a code folder already exists before installing or generating files.',
        why_it_matters: 'A working local preview proves the setup before new features are added. Checking the folder first avoids duplicate apps and commands run from the wrong directory.',
        action_steps: actionSteps,
        common_pitfalls: [
          'Do not create a second project if the correct folder and manifest already exist.',
          'Run install and start commands from the directory containing the project manifest.',
          'Do not assume a port conflict means the app failed; check the existing Local URL.',
          'Do not overwrite package.json or a lockfile just to silence an install warning.',
          'Never include .env or API keys when uploading the project to GitHub.',
        ],
        beginner_encouragement: 'Only aim to get the starter running and see one saved change. You do not need all StudyBuddy features at this stage.',
        realistic_example: reactVite
          ? 'React + TypeScript + Vite flow: check Node/npm → create the starter only if absent → install packages → run the dev script → open the printed URL → edit src/App.tsx and observe the browser update.'
          : 'Use the stack shown in the project overview, follow its official starter steps, run the documented command, and confirm one saved edit appears in the browser.',
        expected_result: 'The selected frontend starter loads at its local URL, dependencies are installed, and a saved text edit appears in the browser without restarting the server.',
        verification_steps: [
          'Confirm the terminal prints a ready message and local URL.',
          'Open that exact URL and confirm the starter page loads.',
          'Edit one visible label, save, confirm hot reload, then undo the edit.',
          'Check the Console for errors and make sure the current directory contains the expected manifest.',
        ],
        source: 'domain_synthesizer',
        source_status: 'Built-in offline guide (not AMD-generated)',
      };
    }

    // 4b. Study-specific tests: check normal inputs, invalid values and mobile layout.
    if (domain === 'study_productivity' && intent === 'testing_polish') {
      return {
        task_id: task.id,
        task_title: task.title,
        summary: `Test the main ${projectName} flow with valid and invalid inputs, then check the layout on a phone-sized screen.`,
        what_to_do_next: 'Start the app using its existing README/package.json command and write down the expected result for one normal study session.',
        why_it_matters: 'A feature can look correct with one perfect input but fail for empty values, boundary values, or small screens. Repeatable tests show exactly what needs fixing.',
        action_steps: [
          'Run the start command already documented by the project and open the Local URL printed in the terminal.',
          'Test the normal path: enter Biology and a 25-minute session, then use the main action. Record what appears and compare it to the task acceptance rule.',
          'Test an empty subject. The app should show a helpful validation message and should not proceed as though the session started.',
          'Test duration 0 and the chosen minimum/maximum values. Confirm the app accepts only the values described beside the field.',
          'Press F12 and check Console for red errors. Use Network only if a request fails, and do not copy cookies, keys, or other secrets.',
          'Open DevTools device emulation or resize the browser to about 375 px wide. Confirm fields, buttons, messages, and timer are readable with no overlap or sideways scrolling.',
          'Fix one failing behavior in the existing component/style, repeat that exact test, then check one nearby feature to avoid regression.',
        ],
        common_pitfalls: [
          'Testing only the happy path and skipping empty or boundary values.',
          'Refreshing the browser and assuming a runtime error is fixed without checking Console.',
          'Changing many unrelated files at once instead of isolating one failure.',
          'Calling the layout responsive without testing a narrow viewport.',
        ],
        beginner_encouragement: 'Testing is part of development. A failed check is useful information: it tells you the next small change to make.',
        realistic_example: 'Test sheet: Biology + 25 minutes = accepted; blank subject = clear error; duration 0 = rejected; 375 px screen = no overlap or horizontal scrolling.',
        expected_result: 'The normal study session works, invalid input is explained clearly, the mobile layout remains usable, and the browser has no new unhandled errors.',
        verification_steps: [
          'Record the outcome of the Biology + 25 minutes test.',
          'Confirm blank subject and duration 0 show visible errors.',
          'Check that allowed minimum/maximum durations behave consistently.',
          'Verify the main controls fit and remain usable at mobile width.',
          'Check Console, fix any error, and repeat the failing case.',
        ],
        source: 'domain_synthesizer',
        source_status: 'Built-in offline guide (not AMD-generated)',
      };
    }

    // 4. STUDY / TIMER DOMAIN (e.g. StudySprint Pomodoro Engine)
    if (domain === 'study_productivity' && (intent === 'timer_engine' || task.title.toLowerCase().includes('timer'))) {
      return {
        task_id: task.id,
        task_title: task.title,
        summary: `Build an accurate 25-minute Pomodoro countdown timer with start, pause, reset, and background-tab drift protection.`,
        what_to_do_next: `Create a timer engine using requestAnimationFrame or Date.now() timestamp comparisons to ensure accurate timekeeping even when browser tabs are throttled.`,
        why_it_matters: `Browsers aggressively throttle setInterval() callbacks in background tabs to save battery. If your study timer relies purely on 1-second ticks, a 25-minute study session can take 35 real minutes when the student switches tabs!`,
        action_steps: [
          'Track total remaining seconds in state (e.g. 25 * 60 = 1500 seconds).',
          'When started, record the target completion timestamp (Date.now() + remainingSeconds * 1000).',
          'Calculate remaining seconds inside an interval by comparing target timestamp with Date.now().',
          'Clean up the interval in your useEffect cleanup function to prevent memory leaks.',
          'Format display as MM:SS (e.g. "25:00", "04:09") with leading zero padding.',
          'Trigger an alert or audio chime when seconds reach zero, transitioning the student into a 5-minute break.',
        ],
        common_pitfalls: [
          'Counting ticks (seconds - 1) instead of comparing against wall-clock timestamps: Causes timer drift when tab is in background.',
          'Forgetting to clearInterval() on unmount, resulting in ghost timers ticking in memory.',
        ],
        beginner_encouragement: `Building a real timer is a rite of passage for full-stack developers. Handling timestamp delta arithmetic will make your timer bulletproof!`,
        realistic_example: `// Wall-Clock Accurate Timer Hook Pattern
const [timeLeft, setTimeLeft] = useState(25 * 60);
const [isRunning, setIsRunning] = useState(false);

useEffect(() => {
  if (!isRunning) return;
  const targetTime = Date.now() + timeLeft * 1000;
  
  const timer = setInterval(() => {
    const remaining = Math.max(0, Math.round((targetTime - Date.now()) / 1000));
    setTimeLeft(remaining);
    if (remaining === 0) {
      clearInterval(timer);
      setIsRunning(false);
      alert('Pomodoro complete! Time for a short break.');
    }
  }, 250);

  return () => clearInterval(timer);
}, [isRunning]);`,
        expected_result: `A responsive countdown timer that accurately counts down from 25:00 to 00:00 without skipping or freezing when browsing other tabs.`,
        verification_steps: [
          'Start the timer, switch to another tab for 30 seconds, return, and verify the clock decremented by exactly 30 seconds.',
          'Test pause and reset buttons to verify state resets back to 25:00.',
        ],
        source: 'domain_synthesizer',
        source_status: 'Built-in offline guide (not AI-generated)',
      };
    }

    // 4b. PLANNING TASK: "primary user action" / first user journey (notes, no code)
    if (
      intent === 'scope_setup' &&
      /(primary|main|single|first)\s+(user\s+)?(action|journey|story)|user story/i.test(`${task.title} ${task.description}`)
    ) {
      return this.buildPrimaryActionGuidance(task, projectName, project?.description || '', domain);
    }

    // 5. GENERAL DOMAIN / INTENT COMBINATION (Dynamic Contextual Synthesizer)
    const taskTitle = task.title;
    const taskDesc = task.description;

    return {
      task_id: task.id,
      task_title: taskTitle,
      summary: taskDesc && taskDesc.length > 10
        ? taskDesc
        : `Execute the "${taskTitle}" step specifically designed for ${projectName}.`,
      what_to_do_next: `Focus on implementing ${taskTitle} by completing its core requirements before proceeding to dependent features.`,
      why_it_matters: task.why_it_matters && task.why_it_matters.length > 20
        ? task.why_it_matters
        : `Completing "${taskTitle}" establishes the necessary structural foundation for ${projectName}. Skipping this step often causes cascade bugs later.`,
      action_steps:
        task.step_by_step_tips && task.step_by_step_tips.length > 0
          ? task.step_by_step_tips
          : [
              `Review the required data inputs and expected outputs for "${taskTitle}".`,
              'Write a minimal working prototype first without worrying about complex styling.',
              'Add input validation and boundary condition checks.',
              'Verify the component or function behaves correctly before marking the task complete.',
            ],
      common_pitfalls: [
        `Trying to integrate external libraries before understanding how "${taskTitle}" fits into ${projectName}.`,
        'Skipping validation checks, which introduces hard-to-trace bugs later in testing.',
        'Not testing mobile viewports or smaller screen dimensions.',
      ],
      beginner_encouragement: `Every great software application is built one small milestone at a time. Take your time with "${taskTitle}"—you are making tangible progress on ${projectName}!`,
      expected_result: `A working implementation of "${taskTitle}" that satisfies its specification and functions without unhandled errors.`,
      verification_steps: [
        `Run local development server and test interacting with the "${taskTitle}" feature.`,
        'Check browser console for any warnings or unhandled exceptions.',
      ],
      source: 'domain_synthesizer',
      source_status: 'Built-in offline guide (not AI-generated)',
    };
  }

  private static clip(text: string, limit: number): string {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length <= limit ? flat : `${flat.slice(0, limit - 1).trimEnd()}…`;
  }

  /**
   * Offline guide for "clarify the primary user action" style tasks.
   * These are planning tasks: the result is a short page of notes, not code.
   */
  private static buildPrimaryActionGuidance(
    task: Task,
    projectName: string,
    projectDescription: string,
    domain: DomainType
  ): TaskGuidance {
    const examples: Record<string, { sentence: string; fields: string; screen: string; notNow: string; done: string }> = {
      recipe_food: {
        sentence: 'A person who bought groceries opens the app and adds one ingredient by typing its name and choosing its expiry date.',
        fields: 'Ingredient name (text); Expiry date (date)',
        screen: "a title, one text box labelled 'Ingredient name', one date picker labelled 'Expiry date', an 'Add' button, and a list underneath that shows each ingredient with its date",
        notNow: 'quantities, categories, reminders, recipes, barcode scanning, and user accounts',
        done: "I can add 'Milk' with an expiry date and see 'Milk — expires <that date>' in the list",
      },
      inventory_factory: {
        sentence: 'A warehouse worker opens the app and records one stock item by typing the product name, the quantity, and choosing the unit.',
        fields: 'Product name (text); Quantity (number above zero); Unit (dropdown)',
        screen: "a title, a 'Product name' box, a 'Quantity' box, a 'Unit' dropdown, an 'Add' button, and a table underneath showing the recorded items",
        notNow: 'stock-out, low-stock alerts, reports, and user roles',
        done: "I can add 'Cola 500ml pack, 150, cartons' and see exactly that row in the table",
      },
      study_productivity: {
        sentence: 'A student opens the app and starts one study session with a single button press.',
        fields: 'Session length in minutes (number, default 25)',
        screen: "a large time display, a 'Start' button, and a short message that says whether a session is running",
        notNow: 'break timers, statistics, sounds, and saved history',
        done: 'I press Start and the time display begins counting down from the session length',
      },
      transport_carpool: {
        sentence: 'A commuter opens the app and posts one ride by entering where from, where to, and when.',
        fields: 'From (text); To (text); Date and time',
        screen: "a title, three input boxes (From, To, Date and time), a 'Post ride' button, and a list of posted rides",
        notNow: 'payments, live maps, ratings, and chat',
        done: 'I post one ride and see it in the list with the right places and time',
      },
    };
    const ex = examples[domain] ?? {
      sentence: `A person opens ${projectName} and does one thing, for example: <one verb + one thing from your idea>.`,
      fields: '<the first piece of information the action needs>; <a second one, only if the action is impossible without it>',
      screen: 'a title, one input box for each piece of information, one button for the action, and a place that shows the result',
      notNow: 'everything that is not needed for that one action (extra screens, accounts, settings)',
      done: 'I can do the action once and see the result on the screen',
    };
    const idea = this.clip(projectDescription || projectName, 160);

    return {
      task_id: task.id,
      task_title: task.title,
      summary: `Decide the one thing a person can do first in ${projectName}, what information it needs, and how you will know it works.`,
      what_to_do_next: `This is a thinking-and-writing task, so you do not need to write or change any code yet. Open a plain notes app (or a text file outside your code) and write the heading 'Primary action: ${projectName}'.`,
      why_it_matters: task.why_it_matters && task.why_it_matters.length > 20
        ? task.why_it_matters
        : `One clear first action keeps the first version of ${projectName} small enough to finish, and gives you something concrete to build and test.`,
      action_steps: [
        `Open a plain notes app (or a text file outside your code) and write the heading 'Primary action: ${projectName}'.`,
        `Read your project idea once: "${idea}" Ask yourself: what is the ONE thing a person most wants to get done with this?`,
        `Complete this sentence in your notes: "A [type of person] opens ${projectName} and can [one verb + one thing] so that [benefit]." Pick only one verb. A filled-in example for a project like yours: "${ex.sentence}"`,
        "If your sentence joins two actions with 'and' (for example 'add and share'), keep the first one and move the second under a heading called 'Later'.",
        `List the information the person must give you to do that action. Only include things the action is impossible without. For a first version like yours that could be: ${ex.fields}.`,
        `Describe the first screen in plain words, or sketch it on paper. For example: ${ex.screen}.`,
        `Write a short 'Not in version 1' list so you are not tempted to build it yet. For example: ${ex.notNow}.`,
        `Write one 'Done when' line that you can check by looking at the screen. For example: "${ex.done}."`,
        'Read your notes back. If a friend could build the first screen from them in one sitting without asking you any questions, the task is finished.',
      ],
      common_pitfalls: [
        "Choosing two actions at once (for example 'add and share'). Pick the one that has to work first; the other goes under 'Later'.",
        "Adding fields 'just in case'. Every extra field is extra work to build and test, so keep only what the action cannot work without.",
        'Describing the whole app instead of the first screen. Only describe what a person sees and does in the first version.',
        "Using vague words such as 'manage', 'track', or 'organise' without saying what the person actually types or clicks.",
        'Starting to code or creating new files before the notes are done. When you do start coding, add to your existing project rather than making a new standalone page.',
      ],
      beginner_encouragement: 'Good planning is real progress: a clear page of notes now saves hours of rework later. Keep your first version small.',
      realistic_example: `Example notes for a project like yours (illustrative, not code):\nPrimary action: ${ex.sentence}\nInformation needed: ${ex.fields}\nFirst screen: ${ex.screen}\nNot in version 1: ${ex.notNow}\nDone when: ${ex.done}.`,
      expected_result: "A short set of notes (about 5 to 10 lines) with one action sentence, the list of information to collect, a description of the first screen, a 'Not in version 1' list, and a 'Done when' line. No code changes are needed.",
      verification_steps: [
        'Read your action sentence aloud. It should fit in one breath and contain only one action verb.',
        'Count your information list. Each item should have a reason it is needed; if you cannot explain one, remove it.',
        'Compare your screen description with your list. Every item should have a place on the screen, and the screen should have one button for the action.',
        "Check that your 'Not in version 1' list exists and includes at least two ideas you are postponing.",
        "Read your 'Done when' line. You should be able to check it by clicking through the screen, with no guessing.",
      ],
      source: 'domain_synthesizer',
      source_status: 'Built-in offline guide (not AI-generated)',
    };
  }

  // ---------------------------------------------------------------------------
  // Backend (AMD) guidance: request, de-duplication, validation, and labelling
  // ---------------------------------------------------------------------------

  private static inFlight = new Map<string, Promise<BackendGuidanceResult>>();
  private static amdCache = new Map<string, TaskGuidance>();

  public static getBackendUrl(): string {
    return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) || 'http://localhost:8000';
  }

  /** Forget cached AMD answers (also used by tests). */
  public static clearGuidanceCache(): void {
    this.inFlight.clear();
    this.amdCache.clear();
  }

  /** Build the exact body for POST /api/tasks/guidance, within the backend's size limits. */
  public static buildGuidanceRequest(task: Task, project: ProjectContext | Project) {
    return {
      task: {
        id: task.id,
        milestone_id: task.milestone_id ?? '',
        title: this.clip(task.title, 200),
        description: this.clip(task.description ?? '', 2000),
        why_it_matters: this.clip(task.why_it_matters ?? '', 2000),
        step_by_step_tips: (task.step_by_step_tips ?? []).slice(0, 20),
        estimated_minutes: Math.min(600, Math.max(1, Math.round(task.estimated_minutes || 30))),
        is_completed: !!task.is_completed,
      },
      project: {
        title: this.clip(project.title, 120),
        description: this.clip(project.description ?? '', 3000),
        category: project.category || 'web',
        ...(project.difficulty ? { difficulty: project.difficulty } : {}),
        ...(project.commitment_pace ? { commitment_pace: project.commitment_pace } : {}),
        ...(project.technology_stack?.length ? { technology_stack: project.technology_stack.slice(0, 20) } : {}),
        ...(project.architecture_overview ? { architecture_overview: this.clip(project.architecture_overview, 3000) } : {}),
        ...(project.folder_structure?.length ? { folder_structure: project.folder_structure.slice(0, 30) } : {}),
      },
      ...(project.milestones?.some((m) => m.id === task.milestone_id)
        ? { milestone: (() => {
            const milestone = project.milestones?.find((m) => m.id === task.milestone_id);
            return milestone ? { title: this.clip(milestone.title, 200), description: this.clip(milestone.description ?? '', 2000) } : undefined;
          })() }
        : {}),
    };
  }

  /** Cache key. Deliberately ignores is_completed so ticking a task does not refetch. */
  public static guidanceKey(task: Task, project: ProjectContext | Project): string {
    return JSON.stringify([
      task.id, task.title, task.description, task.estimated_minutes,
      project.title, project.description, project.category, project.difficulty, project.commitment_pace,
      (project.milestones?.find((m) => m.id === task.milestone_id)?.title ?? ''),
    ]);
  }

  private static stringList(value: unknown): string[] | null {
    if (!Array.isArray(value)) return null;
    const items = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    return items.length === value.length ? items : null;
  }

  /** Validate and map a backend response. Returns null when it is not a usable guide. */
  public static parseBackendGuidance(data: unknown, taskId: string): TaskGuidance | null {
    if (!data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;
    const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

    const summary = text(d.summary);
    const whatToDo = text(d.what_to_do_next);
    const why = text(d.why_it_matters);
    const encouragement = text(d.beginner_encouragement);
    const steps = this.stringList(d.action_steps);
    const pitfalls = this.stringList(d.common_pitfalls);
    const verification = this.stringList(d.verification_steps ?? []);
    const source = d.source;

    if (!summary || !whatToDo || !why || !encouragement || !steps || steps.length === 0 || !pitfalls || !verification) return null;
    if (source !== 'amd_ai' && source !== 'domain_synthesizer') return null; // never guess the provenance
    if (d.task_id !== taskId) return null; // a stale answer for another task

    return {
      task_id: taskId,
      task_title: text(d.task_title) ?? '',
      summary,
      what_to_do_next: whatToDo,
      why_it_matters: why,
      action_steps: steps,
      common_pitfalls: pitfalls,
      beginner_encouragement: encouragement,
      realistic_example: typeof d.realistic_example === 'string' && d.realistic_example.trim() ? d.realistic_example : undefined,
      expected_result: text(d.expected_result) ?? undefined,
      verification_steps: verification,
      guide_stage: typeof d.guide_stage === 'string' ? d.guide_stage : undefined,
      tools_and_links: this.stringList(d.tools_and_links) ?? undefined,
      file_instructions: this.stringList(d.file_instructions) ?? undefined,
      code_generation_prompt: typeof d.code_generation_prompt === 'string' && d.code_generation_prompt.trim() ? d.code_generation_prompt : undefined,
      run_instructions: this.stringList(d.run_instructions) ?? undefined,
      troubleshooting_steps: this.stringList(d.troubleshooting_steps) ?? undefined,
      github_deployment_steps: this.stringList(d.github_deployment_steps) ?? undefined,
      source,
      source_status: typeof d.source_status === 'string' ? d.source_status : '',
    };
  }

  /**
   * Ask the backend for guidance. Identical requests that are already running share
   * one network call (React StrictMode runs effects twice in development, and each
   * extra call would otherwise start another slow AMD request on the server).
   */
  public static requestBackendGuidance(
    task: Task,
    project: ProjectContext | Project,
    options: GuidanceRequestOptions = {}
  ): Promise<BackendGuidanceResult> {
    const key = this.guidanceKey(task, project);

    if (!options.force) {
      const cached = this.amdCache.get(key);
      if (cached) return Promise.resolve({ ok: true, guidance: cached });
    }
    const running = this.inFlight.get(key);
    if (running) return running;

    const fetchImpl = options.fetchImpl ?? fetch;
    const timeoutMs = options.timeoutMs ?? GUIDANCE_TIMEOUT_MS;
    const backendUrl = options.backendUrl ?? this.getBackendUrl();

    const run = async (): Promise<BackendGuidanceResult> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${backendUrl}/api/tasks/guidance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.buildGuidanceRequest(task, project)),
          signal: controller.signal,
        });
        if (!response.ok) {
          return {
            ok: false,
            reason: response.status === 422
              ? 'The backend rejected the task details (HTTP 422).'
              : `The backend returned an error (HTTP ${response.status}).`,
          };
        }
        let data: unknown;
        try {
          data = await response.json();
        } catch {
          return { ok: false, reason: 'The backend reply was not valid JSON.' };
        }
        const guidance = this.parseBackendGuidance(data, task.id);
        if (!guidance) {
          return { ok: false, reason: 'The backend reply was missing required guidance fields.' };
        }
        if (guidance.source === 'amd_ai') this.amdCache.set(key, guidance);
        return { ok: true, guidance };
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return { ok: false, reason: `The backend did not answer within ${Math.round(timeoutMs / 1000)} seconds.` };
        }
        return { ok: false, reason: `Could not reach the HerFirst backend at ${backendUrl}. Check that it is running.` };
      } finally {
        clearTimeout(timer);
        this.inFlight.delete(key);
      }
    };

    const promise = run();
    this.inFlight.set(key, promise);
    return promise;
  }

  /** Describe where a guide came from, using only the actual response fields. */
  public static describeSource(guidance: TaskGuidance): GuidanceSourceInfo {
    if (guidance.source === 'amd_ai') {
      return { kind: 'amd', label: 'Generated by AMD AI', detail: guidance.source_status ?? '' };
    }
    return { kind: 'offline', label: 'Offline guide (not AMD-generated)', detail: guidance.source_status ?? '' };
  }

  /** Mark a locally built guide as offline, with the reason the backend guide is missing. */
  public static asOfflineGuidance(guidance: TaskGuidance, reason: string): TaskGuidance {
    return {
      ...guidance,
      source: 'domain_synthesizer',
      source_status: `Built-in offline guide, not AI-generated. ${reason}`.trim(),
    };
  }

  /** Add universal code-generation, file-placement, run, and delivery guidance even when the API is offline. */
  public static enrichWithWorkflow(
    guidance: TaskGuidance,
    task: Task,
    project?: Project,
    milestoneTitle = '',
    milestoneDescription = '',
  ): TaskGuidance {
    const taskContext = `${task.title} ${task.description}`.toLowerCase();
    const milestoneContext = `${milestoneTitle} ${milestoneDescription}`.toLowerCase();
    // The task itself wins. Milestone descriptions can mention both planning and setup,
    // e.g. 'Define your core journey and configure the environment'; they must not turn
    // a concrete setup task into a planning-only guide with no commands.
    const taskPlanning = /(clarify|define|plan|requirements|research|user story|scope|wireframe|brainstorm)/.test(taskContext);
    const taskSetup = /(workspace|environment|libraries|dependencies|install|scaffold|setup|set up|initialize|initialise)/.test(taskContext);
    const taskTesting = /(test|testing|verify|verification|debug|edge case|quality assurance|responsive|mobile)/.test(taskContext);
    const taskGithub = /(github|git repository|version control|commit|push to|remote repository)/.test(taskContext);
    const taskDeployment = /(deploy|deployment|publish|hosting|production|custom domain|live url)/.test(taskContext);
    const planning = taskPlanning && !taskSetup && !taskTesting && !taskGithub && !taskDeployment;
    const setup = taskSetup || (!planning && /(workspace|environment|libraries|dependencies|install|scaffold|setup|set up|initialize|initialise)/.test(milestoneContext) && !taskTesting && !taskGithub && !taskDeployment);
    const testing = taskTesting || (!planning && !setup && /(test|testing|verify|verification|debug|edge case|quality assurance|responsive|mobile)/.test(milestoneContext));
    const github = taskGithub || (!planning && !setup && !testing && /(github|git repository|version control|commit|push to|remote repository)/.test(milestoneContext));
    const deployment = taskDeployment || (!planning && !setup && !testing && !github && /(deploy|deployment|publish|hosting|production|custom domain|live url)/.test(milestoneContext));
    const guide_stage = deployment ? 'deployment' : github ? 'github' : testing ? 'testing' : setup ? 'setup' : planning ? 'planning' : 'implementation';
    const title = project?.title || 'your project';
    const description = project?.description || '';
    const category = project?.category || 'web';
    const tips = task.step_by_step_tips?.length ? task.step_by_step_tips.join('; ') : 'No additional tips supplied.';
    const milestone = milestoneTitle || '(not supplied)';
    const baseTools = [
      'Visual Studio Code (free editor): https://code.visualstudio.com/',
      'AI coding assistant: ChatGPT https://chatgpt.com/ or Claude https://claude.ai/; free/paid limits change, so check official plan pages.',
      'Chrome DevTools: open the app in Chrome, press F12, and inspect Console/Network.',
    ];
    if (category === 'ai') baseTools.push('Python docs: https://docs.python.org/3/tutorial/', 'FastAPI docs (if a Python API is used): https://fastapi.tiangolo.com/tutorial/');
    else if (category === 'mobile') baseTools.push('React Native docs: https://reactnative.dev/docs/getting-started', 'Flutter docs: https://docs.flutter.dev/');
    else baseTools.push('MDN Web Docs: https://developer.mozilla.org/');
    if (github) baseTools.push('GitHub: https://github.com/', 'GitHub docs: https://docs.github.com/', 'Git downloads: https://git-scm.com/downloads');
    if (deployment) baseTools.push('Vercel: https://vercel.com/', 'Netlify: https://www.netlify.com/', 'Render: https://render.com/', 'Streamlit Community Cloud (Streamlit projects only): https://share.streamlit.io/');

    const file_instructions = planning ? [
      'For this planning task, write a concrete decision or checklist first; do not write app code unless the task explicitly requests implementation.',
      'Review the existing project README/docs before deciding where notes belong. Do not invent new file paths.',
      'Define the expected input, user action, and visible completion result in plain language.',
    ] : setup ? [
      'First check whether a project manifest (for example package.json) and README already exist. If they do, reuse that app folder; if not, create the starter project for the stack shown in the project overview.',
      'For a confirmed React + TypeScript + Vite stack, check `node --version` and `npm --version`, then scaffold only if no existing app exists with `npm create vite@latest <ProjectFolder> -- --template react-ts` from the parent folder. Replace <ProjectFolder> with a simple name.',
      'Enter the folder containing package.json; run `npm install` only if dependencies are missing, then use `npm run dev` and open the exact Local URL printed in the terminal.',
      'Change one visible label in the actual starter screen, save it, confirm hot reload, and undo the test edit. Do not invent source paths before confirming the selected stack.',
    ] : github ? [
      'Open the actual repository root, review .gitignore, and ensure .env files, keys, virtual environments, node_modules, and caches are excluded.',
      'Run `git status --short` and inspect the file list before staging anything. Never commit private credentials.',
    ] : deployment ? [
      'Confirm the actual project stack and manifest before selecting a host or build/start command.',
      'Keep secrets in backend/hosting environment settings; never put private keys in frontend code or VITE_ variables.',
    ] : [
      'Open the full project root in VS Code. Press Ctrl+Shift+F and search for the task title, visible screen text, or related keywords.',
      'Ask the AI to inspect the actual repository/file tree before naming paths. Do not assume files it has not seen.',
      'Apply the result file by file. Make clear whether each file is CREATE, MODIFY, or REPLACE; back up existing files before a full replacement.',
      'If AI cannot see your local computer, upload the relevant files or paste them. Code in a chat is not automatically saved to your computer.',
    ];

    const run_instructions = planning ? [
      'No terminal command is needed unless the task explicitly includes implementation.',
      'Check each written requirement against the task description and agree the acceptance rule before moving to coding.',
    ] : setup ? [
      'If the app already exists, run commands from the folder containing its manifest. If no app exists and React + TypeScript + Vite is the confirmed stack, scaffold from its parent directory with `npm create vite@latest <ProjectFolder> -- --template react-ts`.',
      'Inside the folder containing package.json, run `npm install` only if dependencies are missing, then `npm run dev`. For any other stack, use the official starter instructions and actual commands instead of Vite commands.',
      'Open the exact Local URL printed by the terminal, keep that server terminal open, and verify one saved text change appears in the browser.',
    ] : testing ? [
      'Inspect README and the existing package/test manifest to find the correct test, build, and lint commands.',
      'Run one focused test first, then the suite/build. Record real command output; do not assume code passed because it was generated.',
    ] : github ? [
      'From the verified repository root, inspect `git status --short` and .gitignore before staging files.',
      'After confirming no secrets are tracked, commit reviewed changes and push to the chosen GitHub repository; verify the files in the browser.',
    ] : deployment ? [
      'Select hosting based on the verified stack, backend/database needs, traffic, and budget; confirm official pricing and limits.',
      'Use the real project build/start commands and add private environment variables in the hosting dashboard.',
      'After deploy, test the live URL, core user journey, API requests, and logs. Keep a rollback option.',
    ] : [
      'Read README and the existing manifest to determine the actual command and working directory; do not guess a command.',
      'Run the existing start script. Keep each required service in its own terminal and open the local URL printed by the process.',
      'Test the task normally, then test a missing/invalid input where relevant. Keep the terminal open while using the app.',
    ];

    const troubleshooting_steps = [
      'Copy the full first relevant error and 10–20 surrounding lines; include the terminal folder and command, but never share API keys/passwords.',
      'For browser errors, press F12 and check Console; in Network, inspect the failing request URL, HTTP status, and safe response text.',
      'For missing files/imports, check spelling and relative paths and search the project before creating duplicates.',
      'For dependency/build errors, compare commands with README/manifests and verify runtime versions. Install only the missing dependency first.',
      'For API errors, 401/403 usually concerns credentials/permissions, 404 the endpoint/path, 429 rate limits/concurrency, and timeout an unavailable/slow service.',
      'Do not delete databases, lockfiles, node_modules, .venv, or reset Git as a first fix. Make one targeted change and retest.',
    ];
    const github_deployment_steps = github ? [
      'GitHub: https://github.com/ and https://docs.github.com/. Use GitHub Desktop at https://desktop.github.com/ if you prefer a visual workflow.',
      'Check .gitignore, ensure no .env/secrets are included, inspect `git status --short`, then commit/push reviewed files.',
      'Open the repository in the browser and verify README, source folders, dependency manifests, tests, and startup instructions.',
    ] : deployment ? [
      'Choose a provider only after confirming stack: Vercel/Netlify for suitable frontend apps, Render for supported backends, Streamlit Community Cloud for Streamlit, or Hugging Face Spaces for supported ML demos.',
      'Verify current official pricing, free-tier limits, resource quotas, database costs, and AI API charges. Do not assume all usage is free.',
      'Configure server secrets privately, deploy from the correct branch, check logs, test the live URL, and document rollback steps.',
    ] : [
      'After local features and tests work, prepare GitHub at https://github.com/ and https://docs.github.com/. Review .gitignore and never publish .env or credentials.',
      'For the later deployment milestone, choose a provider that fits the verified stack and budget; validate official pricing, build/start commands, environment settings, and live tests.',
    ];

    const code_generation_prompt = `You are a senior developer and patient instructor helping a ${project?.difficulty || 'beginner'}-level learner.\n\nPROJECT: ${title}\nDESCRIPTION: ${description}\nCATEGORY: ${category}\nTECHNOLOGY STACK: ${(project?.technology_stack ?? []).join('; ') || '(not supplied)'}\nMILESTONE: ${milestone}\nMILESTONE DESCRIPTION: ${milestoneDescription || '(not supplied)'}\nTASK: ${task.title}\nTASK DETAILS: ${task.description}\nWHY IT MATTERS: ${task.why_it_matters || '(not supplied)'}\nTIME: ${task.estimated_minutes || 30} minutes\nTIPS: ${tips}\n\nHelp me complete only this task. First inspect the actual files, README, dependency manifests and scripts I provide; do not pretend you can access files on my computer if I have not uploaded them. If files are missing, ask for the minimum relevant file tree/files rather than inventing paths. Before writing code, tell me exact relative paths and whether each file is CREATE, MODIFY, or REPLACE. Match the existing stack and preserve working features. For planning tasks, create a clear checklist and do not add code unnecessarily. For coding tasks, provide integrated code/patch, where to save it, commands and the folder to run them from, expected output, tests, likely errors and targeted fixes. Keep secrets private. For GitHub/deployment tasks, check .gitignore, explain GitHub/repository steps, verify current official hosting instructions/pricing, configure secrets privately, then test the live app. Do not claim tests/deployment succeeded unless verified.`;

    // Workflow metadata can also be cached in an older task.guidance object. For
    // offline guides, always refresh it from the current task classification; only
    // retain server-supplied workflow metadata when it came from a real AMD answer.
    const refreshOfflineWorkflow = guidance.source !== 'amd_ai';
    return {
      ...guidance,
      guide_stage: refreshOfflineWorkflow ? guide_stage : (guidance.guide_stage || guide_stage),
      tools_and_links: !refreshOfflineWorkflow && guidance.tools_and_links?.length ? guidance.tools_and_links : baseTools,
      file_instructions: !refreshOfflineWorkflow && guidance.file_instructions?.length ? guidance.file_instructions : file_instructions,
      code_generation_prompt: !refreshOfflineWorkflow && guidance.code_generation_prompt ? guidance.code_generation_prompt : code_generation_prompt,
      run_instructions: !refreshOfflineWorkflow && guidance.run_instructions?.length ? guidance.run_instructions : run_instructions,
      troubleshooting_steps: !refreshOfflineWorkflow && guidance.troubleshooting_steps?.length ? guidance.troubleshooting_steps : troubleshooting_steps,
      github_deployment_steps: !refreshOfflineWorkflow && guidance.github_deployment_steps?.length ? guidance.github_deployment_steps : github_deployment_steps,
    };
  }

}
