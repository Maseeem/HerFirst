import json
import logging
import os
import re
from uuid import uuid4
from typing import Any

import httpx

logger = logging.getLogger(__name__)

API_KEY = os.getenv("AMD_API_KEY", "").strip()
BASE_URL = os.getenv("AMD_BASE_URL", "").strip().rstrip("/")
MODEL_NAME = os.getenv("AMD_MODEL_NAME", "").strip()
AMD_CONFIGURED = bool(API_KEY and BASE_URL and MODEL_NAME)

# If AMD returns its model-concurrency 429, try the next compatible chat model
# instead of immediately giving the user offline-only guidance. Users can
# customize this comma-separated list in backend/.env if their account exposes
# a different set of model IDs.
_DEFAULT_FALLBACK_MODELS = (
    "DeepSeek-V4-Flash",
    "GLM-5.3-Flash",
    "MiMo-V2.6-Flash",
    "Qwen3.8-Flash-Next",
)


def _model_candidates() -> list[str]:
    configured_fallbacks = os.getenv("AMD_FALLBACK_MODELS", "").strip()
    fallback_text = configured_fallbacks or ",".join(_DEFAULT_FALLBACK_MODELS)
    candidates = [MODEL_NAME]
    candidates.extend(item.strip() for item in fallback_text.split(",") if item.strip())
    # Preserve order, and do not retry the same model twice.
    return list(dict.fromkeys(item for item in candidates if item))


def _domain(title: str, description: str) -> str:
    text = f"{title} {description}".lower()
    if any(word in text for word in (
        "inventory", "warehouse", "factory", "stock", "pepsi",
        "beverage", "bottling", "supply"
    )):
        return "inventory"
    if any(word in text for word in (
        "study", "timer", "exam", "student", "focus", "pomodoro"
    )):
        return "study"
    if any(word in text for word in (
        "eco", "sustainability", "carbon", "habit", "pledge", "green"
    )):
        return "sustainability"
    if any(word in text for word in (
        "recipe", "meal", "cooking", "ingredient", "food"
    )):
        return "food"
    return "general"


def _parse_json_content(content: Any) -> Any:
    """Parse a model reply as JSON, tolerating markdown fences or extra prose."""
    if not isinstance(content, str):
        raise TypeError("model content was not text")
    text = content.strip()
    try:
        return json.loads(text)
    except ValueError:
        pass
    fenced = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE)
    try:
        return json.loads(fenced)
    except ValueError:
        pass
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        return json.loads(text[start:end + 1])
    raise ValueError("no JSON object found in model reply")


def _amd_json(
    system_prompt: str,
    user_payload: dict[str, Any]
) -> tuple[dict[str, Any] | None, str | None, str | None]:
    """Return (JSON response, successful model, safe diagnostic message).

    Busy models are common on shared inference services. When AMD returns
    HTTP 429, try the configured model alternatives before using offline
    guidance. Credentials are never included in logs or diagnostics.
    """
    if not AMD_CONFIGURED:
        return None, None, "AMD API is not configured (one or more settings are missing)."

    url = f"{BASE_URL}/chat/completions"
    candidates = _model_candidates()
    last_error = "AMD request did not complete."

    for index, candidate_model in enumerate(candidates):
        try:
            response = httpx.post(
                url,
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": candidate_model,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                system_prompt
                                + " Return only a valid JSON object, "
                                "with no markdown fences."
                            ),
                        },
                        {
                            "role": "user",
                            "content": json.dumps(
                                user_payload, ensure_ascii=False
                            ),
                        },
                    ],
                    "temperature": 0.3,
                    "response_format": {"type": "json_object"},
                },
                # Guidance prompts have multiple fields; 18 seconds was too
                # short for some valid responses. Keep connect time bounded.
                timeout=httpx.Timeout(45.0, connect=8.0),
            )

            if response.status_code == 429:
                try:
                    error_body = response.json()
                except ValueError:
                    error_body = {}
                detail = error_body.get("detail", {})
                error = detail.get("error", {}) if isinstance(detail, dict) else {}
                if not isinstance(error, dict):
                    error = {}
                message = str(error.get("message") or "model is busy or rate limited")
                code = str(error.get("code") or "rate_limit")
                last_error = (
                    f"AMD model '{candidate_model}' returned HTTP 429 "
                    f"({code}): {message[:240]}"
                )
                if index < len(candidates) - 1:
                    logger.warning(
                        "AMD model %s returned HTTP 429; trying the next fallback model. (%s)",
                        candidate_model,
                        code,
                    )
                    continue
                logger.warning("AMD guidance unavailable after model retries: %s", last_error)
                return None, None, last_error

            if response.is_error:
                try:
                    error_body = response.json()
                except ValueError:
                    error_body = {}
                detail = error_body.get("detail", {})
                error = detail.get("error", {}) if isinstance(detail, dict) else {}
                if isinstance(error, dict):
                    message = str(error.get("message") or error.get("code") or "request rejected")
                else:
                    message = str(error_body.get("detail") or "request rejected")
                last_error = f"AMD returned HTTP {response.status_code}: {message[:240]}"
                logger.warning("AMD model request failed: %s", last_error)
                return None, None, last_error

            try:
                body = response.json()
                content = body["choices"][0]["message"]["content"]
                parsed = _parse_json_content(content)
            except (ValueError, KeyError, IndexError, TypeError) as exc:
                last_error = f"AMD model '{candidate_model}' returned an invalid JSON response ({type(exc).__name__})."
                logger.warning("%s", last_error)
                return None, None, last_error

            if not isinstance(parsed, dict) or not parsed:
                last_error = f"AMD model '{candidate_model}' did not return a non-empty JSON object."
                logger.warning("%s", last_error)
                return None, None, last_error
            return parsed, candidate_model, None

        except httpx.TimeoutException:
            last_error = f"AMD model '{candidate_model}' timed out after 45 seconds."
            logger.warning("%s", last_error)
            # A timeout is not necessarily a concurrency limit. Do not fire
            # several long-running requests in a row; return a clear fallback.
            return None, None, last_error
        except httpx.HTTPError as exc:
            last_error = f"AMD network request failed ({type(exc).__name__})."
            logger.warning("%s", last_error)
            return None, None, last_error

    return None, None, last_error


def _task(
    task_id: str,
    milestone_id: str,
    title: str,
    description: str,
    why: str,
    tips: list[str],
    minutes: int,
) -> dict[str, Any]:
    return {
        "id": task_id,
        "milestone_id": milestone_id,
        "title": title,
        "description": description,
        "why_it_matters": why,
        "step_by_step_tips": tips,
        "estimated_minutes": minutes,
        "is_completed": False,
    }


