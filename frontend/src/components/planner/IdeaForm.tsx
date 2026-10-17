import React, { useState } from 'react';
import { Button } from '../common/Button';
import { Card, CardBody, CardHeader } from '../common/Card';
import { Input, Select, Textarea } from '../common/FormControls';
import type { CommitmentPace, DifficultyLevel, PlanGenerationRequest, ProjectCategory } from '../../types/project';
import './IdeaForm.css';

interface IdeaFormProps {
  onSubmit: (request: PlanGenerationRequest) => void;
  isLoading: boolean;
}

const CATEGORY_OPTIONS = [
  { value: 'web', label: 'Web Application', description: 'Browser-based tools, dashboards, and sites' },
  { value: 'mobile', label: 'Mobile App', description: 'iOS/Android or responsive progressive web apps' },
  { value: 'ai', label: 'AI & Machine Learning', description: 'Intelligent helpers, classifiers, and chatbots' },
  { value: 'creative', label: 'Creative & Community', description: 'Art, portfolio, writing, or social platforms' },
  { value: 'hardware', label: 'Hardware & IoT', description: 'Arduino, Raspberry Pi, robotics' },
  { value: 'other', label: 'General / Other', description: 'Any other unique idea' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'beginner', label: 'Beginner (Recommended)', description: 'First project, focus on fundamentals' },
  { value: 'intermediate', label: 'Intermediate', description: 'Familiar with programming basics' },
  { value: 'advanced', label: 'Advanced', description: 'Comfortable with full-stack architectures' },
];

const PACE_OPTIONS = [
  { value: 'casual', label: 'Casual Pace', description: '1–2 hours per week' },
  { value: 'steady', label: 'Steady Pace', description: '4–6 hours per week' },
  { value: 'intensive', label: 'Hackathon Sprint', description: 'Daily focused progress' },
];

const PREFILL_IDEAS = [
  {
    title: 'PocketPantry — Zero-Waste Meal Planner',
    description: 'An app that looks at leftover ingredients in your fridge and recommends 3 simple recipes to reduce food waste.',
    category: 'web' as ProjectCategory,
  },
  {
    title: 'CampusRide — Safe Student Carpool Matcher',
    description: 'A platform helping university students find verified campus commute buddies traveling the same route.',
    category: 'web' as ProjectCategory,
  },
  {
    title: 'FocusPet — Gamified Study Timer',
    description: 'A micro-study timer where finishing 25-minute Pomodoro sessions hatches and feeds a virtual pet.',
    category: 'mobile' as ProjectCategory,
  },
];

export const IdeaForm: React.FC<IdeaFormProps> = ({ onSubmit, isLoading }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProjectCategory>('web');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('beginner');
  const [pace, setPace] = useState<CommitmentPace>('steady');
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});

  const validate = (): boolean => {
    const newErrors: { title?: string; description?: string } = {};
    if (!title.trim()) {
      newErrors.title = 'Please provide a name or short working title for your idea.';
    } else if (title.trim().length < 3) {
      newErrors.title = 'Title should be at least 3 characters.';
    }

    if (!description.trim()) {
      newErrors.description = 'Please explain what your idea does and who it helps.';
    } else if (description.trim().length < 15) {
      newErrors.description = 'Please add a bit more detail (at least 15 characters) so the AI can build a tailored blueprint.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      idea_title: title.trim(),
      idea_description: description.trim(),
      category,
      difficulty,
      commitment_pace: pace,
    });
  };

  const handlePrefill = (prefill: (typeof PREFILL_IDEAS)[0]) => {
    setTitle(prefill.title);
    setDescription(prefill.description);
    setCategory(prefill.category);
    setErrors({});
  };

  return (
    <Card className="idea-form-card">
      <CardHeader>
        <div>
          <h2 className="idea-form-title">Turn Your Spark Into a Clear Blueprint</h2>
          <p className="idea-form-subtitle">
            Tell us about your project in your own words. We’ll break it down into manageable milestones and step-by-step guidance.
          </p>
        </div>
      </CardHeader>

      <CardBody>
        <div className="prefill-section">
          <span className="prefill-label">Need inspiration? Try an example:</span>
          <div className="prefill-chips">
            {PREFILL_IDEAS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                className="prefill-chip"
                onClick={() => handlePrefill(item)}
              >
                💡 {item.title.split('—')[0].trim()}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <Input
            label="What is your project idea called?"
            placeholder="e.g. EcoPledge, MyFirstPortfolio, CommunityGardenBot"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
            }}
            error={errors.title}
            helperText="A friendly working title for your project."
            required
          />

          <Textarea
            label="Describe your idea and the problem it solves"
            placeholder="e.g. I want to build a simple web tool where beginners can log their daily eco-actions, earn points, and see practical weekly progress..."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
            }}
            error={errors.description}
            helperText="Write in plain English. No technical jargon needed!"
            rows={4}
            required
          />

          <div className="idea-form-grid">
            <Select
              label="Project Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ProjectCategory)}
              options={CATEGORY_OPTIONS}
              helperText="Selected category influences tool recommendations."
            />

            <Select
              label="Your Experience Level"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
              options={DIFFICULTY_OPTIONS}
              helperText="Tailors task explanations to your comfort level."
            />

            <Select
              label="Target Pace"
              value={pace}
              onChange={(e) => setPace(e.target.value as CommitmentPace)}
              options={PACE_OPTIONS}
              helperText="Helps pace your milestones realistically."
            />
          </div>

          <div className="idea-form-actions">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="idea-submit-btn"
            >
              {isLoading ? 'Creating Your Project Blueprint...' : '✨ Generate My Step-by-Step Plan'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
};
