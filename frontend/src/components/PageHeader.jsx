import React from 'react'

export default function PageHeader({ eyebrow, title, description, className = '', titleId }) {
  return <header className={`page-header ${className}`.trim()}>
    {eyebrow && <span className="page-header-eyebrow">{eyebrow}</span>}
    <h1 id={titleId}>{title}</h1>
    {description && <p>{description}</p>}
  </header>
}
