import React, { useEffect, useRef, useState } from 'react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Card, CardBody, CardHeader } from '../common/Card';
import { Modal } from '../common/Modal';
import { ProgressBar } from '../common/ProgressBar';
import { GuidanceService } from '../../services/guidanceService';
import type { Project, Task, TaskGuidance } from '../../types/project';
import './ProjectView.css';

interface ProjectViewProps {
  project: Project;
  onToggleTask: (taskId: string) => void;
  onResetProject?: () => void;
}

type GuidanceState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; guidance: TaskGuidance }
  | { status: 'unavailable'; reason: string };

export const ProjectView: React.FC<ProjectViewProps> = ({
  project,
  onToggleTask,
  onResetProject,
}) => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [guidanceState, setGuidanceState] = useState<GuidanceState>({ status: 'idle' });
  const [retryCount, setRetryCount] = useState(0);
  const [showOfflinePreview, setShowOfflinePreview] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Always read the newest copy of the selected task without re-running the request
  // when only its completion tick changes. (Declared before the request effect so the
  // ref is current when that effect runs.)
  const selectedTaskRef = useRef<Task | null>(null);
  useEffect(() => {
    selectedTaskRef.current = selectedTask;
  });
  const forceNextRequestRef = useRef(false);
  const selectedTaskId = selectedTask?.id ?? null;

  // Request guidance from the backend once per opened task. Identical in-flight requests
  // are shared inside GuidanceService, so React StrictMode and re-renders do not start
  // extra slow AI calls. The offline guide is used only after a real failure, or when the
  // learner chooses to preview it while waiting, and is always labelled as offline.
  useEffect(() => {
    setShowOfflinePreview(false);
    const task = selectedTaskRef.current;
    if (!task) {
      setGuidanceState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    const force = forceNextRequestRef.current;
    forceNextRequestRef.current = false;
    setGuidanceState({ status: 'loading' });

    GuidanceService.requestBackendGuidance(
      task,
      project,
      { force }
    ).then((result) => {
      if (cancelled) return;
      if ('guidance' in result) {
        setGuidanceState({ status: 'ready', guidance: result.guidance });
      } else {
        setGuidanceState({ status: 'unavailable', reason: result.reason });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedTaskId, project.title, project.description, project.category, project.difficulty, project.commitment_pace, retryCount]);

  const handleRetryGuidance = () => {
    forceNextRequestRef.current = true;
    setRetryCount((count) => count + 1);
  };

  // Compute live progress stats
  const allTasks: Task[] = project.milestones.flatMap((m) => m.tasks);
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.is_completed).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const remainingMinutes = allTasks
    .filter((t) => !t.is_completed)
    .reduce((sum, t) => sum + (t.estimated_minutes || 30), 0);

  // Choose what the Task Guide shows. Backend guidance (AMD or the backend's own offline
  // engine) is shown exactly as returned; the browser's offline guide is only a labelled fallback.
  let guidance: TaskGuidance | null = null;
  if (selectedTask) {
    if (guidanceState.status === 'ready') {
      guidance = guidanceState.guidance;
    } else if (guidanceState.status === 'unavailable') {
      guidance = GuidanceService.asOfflineGuidance(
        GuidanceService.generateGuidance(selectedTask, project),
        guidanceState.reason
      );
    } else if (guidanceState.status === 'loading' && showOfflinePreview) {
      guidance = GuidanceService.asOfflineGuidance(
        GuidanceService.generateGuidance(selectedTask, project),
        'Shown while the AI guide is still loading.'
      );
    }
  }
  const selectedMilestone = selectedTask
    ? project.milestones.find((item) => item.id === selectedTask.milestone_id)
    : undefined;
  if (guidance && selectedTask) {
    guidance = GuidanceService.enrichWithWorkflow(
      guidance, selectedTask, project, selectedMilestone?.title, selectedMilestone?.description
    );
  }
  const isLoadingGuidance = guidanceState.status === 'loading' && guidance === null;
  const sourceInfo = guidance ? GuidanceService.describeSource(guidance) : null;

  return (
    <div className="project-view-container">
      {/* Project Overview Header Card */}
      <Card className="project-overview-card">
        <CardBody>
          <div className="project-header-top">
            <div className="project-badges">
              <Badge variant="primary">{project.category}</Badge>
              <Badge variant="neutral">{project.difficulty}</Badge>
              <Badge variant="secondary">{project.commitment_pace} pace</Badge>
              <Badge variant="amd">HerFirst Project Blueprint</Badge>
            </div>
            {onResetProject && (
              <Button variant="outline" size="sm" onClick={onResetProject}>
                Create Another Plan
              </Button>
            )}
          </div>

          <h1 className="project-title">{project.title}</h1>
          {project.tagline && <p className="project-tagline">{project.tagline}</p>}
          <p className="project-description">{project.description}</p>

          <div className="project-progress-summary">
            <ProgressBar
              progress={progressPercent}
              label={`Project Progress: ${completedTasks} of ${totalTasks} tasks complete`}
              size="lg"
            />
            <div className="project-stats-grid">
              <div className="stat-box">
                <span className="stat-number">{completedTasks} / {totalTasks}</span>
                <span className="stat-label">Tasks Finished</span>
              </div>
              <div className="stat-box">
                <span className="stat-number">{remainingMinutes} mins</span>
                <span className="stat-label">Est. Time Remaining</span>
              </div>
              <div className="stat-box">
                <span className="stat-number">{project.milestones.length}</span>
                <span className="stat-label">Key Milestones</span>
              </div>
            </div>

            {progressPercent === 100 && (
              <div className="celebration-banner" role="status">
                🎉 Congratulations! You have completed all milestones for {project.title}!
              </div>
            )}
          </div>
        </CardBody>
      </Card>


      {(project.technology_stack?.length || project.architecture_overview || project.required_tools?.length || project.folder_structure?.length || project.deployment_plan?.length) ? (
        <Card className="project-setup-card">
          <CardHeader>
            <div>
              <h2 className="milestones-heading">Recommended Build Setup</h2>
              <p className="milestone-desc">A starting recommendation for tools, structure, and delivery. Confirm the actual project requirements before installing or paying for tools.</p>
            </div>
          </CardHeader>
          <CardBody>
            {project.architecture_overview && <p className="project-architecture-overview">{project.architecture_overview}</p>}
            {project.technology_stack?.length ? <div className="setup-metadata-section"><h4>Suggested Technology Stack</h4><ul>{project.technology_stack.map((item, idx) => <li key={idx}>{item}</li>)}</ul></div> : null}
            <details className="setup-more-details">
              <summary>Tools, folder structure and release plan</summary>
              {project.required_tools?.length ? <div className="setup-metadata-section"><h4>Tools and Official Links</h4><ul>{project.required_tools.map((item, idx) => <li key={idx}>{item}</li>)}</ul></div> : null}
              {project.folder_structure?.length ? <div className="setup-metadata-section"><h4>Suggested Folder Structure</h4><ul>{project.folder_structure.map((item, idx) => <li key={idx}>{item}</li>)}</ul></div> : null}
              {project.deployment_plan?.length ? <div className="setup-metadata-section"><h4>GitHub, Release and Deployment Plan</h4><ol>{project.deployment_plan.map((item, idx) => <li key={idx}>{item}</li>)}</ol></div> : null}
            </details>
          </CardBody>
        </Card>
      ) : null}

      {/* Milestones & Tasks Section */}
      <div className="milestones-section">
        <h2 className="milestones-heading">Your Actionable Milestones</h2>
        <div className="milestones-list">
          {project.milestones.map((milestone) => {
            const milestoneTotal = milestone.tasks.length;
            const milestoneDone = milestone.tasks.filter((t) => t.is_completed).length;
            const isMilestoneDone = milestoneTotal > 0 && milestoneTotal === milestoneDone;

            return (
              <Card
                key={milestone.id}
                className={`milestone-card ${isMilestoneDone ? 'milestone-card-done' : ''}`}
              >
                <CardHeader className="milestone-header">
                  <div>
                    <span className="milestone-order-tag">Milestone {milestone.order}</span>
                    <h3 className="milestone-title">{milestone.title}</h3>
                    <p className="milestone-desc">{milestone.description}</p>
                  </div>
                  <Badge variant={isMilestoneDone ? 'success' : 'neutral'} size="sm">
                    {milestoneDone} / {milestoneTotal} done
                  </Badge>
                </CardHeader>

                <CardBody className="milestone-body">
                  <div className="tasks-list">
                    {milestone.tasks.map((task) => (
                      <div
                        key={task.id}
                        className={`task-row ${task.is_completed ? 'task-row-completed' : ''}`}
                      >
                        <div className="task-left">
                          <label className="task-checkbox-label">
                            <input
                              type="checkbox"
                              className="task-checkbox"
                              checked={task.is_completed}
                              onChange={() => onToggleTask(task.id)}
                              aria-label={`Mark "${task.title}" as ${task.is_completed ? 'incomplete' : 'complete'}`}
                            />
                            <span className="task-custom-checkbox" aria-hidden="true" />
                          </label>

                          <div className="task-content">
                            <span className="task-title">{task.title}</span>
                            <span className="task-desc">{task.description}</span>
                            <div className="task-meta">
                              <span className="task-time">⏱️ ~{task.estimated_minutes} mins</span>
                              <span className="task-why">💡 {task.why_it_matters}</span>
                            </div>
                          </div>
                        </div>

                        <div className="task-actions">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedTask(task)}
                            aria-label={`View step-by-step guidance for ${task.title}`}
                          >
                            📖 Step-by-Step Guide
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Task Guidance Modal */}
      {selectedTask && (
        <Modal
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          title={`Task Guide: ${selectedTask.title}`}
          size="lg"
          footer={
            <div className="modal-actions-bar">
              <Button
                variant={selectedTask.is_completed ? 'secondary' : 'primary'}
                onClick={() => {
                  onToggleTask(selectedTask.id);
                  setSelectedTask((prev) =>
                    prev ? { ...prev, is_completed: !prev.is_completed } : null
                  );
                }}
              >
                {selectedTask.is_completed ? 'Mark Incomplete' : '✓ Mark as Done'}
              </Button>
              <Button variant="ghost" onClick={() => setSelectedTask(null)}>
                Close
              </Button>
            </div>
          }
        >
          <>
            {isLoadingGuidance && (
              <div className="guidance-loading" role="status" aria-live="polite">
                <div className="guidance-status-pill guidance-status-loading">
                  <span className="status-dot"></span>
                  <span>Asking the AI mentor for a guide written for this task…</span>
                </div>
                <p>
                  This can take up to a minute. Your guide will appear here as soon as it is ready.
                </p>
                <Button variant="ghost" size="sm" onClick={() => setShowOfflinePreview(true)}>
                  Show the offline guide while I wait
                </Button>
              </div>
            )}
            {guidance && sourceInfo && (
          <div className="guidance-content">
            <div className={`guidance-status-pill guidance-status-${sourceInfo.kind}`} role="status">
              <span className="status-dot"></span>
              <span>
                <strong>{sourceInfo.label}</strong>
                {sourceInfo.detail ? ` — ${sourceInfo.detail}` : ''}
              </span>
            </div>
            {sourceInfo.kind === 'offline' && guidanceState.status !== 'loading' && (
              <div>
                <Button variant="outline" size="sm" onClick={handleRetryGuidance}>
                  Try the AI guide again
                </Button>
              </div>
            )}

            <p className="guidance-summary">{guidance.summary}</p>

            <div className="guidance-block guidance-why">
              <h4>🎯 Why This Step Matters</h4>
              <p>{guidance.why_it_matters}</p>
            </div>

            <div className="guidance-block">
              <h4>📋 What To Do Next</h4>
              <p>{guidance.what_to_do_next}</p>
            </div>


            {guidance.tools_and_links?.length ? (
              <div className="guidance-block">
                <h4>🧰 Tools and Official Links</h4>
                <ul>{guidance.tools_and_links.map((item, idx) => <li key={idx}>{item}</li>)}</ul>
              </div>
            ) : null}

            {guidance.file_instructions?.length ? (
              <div className="guidance-block">
                <h4>📁 Where to Put the Code</h4>
                <ol>{guidance.file_instructions.map((item, idx) => <li key={idx}>{item}</li>)}</ol>
              </div>
            ) : null}

            {guidance.code_generation_prompt ? (
              <div className="guidance-block guidance-prompt-block">
                <div className="guidance-prompt-header">
                  <h4>🤖 Copy-Ready AI Prompt</h4>
                  <Button type="button" variant="outline" size="sm" onClick={async () => {
                    try { await navigator.clipboard.writeText(guidance.code_generation_prompt || ''); setCopiedPrompt(true); window.setTimeout(() => setCopiedPrompt(false), 1800); }
                    catch { setCopiedPrompt(false); }
                  }}>{copiedPrompt ? 'Copied!' : 'Copy Prompt'}</Button>
                </div>
                <p>Use this in ChatGPT or Claude. If the assistant cannot see your local files, upload the relevant files. Code in chat is not automatically saved to your computer.</p>
                <pre className="guidance-code-preview guidance-prompt-preview"><code>{guidance.code_generation_prompt}</code></pre>
              </div>
            ) : null}

            <div className="guidance-block">
              <h4>🛠️ Action Steps</h4>
              <ol className="guidance-steps-list">
                {guidance.action_steps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
            </div>

            {guidance.realistic_example && (
              <div className="guidance-block guidance-example-block">
                <h4>💡 A Concrete Example</h4>
                <pre className="guidance-code-preview">
                  <code>{guidance.realistic_example}</code>
                </pre>
              </div>
            )}

            {guidance.expected_result && (
              <div className="guidance-block guidance-result-block">
                <h4>✅ Expected Result</h4>
                <p>{guidance.expected_result}</p>
              </div>
            )}

            {guidance.verification_steps && guidance.verification_steps.length > 0 && (
              <div className="guidance-block guidance-verify-block">
                <h4>🔍 How to Verify This Step</h4>
                <ul className="guidance-verify-list">
                  {guidance.verification_steps.map((vStep, idx) => (
                    <li key={idx}>{vStep}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="guidance-block guidance-pitfalls">
              <h4>⚠️ Common Pitfalls to Avoid</h4>
              <ul>
                {guidance.common_pitfalls.map((pitfall, idx) => (
                  <li key={idx}>{pitfall}</li>
                ))}
              </ul>
            </div>


            {guidance.run_instructions?.length ? <div className="guidance-block"><h4>▶️ Run and Verify</h4><ol>{guidance.run_instructions.map((item, idx) => <li key={idx}>{item}</li>)}</ol></div> : null}
            {guidance.troubleshooting_steps?.length ? <div className="guidance-block"><h4>🧯 Troubleshooting and Error Fixing</h4><ul>{guidance.troubleshooting_steps.map((item, idx) => <li key={idx}>{item}</li>)}</ul></div> : null}
            {guidance.github_deployment_steps?.length ? <div className="guidance-block"><h4>🚀 GitHub, Deployment and Maintenance</h4><ol>{guidance.github_deployment_steps.map((item, idx) => <li key={idx}>{item}</li>)}</ol></div> : null}

            <div className="guidance-encouragement">
              🌟 <strong>Mentor Tip:</strong> {guidance.beginner_encouragement}
            </div>
          </div>
            )}
          </>
        </Modal>
      )}
    </div>
  );
};
