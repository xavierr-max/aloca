import React, { useId } from 'react'
import { AlertTriangle, Check, Clock3 } from 'lucide-react'

const optionIcons = { automatic: Clock3, urgent: AlertTriangle }

export function CheckboxOption({ checked, onChange, title, description, variant = 'automatic', disabled = false, loading = false, compact = false, id: providedId, className = '' }) {
  const generatedId = useId()
  const id = providedId || `checkbox-option-${generatedId}`
  const SemanticIcon = optionIcons[variant] || Clock3
  return <label className={`checkbox-option checkbox-option--${variant} ${compact ? 'checkbox-option--compact' : ''} ${checked ? 'is-checked' : ''} ${disabled ? 'is-disabled' : ''} ${loading ? 'is-loading' : ''} ${className}`.trim()} htmlFor={id}>
    <input id={id} type="checkbox" checked={checked} onChange={onChange} disabled={disabled || loading} />
    <span className="checkbox-option-box" aria-hidden="true">{loading ? <span className="checkbox-option-spinner" /> : checked ? <Check size={14} strokeWidth={3} /> : null}</span>
    <span className="checkbox-option-icon" aria-hidden="true"><SemanticIcon size={16} strokeWidth={2} /></span>
    <span className="checkbox-option-copy"><span className="checkbox-option-title">{title}</span>{description && <span className="checkbox-option-description">{description}</span>}</span>
  </label>
}
