import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Plus, RotateCw, Target } from 'lucide-react'
import InfoTooltip from '../../components/InfoTooltip.jsx'
import PageHeader from '../../components/PageHeader.jsx'

const objectives = [
  { id: 'monthly-deficit', label: 'Cobrir déficit deste mês' },
  { id: 'urgent', label: 'Priorizar compromissos urgentes' },
  { id: 'next-month', label: 'Reservar para o próximo mês' },
  { id: 'safety-reserve', label: 'Criar reserva de emergência' },
  { id: 'future-commitments', label: 'Antecipar compromissos futuros' },
  { id: 'unexpected-expenses', label: 'Criar margem para gastos inesperados' },
  { id: 'installments', label: 'Reservar para parcelas futuras' },
  { id: 'future-due-dates', label: 'Organizar vencimentos' },
  { id: 'next-month-security', label: 'Aumentar segurança do próximo mês' },
  { id: 'uncovered-values', label: 'Reduzir valores ainda descobertos' },
]

function CommitmentObjective({ selectedObjective, onChange }) {
  const editorRef = useRef(null)
  const [suggestionStart, setSuggestionStart] = useState(() => Number(window.localStorage.getItem('aloca-objective-suggestion-start')) || 0)
  const [objectiveEditing, setObjectiveEditing] = useState(false)
  const selectedText = selectedObjective?.startsWith('custom:') ? selectedObjective.slice(7) : objectives.find(item => item.id === selectedObjective)?.label || ''
  const [draft, setDraft] = useState(selectedText)
  const visibleSuggestions = useMemo(() => Array.from({ length: 3 }, (_, index) => objectives[(suggestionStart + index) % objectives.length]), [suggestionStart])
  useEffect(() => {
    if (selectedObjective == null) { setDraft(''); setObjectiveEditing(false); return }
    const nextText = selectedObjective.startsWith('custom:') ? selectedObjective.slice(7) : objectives.find(item => item.id === selectedObjective)?.label || ''
    if (nextText !== draft) { setDraft(nextText); setObjectiveEditing(false) }
  }, [selectedObjective])
  useEffect(() => { window.localStorage.setItem('aloca-objective-suggestion-start', String((suggestionStart + 3) % objectives.length)) }, [])
  const focusEditor = () => window.requestAnimationFrame(() => { editorRef.current?.focus(); const end = editorRef.current?.value.length || 0; editorRef.current?.setSelectionRange(end, end) })
  const beginEditing = () => { setObjectiveEditing(true); focusEditor() }
  const chooseSuggestion = suggestion => { setDraft(suggestion.label); setObjectiveEditing(true); focusEditor() }
  const saveObjective = () => { const nextObjective = draft.trim(); onChange(nextObjective ? `custom:${nextObjective}` : ''); setObjectiveEditing(false) }
  const currentObjective = selectedText || draft.trim()
  const hasSavedObjective = Boolean(currentObjective)
  return <div className="dashboard-objective-content" aria-label="Objetivo da reserva">
    <div className="dashboard-objective-heading"><div><span className="eyebrow">DIREÇÃO DO SALDO</span><h3>Objetivo da reserva <InfoTooltip title="Objetivo da reserva" description="Representa a prioridade financeira que você definiu para orientar suas decisões e reservas." /></h3></div></div>
    <div className={`dashboard-objective-body${objectiveEditing ? ' is-editing' : ''}`}>
      {objectiveEditing ? <div className="objective-edit-form"><span className="dashboard-objective-edit-help">Escreva aqui seu objetivo financeiro</span><textarea ref={editorRef} className="dashboard-objective-editor" aria-label="Objetivo da reserva" value={draft} placeholder="Ex.: quitar dívidas, montar reserva, organizar o próximo mês" rows="2" onChange={event => setDraft(event.target.value)} /><div className="dashboard-objective-edit-actions"><button type="button" className="secondary" onClick={() => { setDraft(selectedText); setObjectiveEditing(false) }}>Cancelar</button><button type="button" className="primary" onClick={saveObjective}>Salvar</button></div></div> : <>{hasSavedObjective ? <div className="dashboard-objective-box"><span className="dashboard-objective-icon" aria-hidden="true"><Target size={19} strokeWidth={1.8} /></span><div className="dashboard-objective-copy"><span className="dashboard-objective-label">Objetivo atual</span><p>{currentObjective}</p></div><button type="button" className="dashboard-objective-edit" onClick={beginEditing} aria-label="Editar objetivo"><Pencil size={14} aria-hidden="true" /><span>Editar</span></button></div> : <button type="button" className="dashboard-objective-box dashboard-objective-empty" onClick={beginEditing}><span className="dashboard-objective-icon" aria-hidden="true"><Target size={19} strokeWidth={1.8} /></span><span className="dashboard-objective-copy"><span className="dashboard-objective-label">Objetivo atual</span><span className="dashboard-objective-empty-copy">Nenhum objetivo definido</span></span><span className="dashboard-objective-empty-action">Definir objetivo</span></button>}</>}
      <div className="dashboard-objective-suggestions" aria-live="polite"><div className="dashboard-objective-suggestions-header"><span className="dashboard-objective-suggestions-label">{hasSavedObjective ? 'Sugestões' : 'Sugestões para começar'}</span><button className="dashboard-objective-refresh" type="button" onClick={() => setSuggestionStart(value => (value + 3) % objectives.length)} aria-label="Atualizar sugestões" title="Atualizar sugestões"><RotateCw size={15} aria-hidden="true" /></button></div><div className="dashboard-objective-suggestions-list">{visibleSuggestions.map((suggestion, index) => <button className={`dashboard-objective-suggestion ${index === 0 ? 'is-primary' : ''}`} type="button" key={suggestion.id} onClick={() => chooseSuggestion(suggestion)}><Plus size={16} strokeWidth={2} aria-hidden="true" />{suggestion.label}</button>)}</div></div>
    </div>
  </div>
}

export default function PlanningPage() {
  const [objective, setObjective] = useState(() => window.localStorage.getItem('aloca-commitment-objective') || '')
  return <section className="planning-page" aria-labelledby="planning-title"><PageHeader eyebrow="PLANEJAMENTO" title="Planejamento" description="Reservas, objetivos e sugestões para organizar suas decisões financeiras." titleId="planning-title" /><section className="planning-objectives" aria-labelledby="planning-objectives-title"><h2 id="planning-objectives-title">Objetivos e sugestões</h2><CommitmentObjective selectedObjective={objective} onChange={value => { setObjective(value); window.localStorage.setItem('aloca-commitment-objective', value) }} /></section></section>
}
