import React, { useRef, useState } from 'react';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Card, CardBody } from '../components/common/Card';
import { Navbar } from '../components/layout/Navbar';
import { IdeaForm } from '../components/planner/IdeaForm';
import { ProjectView } from '../components/planner/ProjectView';
import { SAMPLE_PROJECTS } from '../data/sampleProjects';
import { PlanService } from '../services/planService';
import type { PlanGenerationRequest, Project } from '../types/project';
import './HomePage.css';

export const HomePage: React.FC = () => {
  const [activeProject, setActiveProject] = useState<Project | null>(SAMPLE_PROJECTS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'project' | 'create'>('project');

  const plannerRef = useRef<HTMLDivElement>(null);
  const sampleRef = useRef<HTMLDivElement>(null);
  const howItWorksRef = useRef<HTMLDivElement>(null);

  const scrollToPlanner = () => {
    setViewMode('create');
    setTimeout(() => {
      plannerRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const scrollToSample = () => {
    setActiveProject(SAMPLE_PROJECTS[0]);
    setViewMode('project');
    setTimeout(() => {
      sampleRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const scrollToHowItWorks = () => {
    howItWorksRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Toggle task completion in state
  const handleToggleTask = (taskId: string) => {
    if (!activeProject) return;

    const updatedMilestones = activeProject.milestones.map((milestone) => ({
      ...milestone,
      tasks: milestone.tasks.map((task) =>
        task.id === taskId ? { ...task, is_completed: !task.is_completed } : task
      ),
    }));

    const allTasks = updatedMilestones.flatMap((m) => m.tasks);
    const completedCount = allTasks.filter((t) => t.is_completed).length;
    const progress = allTasks.length > 0 ? Math.round((completedCount / allTasks.length) * 100) : 0;

    setActiveProject({
      ...activeProject,
      milestones: updatedMilestones,
      progress_percentage: progress,
    });
  };

  // Prefer the FastAPI backend when available; PlanService retains the offline fallback.
  const handleGeneratePlan = async (request: PlanGenerationRequest) => {
    setIsLoading(true);
    try {
      const generatedProject = await PlanService.generatePlanWithBackend(request);
      setActiveProject(generatedProject);
      setViewMode('project');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="homepage-wrapper">
      <Navbar
        onNewPlanClick={scrollToPlanner}
        onSampleClick={scrollToSample}
        onHowItWorksClick={scrollToHowItWorks}
      />

      <main className="container homepage-main">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-badge-row">
            <Badge variant="amd" size="md">
              ✨ Beginner-friendly project guidance
            </Badge>
            <Badge variant="secondary" size="md">
              For First-Time Creators & Beginners
            </Badge>
          </div>

          <h1 className="hero-heading">
            Her First Idea. <br />
            <span className="hero-gradient-text">Her First Project. Her First Step.</span>
          </h1>

          <p className="hero-subheading">
            Got an idea you have always wanted to build? Don’t let technical overwhelm stop you.
            HerFirst turns your raw idea into an actionable, step-by-step milestone blueprint with
            encouraging AI guidance at every stage.
          </p>

          <div className="hero-cta-group">
            <Button variant="primary" size="lg" onClick={scrollToPlanner}>
              🚀 Create a Project Plan
            </Button>
            <Button variant="outline" size="lg" onClick={scrollToSample}>
              👀 Explore Sample Blueprint
            </Button>
          </div>

          {/* Quick Pillars */}
          <div className="hero-pillars-grid">
            <div className="pillar-item">
              <span className="pillar-icon">🗺️</span>
              <h3 className="pillar-title">Milestone Deconstruction</h3>
              <p className="pillar-desc">
                No massive vague tasks. We break ideas into digestible 20–45 minute steps.
              </p>
            </div>
            <div className="pillar-item">
              <span className="pillar-icon">💡</span>
              <h3 className="pillar-title">Why It Matters</h3>
              <p className="pillar-desc">
                Every task explains the “why” so you actually learn software fundamentals.
              </p>
            </div>
            <div className="pillar-item">
              <span className="pillar-icon">🤖</span>
              <h3 className="pillar-title">AMD AI Task Guidance</h3>
              <p className="pillar-desc">
                Stuck on a step? Get contextual hints and avoid common beginner traps.
              </p>
            </div>
          </div>
        </section>

        {/* Interactive Workspace Section */}
        <section className="interactive-workspace" ref={sampleRef}>
          <div className="workspace-tabs-row">
            <div className="workspace-tabs-left">
              <button
                type="button"
                className={`workspace-tab-btn ${viewMode === 'project' ? 'active' : ''}`}
                onClick={() => setViewMode('project')}
              >
                📋 Active Project Blueprint
              </button>
              <button
                type="button"
                className={`workspace-tab-btn ${viewMode === 'create' ? 'active' : ''}`}
                onClick={() => setViewMode('create')}
              >
                ✨ Plan a New Idea
              </button>
            </div>

            {viewMode === 'project' && (
              <span className="workspace-hint">
                👉 Try checking off tasks to see real-time progress, or click "Step-by-Step Guide"!
              </span>
            )}
          </div>

          <div ref={plannerRef}>
            {viewMode === 'create' ? (
              <IdeaForm onSubmit={handleGeneratePlan} isLoading={isLoading} />
            ) : activeProject ? (
              <ProjectView
                project={activeProject}
                onToggleTask={handleToggleTask}
                onResetProject={() => setViewMode('create')}
              />
            ) : (
              <Card>
                <CardBody>
                  <p>No project loaded yet. Click "+ Start a Plan" to begin!</p>
                </CardBody>
              </Card>
            )}
          </div>
        </section>

        {/* How It Works Section */}
        <section className="how-it-works-section" ref={howItWorksRef}>
          <div className="section-header">
            <Badge variant="primary" size="sm">The HerFirst Method</Badge>
            <h2 className="section-title">How HerFirst Guides You to the Finish Line</h2>
            <p className="section-subtitle">
              Building a real project doesn’t require years of expertise. It requires clarity, momentum, and small wins.
            </p>
          </div>

          <div className="steps-cards-grid">
            <Card className="step-card">
              <CardBody>
                <div className="step-number-bubble">1</div>
                <h3 className="step-card-title">Share Your Idea in Plain English</h3>
                <p className="step-card-desc">
                  Type what you want to create and your comfort level. No technical jargon, architecture diagrams, or specs needed.
                </p>
              </CardBody>
            </Card>

            <Card className="step-card">
              <CardBody>
                <div className="step-number-bubble">2</div>
                <h3 className="step-card-title">AI Generates Your Milestones</h3>
                <p className="step-card-desc">
                  HerFirst turns your idea into structured milestones with time estimates, using the backend AI when configured or its domain-aware offline generator otherwise.
                </p>
              </CardBody>
            </Card>

            <Card className="step-card">
              <CardBody>
                <div className="step-number-bubble">3</div>
                <h3 className="step-card-title">Step-by-Step Guidance & Pitfall Avoidance</h3>
                <p className="step-card-desc">
                  Open any task to see what to do next, why it matters, and common traps beginners fall into.
                </p>
              </CardBody>
            </Card>

            <Card className="step-card">
              <CardBody>
                <div className="step-number-bubble">4</div>
                <h3 className="step-card-title">Track Real Progress & Celebrate</h3>
                <p className="step-card-desc">
                  Check off tasks as you build. Save your project privately to your account and return anytime.
                </p>
              </CardBody>
            </Card>
          </div>
        </section>

        {/* AMD Architecture Transparency Card */}
        <section className="amd-transparency-section">
          <Card className="amd-spotlight-card">
            <CardBody>
              <div className="amd-spotlight-content">
                <div className="amd-badge-heading">
                  <span className="amd-flame-icon">🔥</span>
                  <div>
                    <h3 className="amd-spotlight-title">Built for AMD Developer Hackathon ACT III</h3>
                    <p className="amd-spotlight-sub">AMD Cloud AI Integration with Offline Fallback</p>
                  </div>
                </div>
                <p className="amd-spotlight-text">
                  HerFirst includes a FastAPI integration path for the <strong>AMD Radeon Cloud Token Factory</strong>. When valid backend credentials are configured and the model endpoint is reachable, requests can use AMD AI. Until then, project blueprints and task guidance remain available through the local domain-aware fallback. API credentials are kept on the backend.
                </p>
                <div className="amd-tech-tags">
                  <span className="tech-tag">AMD Token Factory API</span>
                  <span className="tech-tag">FastAPI Backend</span>
                  <span className="tech-tag">React 19 + TypeScript</span>
                  <span className="tech-tag">Offline Guidance Fallback</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="homepage-footer">
        <div className="container footer-content">
          <div className="footer-left">
            <span className="footer-brand">✨ HerFirst</span>
            <p className="footer-tagline">“Her First Idea. Her First Project. Her First Step.”</p>
          </div>
          <div className="footer-right">
            <p>Developed with passion for AMD Developer Hackathon ACT III</p>
            <p className="footer-privacy-note">Privacy First: Zero client-exposed secrets • Accessible UI</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
