import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { api } from '../../../services/api.js'
import { businessDate } from '../../../utils/businessDate.js'

const today = referenceDate => businessDate(referenceDate)
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
const parseAmount = value => { const normalized = String(value).trim().replace(',', '.'); if (!normalized || !/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN; return Number(normalized) }
const errorText = error => error?.message || 'Não foi possível concluir a operação.'

function PortalModal({ title, children, onClose, labelledBy }) {
  const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const close = event => { if (event.key === 'Escape') onCloseRef.current() }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', close)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', close); if (opener.current instanceof HTMLElement && document.contains(opener.current)) opener.current.focus() }
  }, [])
  return createPortal(<div className="movement-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className="movement-modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}><header className="movement-modal-header"><div><span className="eyebrow">MOVIMENTAÇÃO</span><h2 id={labelledBy}>{title}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></header>{children}</div></div>, document.body)
}

function InsufficientBalanceModal({ amount, balance, onCancel, onConfirm, busy }) {
  return <PortalModal title="Saldo insuficiente" labelledBy="insufficient-balance-title" onClose={onCancel}><div className="movement-confirm-copy"><AlertTriangle size={20} aria-hidden="true" /><p>O valor desta saída é maior que o saldo disponível. Deseja registrar mesmo assim?</p></div><dl className="movement-confirm-values"><div><dt>Valor da saída</dt><dd>{money(amount)}</dd></div><div><dt>Saldo disponível</dt><dd>{money(balance)}</dd></div></dl><div className="movement-modal-actions"><button type="button" className="secondary" onClick={onCancel} disabled={busy}>Cancelar</button><button type="button" className="danger-button" onClick={onConfirm} disabled={busy}>{busy ? 'Registrando…' : 'Registrar mesmo assim'}</button></div></PortalModal>
}

export default function MovementFormModal({ mode, item, categories, currentBalance, businessDate: referenceDate, onClose, onSaved }) {
  const isEdit = Boolean(item)
  const type = item?.type || (mode === 'create-expense' ? 'Expense' : 'Income')
  const isExpense = type === 'Expense'
  const [form, setForm] = useState(() => ({ description: item?.description || '', amount: item ? String(item.amount).replace('.', ',') : '', categoryId: item?.categoryId || '', date: item?.date?.slice(0, 10) || today(referenceDate) }))
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [insufficient, setInsufficient] = useState(false)

  const update = (key, value) => { setForm(current => ({ ...current, [key]: value })); setFieldErrors(current => ({ ...current, [key]: '' })); setError('') }
  const validate = () => {
    const next = {}
    if (!form.description.trim()) next.description = `Informe a descrição da ${isExpense ? 'saída' : 'entrada'}.`
    else if (form.description.trim().length > 250) next.description = 'Use no máximo 250 caracteres.'
    const amount = parseAmount(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) next.amount = 'Informe um valor maior que zero.'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) next.date = 'Informe uma data válida.'
    setFieldErrors(next)
    return Object.keys(next).length === 0 ? amount : null
  }
  const submit = async event => {
    event.preventDefault()
    const amount = validate()
    if (amount === null) return
    if (!isEdit && isExpense && amount > Number(currentBalance || 0) && !insufficient) { setInsufficient(true); return }
    setSaving(true); setError('')
    try {
      const payload = { description: form.description.trim(), amount, date: form.date, categoryId: form.categoryId || null, type }
      if (isEdit) await api.updateTransaction(item.id, payload)
      else if (isExpense) await api.createExpense(payload)
      else await api.createIncome(payload)
      await onSaved(isEdit ? 'Movimentação atualizada.' : isExpense ? 'Saída registrada.' : 'Entrada registrada.')
    } catch (cause) { setError(errorText(cause)) } finally { setSaving(false); setInsufficient(false) }
  }
  const title = isEdit ? `Editar ${isExpense ? 'saída' : 'entrada'}` : `Nova ${isExpense ? 'saída' : 'entrada'}`
  return <>
    <PortalModal title={title} labelledBy="movement-form-title" onClose={() => { if (!saving) onClose() }}><form className="movement-form" onSubmit={submit} noValidate>
      {error && <div className="alert error" role="alert">{error}</div>}
      <label>Descrição<input autoFocus value={form.description} onChange={event => update('description', event.target.value)} maxLength="250" aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? 'movement-description-error' : undefined} />{fieldErrors.description && <small id="movement-description-error" className="movement-field-error">{fieldErrors.description}</small>}</label>
      <label>Valor<input inputMode="decimal" placeholder="0,00" value={form.amount} onChange={event => update('amount', event.target.value)} aria-invalid={Boolean(fieldErrors.amount)} aria-describedby={fieldErrors.amount ? 'movement-amount-error' : undefined} />{fieldErrors.amount && <small id="movement-amount-error" className="movement-field-error">{fieldErrors.amount}</small>}</label>
      <label>Grupo<select value={form.categoryId} onChange={event => update('categoryId', event.target.value)}><option value="">Sem grupo</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label>Data<input type="date" value={form.date} onChange={event => update('date', event.target.value)} aria-invalid={Boolean(fieldErrors.date)} aria-describedby={fieldErrors.date ? 'movement-date-error' : undefined} />{fieldErrors.date && <small id="movement-date-error" className="movement-field-error">{fieldErrors.date}</small>}</label>
      <div className="movement-modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? 'Salvando…' : isEdit ? 'Salvar alterações' : isExpense ? 'Salvar saída' : 'Salvar entrada'}</button></div>
    </form></PortalModal>
    {insufficient && <InsufficientBalanceModal amount={parseAmount(form.amount)} balance={currentBalance} busy={saving} onCancel={() => setInsufficient(false)} onConfirm={() => { setInsufficient(false); document.querySelector('.movement-form')?.requestSubmit() }} />}
  </>
}
