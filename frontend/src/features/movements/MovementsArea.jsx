import React from 'react'
import MovementsPage from './MovementsPage.jsx'
import { CommitmentsPage } from './CommitmentsFeature.jsx'

export default function MovementsArea({ movementSection, movementsProps, commitmentsProps }) {
  const sections = [{ id: 'historico', label: 'Histórico' }, { id: 'obrigacoes', label: 'Obrigações' }, { id: 'recorrentes', label: 'Receitas recorrentes' }]
  return <section className="movements-area"><nav className="movements-area-navigation" aria-label="Seções de movimentações">{sections.map(section => <a key={section.id} href={`#movimentacoes/${section.id}`} className={movementSection === section.id ? 'is-active' : ''}>{section.label}</a>)}</nav>{movementSection === 'obrigacoes' ? <CommitmentsPage {...commitmentsProps} /> : <MovementsPage key={movementSection} initialTab={movementSection === 'recorrentes' ? 'recurring' : 'all'} {...movementsProps} />}</section>
}
