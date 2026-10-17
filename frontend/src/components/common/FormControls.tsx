import React, { useId } from 'react';
import './FormControls.css';

interface BaseFieldProps {
  label: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  id?: string;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, BaseFieldProps {}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  required,
  id: customId,
  className = '',
  ...props
}) => {
  const generatedId = useId();
  const fieldId = customId || generatedId;
  const helperId = `${fieldId}-helper`;
  const errorId = `${fieldId}-error`;

  return (
    <div className={`form-group ${error ? 'form-group-error' : ''}`}>
      <label htmlFor={fieldId} className="form-label">
        {label}
        {required && <span className="form-required" aria-hidden="true">*</span>}
      </label>
      <input
        id={fieldId}
        className={`form-input ${className}`}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        aria-invalid={!!error}
        required={required}
        {...props}
      />
      {error ? (
        <span id={errorId} className="form-message form-message-error" role="alert">
          {error}
        </span>
      ) : helperText ? (
        <span id={helperId} className="form-message form-message-helper">
          {helperText}
        </span>
      ) : null}
    </div>
  );
};

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, BaseFieldProps {}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  helperText,
  error,
  required,
  id: customId,
  className = '',
  rows = 4,
  ...props
}) => {
  const generatedId = useId();
  const fieldId = customId || generatedId;
  const helperId = `${fieldId}-helper`;
  const errorId = `${fieldId}-error`;

  return (
    <div className={`form-group ${error ? 'form-group-error' : ''}`}>
      <label htmlFor={fieldId} className="form-label">
        {label}
        {required && <span className="form-required" aria-hidden="true">*</span>}
      </label>
      <textarea
        id={fieldId}
        rows={rows}
        className={`form-textarea ${className}`}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        aria-invalid={!!error}
        required={required}
        {...props}
      />
      {error ? (
        <span id={errorId} className="form-message form-message-error" role="alert">
          {error}
        </span>
      ) : helperText ? (
        <span id={helperId} className="form-message form-message-helper">
          {helperText}
        </span>
      ) : null}
    </div>
  );
};

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement>, BaseFieldProps {
  options: SelectOption[];
}

export const Select: React.FC<SelectProps> = ({
  label,
  helperText,
  error,
  required,
  options,
  id: customId,
  className = '',
  value,
  ...props
}) => {
  const generatedId = useId();
  const fieldId = customId || generatedId;
  const helperId = `${fieldId}-helper`;
  const errorId = `${fieldId}-error`;

  return (
    <div className={`form-group ${error ? 'form-group-error' : ''}`}>
      <label htmlFor={fieldId} className="form-label">
        {label}
        {required && <span className="form-required" aria-hidden="true">*</span>}
      </label>
      <div className="select-wrapper">
        <select
          id={fieldId}
          className={`form-select ${className}`}
          value={value}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          aria-invalid={!!error}
          required={required}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="form-option">
              {opt.label} {opt.description ? `— ${opt.description}` : ''}
            </option>
          ))}
        </select>
        <span className="select-arrow" aria-hidden="true">
          ▼
        </span>
      </div>
      {error ? (
        <span id={errorId} className="form-message form-message-error" role="alert">
          {error}
        </span>
      ) : helperText ? (
        <span id={helperId} className="form-message form-message-helper">
          {helperText}
        </span>
      ) : null}
    </div>
  );
};
