from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_reports_offline_honestly_without_amd_credentials(monkeypatch):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "HerFirst API"
    assert "amd_configured" in body
    assert body["ai_provider"] in ("offline_domain_synthesizer", "amd_token_factory")

def test_blueprint_is_project_specific_and_validated():
    response = client.post("/api/blueprints", json={
        "idea_title": "Pepsi Factory Inventory Management System",
        "idea_description": "Track raw materials, bottles, caps, labels, finished products and warehouse stock.",
        "category": "web",
        "difficulty": "beginner",
        "commitment_pace": "intensive",
    })
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["title"] == "Pepsi Factory Inventory Management System"
    assert len(body["milestones"]) >= 3
    all_text = " ".join(
        task["title"] + " " + " ".join(task["step_by_step_tips"])
        for milestone in body["milestones"] for task in milestone["tasks"]
    ).lower()
    assert "cartons" in all_text
    assert body["source"] in ("amd_ai", "domain_synthesizer")

def test_blueprint_rejects_invalid_title_and_unknown_fields():
    response = client.post("/api/blueprints", json={
        "idea_title": "x", "idea_description": "A valid enough description for a project",
        "category": "web", "difficulty": "beginner", "commitment_pace": "steady"
    })
    assert response.status_code == 422

def test_task_guidance_is_project_aware():
    response = client.post("/api/tasks/guidance", json={
        "project": {
            "title": "Pepsi Factory Inventory Management System",
            "description": "Warehouse stock, bottles, cartons and raw materials",
            "category": "web"
        },
        "task": {
            "id": "t-2-1", "milestone_id": "m-2",
            "title": "Build the main interactive input control",
            "description": "Build a product entry form with quantity and units.",
            "why_it_matters": "Avoid incorrect stock data.",
            "step_by_step_tips": [], "estimated_minutes": 45, "is_completed": False
        }
    })
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["task_id"] == "t-2-1"
    assert "inventory" in body["summary"].lower()
    assert any("cartons" in step.lower() for step in body["action_steps"])
    assert body["source"] in ("amd_ai", "domain_synthesizer")

def test_guidance_rejects_invalid_request():
    response = client.post("/api/tasks/guidance", json={
        "project": {"title": "x"},
        "task": {"id": "t1", "title": "x"}
    })
    assert response.status_code == 422


def test_frontend_dev_origin_is_allowed_by_cors():
    response = client.options(
        "/api/tasks/guidance",
        headers={
            "Origin": "http://localhost:5174",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5174"


def test_blueprint_ids_are_unique_and_task_parent_ids_match():
    payload = {
        "idea_title": "Personal study planner",
        "idea_description": "A simple planner that helps students organize daily study sessions.",
        "category": "web",
        "difficulty": "beginner",
        "commitment_pace": "steady",
    }
    first = client.post("/api/blueprints", json=payload).json()
    second = client.post("/api/blueprints", json=payload).json()
    assert first["id"] != second["id"]
    milestone_ids = {m["id"] for m in first["milestones"]}
    task_ids = [t["id"] for m in first["milestones"] for t in m["tasks"]]
    assert len(task_ids) == len(set(task_ids))
    for milestone in first["milestones"]:
        assert milestone["project_id"] == first["id"]
        for task in milestone["tasks"]:
            assert task["milestone_id"] == milestone["id"]
            assert task["milestone_id"] in milestone_ids


def test_blueprint_includes_project_builder_metadata_and_delivery_milestones(monkeypatch):
    import app.services as services
    monkeypatch.setattr(services, "_amd_json", lambda *args, **kwargs: (None, None, "offline test"))
    response = client.post("/api/blueprints", json={
        "idea_title": "StudyBuddy",
        "idea_description": "A study planner for students to create and track study sessions.",
        "category": "web",
        "difficulty": "beginner",
        "commitment_pace": "intensive",
    })
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["technology_stack"]
    assert body["architecture_overview"]
    assert body["required_tools"]
    assert body["folder_structure"]
    assert body["deployment_plan"]
    titles = " ".join(m["title"].lower() for m in body["milestones"])
    assert "github" in titles or "version control" in titles
    assert "deploy" in titles or "hosting" in titles
    assert any("live" in title or "maintenance" in title or "verification" in title for title in titles.split("milestone"))


def test_guidance_accepts_and_uses_optional_milestone_context(monkeypatch):
    import app.services as services
    monkeypatch.setattr(services, "_amd_json", lambda *args, **kwargs: (None, None, "offline test"))
    response = client.post("/api/tasks/guidance", json={
        "project": {"title": "StudyBuddy", "description": "Study session planner", "category": "web", "difficulty": "beginner", "commitment_pace": "intensive"},
        "milestone": {"title": "Build the study timer", "description": "Create and test a working countdown timer."},
        "task": {"id": "timer-task", "milestone_id": "m-timer", "title": "Implement timer countdown", "description": "Start and stop a 25-minute timer", "why_it_matters": "Students need a visible session duration.", "step_by_step_tips": ["Add timer display", "Add start button"], "estimated_minutes": 30, "is_completed": False},
    })
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["task_id"] == "timer-task"
    assert body["guide_stage"] == "testing"
    assert body["code_generation_prompt"] and "StudyBuddy" in body["code_generation_prompt"]
    assert body["tools_and_links"]
    assert body["run_instructions"]
    assert body["troubleshooting_steps"]
