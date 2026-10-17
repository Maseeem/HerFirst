from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

Category = Literal["web", "mobile", "ai", "hardware", "creative", "community", "other"]
Difficulty = Literal["beginner", "intermediate", "advanced"]
Pace = Literal["casual", "steady", "intensive"]

class BlueprintRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    idea_title: str = Field(min_length=2, max_length=120)
    idea_description: str = Field(min_length=10, max_length=3000)
    category: Category = "web"
    difficulty: Difficulty = "beginner"
    commitment_pace: Pace = "steady"

class TaskSchema(BaseModel):
    id: str
    milestone_id: str
    title: str
    description: str
    why_it_matters: str
    step_by_step_tips: list[str]
    estimated_minutes: int = Field(ge=1, le=600)
    is_completed: bool = False

class MilestoneSchema(BaseModel):
    id: str
    project_id: str
    order: int = Field(ge=1)
    title: str
    description: str
    tasks: list[TaskSchema]

class BlueprintResponse(BaseModel):
    id: str
    title: str
    description: str
    category: Category
    difficulty: Difficulty
    commitment_pace: Pace
    created_at: str
    progress_percentage: int = Field(ge=0, le=100)
    milestones: list[MilestoneSchema]
    technology_stack: list[str] = Field(default_factory=list)
    architecture_overview: str = ""
    required_tools: list[str] = Field(default_factory=list)
    folder_structure: list[str] = Field(default_factory=list)
    deployment_plan: list[str] = Field(default_factory=list)
    source: Literal["amd_ai", "domain_synthesizer"]
    source_status: str

class TaskInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    id: str = Field(min_length=1, max_length=100)
    milestone_id: str = Field(default="", max_length=100)
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=2000)
    why_it_matters: str = Field(default="", max_length=2000)
    step_by_step_tips: list[str] = Field(default_factory=list, max_length=20)
    estimated_minutes: int = Field(default=30, ge=1, le=600)
    is_completed: bool = False

class ProjectContext(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=3000)
    category: str = "web"
    difficulty: Difficulty = "beginner"
    commitment_pace: Pace = "steady"
    # Optional blueprint metadata lets task guidance use the selected stack instead
    # of guessing a framework from the project title alone.
    technology_stack: list[str] = Field(default_factory=list, max_length=20)
    architecture_overview: str = Field(default="", max_length=3000)
    folder_structure: list[str] = Field(default_factory=list, max_length=30)

class MilestoneContext(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    title: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=2000)

class GuidanceRequest(BaseModel):
    task: TaskInput
    project: ProjectContext
    milestone: MilestoneContext | None = None

class GuidanceResponse(BaseModel):
    task_id: str
    task_title: str
    summary: str
    what_to_do_next: str
    why_it_matters: str
    action_steps: list[str]
    common_pitfalls: list[str]
    beginner_encouragement: str
    realistic_example: str | None = None
    expected_result: str
    verification_steps: list[str]
    # Additional universal project-building guidance. Defaults preserve compatibility
    # with older clients and model responses that only return the original fields.
    guide_stage: str = "implementation"
    tools_and_links: list[str] = Field(default_factory=list)
    file_instructions: list[str] = Field(default_factory=list)
    code_generation_prompt: str | None = None
    run_instructions: list[str] = Field(default_factory=list)
    troubleshooting_steps: list[str] = Field(default_factory=list)
    github_deployment_steps: list[str] = Field(default_factory=list)
    source: Literal["amd_ai", "domain_synthesizer"]
    source_status: str
