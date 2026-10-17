import React from 'react';
import './ProgressBar.css';

export interface ProgressBarProps {
  progress: number; // 0 to 100
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'success' | 'gradient';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  showPercentage = true,
  size = 'md',
  variant = 'gradient',
}) => {
  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className="progress-container">
      {(label || showPercentage) && (
        <div className="progress-header">
          {label && <span className="progress-label">{label}</span>}
          {showPercentage && <span className="progress-value">{clampedProgress}%</span>}
        </div>
      )}
      <div
        className={`progress-track progress-track-${size}`}
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Project completion progress'}
      >
        <div
          className={`progress-fill progress-fill-${variant}`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};