def _project_setup_metadata(req: dict[str, Any]) -> dict[str, Any]:
    """Offer a suitable starting stack without pretending it is the only option."""
    category = str(req.get("category") or "web").lower()
    title = str(req.get("idea_title") or "your project")
    desc = str(req.get("idea_description") or "").lower()
    if category == "mobile":
        stack = [
            "Mobile UI: choose ONE beginner-friendly route—React Native + Expo (JavaScript/TypeScript) or Flutter (Dart)—after confirming your device/platform needs.",
            "Backend/API: add FastAPI or another backend only if the app needs shared accounts, remote data, or server-side secrets.",
            "Version control: Git + GitHub; for distribution, investigate the selected framework's official build/release process.",
        ]
        architecture = "A mobile client owns the screens and local interaction; an optional backend serves shared data and keeps private credentials server-side. Choose Expo or Flutter before creating files—do not mix both stacks."
        structure = ["app/ or src/: mobile screens/components in the chosen framework", "services/: API clients only if a backend exists", "backend/: optional server/API; create only when needed", "tests/: automated tests that match the chosen toolchain", "README.md, .gitignore, and .env.example: setup and safe configuration"]
        deploy = ["Build and test on a real or emulated device first.", "For Expo, review Expo Application Services (EAS): https://docs.expo.dev/eas/; for Flutter, follow https://docs.flutter.dev/deployment.", "App-store accounts, signing, and publishing may carry requirements or fees; verify official platform rules before committing to a release."]
        tools = ["VS Code (free): https://code.visualstudio.com/", "React Native / Expo docs: https://reactnative.dev/docs/getting-started and https://docs.expo.dev/", "Flutter docs (alternative): https://docs.flutter.dev/", "GitHub: https://github.com/", "Check platform and app-store costs before publishing; do not assume every release step is free."]
    elif category == "ai":
        simple_streamlit = any(word in desc for word in ("dashboard", "demo", "prototype", "data app", "machine learning demo"))
        if simple_streamlit:
            stack = [
                "Prototype UI: Python + Streamlit for a simple AI/data demo.",
                "Model/API: call external providers from server-side Python; keep credentials in environment variables or the host's secret manager.",
                "Add a separate frontend/backend only if the user experience or traffic requires it.",
            ]
            architecture = "For an initial AI/data demo, one Streamlit app can present controls and results. Keep provider secrets on the server and add a database or separate API only when requirements justify it."
            structure = ["app.py: Streamlit entry point after confirming the plan", "requirements.txt: Python dependencies", "tests/: focused tests for data handling and response validation", ".env.example, .gitignore, README.md: safe setup and run instructions"]
            deploy = ["Run locally with the verified command shown by the project's instructions, commonly `streamlit run app.py` if app.py is the confirmed entry point.", "Consider https://share.streamlit.io/ for supported Streamlit demos or https://huggingface.co/spaces for supported ML demos; verify current runtime and secrets limits.", "If the model is expensive or requires a private backend, check quotas, timeouts, privacy and usage costs before publishing."]
            tools = ["Python docs: https://docs.python.org/3/tutorial/", "Streamlit docs: https://docs.streamlit.io/", "VS Code (free): https://code.visualstudio.com/", "Streamlit Community Cloud: https://share.streamlit.io/", "Hugging Face Spaces: https://huggingface.co/spaces; verify limits and provider pricing."]
        else:
            stack = [
                "Model/data prototype: Python; choose Streamlit for a simple demo or FastAPI if a separate API is required.",
                "Frontend: only add a separate React/TypeScript UI if the project needs a richer multi-screen interface.",
                "Secrets, logging and response validation must stay in the trusted backend/runtime.",
            ]
            architecture = "Start with the smallest AI interface that proves the main workflow. Separate UI and API only when the requirements need it; never expose model API keys to a browser client."
            structure = ["app.py or backend/app/: choose an entry point that matches the selected runtime", "frontend/: optional separate UI only if selected", "tests/: tests for model responses, validation and error handling", ".env.example, .gitignore, README.md"]
            deploy = ["Choose Streamlit Community Cloud for supported Streamlit demos, Hugging Face Spaces for supported demos, or a backend host such as Render for a suitable API.", "Verify official quotas, privacy, cold starts, timeouts, and current costs before live use.", "Configure API keys only in server-side secrets/environment settings and test an unavailable-model fallback."]
            tools = ["Python docs: https://docs.python.org/3/tutorial/", "FastAPI docs if needed: https://fastapi.tiangolo.com/tutorial/", "Streamlit docs: https://docs.streamlit.io/", "GitHub: https://github.com/", "AI API usage can cost money; review the provider's official pricing/quotas."]
    elif category == "hardware":
        stack = [
            "Hardware-specific code: use Arduino IDE/C++ for an Arduino board or Python for supported Raspberry Pi projects; confirm the actual board/sensors first.",
            "Optional dashboard/API only if the user's requirements need it; do not add a web backend by default.",
            "Version control: Git + GitHub; document safe wiring, power limits, and recovery steps.",
        ]
        architecture = "Device firmware/script reads the selected sensor or input, applies the task logic, and produces an observable output. Add a dashboard or backend only if the device needs remote control or reporting."
        structure = ["src/ or the board-specific sketch folder: firmware/script", "tests/ or simulation notes: validate logic before connecting hardware", "README.md: board, wiring, power and run/flash steps", ".gitignore and .env.example if secrets/configuration are needed"]
        deploy = ["Validate with a simulator or safe test setup first; verify voltage/current and wiring against official hardware documents.", "Deployment may mean flashing firmware or installing a script on the target device rather than hosting a web URL.", "Keep a known-good firmware/build and document recovery or rollback steps."]
        tools = ["Arduino docs: https://docs.arduino.cc/", "Raspberry Pi docs: https://www.raspberrypi.com/documentation/", "VS Code (free): https://code.visualstudio.com/", "GitHub: https://github.com/", "Check any board/toolchain requirements before buying additional hardware."]
    else:
        stack = [
            "For a browser-based application: React + TypeScript + Vite is a reasonable UI starting point.",
            "Add a backend (for example FastAPI) only when the project needs APIs, server-side secrets, authentication, or shared data.",
            "Use local/sample data for a first prototype; add a database only after the data model and persistence requirement are clear.",
            "Use Git + GitHub from the start, with .env and other secrets excluded.",
        ]
        architecture = f"Build {title} around one core user action. Keep the UI and business logic simple for the first prototype; add a backend, database, authentication, or paid services only when a real requirement justifies them."
        structure = ["frontend/src/: UI components, pages and service clients if a frontend is selected", "backend/app/: API and business logic only if a backend is selected", "backend/tests/ or tests/: focused automated checks", "README.md: setup, run, test and deploy instructions", ".env.example and .gitignore: safe configuration; never commit real secrets"]
        deploy = ["For a static frontend, evaluate Vercel or Netlify; for a supported API backend, evaluate Render or Railway. A split app may need separate deployments and a configured API URL/CORS.", "Verify official pricing, free-tier limits, inactivity/sleep rules, database costs and usage-based charges before choosing.", "Configure server-side secrets privately and test the actual live user journey after deployment."]
        tools = ["VS Code (free): https://code.visualstudio.com/", "ChatGPT: https://chatgpt.com/; Claude: https://claude.ai/ (plans/limits vary)", "React docs if React is selected: https://react.dev/", "GitHub: https://github.com/ and https://docs.github.com/", "Check current official hosting prices at https://vercel.com/pricing, https://www.netlify.com/pricing/, and https://render.com/pricing before launch."]
    return {
        "technology_stack": stack,
        "architecture_overview": architecture,
        "required_tools": tools,
        "folder_structure": structure,
        "deployment_plan": deploy,
    }


def _delivery_phase_specs(category: str) -> list[tuple[str, str, list[tuple[str, str, list[str], int]]]]:
    """Keep version control, release/deployment and live acceptance in every fallback blueprint."""
    git_phase = (
        "Version Control and GitHub",
        "Prepare a reviewed, secret-safe repository so the project can be shared and recovered.",
        [
            ("Prepare a safe GitHub repository", "Review source files and prevent credentials or generated dependencies from being published.", ["Open the true project root and inspect README and .gitignore", "Keep .env, API keys, passwords, .venv, node_modules, caches and build outputs out of Git", "Run git status and review every file before staging"], 25),
            ("Commit and upload the project to GitHub", "Create a repository and push a known-good version without overwriting unrelated work.", ["Choose public or private visibility based on project needs", "Install Git or GitHub Desktop if needed", "Commit only reviewed files and push the intended branch", "Open the repository in a browser and verify source, README and manifests"], 30),
        ],
    )
    if category == "mobile":
        release_phase = (
            "Build and Distribute the Mobile App",
            "Prepare a device build and test release flow suited to the selected mobile framework.",
            [
                ("Choose a safe mobile build and test route", "Identify whether the project uses Expo/React Native or Flutter before following platform-specific instructions.", ["Confirm the actual framework from package manifests or project files", "Review the official Expo EAS or Flutter deployment documentation", "Check build requirements, signing and any store-account fees before publishing"], 25),
                ("Build and test on a target device", "Ensure the app works outside the development server before store submission.", ["Follow the framework's current official build command", "Install a test build on an emulator or real device", "Test core navigation, offline/permission behavior and crash logs"], 45),
            ],
        )
    elif category == "hardware":
        release_phase = (
            "Install and Verify on Target Hardware",
            "Package or flash the program safely for the actual board/device rather than assuming web hosting.",
            [
                ("Confirm target hardware and installation method", "Match instructions to the exact board, operating system and connected components.", ["Record board/model and required runtime or firmware", "Check official hardware documentation and safe power/wiring limits", "Prepare a recovery/known-good version before flashing"], 25),
                ("Install and test the device build", "Verify the project on actual or simulated target hardware.", ["Follow the official IDE/runtime upload or install steps", "Test one normal input and one safe failure case", "Record logs, wiring/configuration and recovery steps"], 45),
            ],
        )
    else:
        release_phase = (
            "Hosting and Deployment",
            "Choose a provider compatible with the selected stack, then deploy the tested application safely.",
            [
                ("Choose a suitable host and confirm costs", "Select hosting only after checking the frontend, backend, database, storage and expected traffic.", ["Identify which parts are static frontend, backend API, database or AI service", "Compare compatible providers and verify official free-tier limits, paid plans and usage charges", "Record the required build command, start command, environment variables and health check"], 25),
                ("Deploy the app and configure environment variables", "Make a live version without exposing private credentials.", ["Connect the correct GitHub repository and branch to the chosen host", "Set build/start commands from the real project manifests", "Add secrets in the host's private environment settings, not in frontend code or Git", "Deploy, read logs and open the generated live URL"], 45),
            ],
        )
    maintenance_phase = (
        "Live Verification and Maintenance",
        "Verify the real user journey and leave instructions for future fixes and updates.",
        [
            ("Run live acceptance checks", "Confirm the deployed build behaves like the tested local version.", ["Test the main user journey using fresh sample data", "Test missing/invalid input and the most important error state", "Check API/database connectivity and hosting logs", "Record any limitation rather than marking the task complete prematurely"], 30),
            ("Document updates, monitoring and recovery", "Make it possible to maintain or roll back the project after submission.", ["Update README with install, run, test and deployment instructions", "Explain how to update the live app from a reviewed GitHub commit", "Document log locations, backup needs and rollback/recovery steps", "Review usage quotas, secrets and recurring costs"], 25),
        ],
    )
    return [git_phase, release_phase, maintenance_phase]


def _ensure_delivery_milestones(project_data: dict[str, Any], req: dict[str, Any]) -> dict[str, Any]:
    """Add missing delivery phases to model-generated blueprints without duplicating existing ones."""
    milestones = list(project_data.get("milestones") or [])
    all_text = " ".join(
        str(m.get("title", "")) + " " + str(m.get("description", "")) + " " + " ".join(
            str(t.get("title", "")) + " " + str(t.get("description", ""))
            for t in (m.get("tasks") or [])
        )
        for m in milestones
    ).lower()
    category = str(req.get("category") or "web").lower()
    missing_specs = []
    if not any(word in all_text for word in ("github", "version control", "git repository", "repository preparation")):
        missing_specs.append(_delivery_phase_specs(category)[0])
    release_keywords = ("app store", "mobile build", "target hardware", "flash firmware", "hosting", "deployment", "deploy", "production", "publish", "live url")
    if not any(word in all_text for word in release_keywords):
        missing_specs.append(_delivery_phase_specs(category)[1])
    if not any(word in all_text for word in ("maintenance", "rollback", "monitoring", "live acceptance", "live verification")):
        missing_specs.append(_delivery_phase_specs(category)[2])
    project_id = str(project_data.get("id") or "project")
    start_order = len(milestones) + 1
    for offset, (phase_title, phase_desc, tasks) in enumerate(missing_specs):
        order = start_order + offset
        milestone_id = f"{project_id}-delivery-{order}"
        milestone = {
            "id": milestone_id,
            "project_id": project_id,
            "order": order,
            "title": f"Milestone {order}: {phase_title}",
            "description": phase_desc,
            "tasks": [
                {
                    "id": f"{milestone_id}-task-{task_index}",
                    "milestone_id": milestone_id,
                    "title": task_title,
                    "description": task_desc,
                    "why_it_matters": f"This delivery step makes {project_data.get('title', 'the project')} safer to share, launch, and maintain.",
                    "step_by_step_tips": tips,
                    "estimated_minutes": minutes,
                    "is_completed": False,
                }
                for task_index, (task_title, task_desc, tips, minutes) in enumerate(tasks, start=1)
            ],
        }
        milestones.append(milestone)
        all_text += " " + phase_title.lower() + " " + phase_desc.lower()
    project_data["milestones"] = milestones
    return project_data



