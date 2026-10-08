import React from 'react'

export default function PageHeader({ eyebrow, title, description, className = '', titleId, headingLevel = 1 }) {
  const nestedPageTitles = ['Perfil e Segurança', 'Grupos', 'Suporte']
  const resolvedLevel = headingLevel === 1 && nestedPageTitles.includes(title) ? 2 : headingLevel
  const Heading = resolvedLevel === 2 ? 'h2' : resolvedLevel === 3 ? 'h3' : 'h1'
  return <header className={`page-header ${className}`.trim()}>
    {eyebrow && <span className="page-header-eyebrow">{eyebrow}</span>}
    <Heading id={titleId}>{title}</Heading>
    {description && <p>{description}</p>}
  </header>
}
