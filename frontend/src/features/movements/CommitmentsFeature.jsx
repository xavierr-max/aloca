import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, CircleAlert, LockKeyhole, Wallet } from 'lucide-react'
import { api } from '../../services/api'
import { businessToday } from '../../utils/businessDate.js'
import { errorText, formatDecimalInput, money, optionalCategoryId, parseAmount } from '../../utils/financial.js'
import { CheckboxOption } from '../../components/CheckboxOption.jsx'
import InfoTooltip from '../../components/InfoTooltip.jsx'
import ModalLayer from '../../components/ModalLayer.jsx'
import PageHeader from '../../components/PageHeader.jsx'

const frequencyLabels = { Once: 'Uma vez', Weekly: 'Semanal', Fortnightly: 'Quinzenal', Monthly: 'Mensal', Bimonthly: 'Bimestral', Quarterly: 'Trimestral', Semiannual: 'Semestral', Annual: 'Anual' }
const iconProps = { size: 18, strokeWidth: 1.8, 'aria-hidden': true, focusable: false }
const Icon = ({ icon: Glyph, size, className = '' }) => <Glyph {...iconProps} size={size ?? iconProps.size} className={className} />
const addMonths = (date, months, dayOfMonth = null) => { if (!date) return ''; const [year, month, day] = date.slice(0, 10).split('-').map(Number); const result = new Date(Date.UTC(year, month - 1 + months, 1)); const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate(); result.setUTCDate(Math.min(dayOfMonth ?? day, lastDay)); return result.toISOString().slice(0, 10) }
const addDays = (date, days) => { if (!date) return ''; const [year, month, day] = date.slice(0, 10).split('-').map(Number); const result = new Date(Date.UTC(year, month - 1, day + days)); return result.toISOString().slice(0, 10) }
const recurrenceMonthSteps = { Monthly: 1, Bimonthly: 2, Quarterly: 3, Semiannual: 6, Annual: 12 }
const parseDateInput = value => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null; const [year, month, day] = value.split('-').map(Number); const date = new Date(Date.UTC(year, month - 1, day)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? { year, month, day } : null }
const nextCommitmentOccurrence = (date, frequency, dayOfMonth) => frequency === 'Weekly' ? addDays(date, 7) : frequency === 'Fortnightly' ? addDays(date, 14) : recurrenceMonthSteps[frequency] ? addMonths(date, recurrenceMonthSteps[frequency], dayOfMonth) : ''
const generateCommitmentOccurrences = (firstDueDate, frequency, endDate) => { const first = parseDateInput(firstDueDate); const end = endDate ? parseDateInput(endDate) : null; if (!first || !endDate || !end || endDate < firstDueDate) return []; const start = firstDueDate; if (frequency === 'Once') return [start]; const occurrences = []; const anchorDay = first.day; let current = start; while (current <= endDate) { occurrences.push(current); current = nextCommitmentOccurrence(current, frequency, anchorDay); if (!current) break } return occurrences }
const getCommitmentRecurrencePreview = ({ dueDate, frequency, endDate }) => { if (frequency === 'Once') return { kind: 'once' }; if (!dueDate) return { kind: 'missing-start', message: 'Informe o primeiro vencimento para visualizar a previsão.' }; if (!parseDateInput(dueDate)) return { kind: 'invalid', message: 'Informe um primeiro vencimento válido.' }; if (endDate && !parseDateInput(endDate)) return { kind: 'invalid', message: 'Informe uma data de término válida.' }; if (endDate && endDate < dueDate) return { kind: 'invalid', message: 'A data de término deve ser igual ou posterior ao primeiro vencimento.' }; if (!endDate) return { kind: 'open' }; const occurrences = generateCommitmentOccurrences(dueDate, frequency, endDate); return occurrences.length ? { kind: 'scheduled', occurrences } : { kind: 'invalid', message: 'Não foi possível calcular as cobranças para esse período.' } }
const formatDate = date => date ? new Date(String(date).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data informada'
export function CurrentBalanceModal({ value, onClose, onSaved }) {
  const [amount, setAmount] = useState(formatDecimalInput(value ?? 0)); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const current = Number(value) || 0; const next = parseAmount(amount); const difference = Number.isFinite(next) ? next - current : 0
  const save = async e => { e.preventDefault(); if (!Number.isFinite(next) || next < 0) return setError('Informe um valor válido maior ou igual a zero.'); if (Math.abs(difference) >= 1000 && !window.confirm('A alteração é grande. Deseja registrar este ajuste?')) return; setSaving(true); setError(''); try { await api.updateCurrentBalance(next); await onSaved() } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">AJUSTE FINANCEIRO</span><h2>Editar saldo atual</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div><p className="modal-copy">Esta ação altera o saldo base atual da conta e registra a diferença como um ajuste manual no histórico.</p>{error && <div className="alert error">{error}</div>}<div className="preview-list"><div><span>Saldo atual</span><strong>{money(current)}</strong></div><label>Novo saldo<input autoFocus inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} aria-label="Novo saldo" /></label><div><span>Diferença</span><strong className={difference < 0 ? 'negative' : 'positive'}>{difference >= 0 ? '+ ' : '- '}{money(Math.abs(difference))}</strong></div></div><div className="modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar novo saldo'}</button></div></form></div>
}

export function CategoryModal({ category, onClose, onSaved }) { const [name, setName] = useState(category?.name || ''); const [error, setError] = useState(''); const save = async e => { e.preventDefault(); if (!name.trim()) { setError('Informe o nome do grupo.'); return } try { await api.updateCategory(category.id, name.trim()); onSaved() } catch (e) { setError(errorText(e)) } }; return <ModalLayer onClose={onClose}><form onSubmit={save}><div className="modal-head"><div><span className="eyebrow">GRUPOS</span><h2>Editar grupo</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{error && <div className="alert error" role="alert">{error}</div>}<label htmlFor="edit-category-name">Nome<input id="edit-category-name" autoFocus value={name} onChange={e => setName(e.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary">Salvar</button></div></form></ModalLayer> }
export function ConfirmModal({ title, message, onClose, onConfirm, confirmLabel = 'Confirmar', busy = false, busyLabel = 'Processando…', error = '', tone = 'default' }) { return <ModalLayer onClose={onClose}><div className={`modal-content modal-tone-${tone}`}><h2>{title}</h2><p className="modal-copy">{message}</p>{error && <div className="alert error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button><button type="button" className={tone === 'danger' ? 'danger-button' : 'primary'} onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</button></div></div></ModalLayer> }
export function AlertModal({ title, message, onClose }) { return <ModalLayer onClose={onClose}><div className="modal-content modal-tone-warning"><h2>{title}</h2><p className="modal-copy">{message}</p><div className="modal-actions"><button type="button" className="primary" onClick={onClose}>Entendi</button></div></div></ModalLayer> }

export function AppDrawer({ open = true, onClose, eyebrow, title, titleId, badges, children, footer, className = '' }) {
  const closeButtonRef = useRef(null)
  const openerRef = useRef(typeof document !== 'undefined' ? document.activeElement : null)
  const onCloseRef = useRef(onClose)
  const closingRef = useRef(false)
  const [closing, setClosing] = useState(false)
  const drawerId = titleId || 'app-drawer-title'
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  const requestClose = () => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    window.setTimeout(() => onCloseRef.current(), 220)
  }
  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const closeOnEscape = event => { if (event.key === 'Escape' && !document.querySelector('[data-modal-layer]')) requestClose() }
    const trapFocus = event => {
      if (event.key !== 'Tab') return
      const drawer = event.currentTarget.querySelector('[role="dialog"]')
      if (!drawer) return
      const focusable = [...drawer.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', closeOnEscape)
    const backdrop = document.querySelector('.app-drawer-backdrop')
    backdrop?.addEventListener('keydown', trapFocus)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      backdrop?.removeEventListener('keydown', trapFocus)
      document.body.style.overflow = previousOverflow
      if (openerRef.current instanceof HTMLElement && document.contains(openerRef.current)) openerRef.current.focus()
    }
  }, [open])
  if (!open || typeof document === 'undefined') return null
  return createPortal(<div className={`app-drawer-backdrop ${closing ? 'is-closing' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) requestClose() }}><aside className={`app-drawer ${className} ${closing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-labelledby={drawerId}><header className="app-drawer-header"><div><span className="eyebrow">{eyebrow}</span><h2 id={drawerId}>{title}</h2>{badges && <div className="app-drawer-badges">{badges}</div>}</div><button ref={closeButtonRef} type="button" className="icon-button" onClick={requestClose} aria-label="Fechar detalhes">×</button></header><div className="app-drawer-content">{children}</div>{footer && <footer className="app-drawer-footer">{footer}</footer>}</aside></div>, document.body)
}

export function RecurringIncomeDrawer({ item, categories, onClose, onToggle, onDelete, onReceive, onSaved }) {
  const [mode, setMode] = useState('view')
  const occurrences = [...(item.occurrences || [])].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
  const editFormId = 'recurring-income-edit-form'
  const footer = mode === 'edit' ? <><button type="button" className="secondary" onClick={() => setMode('view')}>Cancelar</button><button type="submit" form={editFormId} className="primary">Salvar alterações</button></> : <><button type="button" className="secondary" onClick={() => setMode('edit')}>Editar</button><button type="button" className="secondary" onClick={onToggle}>{item.isActive ? 'Pausar' : 'Reativar'}</button><button type="button" className="danger-button" onClick={onDelete}>Excluir</button></>
  const content = mode === 'edit' ? <RecurringIncomeModal embedded formId={editFormId} item={item} categories={categories} onClose={() => setMode('view')} onSaved={onSaved} /> : <><div className="recurring-detail-hero"><strong>{money(item.amount)}</strong><span>{frequencyLabels[item.frequency]} · {item.categoryName}</span></div><dl className="detail-facts"><div><dt>Próxima ocorrência</dt><dd>{item.nextOccurrence ? formatDate(item.nextOccurrence) : 'Sem próximas'}</dd></div><div><dt>Início</dt><dd>{formatDate(item.startDate)}</dd></div><div><dt>Término</dt><dd>{item.endDate ? formatDate(item.endDate) : 'Sem término'}</dd></div></dl><section className="recurring-history"><div className="drawer-section-heading"><h3>Histórico</h3><span>{occurrences.length} ocorrências</span></div>{occurrences.length ? <div className="history-list">{occurrences.map(occurrence => <div className="history-item" key={occurrence.id}><span className={`history-dot ${occurrence.status.toLowerCase()}`} /><div><strong>{formatDate(occurrence.scheduledDate)}</strong><small>{occurrence.status === 'Received' ? 'Recebida' : occurrence.status === 'Cancelled' ? 'Cancelada' : occurrence.status === 'Paused' ? 'Pausada' : 'Prevista'}</small></div><b>{money(occurrence.amount)}</b>{occurrence.status === 'Planned' && item.isActive && <button className="tertiary" onClick={() => onReceive(occurrence)}>Receber</button>}</div>)}</div> : <p className="drawer-empty">Nenhuma ocorrência registrada ainda.</p>}</section></>
  return <AppDrawer className="recurring-detail-drawer" eyebrow={mode === 'edit' ? 'EDITAR ENTRADA RECORRENTE' : 'ENTRADA RECORRENTE'} title={mode === 'edit' ? 'Editar entrada recorrente' : item.description} titleId="recurring-detail-title" badges={mode === 'view' && <><span className={`recurring-status ${item.isActive ? 'active' : 'paused'}`}>{item.isActive ? 'Ativa' : 'Pausada'}</span>{item.automaticProcessing && <span className="recurring-status active" title="Processamento automático ativado">Automático</span>}</>} footer={footer} onClose={onClose}>{mode === 'edit' ? <RecurringIncomeModal embedded formId={editFormId} item={item} categories={categories} onClose={() => setMode('view')} onSaved={async () => { await onSaved(); setMode('view') }} /> : content}</AppDrawer>
}

export function RecurringIncomeModal({ categories, item, businessDate: referenceDate, onClose, onSaved, embedded = false, formId }) {
  const [form, setForm] = useState(() => item ? { description: item.description, amount: String(item.amount).replace('.', ','), categoryId: item.categoryId || "", frequency: item.frequency, startDate: item.startDate, endDate: item.endDate || '', automaticProcessing: item.automaticProcessing ?? false } : { description: '', amount: '', categoryId: '', frequency: 'Monthly', startDate: referenceDate?.slice(0, 10) || businessToday(), endDate: '', automaticProcessing: false }); const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const update = (key, value) => setForm(x => ({ ...x, [key]: value }))
  const dayOfMonth = Number(form.startDate.slice(8, 10))
  const save = async e => { e.preventDefault(); if (!form.description.trim() || !form.amount || !form.startDate) return setError('Preencha descrição, valor e a primeira ocorrência.'); if (form.endDate && form.endDate < form.startDate) return setError('A data final deve ser igual ou posterior ao início.'); setSaving(true); setError(''); try { const body = { ...form, amount: parseAmount(form.amount), categoryId: optionalCategoryId(form.categoryId), dayOfMonth: form.frequency === 'Monthly' ? dayOfMonth : null, endDate: form.endDate || null }; await (item ? api.updateRecurringIncome(item.id, body) : api.createRecurringIncome(body)); await onSaved() } catch (e) { console.error('Falha ao salvar entrada recorrente', e); setError(e?.status >= 400 ? 'Não foi possível salvar a entrada recorrente.' : errorText(e)) } finally { setSaving(false) } }
  const fields = <>{error && <div className="alert error">{error}</div>}<section className="recurring-form-section"><h3>Informações principais</h3><label>Descrição<input autoFocus required value={form.description} onChange={e => update('description', e.target.value)} /></label><div className="form-grid income-form-grid"><label>Valor<input required inputMode="decimal" placeholder="0,00" value={form.amount} onChange={e => update('amount', e.target.value)} /></label><label>Grupo<select value={form.categoryId} onChange={e => update('categoryId', e.target.value || null)}><option value="">Sem grupo</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div></section><section className="recurring-form-section"><h3>Recorrência</h3><div className="form-grid recurring-form-grid"><label>Primeira ocorrência<input required type="date" value={form.startDate} onChange={e => update('startDate', e.target.value)} /></label><label>Frequência<select value={form.frequency} onChange={e => update('frequency', e.target.value)}>{Object.entries(frequencyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{form.frequency === 'Monthly' && <span className="field-hint">Repete todo dia {dayOfMonth}; o dia 31 cai no último dia válido.</span>}</label><label>Data de término <span className="field-hint">(opcional)</span><input type="date" value={form.endDate} onChange={e => update('endDate', e.target.value)} /></label></div></section><section className="recurring-form-section recurring-form-options"><h3>Automação</h3><CheckboxOption checked={form.automaticProcessing} onChange={e => update('automaticProcessing', e.target.checked)} title="Receber automaticamente na data" description="O valor será adicionado ao saldo automaticamente na data da ocorrência." /><p className="modal-copy">A primeira ocorrência define o dia das entradas mensais. As previsões não alteram seu saldo real.</p></section></>
  if (embedded) return <form id={formId} className="app-drawer-form commitment-setting-form" onSubmit={save}>{fields}</form>
  return <div className="modal-backdrop"><form className="modal commitment-setting-form" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">ENTRADA RECORRENTE</span><h2>{item ? 'Editar entrada recorrente' : 'Nova entrada recorrente'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{fields}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{item ? 'Salvar alterações' : 'Salvar entrada recorrente'}</button></div></form></div>
}

export function IncomeModal({ categories, onClose, onSaved }) {
  const [form, setForm] = useState({ description: '', amount: '', categoryId: '', date: businessToday() }); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const save = async event => { event.preventDefault(); const amount = parseAmount(form.amount); if (!form.description.trim()) return setError('Informe a descrição da entrada.'); if (!Number.isFinite(amount) || amount <= 0) return setError('Informe um valor maior que zero.'); setSaving(true); setError(''); try { await api.createIncome({ description: form.description.trim(), amount, date: form.date, categoryId: form.categoryId || null }); onSaved() } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">MOVIMENTAÇÃO</span><h2>Nova entrada</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{error && <div className="alert error">{error}</div>}<label>Descrição<input autoFocus required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><label>Valor<input required inputMode="decimal" placeholder="0,00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label><div className="form-grid income-form-grid"><label>Grupo<select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}><option value="">Sem grupo</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Data<input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label></div><p className="modal-copy">Entradas não podem ser editadas depois de criadas. Se necessário, exclua e cadastre novamente.</p><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>Salvar entrada</button></div></form></div>
}

export function ExpenseModal({ item, categories, currentBalance, businessDate: referenceDate, onClose, onSaved }) {
  const [form, setForm] = useState({ description: item?.description || '', amount: item?.amount ?? '', categoryId: item?.categoryId || '', date: item?.date?.slice(0, 10) || referenceDate?.slice(0, 10) || businessToday() }); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const save = async event => { event.preventDefault(); const amount = parseAmount(form.amount); if (!form.description.trim()) return setError('Informe a descrição da saída.'); if (!Number.isFinite(amount) || amount <= 0) return setError('Informe um valor maior que zero.'); if (!item && amount > Number(currentBalance) && !window.confirm(`Esta saída é maior que o saldo real disponível (${money(currentBalance)}). Deseja confirmar mesmo assim?`)) return; setSaving(true); setError(''); try { const body = { description: form.description.trim(), amount, date: form.date, categoryId: form.categoryId || null, type: 'Expense' }; if (item) await api.updateTransaction(item.id, body); else await api.createExpense(body); onSaved() } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">MOVIMENTAÇÃO</span><h2>Nova saída</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{error && <div className="alert error">{error}</div>}<p className="modal-copy">Registre um gasto já realizado. Ele reduz o saldo real e não cria compromisso, reserva ou parcela.</p><label>Descrição<input autoFocus required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><label>Valor<input required inputMode="decimal" placeholder="0,00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label><div className="form-grid income-form-grid"><label>Grupo <span className="field-hint">(opcional)</span><select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}><option value="">Sem grupo</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Data<input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label></div><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>Registrar saída</button></div></form></div>
}

export function CommitmentListItem({ item, availableBalance, onChange, onEdit, onDelete }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const priority = item.priorityLabel || (item.priority ? ['Indefinida', 'Alta', 'Média', 'Baixa'][item.priority] : '')
  const coverage = Math.min(100, Math.max(0, Number(item.coveragePercentage) || 0))
  const nextDueDate = item.nextDueDate
  const status = item.isCompleted ? 'Pago' : coverage >= 100 ? 'Coberto' : coverage > 0 ? 'Parcialmente reservado' : 'Pendente'
  const urgentUncovered = Boolean(item.urgent && !item.isCompleted && coverage < 100)
  const urgentPartial = urgentUncovered && coverage > 0
  const frequency = item.isOpenEnded ? `Recorrente · ${frequencyLabels[item.frequency] || 'Periódico'}` : item.isRecurring ? frequencyLabels[item.frequency] || 'Recorrente' : ''
  const openDetails = () => setDetailsOpen(true)
  const onKeyDown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetails() } }
  return <>
    <article className={`commitments-list-item ${item.isCompleted ? 'is-completed' : ''} ${urgentUncovered ? 'is-urgent-uncovered' : ''} ${urgentPartial ? 'is-urgent-partial' : ''}`} role="button" tabIndex="0" onClick={openDetails} onKeyDown={onKeyDown}>
      <div className="commitments-list-main">
        <strong className="commitments-list-name">{item.name}</strong>
        <span className="commitments-list-meta">{item.categoryName || 'Sem grupo'}{frequency && ` · ${frequency}`}{priority && ` · Prioridade ${priority.toLowerCase()}`}{item.urgent && <> · <span className={urgentUncovered ? 'commitments-list-urgent-label' : ''}>Urgente</span></>}</span>
      </div>
      <div className="commitments-list-due">
        <span>Próximo vencimento</span>
        <strong>{nextDueDate ? formatDate(nextDueDate) : 'Sem vencimento'}</strong>
      </div>
      <div className="commitments-list-value">
        <span>{item.isOpenEnded ? 'Por cobrança' : 'Valor'}</span>
        <strong>{money(item.installmentAmount)}</strong>
      </div>
      <div className="commitments-list-reserve">
        <div className="commitments-list-reserve-heading"><span>Reserva</span><strong>{Math.round(coverage)}%</strong></div>
        <div className="commitments-list-progress" role="progressbar" aria-label={`Cobertura de ${item.name}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(coverage)}><span style={{ width: `${coverage}%` }} /></div>
        <small>{money(item.allocatedAmount)} reservado{item.missingForNextInstallment > 0 && <> · <span className={urgentUncovered ? 'commitments-list-missing' : ''}>faltam {money(item.missingForNextInstallment)}</span></>}</small>
      </div>
      <span className={`commitments-list-status ${item.isCompleted ? 'is-complete' : coverage >= 100 ? 'is-covered' : ''} ${urgentUncovered ? 'is-urgent' : ''}`}>{status}</span>
      <span className="commitments-list-menu" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}><CommitmentMenu item={item} onDetails={openDetails} onEdit={onEdit} onDelete={onDelete} /></span>
    </article>
    {detailsOpen && <CommitmentDetailsDrawer item={item} availableBalance={availableBalance} priority={priority} onClose={() => setDetailsOpen(false)} onEdit={onEdit} onDelete={onDelete} onChange={onChange} />}
  </>
}

export function CommitmentSummarySkeleton() { return <div className="commitments-summary commitments-summary-skeleton" aria-hidden="true">{[1, 2, 3, 4].map(key => <div className="commitments-skeleton-block" key={key} />)}</div> }
export function CommitmentToolbarSkeleton() { return <div className="commitments-toolbar-skeleton" aria-hidden="true"><span /><span /><span /><span /><span /></div> }
export function CommitmentListSkeleton() { return <div className="commitments-list commitments-list-skeleton" aria-hidden="true">{[1, 2, 3, 4].map(key => <div className="commitments-list-skeleton-row" key={key}><span /><span /><span /><span /><span /></div>)}</div> }

export function CommitmentsPage({ commitments, filtered, categories, filters, setFilters, searchInput, setSearchInput, activeFilterCount, onOpenFilters, summary, onCreate, setEditing, run, refresh, loading, initialLoadComplete, error, onRetry, onClearFilters }) {
  const initialLoading = loading && !initialLoadComplete && commitments.length === 0
  const activeCommitments = commitments.filter(item => !item.isCompleted)
  const totalCommitted = activeCommitments.reduce((total, item) => total + Number(item.remainingAmount || 0), 0)
  const totalReserved = Number(summary?.allocatedBalance ?? 0)
  const missingToReserve = activeCommitments.reduce((total, item) => total + Number(item.missingForFullCoverage || 0), 0)
  const nextCommitment = activeCommitments
    .filter(item => item.nextDueDate)
    .sort((left, right) => String(left.nextDueDate).localeCompare(String(right.nextDueDate)) || left.name.localeCompare(right.name))[0]
  return <section className="commitments-page commitments-shell" aria-labelledby="commitments-page-title">
    <header className="commitments-page-header">
      <PageHeader className="commitments-page-heading" eyebrow="MOVIMENTAÇÕES" title="Obrigações" description="Organize valores reservados para despesas e obrigações futuras." titleId="commitments-page-title" />
      <button type="button" className="primary commitments-create-button" onClick={onCreate}>+ Novo compromisso</button>
    </header>
    {initialLoading ? <CommitmentSummarySkeleton /> : <section className="commitments-summary" aria-label="Resumo dos compromissos">
      <article className="commitments-summary-card commitments-summary-card-committed">
        <div className="commitments-summary-label"><Icon icon={Wallet} size={18} /><span>Total comprometido</span><InfoTooltip title="Total comprometido" description="Soma do valor que ainda falta pagar nos compromissos ativos." /></div>
        <strong>{money(totalCommitted)}</strong>
        <small>Compromissos ativos</small>
      </article>
      <article className="commitments-summary-card commitments-summary-card-reserved">
        <div className="commitments-summary-label"><Icon icon={LockKeyhole} size={18} /><span>Total reservado</span><InfoTooltip title="Total reservado" description="Valor já separado para cobrir os compromissos ativos." /></div>
        <strong>{money(totalReserved)}</strong>
        <small>Saldo já alocado</small>
      </article>
      <article className="commitments-summary-card commitments-summary-card-missing">
        <div className="commitments-summary-label"><Icon icon={CircleAlert} size={18} /><span>Falta reservar</span><InfoTooltip title="Falta reservar" description="Quanto ainda precisa ser separado para cobrir completamente os compromissos ativos." /></div>
        <strong>{money(missingToReserve)}</strong>
        <small>Para cobertura completa</small>
      </article>
      <article className="commitments-summary-card commitments-summary-card-next">
        <div className="commitments-summary-label"><Icon icon={CalendarDays} size={18} /><span>Próximo vencimento</span><InfoTooltip title="Próximo vencimento" description="Data e valor da próxima cobrança entre os compromissos ativos." /></div>
        {nextCommitment ? <><strong>{formatDate(nextCommitment.nextDueDate)}</strong><small>{nextCommitment.name} · {money(nextCommitment.installmentAmount)}</small></> : <><strong>Nenhum vencimento</strong><small>Não há compromissos ativos</small></>}
      </article>
    </section>}
    {initialLoading ? <CommitmentToolbarSkeleton /> : <section className="commitments-toolbar" aria-label="Ferramentas de compromissos">
      <div className="commitments-toolbar-controls">
        <label className="commitments-search-field">
          <span className="sr-only">Buscar compromisso</span>
          <input type="search" placeholder="Buscar compromisso" value={searchInput} onChange={event => setSearchInput(event.target.value)} />
        </label>
        <select aria-label="Filtrar por grupo" value={filters.category} onChange={event => setFilters(current => ({ ...current, category: event.target.value }))}>
          <option value="">Todos os grupos</option>
          <option value="none">Sem grupo</option>
          {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select aria-label="Filtrar por status" value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))}>
          <option value="active">Ativos</option>
          <option value="completed">Concluídos</option>
          <option value="">Todos</option>
        </select>
        <select aria-label="Ordenar compromissos" value={filters.sort} onChange={event => setFilters(current => ({ ...current, sort: event.target.value }))}>
          <option value="priority">Ordenar</option>
          <option value="name">Nome</option>
          <option value="total">Valor total</option>
          <option value="remaining">Valor restante</option>
          <option value="next">Próxima parcela</option>
          <option value="progress">Progresso</option>
          <option value="category">Grupo</option>
        </select>
        <button type="button" className="secondary commitments-more-filters" onClick={onOpenFilters}>Mais filtros{activeFilterCount ? ` (${activeFilterCount})` : ''}</button>
      </div>
      <div className="commitments-result-count">{filtered.length} de {commitments.length} compromissos</div>
    </section>}
    <section className="commitments-content" aria-label="Lista de compromissos">
      {initialLoading ? <CommitmentListSkeleton /> : error && commitments.length === 0 ? <div className="commitments-state commitments-error-state" role="alert"><strong>Não foi possível carregar seus compromissos.</strong><button type="button" className="secondary" onClick={onRetry}>Tentar novamente</button></div> : commitments.length === 0 ? <div className="commitments-state"><strong>Nenhum compromisso cadastrado</strong><span>Crie seu primeiro compromisso para organizar valores reservados e vencimentos.</span><button type="button" className="primary" onClick={onCreate}>Criar compromisso</button></div> : <>{error && <div className="commitments-refresh-notice" role="status">Não foi possível atualizar os dados. Os dados anteriores continuam visíveis.</div>}{filtered.length ? <div className="commitments-list">{filtered.map(item => <CommitmentListItem key={item.id} item={item} availableBalance={summary?.unallocatedBalance ?? 0} onChange={refresh} onEdit={() => setEditing(item)} onDelete={() => run(() => api.deleteCommitment(item.id))} />)}</div> : <div className="commitments-state"><strong>Nenhum compromisso encontrado</strong><span>Tente ajustar a busca ou os filtros.</span><button type="button" className="secondary" onClick={onClearFilters}>Limpar filtros</button></div>}</>}
    </section>
  </section>
}

export function FilterDrawer({ filters, setFilters, categories, onClear, onClose, onEditCategory, onDeleteCategory }) {
  const update = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  return <div className="drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><aside className="filter-drawer" role="dialog" aria-modal="true" aria-labelledby="filters-title"><div className="drawer-head"><div><span className="eyebrow">PERSONALIZE A LISTA</span><h2 id="filters-title">Filtros</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar filtros">×</button></div><div className="drawer-content"><fieldset><legend>Classificação</legend><label>Grupo<select value={filters.category} onChange={e => update('category', e.target.value)}><option value="">Todos os grupos</option><option value="none">Sem grupo</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Prioridade<select value={filters.priority} onChange={e => update('priority', e.target.value)}><option value="">Todas as prioridades</option><option value="none">Sem prioridade</option><option value="1">Alta</option><option value="2">Média</option><option value="3">Baixa</option></select></label></fieldset><fieldset><legend>Situação</legend><label>Status<select value={filters.status} onChange={e => update('status', e.target.value)}><option value="">Todos os status</option><option value="active">Ativos</option><option value="completed">Concluídos</option></select></label><label>Cobertura<select value={filters.coverage} onChange={e => update('coverage', e.target.value)}><option value="">Todas as coberturas</option><option value="none">Sem reserva</option><option value="partial">Parcial</option><option value="next">Próxima parcela coberta</option><option value="full">Totalmente reservado</option></select></label><label>Pagamento<select value={filters.payment} onChange={e => update('payment', e.target.value)}><option value="">Todos os pagamentos</option><option value="none">Não iniciado</option><option value="progress">Em andamento</option><option value="done">Quitado</option></select></label></fieldset><fieldset><legend>Ordenação</legend><label>Ordenar por<select value={filters.sort} onChange={e => update('sort', e.target.value)}><option value="priority">Prioridade</option><option value="name">Nome</option><option value="total">Valor total</option><option value="remaining">Valor restante</option><option value="next">Próxima parcela</option><option value="progress">Progresso</option><option value="category">Grupo</option></select></label></fieldset><fieldset><legend>Filtros rápidos</legend><CheckboxOption compact checked={filters.deficit} onChange={e => update('deficit', e.target.checked)} title="Com déficit" /><CheckboxOption compact checked={filters.payable} onChange={e => update('payable', e.target.checked)} title="Aptos para pagar" /></fieldset><section className="category-tools" aria-label="Gerenciar grupos"><strong>Gerenciar grupos</strong>{categories.length ? categories.map(category => <span key={category.id}>{category.name}<button type="button" onClick={() => onEditCategory(category)} aria-label={`Editar ${category.name}`}>✎</button><button type="button" onClick={() => onDeleteCategory(category)} aria-label={`Excluir ${category.name}`}>×</button></span>) : <small>Nenhum grupo criado.</small>}</section></div><div className="drawer-actions"><button className="secondary" onClick={onClear}>Limpar filtros</button><button className="primary" onClick={onClose}>Aplicar filtros</button></div></aside></div>
}

export function CategoryCreateModal({ onClose, onSaved }) { const [name, setName] = useState(''); const [error, setError] = useState(''); const save = async e => { e.preventDefault(); if (!name.trim()) { setError('Informe o nome do grupo.'); return } try { await onSaved(name.trim()) } catch (e) { setError(errorText(e)) } }; return <ModalLayer onClose={onClose}><form onSubmit={save}><div className="modal-head"><div><span className="eyebrow">GRUPOS</span><h2>Novo grupo</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{error && <div className="alert error" role="alert">{error}</div>}<label htmlFor="new-category-name">Nome<input id="new-category-name" autoFocus value={name} onChange={e => setName(e.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary">Criar</button></div></form></ModalLayer> }

export function CommitmentMenu({ item, onDetails, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const close = () => setOpen(false)
  const toggle = event => {
    event.stopPropagation()
    if (open) { close(); return }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPosition({ top: rect.bottom + 6, left: Math.max(8, rect.right - 168) })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = event => {
      if (!triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) close()
    }
    const onKeyDown = event => { if (event.key === 'Escape') close() }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown) }
  }, [open])

  const menu = open && typeof document !== 'undefined' ? createPortal(<div ref={menuRef} className="commitment-static-menu" role="menu" style={{ top: position.top, left: position.left }}><button type="button" role="menuitem" onClick={() => { close(); onDetails() }}>Adicionar reserva</button><button type="button" role="menuitem" onClick={() => { close(); onDetails() }}>Retirar reserva</button><button type="button" role="menuitem" onClick={() => { close(); onEdit() }}>Editar</button><button type="button" role="menuitem" onClick={() => { close(); onDetails() }}>Ver histórico</button><button type="button" role="menuitem" className="is-danger" onClick={() => { close(); onDelete() }}>Excluir</button></div>, document.body) : null
  return <><button ref={triggerRef} type="button" className="commitment-static-menu-trigger" aria-label={`Mais ações para ${item.name}`} aria-expanded={open} title="Mais ações" onClick={toggle}>⋯</button>{menu}</>
}

export function CommitmentDetailsDrawer({ item, availableBalance, priority, onClose, onEdit, onDelete, onChange }) {
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(item.automaticProcessingWarning || '')
  const [confirmRelease, setConfirmRelease] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [invalidAllocation, setInvalidAllocation] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const available = Math.max(0, Number(availableBalance) || 0)
  const missingFull = Math.max(0, Number(item.missingForFullCoverage) || 0)
  const reserved = Math.max(0, Number(item.allocatedAmount) || 0)

  const showInvalid = (operation, value, allowed, reason) => setInvalidAllocation({ operation, value: Number.isFinite(value) ? value : 0, allowed, reason })
  const mutate = async (action, operation = null) => {
    setBusy(true)
    setMessage('')
    try {
      await action()
      setAmount('')
      await onChange()
    } catch (e) {
      if (operation) showInvalid(operation.type, operation.value, operation.allowed, errorText(e))
      else setMessage(errorText(e))
    } finally { setBusy(false) }
  }
  const submitAllocation = () => {
    const value = parseAmount(amount)
    const allowed = Math.min(available, missingFull)
    if (!Number.isFinite(value) || value <= 0) return showInvalid('allocation', Number.isFinite(value) ? value : 0, allowed, 'Informe um valor de reserva maior que zero.')
    if (value > allowed) return showInvalid('allocation', value, allowed)
    mutate(() => api.allocate(item.id, value), { type: 'allocation', value, allowed })
  }
  const submitWithdrawal = () => {
    const value = parseAmount(amount)
    if (!Number.isFinite(value) || value <= 0) return showInvalid('withdrawal', Number.isFinite(value) ? value : 0, reserved, 'Informe um valor para retirar maior que zero.')
    if (value > reserved) return showInvalid('withdrawal', value, reserved, `A retirada não pode exceder a reserva atual de ${money(reserved)}.`)
    mutate(() => api.deallocate(item.id, value), { type: 'withdrawal', value, allowed: reserved })
  }
  const allocateNext = () => {
    const needed = Math.max(0, Number(item.missingForNextInstallment) || 0)
    if (needed <= 0) return
    if (available <= 0) return showInvalid('allocation', needed, available, 'Não há saldo não alocado disponível para esta operação.')
    mutate(() => api.allocateNextInstallment(item.id), { type: 'allocation', value: needed, allowed: available })
  }
  const allocateRemaining = () => {
    if (missingFull <= 0) return
    if (available <= 0) return showInvalid('allocation', missingFull, available, 'Não há saldo não alocado disponível para esta operação.')
    mutate(() => api.allocateAvailable(item.id), { type: 'allocation', value: missingFull, allowed: available })
  }
  const deleteCommitment = async () => { setDeleting(true); setDeleteError(''); try { await onDelete(); setConfirmDelete(false); onClose() } catch (e) { setDeleteError(errorText(e)) } finally { setDeleting(false) } }
  const history = item.occurrences?.length ? item.occurrences.map(occurrence => ({
    id: occurrence.id,
    number: occurrence.installmentNumber,
    paid: occurrence.status === 'Paid',
    current: occurrence.status === 'Pending',
    reserved: occurrence.status === 'Paid' ? occurrence.amount : 0,
    missing: occurrence.status === 'Paid' ? 0 : occurrence.amount,
    dueDate: occurrence.scheduledDate,
    amount: occurrence.amount,
    status: occurrence.status,
  })) : Array.from({ length: item.isOpenEnded ? Math.min(item.paidInstallments + 1, 24) : item.totalInstallments }, (_, index) => { const paid = index < item.paidInstallments; const current = index === item.paidInstallments; const reservedAmount = paid ? item.installmentAmount : current ? Math.min(item.allocatedForNextInstallment, item.installmentAmount) : 0; return { number: index + 1, paid, current, reserved: reservedAmount, missing: Math.max(0, item.installmentAmount - reservedAmount), dueDate: addMonths(item.dueDate, index), amount: item.installmentAmount, status: paid ? 'Paid' : current ? 'Pending' : 'Planned' } })
  const releaseAll = async () => { setConfirmRelease(false); await mutate(() => api.releaseAllAllocation(item.id)) }
  const releaseConfirmation = confirmRelease && <ModalLayer backdropClassName="release-confirm-backdrop" className="release-confirm-modal" onClose={() => setConfirmRelease(false)}><div className="release-confirm-heading"><span aria-hidden="true">!</span><h2>Retirar toda a reserva?</h2></div><p>{money(item.allocatedAmount)} voltarão a ficar disponíveis para novas alocações. O compromisso continuará ativo.</p><div className="release-confirm-actions"><button type="button" className="secondary" onClick={() => setConfirmRelease(false)}>Cancelar</button><button type="button" className="release-confirm-button" onClick={releaseAll}>Retirar reserva</button></div></ModalLayer>
  const overallCoverage = Number(item.overallCoveragePercentage)
  const urgentUncovered = Boolean(item.requiresAttention)
  const nextDueDate = item.nextDueDate || addMonths(item.dueDate, item.paidInstallments)
  const missingForNext = Number(item.remainingForNextInstallment)
  const status = item.isCompleted ? ['Concluído', 'complete'] : ['Ativo', 'active']
  const footer = <><div className="commitment-drawer-actions"><div className="commitment-drawer-action-copy">{urgentUncovered && <span className="urgent-critical-message" role="alert">⚠ Faltam <strong>{money(item.overallRemainingAmount ?? item.remainingAmount)}</strong></span>}<small>Ações do compromisso</small></div><div className="commitment-drawer-action-buttons"><button className="secondary" onClick={onEdit} disabled={busy || deleting}>Editar compromisso</button><button className="danger-button" onClick={() => setConfirmDelete(true)} disabled={busy || deleting}>Excluir compromisso</button></div></div>{confirmDelete && <ConfirmModal title="Excluir compromisso?" message={`“${item.name}” será excluído permanentemente. As reservas e alocações vinculadas também serão removidas.`} confirmLabel="Excluir compromisso" busy={deleting} busyLabel="Excluindo…" error={deleteError} tone="danger" onClose={() => { if (!deleting) setConfirmDelete(false) }} onConfirm={deleteCommitment} />}{invalidAllocation && <AlertModal title={invalidAllocation.operation === 'withdrawal' ? 'Valor para retirar inválido' : 'Valor de reserva inválido'} message={invalidAllocation.reason || `Disponível: ${money(invalidAllocation.allowed)}. Valor solicitado: ${money(invalidAllocation.value)}.`} onClose={() => setInvalidAllocation(null)} />}</>
  const statusLabel = item.isCompleted ? 'Pago' : item.canPay ? 'Coberto' : overallCoverage > 0 ? 'Parcialmente reservado' : 'Pendente'
  const badges = <span className={`commitment-drawer-status ${item.isCompleted ? 'is-complete' : item.canPay ? 'is-covered' : ''}`}>{statusLabel}</span>
  const metadata = [item.categoryName || 'Sem grupo', item.isOpenEnded ? `${frequencyLabels[item.frequency] || 'Recorrente'} · sem término` : item.isRecurring ? frequencyLabels[item.frequency] || 'Recorrente' : 'Pagamento único', priority && `Prioridade ${priority.toLowerCase()}`].filter(Boolean).join(' · ')
  return <AppDrawer className="commitment-detail-drawer" eyebrow="COMPROMISSO" title={item.name} titleId="commitment-drawer-title" badges={badges} footer={footer} onClose={onClose}>
    <p className="commitment-drawer-metadata">{metadata}</p>
    <div className="commitment-drawer-status-row">{item.urgent && <span className="commitment-drawer-urgent">Urgente</span>}{item.automaticProcessing && <span className="commitment-drawer-automatic">Pagamento automático ativado</span>}</div>
    {item.automaticProcessingWarning && <p className="commitment-drawer-warning" role="alert">{item.automaticProcessingWarning}</p>}
    <section className="commitment-drawer-section commitment-drawer-financial-summary"><h3>Resumo financeiro</h3><div className="commitment-drawer-facts"><span><small>Valor por cobrança</small><strong>{money(item.installmentAmount)}</strong></span><span title="Parte do saldo atual separada para este compromisso"><small>Reservado</small><strong>{money(item.allocatedAmount)}</strong></span><span title="Valor da próxima cobrança que ainda não possui reserva"><small>Ainda sem cobertura</small><strong>{money(item.missingForNextInstallment)}</strong></span><span><small>Próximo vencimento</small><strong>{nextDueDate ? formatDate(nextDueDate) : 'Nenhum'}</strong></span></div></section>
    <section className="commitment-drawer-section commitment-drawer-coverage"><div className="commitment-drawer-section-heading"><h3>Cobertura da próxima cobrança</h3><strong>{Math.round(Number(item.coveragePercentage) || 0)}%</strong></div><div className="commitment-drawer-progress"><span style={{ width: `${Math.min(100, Math.max(0, Number(item.coveragePercentage) || 0))}%` }} /></div><p>{money(item.allocatedForNextInstallment ?? item.allocatedAmount)} de {money(item.installmentAmount)} reservado</p></section>
    <section className="commitment-drawer-section commitment-drawer-controls"><div className="commitment-drawer-section-heading"><h3>Reserva</h3><small>Disponível {money(available)}</small></div><label className="drawer-field">Valor para reservar ou retirar<input inputMode="decimal" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} /></label><div className="commitment-drawer-action-row"><button className="primary" disabled={busy || missingFull <= 0} onClick={submitAllocation}>Reservar</button><button className="secondary" disabled={busy || Number(item.missingForNextInstallment) <= 0} onClick={allocateNext}>Reservar próxima cobrança</button><button className="secondary" disabled={busy || missingFull <= 0} onClick={allocateRemaining}>Completar cobertura</button></div><div className="commitment-drawer-withdrawal"><span>Retirar reserva</span><button className="tertiary" disabled={busy || reserved <= 0} onClick={submitWithdrawal}>Retirar valor informado</button>{item.allocatedAmount > 0 && <button className="tertiary" disabled={busy} onClick={() => setConfirmRelease(true)}>Retirar tudo</button>}</div><p className="commitment-drawer-current-reserve">Reserva atual <strong>{money(item.allocatedAmount)}</strong></p></section>
    <section className="commitment-drawer-section commitment-drawer-payment"><div className="commitment-drawer-section-heading"><h3>Pagamento</h3><small>{item.canPay ? 'Cobertura suficiente' : 'Reserve o valor completo da próxima cobrança para habilitar o pagamento.'}</small></div>{item.isCompleted ? <span className="commitment-drawer-complete-note">Compromisso concluído</span> : <button className="pay-button" disabled={busy || !item.canPay} onClick={() => mutate(() => api.payInstallment(item.id))}>Marcar como pago</button>}{item.paidInstallments > 0 && <button className="tertiary undo-payment" disabled={busy} onClick={() => mutate(async () => { await api.reversePayment(item.id); setMessage('Pagamento desfeito. Reserva e saldo restaurados.') })}>Desfazer último pagamento</button>}</section>
    <section className="commitment-drawer-section commitment-drawer-installment-section"><div className="commitment-drawer-section-heading"><h3>Ocorrências e histórico</h3><small>{item.isOpenEnded ? 'Recorrência sem término definido' : `${item.paidInstallments} de ${item.totalInstallments} pagas`}</small></div><div className="drawer-installments">{history.map(row => <div className={`drawer-installment ${row.paid ? 'is-paid' : row.current ? 'is-current' : ''}`} key={row.id || row.number}><div><strong>{item.isOpenEnded ? 'Cobrança' : 'Parcela'} {row.number}</strong><small>{formatDate(row.dueDate)} · {row.paid ? 'Paga' : row.status === 'Cancelled' ? 'Cancelada' : row.current ? 'Pendente' : 'Prevista'}</small></div><div><strong>{money(row.amount)}</strong>{row.paid ? <button type="button" className="tertiary" disabled={busy} onClick={() => mutate(() => api.reverseCommitmentOccurrencePayment(item.id, row.id))}>Desfazer</button> : row.current && <button type="button" className="pay-button" disabled={busy} onClick={() => mutate(() => api.payCommitmentOccurrence(item.id, row.id))}>Pagar</button>}</div></div>)}</div></section>
    {message && <div className="inline-error" role="status">{message}</div>}
    {item.objective && <section className="commitment-drawer-section commitment-drawer-objective"><h3>Objetivo</h3><p>{item.objective}</p></section>}
    {releaseConfirmation}
  </AppDrawer>
}

export function CommitmentModal({ item, categories, businessDate: referenceDate, onClose, onSaved }) {
  const today = referenceDate?.slice(0, 10) || businessToday()
  const [form, setForm] = useState({ name: item.name || '', installmentAmount: item.installmentAmount || '', frequency: item.frequency || 'Monthly', endDate: item.endDate || '', priority: item.priority ?? '', categoryId: item.categoryId || '', automaticProcessing: item.automaticProcessing ?? false, urgent: item.urgent ?? false, dueDate: item.dueDate || today, objective: item.objective || '' }); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const update = (key, value) => setForm(x => ({ ...x, [key]: value }))
  const recurrencePreview = useMemo(() => getCommitmentRecurrencePreview(form), [form.dueDate, form.frequency, form.endDate])
  const recurrenceLastDate = recurrencePreview.kind === 'scheduled' ? recurrencePreview.occurrences[recurrencePreview.occurrences.length - 1] : ''
  const recurrencePreviewContent = recurrencePreview.kind === 'open' ? <p>Sem data final. O compromisso continuará recorrendo até ser editado ou encerrado.</p> : recurrencePreview.kind === 'missing-start' || recurrencePreview.kind === 'invalid' ? <p>{recurrencePreview.message}</p> : recurrencePreview.kind === 'scheduled' ? <div className="recurrence-preview-summary"><strong>{recurrencePreview.occurrences.length} {recurrencePreview.occurrences.length === 1 ? 'cobrança prevista' : 'cobranças previstas'}</strong><span>Primeira: {formatDate(recurrencePreview.occurrences[0])}</span><small>Última: {formatDate(recurrenceLastDate)}</small></div> : null
  const recurrencePreviewBlock = form.frequency === 'Once' ? null : <section className={`form-callout form-callout--${recurrencePreview.kind === 'invalid' ? 'error' : 'info'} recurrence-preview`} aria-live="polite" role={recurrencePreview.kind === 'invalid' ? 'alert' : 'status'}>{recurrencePreviewContent}</section>
  const save = async e => { e.preventDefault(); if (saving) return; setError(''); const amount = parseAmount(form.installmentAmount); if (!form.name.trim()) return setError('Informe o nome do compromisso.'); if (!Number.isFinite(amount) || amount <= 0) return setError('Informe um valor válido.'); if (!form.dueDate) return setError('Informe o primeiro vencimento.'); if (form.frequency !== 'Once' && form.endDate && form.endDate < form.dueDate) return setError('A data de término deve ser igual ou posterior ao primeiro vencimento.'); const payload = { name: form.name.trim(), installmentAmount: amount, totalInstallments: null, frequency: form.frequency, priority: form.priority ? Number(form.priority) : null, automaticProcessing: form.automaticProcessing, urgent: form.urgent, categoryId: form.categoryId || null, dueDate: form.dueDate, endDate: form.frequency === 'Once' ? form.dueDate : (form.endDate || null), objective: form.objective.trim() || null }; setSaving(true); try { if (item.id) await api.updateCommitment(item.id, payload); else await api.createCommitment(payload); onSaved() } catch (e) { setError(errorText(e)); setSaving(false) } }
  const isEditingPaid = Boolean(item.id && item.paidInstallments > 0)
  return <div className="modal-backdrop"><form className="modal commitment-form-modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">COMPROMISSO</span><h2>{item.id ? 'Editar compromisso' : 'Novo compromisso'}</h2></div><button type="button" className="icon-button" onClick={onClose} disabled={saving} aria-label="Fechar">×</button></div>{error && <div className="alert error" role="alert">{error}</div>}
    <section className="commitment-form-section"><h3>Informações principais</h3><label>Nome<input autoFocus required placeholder="Ex.: Netflix" value={form.name} onChange={e => update('name', e.target.value)} /></label><div className="commitment-form-grid"><label>Valor da cobrança<input required inputMode="decimal" placeholder="0,00" value={form.installmentAmount} onChange={e => update('installmentAmount', e.target.value)} /></label><label>Primeiro vencimento<input required type="date" disabled={isEditingPaid} value={form.dueDate} onChange={e => update('dueDate', e.target.value)} />{isEditingPaid && <small className="commitment-form-hint">A primeira data não pode ser alterada após um pagamento.</small>}</label><label>Grupo<select value={form.categoryId || ''} onChange={e => update('categoryId', e.target.value || null)}><option value="">Sem grupo</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div></section>
    <section className="commitment-form-section"><h3>Recorrência</h3><label>Frequência<select value={form.frequency} onChange={e => update('frequency', e.target.value)}>{Object.entries(frequencyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>{form.frequency !== 'Once' && <><label>Data de término <span className="field-hint">(opcional)</span><input type="date" value={form.endDate} onChange={e => update('endDate', e.target.value)} aria-invalid={recurrencePreview.kind === 'invalid'} /></label>{recurrencePreviewBlock}</>}{form.frequency === 'Once' && <p className="commitment-form-hint">Pagamento único em {form.dueDate ? formatDate(form.dueDate) : 'uma data ainda não definida'}.</p>}</section>
    <section className="commitment-form-section commitment-form-disclosure" aria-labelledby="commitment-form-options-title"><div className="commitment-form-section-heading"><div><h3 id="commitment-form-options-title">Mais opções <span className="commitment-form-optional">(opcional)</span></h3><p className="commitment-form-section-description">Configurações que ajudam a definir como este compromisso será acompanhado e processado.</p></div></div><div className="commitment-form-options"><label className="commitment-form-option commitment-form-priority-option"><span>Prioridade</span><select value={form.priority} onChange={e => update('priority', e.target.value || null)}><option value="">Sem prioridade</option><option value="3">Baixa</option><option value="2">Média</option><option value="1">Alta</option></select></label><CheckboxOption checked={form.automaticProcessing} onChange={e => update('automaticProcessing', e.target.checked)} title="Pagamento automático no vencimento" description="Quando houver valor reservado suficiente, a cobrança poderá ser processada automaticamente." /><CheckboxOption checked={form.urgent} onChange={e => update('urgent', e.target.checked)} title="Marcar como urgente" description="Mantém este compromisso em destaque enquanto houver valor pendente." variant="urgent" /></div></section>
    <section className="commitment-form-section"><h3>Objetivo <span className="commitment-form-optional">Opcional</span></h3><textarea rows="3" placeholder="Para que você está reservando este valor?" value={form.objective} onChange={e => update('objective', e.target.value)} /></section>
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? 'Salvando…' : item.id ? 'Salvar alterações' : 'Criar compromisso'}</button></div>
  </form></div>
}