def generate_blueprint(req: dict[str, Any]) -> dict[str, Any]:
    title = req["idea_title"].strip()
    description = req["idea_description"].strip()
    project_id = f"proj-{uuid4().hex[:12]}"
    domain = _domain(title, description)
    setup_metadata = _project_setup_metadata(req)

    if domain == "inventory":
        phase_specs = [
            (
                "Define inventory requirements",
                "List the products, units, and stock movements the system must support.",
                [
                    (
                        "List products and measurement units",
                        "Identify raw materials and finished goods, and define their units.",
                        [
                            "List product names and SKUs",
                            "Choose supported units such as bottles, cartons, packs, kilograms, and liters",
                            "Write down which roles can add or remove stock",
                        ],
                        25,
                    ),
                    (
                        "Plan the stock workflow",
                        "Describe how staff record stock arriving, leaving, and running low.",
                        [
                            "Define stock-in and stock-out",
                            "Choose a low-stock threshold",
                            "Write one example of a daily inventory report",
                        ],
                        25,
                    ),
                ],
            ),
            (
                "Build the core inventory experience",
                "Create the product entry form and show inventory records clearly.",
                [
                    (
                        "Build a validated stock-entry form",
                        "Capture product, quantity, unit, and movement type.",
                        [
                            "Add a product-name input",
                            "Add a positive-number quantity input",
                            "Add a unit dropdown for bottles, cartons, packs, kilograms, and liters",
                            "Show clear errors for missing names or invalid quantities",
                        ],
                        45,
                    ),
                    (
                        "Display inventory and stock status",
                        "Show saved items in a readable inventory table.",
                        [
                            "Display product, quantity, unit, and status",
                            "Show a helpful empty state",
                            "Highlight low-stock items",
                        ],
                        40,
                    ),
                ],
            ),
            (
                "Test and prepare the demo",
                "Check edge cases and prepare a reliable demonstration.",
                [
                    (
                        "Test inventory edge cases",
                        "Verify that invalid data cannot corrupt stock totals.",
                        [
                            "Try an empty product name",
                            "Try zero and negative quantities",
                            "Check that units remain visible after selection",
                        ],
                        30,
                    ),
                    (
                        "Prepare a demo scenario",
                        "Show the main user journey from adding stock to seeing a report.",
                        [
                            "Add a sample product",
                            "Record a stock-in and stock-out",
                            "Show the updated balance and low-stock state",
                        ],
                        20,
                    ),
                ],
            ),
        ]
    elif domain == "study":
        phase_specs = [
            (
                "Define the study flow",
                "Choose the main study session and completion flow.",
                [
                    (
                        "Define a study session",
                        "Choose session length, break length, and completion behavior.",
                        [
                            "Write the default session duration",
                            "Define start, pause, and reset behavior",
                            "Decide what happens when a session ends",
                        ],
                        25,
                    ),
                    (
                        "Plan the main screen",
                        "Sketch the timer, controls, and progress display.",
                        [
                            "List required controls",
                            "Choose the session status labels",
                            "Keep the first version focused",
                        ],
                        20,
                    ),
                ],
            ),
            (
                "Build the core experience",
                "Implement the timer and visible session state.",
                [
                    (
                        "Build timer controls",
                        "Let users start, pause, and reset a session.",
                        [
                            "Create the timer display",
                            "Wire up start, pause, and reset",
                            "Prevent duplicate running timers",
                        ],
                        45,
                    ),
                    (
                        "Show session progress",
                        "Display completed sessions and the current state.",
                        [
                            "Track completed sessions",
                            "Show a clear completion message",
                            "Handle refresh or reset gracefully",
                        ],
                        35,
                    ),
                ],
            ),
            (
                "Test and demo",
                "Check timer behavior and prepare a short demonstration.",
                [
                    (
                        "Test timer edge cases",
                        "Verify pause, reset, and completion behavior.",
                        [
                            "Test pause and resume",
                            "Test reset",
                            "Test session completion",
                        ],
                        25,
                    ),
                    (
                        "Prepare a demo scenario",
                        "Show one complete study session.",
                        [
                            "Start a short test session",
                            "Demonstrate the completion state",
                            "Explain how a beginner uses the app",
                        ],
                        20,
                    ),
                ],
            ),
        ]
    else:
        phase_specs = [
            (
                "Clarify the idea and setup",
                "Define the smallest useful version of the project and prepare the workspace.",
                [
                    (
                        "Define the first user journey",
                        "Write the main action the user should complete.",
                        [
                            "Describe the target user",
                            "Write one simple user story",
                            "List the minimum information needed",
                        ],
                        25,
                    ),
                    (
                        "Set up the development workspace",
                        "Confirm the project runs locally before adding features.",
                        [
                            "Open the project folder",
                            "Install dependencies if needed",
                            "Start the local preview and confirm it loads",
                        ],
                        30,
                    ),
                ],
            ),
            (
                "Build the core feature",
                "Implement the main input and show a useful result.",
                [
                    (
                        "Build the primary input",
                        "Create a clear form or control for the main user action.",
                        [
                            "Add labeled inputs",
                            "Validate required values",
                            "Show helpful error messages",
                        ],
                        40,
                    ),
                    (
                        "Display the result",
                        "Show the result of the user's action in a clear way.",
                        [
                            "Choose an appropriate output view",
                            "Handle empty states",
                            "Test with sample data",
                        ],
                        35,
                    ),
                ],
            ),
            (
                "Test and prepare the demo",
                "Verify the main user journey and polish the presentation.",
                [
                    (
                        "Test important edge cases",
                        "Check empty, invalid, and typical inputs.",
                        [
                            "Test valid input",
                            "Test missing or invalid input",
                            "Confirm errors are understandable",
                        ],
                        25,
                    ),
                    (
                        "Prepare a demo scenario",
                        "Demonstrate the core feature from start to finish.",
                        [
                            "Use a fresh sample input",
                            "Show the expected output",
                            "Explain what is working and what is future work",
                        ],
                        20,
                    ),
                ],
            ),
        ]

    milestones = []
    for phase_index, (phase_title, phase_desc, tasks) in enumerate(
        phase_specs, start=1
    ):
        milestone_id = f"{project_id}-m-{phase_index}"
        milestone_tasks = []
        for task_index, (
            task_title, task_desc, tips, minutes
        ) in enumerate(tasks, start=1):
            milestone_tasks.append(
                _task(
                    f"t-{phase_index}-{task_index}",
                    milestone_id,
                    task_title,
                    task_desc,
                    f"This step helps turn {title} into a testable, working project.",
                    tips,
                    minutes,
                )
            )
        milestones.append({
            "id": milestone_id,
            "project_id": project_id,
            "order": phase_index,
            "title": f"Milestone {phase_index}: {phase_title}",
            "description": phase_desc,
            "tasks": milestone_tasks,
        })

    from datetime import datetime, timezone

    fallback = {
        "id": project_id,
        "title": title,
        "description": description,
        "category": req["category"],
        "difficulty": req["difficulty"],
        "commitment_pace": req["commitment_pace"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "progress_percentage": 0,
        "milestones": milestones,
        "source": "domain_synthesizer",
        "source_status": (
            "AMD API not configured or unavailable; generated with "
            "the offline project-aware blueprint engine."
        ),
    }
    fallback.update(setup_metadata)
    fallback = _ensure_delivery_milestones(fallback, req)

    generated, generated_model, amd_error = _amd_json(
        "You create practical beginner-friendly project blueprints. "
        "Return JSON with id,title,description,category,difficulty,"
        "commitment_pace,created_at,progress_percentage,milestones,technology_stack,"
        "architecture_overview,required_tools,folder_structure,deployment_plan. "
        "Include appropriate GitHub/version-control, release/deployment, live-verification "
        "and maintenance milestones if they are missing. Do not invent exact pricing. "
        "Each milestone has id,project_id,order,title,description,tasks. "
        "Each task has id,milestone_id,title,description,why_it_matters,"
        "step_by_step_tips,estimated_minutes,is_completed.",
        req,
    )
    if generated:
        generated.setdefault("id", project_id)
        generated.setdefault("created_at", fallback["created_at"])
        for metadata_key, metadata_value in setup_metadata.items():
            if not generated.get(metadata_key):
                generated[metadata_key] = metadata_value
        generated = _ensure_delivery_milestones(generated, req)
        generated.update({
            "source": "amd_ai",
            "source_status": f"Generated by AMD model {generated_model}.",
        })
        try:
            from .schemas import BlueprintResponse
            validated = BlueprintResponse.model_validate(generated)
            return validated.model_dump()
        except Exception as exc:
            amd_error = f"AMD returned data that did not match the blueprint schema ({type(exc).__name__})."

    if AMD_CONFIGURED and amd_error:
        fallback["source_status"] = (
            "AMD response unavailable; offline project-aware blueprint used. "
            + amd_error[:300]
        )
    return fallback


# ---------------------------------------------------------------------------
# Task-guidance helpers
# ---------------------------------------------------------------------------

_PLANNING_TITLE = re.compile(
    r"^\s*(define|clarify|plan|decide|choose|list|identify|research|sketch|"
    r"outline|brainstorm|write down|map out)\b",
    re.IGNORECASE,
)
_TESTING_TITLE = re.compile(r"\b(test|verify|debug|edge case|polish)\b", re.IGNORECASE)
_SETUP_TITLE = re.compile(r"\b(set up|setup|install|initiali[sz]e|scaffold|workspace)\b", re.IGNORECASE)
_PRIMARY_ACTION_TITLE = re.compile(
    r"(primary|main|single|first)\s+(user\s+)?(action|journey|story)|user story",
    re.IGNORECASE,
)
_STACK_WORDS = (
    "react", "vite", "typescript", "javascript", "vue", "angular", "svelte",
    "next.js", "node", "express", "python", "flask", "django", "fastapi",
    "html", "css", "tailwind", "supabase", "firebase", "sqlite", "flutter",
    "react native", "swift", "kotlin", "arduino", "raspberry pi",
)


def _guidance_domain(title: str, description: str) -> str:
    """Domain detection for guidance only (blueprint generation keeps _domain)."""
    text = f"{title} {description}".lower()
    strong_inventory = ("factory", "warehouse", "pepsi", "bottling", "beverage")
    strong_food = ("pantry", "recipe", "ingredient", "expir", "grocery", "meal", "cooking")
    if any(w in text for w in strong_inventory):
        return "inventory"
    if any(w in text for w in strong_food):
        return "food"
    if any(w in text for w in ("carpool", "ride share", "rideshare", "commute")):
        return "transport"
    return _domain(title, description)


def _task_kind(task_title: str) -> str:
    """Classify a task from its title: planning, testing, setup, or build."""
    if _PLANNING_TITLE.search(task_title):
        return "planning"
    if _TESTING_TITLE.search(task_title):
        return "testing"
    if _SETUP_TITLE.search(task_title):
        return "setup"
    return "build"


def _stack_hint(title: str, description: str, technology_stack: list[str] | None = None) -> str:
    selected = [str(item).strip() for item in (technology_stack or []) if str(item).strip()]
    if selected:
        return "Use the blueprint's suggested technology stack as the starting point: " + "; ".join(selected[:12]) + ". Do not silently switch frameworks."
    text = f"{title} {description}".lower()
    found = [w for w in _STACK_WORDS if re.search(rf"(?<![a-z]){re.escape(w)}(?![a-z])", text)]
    if found:
        return "The project text mentions: " + ", ".join(found) + "."
    return "Not stated. Do not assume a framework, language, or file layout."


def _clip(text: str, limit: int) -> str:
    text = " ".join(str(text).split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


_STEP_NUMBER_PREFIX = re.compile(r"^\s*(?:step\s*)?\d{1,2}\s*[.):\-]\s+", re.IGNORECASE)


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        return " ".join(_as_text(v) for v in value.values()).strip()
    if isinstance(value, (list, tuple)):
        return "\n".join(_as_text(v) for v in value).strip()
    return str(value).strip()


def _as_text_list(value: Any, strip_numbers: bool = False) -> list[str]:
    if isinstance(value, str):
        value = [line for line in value.splitlines() if line.strip()]
    if not isinstance(value, (list, tuple)):
        return []
    items = []
    for item in value:
        text = _as_text(item)
        if strip_numbers:
            text = _STEP_NUMBER_PREFIX.sub("", text)
        if text:
            items.append(text)
    return items


def _coerce_guidance(generated: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None]:
    """Normalize model output into the GuidanceResponse shape.

    Returns (fields, error). A guide that is missing core parts, or has too few
    steps to be useful to a beginner, is rejected so the honest offline guide is
    shown instead of a thin AMD answer.
    """
    out: dict[str, Any] = {
        "summary": _as_text(generated.get("summary")),
        "what_to_do_next": _as_text(generated.get("what_to_do_next")),
        "why_it_matters": _as_text(generated.get("why_it_matters")),
        "action_steps": _as_text_list(generated.get("action_steps"), strip_numbers=True),
        "common_pitfalls": _as_text_list(generated.get("common_pitfalls")),
        "beginner_encouragement": _as_text(generated.get("beginner_encouragement")),
        "realistic_example": _as_text(generated.get("realistic_example")) or None,
        "expected_result": _as_text(generated.get("expected_result")),
        "verification_steps": _as_text_list(generated.get("verification_steps")),
    }
    missing = [
        key for key in (
            "summary", "what_to_do_next", "why_it_matters",
            "beginner_encouragement", "expected_result",
            "common_pitfalls", "verification_steps",
        ) if not out[key]
    ]
    if missing:
        return None, "AMD guidance was missing: " + ", ".join(missing) + "."
    if len(out["action_steps"]) < 3:
        return None, "AMD guidance had fewer than 3 action steps."
    return out, None


_PRIMARY_ACTION_EXAMPLES: dict[str, dict[str, Any]] = {
    "food": {
        "sentence": "A person who bought groceries opens the app and adds one ingredient by typing its name and choosing its expiry date.",
        "fields": ["Ingredient name (text)", "Expiry date (date)"],
        "screen": "a title, one text box labelled 'Ingredient name', one date picker labelled 'Expiry date', an 'Add' button, and a list underneath that shows each ingredient with its date",
        "not_now": "quantities, categories, reminders, recipes, barcode scanning, and user accounts",
        "done": "I can add 'Milk' with an expiry date and see 'Milk — expires <that date>' in the list",
    },
    "inventory": {
        "sentence": "A warehouse worker opens the app and records one stock item by typing the product name, the quantity, and choosing the unit.",
        "fields": ["Product name (text)", "Quantity (number above zero)", "Unit (dropdown)"],
        "screen": "a title, a 'Product name' box, a 'Quantity' box, a 'Unit' dropdown, an 'Add' button, and a table underneath showing the recorded items",
        "not_now": "stock-out, low-stock alerts, reports, and user roles",
        "done": "I can add 'Cola 500ml pack, 150, cartons' and see exactly that row in the table",
    },
    "study": {
        "sentence": "A student opens the app and starts one study session with a single button press.",
        "fields": ["Session length in minutes (number, default 25)"],
        "screen": "a large time display, a 'Start' button, and a short message that says whether a session is running",
        "not_now": "break timers, statistics, sounds, and saved history",
        "done": "I press Start and the time display begins counting down from the session length",
    },
    "sustainability": {
        "sentence": "A person opens the app and marks one eco-friendly habit as done for today.",
        "fields": ["Habit name (chosen from a short list)", "Done or not done (checkbox)"],
        "screen": "a title, a short list of habits each with a checkbox, and a line that says how many are done today",
        "not_now": "streaks, carbon calculations, reminders, and sharing",
        "done": "I tick one habit and the 'done today' count goes up by one",
    },
    "transport": {
        "sentence": "A commuter opens the app and offers or requests one ride by entering where from, where to, and when.",
        "fields": ["From (text)", "To (text)", "Date and time"],
        "screen": "a title, three input boxes (From, To, Date and time), a 'Post ride' button, and a list of posted rides",
        "not_now": "payments, live maps, ratings, and chat",
        "done": "I post one ride and see it in the list with the right places and time",
    },
}


def _planning_guidance(
    project_title: str,
    project_description: str,
    task: dict[str, Any],
    domain: str,
) -> dict[str, Any]:
    """Offline guide for planning/definition tasks (notes, no code)."""
    task_title = task["title"]
    desc = _clip(project_description, 160)
    tips = [_clip(t, 220) for t in task.get("step_by_step_tips", []) if str(t).strip()]
    minutes = task.get("estimated_minutes", 30)

    if _PRIMARY_ACTION_TITLE.search(f"{task_title} {task.get('description', '')}"):
        ex = _PRIMARY_ACTION_EXAMPLES.get(domain)
        if ex is None:
            ex = {
                "sentence": f"A person opens {project_title} and does one thing, for example: <one verb + one thing from your idea>.",
                "fields": ["<the first piece of information the action needs>", "<a second one, only if the action is impossible without it>"],
                "screen": "a title, one input box for each field, one button for the action, and a place that shows the result",
                "not_now": "everything that is not needed for that one action (extra screens, accounts, settings)",
                "done": "I can do the action once and see the result on the screen",
            }
        field_text = "; ".join(ex["fields"])
        steps = [
            f"This is a thinking-and-writing task, so you do not need to write or change any code yet. Open a plain notes app (or a text file outside your code) and write the heading 'Primary action: {project_title}'.",
            f"Read your project idea once: \"{desc}\" Ask yourself: what is the ONE thing a person most wants to get done with this?",
            f"Complete this sentence in your notes: \"A [type of person] opens {project_title} and can [one verb + one thing] so that [benefit].\" Pick only one verb. A filled-in example for a project like yours: \"{ex['sentence']}\"",
            "If your sentence joins two actions with 'and' (for example 'add and share'), keep the first one and move the second under a heading called 'Later'.",
            f"List the information the person must give you to do that action. Only include things the action is impossible without. For a first version like yours that could be: {field_text}.",
            f"Describe the first screen in plain words, or sketch it on paper. For example: {ex['screen']}.",
            f"Write a short 'Not in version 1' list so you are not tempted to build it yet. For example: {ex['not_now']}.",
            f"Write one 'Done when' line that you can check by looking at the screen. For example: \"{ex['done']}.\"",
            "Read your notes back. If a friend could build the first screen from them in one sitting without asking you any questions, the task is finished.",
        ]
        return {
            "summary": f"Decide the one thing a person can do first in {project_title}, what information it needs, and how you will know it works.",
            "first_action": steps[0],
            "steps": steps,
            "pitfalls": [
                "Choosing two actions at once (for example 'add and share'). Pick the one that has to work first; the other goes under 'Later'.",
                "Adding fields 'just in case'. Every extra field is extra work to build and test, so keep only what the action cannot work without.",
                "Describing the whole app instead of the first screen. Only describe what a person sees and does in the first version.",
                "Using vague words such as 'manage', 'track', or 'organise' without saying what the person actually types or clicks.",
                "Starting to code or creating new files before the notes are done. When you do start coding, add to your existing project rather than making a new standalone page.",
            ],
            "example": (
                f"Example notes for a project like yours (illustrative, not code):\n"
                f"Primary action: {ex['sentence']}\n"
                f"Information needed: {field_text}\n"
                f"First screen: {ex['screen']}\n"
                f"Not in version 1: {ex['not_now']}\n"
                f"Done when: {ex['done']}."
            ),
            "expected": "A short set of notes (about 5 to 10 lines) with one action sentence, the list of information to collect, a description of the first screen, a 'Not in version 1' list, and a 'Done when' line. No code changes are needed.",
            "verification": [
                "Read your action sentence aloud. It should fit in one breath and contain only one action verb.",
                "Count your information list. Each item should have a reason it is needed; if you cannot explain one, remove it.",
                "Compare your screen description with your list. Every item should have a place on the screen, and the screen should have one button for the action.",
                "Check that your 'Not in version 1' list exists and includes at least two ideas you are postponing.",
                "Read your 'Done when' line. You should be able to check it by clicking through the screen, with no guessing.",
            ],
        }

    # Other planning tasks: turn the task's own tips into a checklist.
    steps = [
        f"This is a planning task, so write your decisions down first and do not change code unless the task asks for it. Open a notes app (or a text file outside your code) and write the task name: '{task_title}'.",
        f"Under it, write one line starting with 'Done when:' that says how you will know this task is finished, using the task description: {_clip(task.get('description', '') or task_title, 200)}",
    ]
    for tip in tips:
        steps.append(f"Work on this point and write your decision in your notes: {tip}")
    if not tips:
        steps.append(f"Make a short list (3 to 5 lines) of the concrete decisions this task needs for {project_title}. Write one sentence of answer for each.")
    steps.append("Cross out anything on your list that the first working version does not need, and move it under a heading called 'Later'.")
    steps.append(f"Read your notes against the 'Done when' line. This task is sized for about {minutes} minutes, so if it is taking much longer, shrink the list.")
    return {
        "summary": f"Make and write down the decisions needed for '{task_title}' in {project_title}.",
        "first_action": steps[0],
        "steps": steps,
        "pitfalls": [
            "Trying to build while you are still deciding. Finish the written decisions first.",
            "Leaving decisions vague, such as 'handle units later'. Write the actual answer, even if it is only a first guess.",
            "Making the list too long for the time available. Keep only what version 1 needs.",
            "Inventing file names or tools you have not checked. If you need to look at your project, search it first (Ctrl+Shift+F in Visual Studio Code).",
        ],
        "example": (
            f"Example notes (illustrative):\nTask: {task_title}\n"
            f"Done when: <one sentence you can check>\n"
            f"Decision 1: <your answer in one sentence>\nDecision 2: <your answer in one sentence>\n"
            f"Later: <ideas you are postponing>"
        ),
        "expected": f"Short written notes for '{task_title}': a 'Done when' line, one written answer for each decision, and a 'Later' list.",
        "verification": [
            "Check that every decision on your list has a written answer, not just a question.",
            "Check that your 'Done when' line can be answered with yes or no.",
            "Check that nothing in your notes is needed only for a later version.",
            "If you looked at your project, confirm any file or screen you mention actually exists.",
        ],
    }


def _workflow_guidance(req: dict[str, Any]) -> dict[str, Any]:
    """Create the practical implementation/deployment companion for every task guide."""
    task = req.get("task", {})
    project = req.get("project", {})
    milestone = req.get("milestone") or {}
    title = str(project.get("title") or "Your project")
    description = str(project.get("description") or "")
    category = str(project.get("category") or "web").lower()
    difficulty = str(project.get("difficulty") or "beginner").lower()
    pace = str(project.get("commitment_pace") or "steady").lower()
    task_title = str(task.get("title") or "Complete this task")
    task_description = str(task.get("description") or "")
    milestone_title = str(milestone.get("title") or "")
    milestone_description = str(milestone.get("description") or "")
    context = " ".join((milestone_title, milestone_description, task_title, task_description)).lower()

    # Detect the kind of work so deployment and repository instructions do not
    # overwhelm an ordinary feature task, while still appearing when relevant.
    if any(w in context for w in ("deploy", "deployment", "publish", "hosting", "production", "custom domain", "live url")):
        stage = "deployment"
    elif any(w in context for w in ("github", "git repository", "version control", "commit", "push to", "remote repository")):
        stage = "github"
    elif any(w in context for w in ("test", "testing", "verify", "verification", "debug", "edge case", "qa", "quality assurance")):
        stage = "testing"
    elif any(w in context for w in ("workspace", "environment", "libraries", "dependencies", "install", "scaffold", "setup", "set up", "initialize")):
        stage = "setup"
    elif any(w in context for w in ("clarify", "define", "plan", "requirements", "research", "user story", "architecture", "scope", "wireframe", "brainstorm")):
        stage = "planning"
    else:
        stage = "implementation"

    tools = [
        "Visual Studio Code (free editor): https://code.visualstudio.com/",
        "AI coding assistant: ChatGPT https://chatgpt.com/ or Claude https://claude.ai/. Free/paid limits can change; check each provider's official plan page.",
        "Chrome DevTools (included with Chrome): open the app, press F12, then check Console and Network.",
    ]
    if category in {"web", "creative", "community"}:
        tools.append("MDN Web Docs (HTML, CSS, JavaScript): https://developer.mozilla.org/")
    elif category == "mobile":
        tools.append("React Native documentation (if selected for this project): https://reactnative.dev/docs/getting-started")
        tools.append("Flutter documentation (alternative mobile stack): https://docs.flutter.dev/")
    elif category == "ai":
        tools.append("Python official tutorial (if Python is selected): https://docs.python.org/3/tutorial/")
        tools.append("FastAPI official tutorial (for a Python API): https://fastapi.tiangolo.com/tutorial/")
    elif category == "hardware":
        tools.append("Arduino documentation (if the project uses Arduino): https://docs.arduino.cc/")
        tools.append("Raspberry Pi documentation (if the project uses Raspberry Pi): https://www.raspberrypi.com/documentation/")

    if stage == "github":
        tools.extend([
            "GitHub (repository hosting): https://github.com/",
            "GitHub documentation: https://docs.github.com/",
            "Git downloads: https://git-scm.com/downloads",
        ])
    if stage == "deployment":
        tools.extend([
            "Vercel (suitable for many frontend/Next.js apps): https://vercel.com/",
            "Netlify (suitable for static/frontend apps): https://www.netlify.com/",
            "Render (suitable for supported backend services): https://render.com/",
            "Streamlit Community Cloud (Streamlit apps only): https://share.streamlit.io/",
            "Hugging Face Spaces (supported ML demos): https://huggingface.co/spaces",
        ])

    if stage == "planning":
        file_instructions = [
            "This is a planning task: do not edit application code unless the task explicitly requests implementation.",
            "First check the existing README/docs area. Record the user story, minimum data, first-screen sketch, and acceptance rule in the existing project documentation if such a place exists.",
            "Do not invent a new file path. If the repository has no documentation convention, keep the decision in your project notes until the next task identifies where it belongs.",
        ]
        run_instructions = [
            "No install or start command is needed for a planning-only task. Finish the written deliverable and review it against the task acceptance criteria.",
            "If you inspect code, open the existing repository root in VS Code and use Ctrl+Shift+F to search for the visible label or task keywords.",
        ]
    elif stage == "setup":
        file_instructions = [
            "Open the actual project root in VS Code using File > Open Folder. Do not create a second project inside the existing project.",
            "Inspect README.md and the existing manifests (for example package.json, requirements.txt, pyproject.toml, or the actual files in this repository) before selecting commands.",
            "If editing is needed, first check whether the requested config/file already exists. Name exact relative paths only after confirming the folder structure; keep a backup before replacing existing config.",
        ]
        run_instructions = [
            "Run commands from the directory that contains the relevant manifest, not from an arbitrary parent folder.",
            "Follow the project's existing README or startup scripts. Install dependencies only if they are missing; do not reinstall everything as the first troubleshooting step.",
            "Keep each required service in its own terminal. Open the local URL printed by the running development server and keep that terminal open.",
        ]
    elif stage == "testing":
        file_instructions = [
            "Inspect the existing tests directory and the scripts defined in the repository's manifests before adding tests.",
            "Prefer adding a focused test beside the existing test suite. Do not rename or replace application files just to make a test pass.",
            "If you modify code, identify each changed relative path and explain whether the whole file or only a section changes.",
        ]
        run_instructions = [
            "Read the README and package/pyproject scripts to find the project's actual test, lint, and build commands.",
            "Run the smallest relevant test first, then the full available test suite and production build if configured.",
            "Record the exact command and its real result. Do not mark the task complete because code merely compiles or was generated.",
        ]
    elif stage == "github":
        file_instructions = [
            "The repository root is the folder containing the actual source folders and project manifests. Open that folder, not only frontend or backend.",
            "Review .gitignore and confirm real .env files, keys, virtual environments, node_modules, caches, and build output are excluded as appropriate.",
            "Before any upload, review `git status --short` and the file list. Never stage or publish a secret. Do not force-push or reset the repository to fix ordinary errors.",
        ]
        run_instructions = [
            "From the verified project root, run `git status --short` first. Review the result before staging changes.",
            "After checking .gitignore and confirming no secrets are included, use GitHub Desktop or the repository's documented Git workflow to commit and push.",
            "Open the GitHub repository in the browser and verify the source folders, README, dependency manifests, tests, and startup instructions are present.",
        ]
    elif stage == "deployment":
        file_instructions = [
            "Inspect the real project manifests and existing backend/frontend split before choosing hosting. Do not deploy a development server as if it were production.",
            "Do not commit .env or place private keys in frontend variables prefixed with VITE_. Configure server secrets in the hosting provider's secret/environment settings.",
            "Keep build and start commands consistent with the actual package scripts or Python application entry point.",
        ]
        run_instructions = [
            "Choose a host only after confirming the project's framework, runtime, backend, database, storage, and budget. Verify current limits/pricing on the provider's official website.",
            "Connect the correct GitHub repository/branch, configure the verified build and start commands, and add server-side environment variables privately.",
            "After deployment, open the real live URL, test each core user journey, inspect build/runtime logs, and verify API/database connections.",
        ]
    else:
        file_instructions = [
            "Open the full existing project root in VS Code. Press Ctrl+Shift+F and search for the task's key words or the text visible on the screen.",
            "Ask the coding assistant to inspect the provided repository/file tree before it names a target path. It must identify each existing/new relative path and explain exactly where each change goes.",
            "Apply one file at a time. For an existing file, follow explicit instructions to replace the whole file or modify only a named section. Back up important files and do not overwrite unrelated working code.",
            "If the AI cannot see your local folder, upload the relevant files or paste their contents; generating code in chat does not automatically save it to your computer.",
        ]
        run_instructions = [
            "Before running commands, inspect README.md and the real scripts/manifests to determine the correct start command and working directory.",
            "Apply the generated code to the exact files identified, save changes, then run the existing app using its documented startup script/commands. Do not paste source code into the terminal unless it is explicitly a terminal command.",
            "In the browser, perform the task's normal user action and compare the visible result with the acceptance criteria. Test a missing/invalid value when relevant.",
        ]

    troubleshooting = [
        "When something fails, do not guess: copy the complete first relevant error plus 10–20 surrounding lines, note the terminal's current folder, and note the command you ran. Never include API keys or passwords.",
        "For a browser problem, press F12 and inspect Console first; use Network to check the failing request's URL, status code, and response body (redact secrets).",
        "For a missing-file/import error, check spelling and relative paths, then search the repository before creating another file.",
        "For package/build errors, compare the command with the existing manifest and runtime version; install only the missing/incompatible dependency rather than deleting the project folders.",
        "For API errors: 401/403 usually points to credentials/permissions; 404 to the URL/route; 429 to quota/concurrency; timeout to slow/unavailable service. Check safe logs and fallback status before changing credentials.",
        "Do not delete node_modules, virtual environments, databases, lockfiles, or reset Git as the first fix. Make one targeted change and retest.",
    ]

    if stage == "github":
        delivery = [
            "Use GitHub Desktop (https://desktop.github.com/) if you prefer a visual workflow, or follow https://docs.github.com/ for Git commands.",
            "Before publishing: review .gitignore, confirm backend/.env and all real credentials are excluded, review `git status --short`, then commit and push only reviewed files.",
            "After pushing, inspect the repository in the browser and verify that README, source, dependency manifests, and required startup files are present.",
        ]
    elif stage == "deployment":
        delivery = [
            "Select hosting based on the actual stack: Vercel/Netlify for suitable frontend apps, Render/Railway for supported backends, Streamlit Community Cloud for Streamlit, or Hugging Face Spaces for supported ML demos.",
            "Free tiers and limits change. Verify official pricing, sleep behavior, resource limits, database costs, and AI API charges before selecting a plan; never assume a provider is free permanently.",
            "Configure private backend secrets in the host dashboard, deploy from the correct branch, review logs, then test the live URL and every critical feature.",
        ]
    else:
        delivery = [
            "Do not deploy this task prematurely. After the app and tests work locally, prepare a GitHub repository using https://github.com/ and https://docs.github.com/.",
            "Before pushing, review .gitignore and confirm no .env, API keys, passwords, virtual environments, or node_modules are included.",
            "For the later deployment milestone, select a host compatible with the verified stack and budget; check official pricing and configure secrets privately.",
        ]

    prompt = f"""You are a senior software developer and patient instructor helping a {difficulty} beginner build an existing project.

PROJECT: {title}
PROJECT DESCRIPTION: {description}
CATEGORY: {category}
LEARNING PACE: {pace}
MILESTONE: {milestone_title or '(not supplied)'}
MILESTONE DESCRIPTION: {milestone_description or '(not supplied)'}
TASK: {task_title}
TASK DESCRIPTION: {task_description}
WHY IT MATTERS: {str(task.get('why_it_matters') or '(not supplied)')}
ESTIMATED TIME: {task.get('estimated_minutes', 30)} minutes
EXISTING TASK TIPS: {json.dumps(task.get('step_by_step_tips') or [], ensure_ascii=False)}

Help me complete ONLY this task. First inspect the actual files, folder structure, README, dependency manifests, and scripts I provide. Do not pretend you can see my computer if I have not uploaded the files. If files are unavailable, ask me for the minimum relevant files/file tree rather than guessing paths or commands.

Teach me step by step. Tell me which free or paid tools are needed and link to official websites. Before generating code, identify exact relative file paths and label each as CREATE, MODIFY, or REPLACE; explain where I should paste/save the result. Preserve working features and existing conventions. For a planning task, create a concrete artifact/checklist and do not generate application code unless it is required. For a coding task, provide complete integrated code or a precise patch, required dependencies, exact commands and the directory in which to run them, expected output, manual/automated tests, likely errors and targeted fixes. Never put secrets in frontend code or ask me to reveal them. Do not invent successful test results, repository URLs, deployment status, or pricing. If this task concerns GitHub/deployment, review secret safety, verify current official provider instructions/pricing, explain the correct build/start command, environment variables, logs, live tests, and rollback. Keep the work limited to the task and tell me how to verify it before marking it complete."""

    return {
        "guide_stage": stage,
        "tools_and_links": tools,
        "file_instructions": file_instructions,
        "code_generation_prompt": prompt,
        "run_instructions": run_instructions,
        "troubleshooting_steps": troubleshooting,
        "github_deployment_steps": delivery,
    }



GUIDANCE_SYSTEM_PROMPT = (
    "You are a patient, encouraging mentor writing a how-to guide for a complete beginner "
    "who is building their own software project and may never have used a code editor. "
    "You receive JSON with `task`, `project` (title, description, category, difficulty, "
    "commitment_pace, optional `technology_stack`, `architecture_overview`, and `folder_structure`), optional `milestone` (title and description), and `guide_hints`. "
    "Use the milestone and learner context so instructions fit this exact point in the project. "
    "Write ONE guide for exactly this task in this project.\n"
    "RULES:\n"
    "1. Language: simple, warm English and short sentences. Explain any technical word in "
    "plain words the first time you use it. No filler praise and no repeated instructions.\n"
    "2. Be specific to this project. Use the project's real name and what it does. Every "
    "step must name something concrete to write, decide, type, click or check. Never give a "
    "step such as 'define the primary user action' without showing HOW: give the question to "
    "ask, a sentence template to fill in, and a worked answer for THIS project.\n"
    "3. what_to_do_next is the single first action, doable in under 5 minutes. action_steps "
    "has 4 to 8 steps in the order to do them. Do NOT put numbers or 'Step 1' inside the step "
    "strings because the app numbers them.\n"
    "4. Respect time_budget_minutes: the whole guide should fit in about that time. Do not add "
    "scope: no extra features, libraries, accounts or deployment.\n"
    "5. You cannot see the learner's files. Never invent file names, folder paths, commands, "
    "APIs or project structure. If the task needs code, tell the learner to search their "
    "existing project (Visual Studio Code: Ctrl+Shift+F) for the related screen or component "
    "and add to it, rather than creating a duplicate, a new project, or a standalone index.html. "
    "Use technologies only if stack_hint or the project text names them; otherwise stay "
    "technology-neutral or say 'in the technology your project already uses'.\n"
    "6. If task_kind is planning, the output is written notes, not code. Say clearly that no "
    "code is needed yet. realistic_example should be a filled-in notes template for this project.\n"
    "7. Example: realistic_example is a concrete, project-specific example (at most 15 lines). "
    "Say whether it is illustrative or ready to paste, and which technology it is for.\n"
    "8. expected_result describes what the finished result looks like and includes a clear "
    "'done when' condition the learner can check by looking at it.\n"
    "9. verification_steps has 3 to 5 specific checks, including one normal case and one "
    "mistake or edge case, each saying what the learner should see.\n"
    "10. common_pitfalls has 3 to 5 mistakes specific to this task, each with how to avoid it.\n"
    "11. why_it_matters is 1 to 3 sentences tied to this project. summary is one sentence on "
    "what the learner will have when finished. beginner_encouragement is 1 or 2 honest, "
    "task-specific sentences. If is_completed is true, write the guide as a review checklist.\n"
    "12. Do not claim anything was tested or run.\n"
    "Return a JSON object with exactly these keys: task_id, task_title, summary, "
    "what_to_do_next, why_it_matters, action_steps (array of strings), common_pitfalls "
    "(array of strings), beginner_encouragement, realistic_example (string), expected_result "
    "(string), verification_steps (array of strings)."
)


def generate_guidance(req: dict[str, Any]) -> dict[str, Any]:
    """Create concrete, task-aware instructions without inventing project paths."""
    task = req["task"]
    project = req["project"]
    workflow = _workflow_guidance(req)

    title = project["title"]
    description = project.get("description", "")
    task_title = task["title"]
    task_description = task.get("description", "")
    domain = _guidance_domain(title, description)
    kind = _task_kind(task_title)
    task_text = f"{task_title} {task_description}".lower()
    first_action: str | None = None

    tools = [
        "Visual Studio Code (free code editor): https://code.visualstudio.com/",
        "Chrome DevTools: open the app in Chrome, press F12, then choose Console to inspect errors.",
    ]
    summary = f"Complete '{task_title}' for {title} one small step at a time."
    steps: list[str]
    pitfalls: list[str]
    example: str
    expected: str
    verification: list[str]

    sustainability_habit = domain == "sustainability" and any(
        word in task_text for word in ("habit", "pledge", "sustainab", "eco", "carbon", "green")
    )

    # Domain-specific instructions should explain both the goal and a safe way
    # to find the relevant files in the user's existing project.
    if kind == "planning" and not sustainability_habit:
        # Planning tasks produce written decisions, not code, so no editor tools.
        plan = _planning_guidance(title, description, task, domain)
        tools = []
        summary = plan["summary"]
        first_action = plan["first_action"]
        steps = plan["steps"]
        pitfalls = plan["pitfalls"]
        example = plan["example"]
        expected = plan["expected"]
        verification = plan["verification"]

    elif sustainability_habit:
        tools.extend([
            "React Learn (if the project uses React): https://react.dev/learn",
            "MDN JavaScript guide (arrays and objects): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
        ])
        summary = (
            f"Define three simple daily sustainability habits for {title}, then connect "
            "them to the existing habit-card interface only if this task includes implementation."
        )
        steps = [
            "In plain words: choose exactly 3 everyday actions a person can mark Done or Not done in a few seconds.",
            "First decide the habits before coding. Good examples are: bring a reusable bottle, carry a reusable bag, and walk/bike/use public transport for a suitable trip.",
            "Write one clear completion rule for each habit. For example, 'Reusable bottle: I used my reusable bottle today.' Avoid vague goals such as 'be greener'.",
            "Choose an impact description only when you have a trustworthy source. Do not invent exact carbon or waste savings; a simple description such as 'helps avoid a single-use bottle' is safer.",
            "If this task is only asking you to define the habits, save the three names, completion rules, and descriptions in your project notes first; you do not need to change code yet.",
            "If the task also asks you to implement them, open the whole existing project folder in Visual Studio Code. Press Ctrl+Shift+F and search for words such as 'habit', 'HabitCard', or 'pledge' to find the existing screen/component. Reuse it instead of creating a duplicate.",
            "If the project uses React and JavaScript, put the three habit records in the relevant existing data/configuration file or near the component that renders them. Use the example below as a pattern, not as a new file path.",
            "Connect each habit to the existing Done/Not done control. Keep each habit's completion state separate so checking one does not check all three.",
            "Start the app using its existing start script. Open the screen, confirm exactly 3 habits appear, and click each toggle to verify it changes independently.",
            "If you cannot find a matching component, do not guess a filename. Search the project for the visible heading or share the folder/file list so the correct file can be identified.",
        ]
        pitfalls = [
            "Do not begin coding before the three habits and their completion rules are clear.",
            "Do not claim exact environmental savings without a reliable source.",
            "Do not create a second habit screen if one already exists.",
            "Checking one habit must not accidentally mark the other two as complete.",
            "Do not mark the task complete until the screen has been tested.",
        ]
        example = (
            "For a React/JavaScript project, an example data list could be:\n"
            "const CORE_HABITS = [\n"
            "  { id: 'reusable-bottle', title: 'Use a reusable bottle', "
            "description: 'Avoid a single-use bottle today' },\n"
            "  { id: 'reusable-bag', title: 'Carry a reusable bag', "
            "description: 'Avoid a disposable shopping bag today' },\n"
            "  { id: 'greener-trip', title: 'Choose a greener trip', "
            "description: 'Walk, bike, or use public transport when practical' },\n"
            "];\n"
            "This defines the habit data only; the existing UI still needs to display it and store each Done/Not done state."
        )
        expected = (
            "Three clear, realistic habits are defined. If implementation is included, "
            "they appear as separate cards or rows and each can be checked independently."
        )
        verification = [
            "Read each habit and confirm a beginner can tell exactly what counts as Done.",
            "Confirm there are exactly 3 habits and no duplicate IDs.",
            "If implemented, verify all 3 appear on the page.",
            "Mark the first habit Done and confirm the other two do not change.",
            "Refresh the page and check whether saving progress is required by the task; do not assume it persists unless implemented.",
            "Open Chrome DevTools Console and check for errors.",
        ]

    elif domain == "inventory" and kind == "build":
        tools.append("MDN form validation guide: https://developer.mozilla.org/en-US/docs/Learn/Forms/Form_validation")
        summary = f"Build and verify the inventory task for {title} without breaking existing stock workflows."
        steps = [
            "In plain words: this task should make inventory information easier to enter, understand, or check.",
            "Open the entire existing project folder in Visual Studio Code. Do not create a new project or duplicate a screen.",
            "Press Ctrl+Shift+F and search for the task's main words, such as 'inventory', 'product', 'stock', or the label shown on the screen. Open the matching existing component.",
            "Before editing, identify what the task expects to change and what must stay the same. If the task is only planning/defining requirements, write the requirements first and do not edit code yet.",
            "For product entry, check that product name, quantity, and unit are clearly shown. Keep units such as bottles, cartons, packs, kilograms, or liters visible after selection.",
            "Validate required fields. Quantities should be numeric and must follow the project's actual rules; do not assume zero or negative stock is invalid if the business workflow allows it.",
            "Make the smallest change in the existing component and preserve the current design and data flow.",
            "Run the frontend using its existing start script. Test a normal entry, a missing required field, and a unit dropdown selection.",
            "If an error appears, press F12, open Console, and read the first relevant error. Fix one issue at a time.",
        ]
        pitfalls = [
            "Do not create a duplicate inventory form or change unrelated screens.",
            "Do not silently convert or mix units.",
            "Keep the selected dropdown value readable after selection.",
            "Apply validation that matches the real stock workflow.",
            "Do not claim the feature works before testing it.",
        ]
        example = (
            'Example test: enter product "Pepsi Regular 500ml Pack", quantity 150, '
            'and unit "cartons". Confirm the saved/displayed row still shows 150 cartons.'
        )
        expected = "The requested inventory behavior works, units remain visible, and invalid entries receive clear feedback."
        verification = [
            "Perform the normal user action and confirm the expected result.",
            "Choose a unit from each relevant dropdown and confirm the selected value remains readable.",
            "Try missing or invalid values that the business rules forbid.",
            "Confirm existing inventory data and unrelated screens still work.",
            "Check the browser Console for errors.",
        ]

    elif domain == "study" and kind == "build":
        tools.append("MDN JavaScript guide: https://developer.mozilla.org/en-US/docs/Web/JavaScript")
        summary = f"Implement and test '{task_title}' for {title} in small steps."
        steps = [
            "In plain words: identify exactly what the learner should be able to do when this task is finished.",
            "Open the existing project folder in Visual Studio Code. Press Ctrl+Shift+F and search for words shown on the study/timer screen to find the relevant component.",
            "Read the task description and write down the expected behavior before editing.",
            "Change one behavior at a time. Reuse the existing timer/session logic rather than adding a second timer.",
            "Make the current state obvious to the user, for example Running, Paused, or Completed, if those states are part of this task.",
            "Run the app using its existing start script and test the feature in the browser.",
            "For a timer, test start, pause, resume, reset, and completion as applicable. Confirm elapsed time does not speed up after repeated clicks.",
            "If something fails, press F12, open Console, and inspect the first relevant error.",
        ]
        pitfalls = [
            "Avoid creating multiple timer intervals.",
            "Do not reset progress unexpectedly when pausing or resuming.",
            "Make the current state visible and understandable.",
            "Test the actual task requirements instead of assuming success.",
        ]
        example = "Example: start a short session, pause it, wait, resume it, and confirm the elapsed time behaves as expected."
        expected = f"The '{task_title}' behavior is predictable, visible, and testable."
        verification = [
            "Follow the normal user journey from the beginning.",
            "Test relevant pause/resume/reset/completion cases.",
            "Click controls repeatedly and check that behavior does not duplicate.",
            "Check the browser Console for errors.",
        ]

    elif domain == "food" and kind == "build":
        tools.append("USDA food safety resources: https://www.fsis.usda.gov/ (use local official guidance where applicable).")
        summary = f"Complete '{task_title}' for {title} with clear, practical steps."
        steps = [
            "In plain words: define the result this food-related task should produce before changing the app.",
            "Open the existing project folder in Visual Studio Code and press Ctrl+Shift+F to search for the screen label or task keywords.",
            "Check the current component and data format before editing; reuse existing recipe, meal, or ingredient structures.",
            "If the task involves ingredients, keep quantities and units explicit. If it involves cooking or storage advice, rely on trustworthy official food-safety guidance.",
            "Make the smallest necessary change and keep instructions readable for someone using the app for the first time.",
            "Run the app using its existing start script and test one ordinary case plus a missing/invalid case where relevant.",
            "If the result is wrong, press F12, open Console, and inspect the first relevant error.",
        ]
        pitfalls = [
            "Do not invent food-safety claims or unsafe cooking/storage instructions.",
            "Do not mix measurement units without explaining conversion.",
            "Do not create duplicate recipe or meal components.",
            "Test the visible result before marking the task complete.",
        ]
        example = f"Example: try '{task_title}' with one normal recipe/meal and one missing required value, then check the message shown."
        expected = f"The '{task_title}' feature gives clear, useful results and handles missing information gracefully."
        verification = [
            "Try one ordinary input and confirm the expected result.",
            "Try a missing required value and confirm the app explains what is needed.",
            "Check that units and instructions are readable.",
            "Check the browser Console for errors.",
        ]

    elif kind == "setup":
        stack_items = [str(item).strip() for item in project.get("technology_stack", []) if str(item).strip()]
        stack_text = " ".join(stack_items).lower()
        react_vite = "react" in stack_text and "vite" in stack_text
        raw_folder = re.sub(r"[^A-Za-z0-9_-]+", "", title) or "my-app"
        folder_name = raw_folder.strip("-_") or "my-app"
        if react_vite:
            summary = f"Create or verify the {title} workspace and prove the local frontend preview updates after a saved change."
            first_action = f"Check Node.js and npm, then look for an existing {folder_name}/package.json before creating anything."
            steps = [
                f"Read the Suggested Technology Stack on the HerFirst project overview. It specifies React + TypeScript + Vite for this setup path. Open the parent folder where {folder_name} should live in VS Code (File > Open Folder).",
                "Open Terminal > New Terminal and run `node --version` and `npm --version`. If either command is not found, install Node.js LTS from https://nodejs.org/ and reopen the terminal.",
                f"Check whether `{folder_name}/package.json` already exists. If it does, reuse that folder. If the app does not exist yet, run `npm create vite@latest {folder_name} -- --template react-ts` from the parent folder, then run `cd {folder_name}`. Do not run the scaffold command inside an existing app folder.",
                f"From the folder containing `{folder_name}/package.json`, run `npm install`. Wait for it to finish. If it fails, capture the first relevant error instead of deleting the lockfile.",
                "Run `npm run dev`. Open the exact Local URL printed in the terminal (often http://localhost:5173) and keep the server terminal open.",
                "In the generated starter, open `src/App.tsx`, change one visible heading, save with Ctrl+S, and confirm the browser updates without restarting. Undo the test edit afterwards.",
                "If the port is already in use, open the existing Local URL first. If it still does not load, check the terminal output and Chrome DevTools Console before changing any settings.",
            ]
            pitfalls = [
                "Do not create a second app if the correct folder and package.json already exist.",
                "Do not run npm commands from the parent folder when package.json is inside the app folder (except for the initial scaffold command).",
                "Do not replace package.json or the lockfile to silence an install warning; diagnose the first error.",
                "Do not assume a port conflict means the app is broken; check the Local URL printed by Vite.",
                "Never upload .env or API credentials to GitHub.",
            ]
            example = f"React + TypeScript + Vite setup for {title}: check Node/npm → create {folder_name} only if it does not exist → npm install → npm run dev → open the printed URL → edit src/App.tsx and observe hot reload."
            expected = "The frontend starter runs at its local URL, dependencies are installed, and a saved text change appears in the browser without restarting the server."
            verification = [
                "Confirm `node --version` and `npm --version` both print version numbers.",
                "Confirm the selected app folder contains package.json and the install completes successfully.",
                "Open the exact local URL and confirm the starter screen loads.",
                "Edit one visible string in src/App.tsx, save, confirm hot reload, then undo the change.",
                "Check Chrome Console and terminal output for unresolved errors.",
            ]
        else:
            summary = f"Create or verify the development workspace for {title} using the technology stack selected in the project overview."
            first_action = "Read the Suggested Technology Stack and check whether the project folder already contains its dependency manifest."
            steps = [
                "Open the Suggested Build Setup card on the project overview and read the selected technology stack before installing anything.",
                "Open the parent folder in VS Code. Check whether the project folder and its dependency manifest already exist; if they do, reuse them rather than making a duplicate project.",
                "If no starter app exists, follow the official starter instructions for the selected framework. Do not copy a React/Vite command into a Python, mobile, or other framework project.",
                "Open Terminal > New Terminal in the folder containing the dependency manifest. Read README and its scripts, then install dependencies with the package manager for this stack.",
                "Run the start/development command documented by the existing manifest or the framework's official guide. Open the exact local URL or output shown by the command.",
                "Make one small, visible edit in the starter's actual entry screen, save it, confirm the running app updates, and undo the test edit.",
                "If a command fails, copy the current terminal directory and first relevant error. Do not delete lockfiles, virtual environments, or source files as a first fix.",
            ]
            pitfalls = [
                "Do not install multiple frameworks just because several appear in general examples.",
                "Do not create a duplicate project folder if an existing manifest is present.",
                "Run commands from the directory that contains the relevant manifest.",
                "Use official framework instructions if the selected stack is not React + Vite.",
                "Never publish .env files or API keys.",
            ]
            example = f"For {title}, first confirm the stack shown in the project overview, use that framework's official starter, run its documented command, and verify one saved change in the local preview."
            expected = "The correct starter runs locally, dependencies match the selected stack, and one saved edit appears in its local preview."
            verification = [
                "Confirm the project folder contains the expected manifest for the selected stack.",
                "Confirm dependency installation and the documented start command succeed.",
                "Open the local URL/output and verify the starter runs.",
                "Make and undo one visible edit to verify the development preview.",
                "Check the terminal and browser Console for errors.",
            ]

    else:
        # General guidance for tasks without a more specific branch.
        planning_task = kind == "planning"
        summary = f"Complete '{task_title}' for {title} in small, verifiable steps."
        if planning_task:
            steps = [
                "In plain words: this looks like a planning/definition task. First produce the requested list, decision, or requirements; do not change code unless the task explicitly asks for implementation.",
                "Open the project description and task details in HerFirst. Write down what the final result must contain and how you will know it is finished.",
                "Break the task into a short checklist of concrete decisions or outputs. Avoid vague items such as 'make it better'.",
                "Open the existing project folder in Visual Studio Code only if you need to inspect how the current feature is organised. Press Ctrl+Shift+F to search for the task's key words.",
                "If a coding change is required, find and reuse the existing related component or data structure. Do not guess a filename or create duplicate components.",
                "Complete one checklist item at a time and record the decision or change so it can be reviewed.",
                "Verify every item against the task description. If a requirement is unclear, note the question instead of inventing an answer.",
                "If code was changed, run the app using its existing start script and test the user-visible result. If no code was required, review the completed checklist instead.",
            ]
        else:
            steps = [
                "In plain words: decide what the user should see or be able to do when this task is finished.",
                "Open the whole existing project folder in Visual Studio Code. If it is not installed, download it from https://code.visualstudio.com/ and open the project folder (File > Open Folder).",
                "Read the task description and note the expected input, action, and visible result.",
                "Find the existing relevant file without guessing its name: press Ctrl+Shift+F and search for the task title, a visible screen label, or a related word. Reuse the matching component instead of creating a duplicate.",
                "Make the smallest change that satisfies the task. Keep existing project conventions and do not replace unrelated code.",
                "Run the app with its existing start script. Use the command or batch file already documented in the project; do not invent a new command if you are unsure.",
                "In the browser, perform the normal user action and compare what appears with the expected result.",
                "Test a missing or invalid input if relevant, and check that loading, empty, and error states are understandable.",
                "If it fails, press F12 in Chrome, open Console, read the first relevant error, and fix one issue at a time. Do not mark the task complete until it passes.",
            ]
        if any(word in task_text for word in ("test", "verify", "edge case", "debug")):
            steps[2] = (
                "Write down the expected result, then test one normal case and one missing or invalid case. "
                "Compare the actual behavior with the task description."
            )
        pitfalls = [
            "Do not guess filenames or create duplicate components before searching the existing project.",
            "Do not change unrelated parts of the app.",
            "Do not ignore loading, empty, validation, or error messages when they apply.",
            "Do not mark the task complete until you have checked the actual result.",
            "If the task is planning-only, finish and review the plan before writing code.",
        ]
        example = (
            f"Example: for '{task_title}', write down the expected result, locate the existing related screen, "
            "make only the required change if coding is needed, and test one normal case plus one edge case."
        )
        expected = (
            f"The required outcome for '{task_title}' is clear and verified. If implementation is required, "
            "the existing feature works without breaking unrelated behavior."
        )
        verification = [
            "Check each requirement in the task description against the actual result.",
            "Run the normal user journey if code/UI was changed.",
            "Test a missing or invalid value where relevant.",
            "Confirm existing related functionality still works.",
            "Check the browser Console for unhandled errors.",
        ]

    fallback = {
        "task_id": task["id"],
        "task_title": task_title,
        "summary": summary,
        "what_to_do_next": first_action or steps[0],
        "why_it_matters": (
            task.get("why_it_matters")
            or f"This task helps move {title} toward a useful, testable result."
        ),
        "action_steps": steps + (
            ["Tools and learning links:\n" + "\n".join(f"- {tool}" for tool in tools)]
            if tools else []
        ),
        "common_pitfalls": pitfalls,
        "beginner_encouragement": (
            "Good planning is real progress: a clear page of notes now saves hours of "
            "rework later. Take it one step at a time, and keep your first version small."
            if kind == "planning" and not sustainability_habit
            else (
                "You do not need to understand everything at once. Follow one step, "
                "check the result, and then continue. If a file or button is not where "
                "the guide says, stop and inspect the existing project rather than guessing."
            )
        ),
        "realistic_example": example,
        "expected_result": expected,
        "verification_steps": verification,
        "source": "domain_synthesizer",
        "source_status": (
            "AMD API not configured or unavailable; generated by the task-aware "
            "offline beginner guidance engine."
        ),
    }
    fallback.update(workflow)

    payload = {
        "task": task,
        "project": project,
        "milestone": req.get("milestone") or {},
        "guide_hints": {
            "task_kind": kind,
            "time_budget_minutes": task.get("estimated_minutes", 30),
            "stack_hint": _stack_hint(title, description, project.get("technology_stack")),
            "learner_level": project.get("difficulty", "beginner"),
            "commitment_pace": project.get("commitment_pace", "steady"),
        },
    }
    generated, generated_model, amd_error = _amd_json(GUIDANCE_SYSTEM_PROMPT, payload)

    if generated:
        fields, coerce_error = _coerce_guidance(generated)
        if fields is None:
            amd_error = coerce_error
        else:
            fields.update(workflow)
            fields.update({
                "task_id": task["id"],
                "task_title": task_title,
                "source": "amd_ai",
                "source_status": f"Generated by AMD model {generated_model}.",
            })
            try:
                from .schemas import GuidanceResponse
                validated = GuidanceResponse.model_validate(fields)
                return validated.model_dump()
            except Exception as exc:
                amd_error = f"AMD returned data that did not match the guidance schema ({type(exc).__name__})."

    if AMD_CONFIGURED and amd_error:
        fallback["source_status"] = (
            "AMD response unavailable; offline beginner guidance used. "
            + amd_error[:300]
        )
    return fallback
