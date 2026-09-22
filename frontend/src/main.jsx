import React, { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import ErrorBoundary from './ErrorBoundary.jsx'
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BarChart3, BadgeCheck, Bell, Calculator,
  CalendarDays, ChevronDown, ChevronRight, ChevronUp, CircleAlert, CircleCheck, Eye, Filter,
  Folder, LayoutDashboard, List, Pencil, Plus, RotateCw, Settings, ShieldCheck,
  Search, Moon, Sun, Trash2, TriangleAlert, Undo2, UserCircle, Users, Wallet, ArrowDownToLine, ArrowUpFromLine, Mail, LifeBuoy,
} from 'lucide-react'
import { api, apiAvailabilityEvents } from './services/api'
import { CheckboxOption } from './components/CheckboxOption'
import FinancialForecastPage from './pages/FinancialForecastPage.jsx'
import './styles.css'
import './balance.css'
import './payment.css'
import './transactions.css'
import './dashboard.css'
import './semantic.css'
import './dashboard-compact.css'
import './theme.css'
import './calculator.css'
import './responsive-system.css'
import './commitment-static-card.css'
import './account.css'
import './profile-page.css'
import './navigation.css'
import './ux-overhaul.css'

const iconProps = { size: 18, strokeWidth: 1.8, 'aria-hidden': true, focusable: false }
const Icon = ({ icon: Glyph, size, className = '' }) => <Glyph {...iconProps} size={size ?? iconProps.size} className={className} />

function InfoTooltip({ title, description, placement = 'top' }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState(null)
  const tooltipId = useId()
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)
  const closeTimer = useRef(null)
  const setOpenFromPointer = value => {
    window.clearTimeout(closeTimer.current)
    if (value) setOpen(true)
    else closeTimer.current = window.setTimeout(() => setOpen(false), 120)
  }

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popoverRef.current) return undefined
    const updatePosition = () => {
      const trigger = triggerRef.current.getBoundingClientRect()
      const popover = popoverRef.current.getBoundingClientRect()
      const gap = 8
      const edge = 16
      const placements = placement === 'top' ? ['top', 'bottom', 'right', 'left'] : [placement, 'top', 'bottom', 'right', 'left']
      const fits = (side, width, height) => side === 'top' ? trigger.top >= height + gap : side === 'bottom' ? window.innerHeight - trigger.bottom >= height + gap : side === 'left' ? trigger.left >= width + gap : window.innerWidth - trigger.right >= width + gap
      const side = placements.find(candidate => fits(candidate, popover.width, popover.height)) || placements[0]
      let top = side === 'top' ? trigger.top - popover.height - gap : side === 'bottom' ? trigger.bottom + gap : trigger.top + (trigger.height - popover.height) / 2
      let left = side === 'left' ? trigger.left - popover.width - gap : side === 'right' ? trigger.right + gap : trigger.left + (trigger.width - popover.width) / 2
      left = Math.max(edge, Math.min(left, window.innerWidth - popover.width - edge))
      top = Math.max(edge, Math.min(top, window.innerHeight - popover.height - edge))
      setPosition({ top, left, side })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => { window.removeEventListener('resize', updatePosition); window.removeEventListener('scroll', updatePosition, true) }
  }, [open, placement, title, description])

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  const tooltip = open && typeof document !== 'undefined' ? createPortal(<span ref={popoverRef} id={tooltipId} className={`info-tooltip-popover ${position ? `is-positioned info-tooltip-${position.side}` : ''}`} role="tooltip" style={position ? { top: position.top, left: position.left } : undefined} onMouseEnter={() => setOpenFromPointer(true)} onMouseLeave={() => setOpenFromPointer(false)}>
    <strong>{title}</strong><span>{description}</span>
  </span>, document.body) : null

  return <span className={`info-tooltip${open ? ' is-open' : ''}`} onMouseEnter={() => setOpenFromPointer(true)} onMouseLeave={() => setOpenFromPointer(false)}>
    <button ref={triggerRef} type="button" className="info-tooltip-trigger" aria-label={`Informações: ${title}`} aria-describedby={open ? tooltipId : undefined} aria-expanded={open} onClick={() => { window.clearTimeout(closeTimer.current); setOpen(value => !value) }} onFocus={() => setOpen(true)} onBlur={() => setOpenFromPointer(false)} onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}>
      <span aria-hidden="true">i</span>
    </button>
    {tooltip}
  </span>
}

const formatCurrency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
const money = formatCurrency
const signedMoney = (value, positive = '+') => `${Number(value) < 0 ? '-' : positive} ${formatCurrency(Math.abs(Number(value) || 0))}`
const errorText = error => error?.message || 'Não foi possível concluir a operação.'
const optionalCategoryId = value => typeof value === 'string' ? (value.trim() ? value : null) : (value ?? null)
const parseAmount = value => { const normalized = String(value).trim().replace(',', '.'); if (!normalized || !/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN; return Number(normalized) }
const formatDecimalInput = value => { const numeric = Number(value); return Number.isFinite(numeric) ? numeric.toFixed(2).replace('.', ',') : '' }
const addMonths = (date, months, dayOfMonth = null) => { if (!date) return ''; const [year, month, day] = date.slice(0, 10).split('-').map(Number); const result = new Date(Date.UTC(year, month - 1 + months, 1)); const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate(); result.setUTCDate(Math.min(dayOfMonth ?? day, lastDay)); return result.toISOString().slice(0, 10) }
const addDays = (date, days) => { if (!date) return ''; const [year, month, day] = date.slice(0, 10).split('-').map(Number); const result = new Date(Date.UTC(year, month - 1, day + days)); return result.toISOString().slice(0, 10) }
const recurrenceMonthSteps = { Monthly: 1, Bimonthly: 2, Quarterly: 3, Semiannual: 6, Annual: 12 }
const parseDateInput = value => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null; const [year, month, day] = value.split('-').map(Number); const date = new Date(Date.UTC(year, month - 1, day)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? { year, month, day } : null }
const nextCommitmentOccurrence = (date, frequency, dayOfMonth) => frequency === 'Weekly' ? addDays(date, 7) : frequency === 'Fortnightly' ? addDays(date, 14) : recurrenceMonthSteps[frequency] ? addMonths(date, recurrenceMonthSteps[frequency], dayOfMonth) : ''
const generateCommitmentOccurrences = (firstDueDate, frequency, endDate) => { const first = parseDateInput(firstDueDate); const end = endDate ? parseDateInput(endDate) : null; if (!first || !endDate || !end || endDate < firstDueDate) return []; const start = firstDueDate; if (frequency === 'Once') return [start]; const occurrences = []; const anchorDay = first.day; let current = start; while (current <= endDate) { occurrences.push(current); current = nextCommitmentOccurrence(current, frequency, anchorDay); if (!current) break } return occurrences }
const getCommitmentRecurrencePreview = ({ dueDate, frequency, endDate }) => { if (frequency === 'Once') return { kind: 'once' }; if (!dueDate) return { kind: 'missing-start', message: 'Informe o primeiro vencimento para visualizar a previsão.' }; if (!parseDateInput(dueDate)) return { kind: 'invalid', message: 'Informe um primeiro vencimento válido.' }; if (endDate && !parseDateInput(endDate)) return { kind: 'invalid', message: 'Informe uma data de término válida.' }; if (endDate && endDate < dueDate) return { kind: 'invalid', message: 'A data de término deve ser igual ou posterior ao primeiro vencimento.' }; if (!endDate) return { kind: 'open' }; const occurrences = generateCommitmentOccurrences(dueDate, frequency, endDate); return occurrences.length ? { kind: 'scheduled', occurrences } : { kind: 'invalid', message: 'Não foi possível calcular as cobranças para esse período.' } }
const monthDistance = (from, to) => { const [fromYear, fromMonth] = String(from).slice(0, 7).split('-').map(Number); const [toYear, toMonth] = String(to).slice(0, 7).split('-').map(Number); return (toYear - fromYear) * 12 + toMonth - fromMonth + 1 }
const formatDate = date => date ? new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data informada'
const formatMonthYear = month => new Date(`${String(month).slice(0, 7)}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
const THEME_STORAGE_KEY = 'theme'
const ThemeContext = createContext(null)

// Keep every global layer in one place so local stacking contexts cannot change the order.
const LAYER_TOKENS = Object.freeze({
  page: 0,
  popover: 700,
  drawerBackdrop: 800,
  drawer: 810,
  modalBackdrop: 900,
  modal: 910,
  toast: 1000,
})

function ModalLayer({ children, onClose }) {
  const openerRef = useRef(typeof document !== 'undefined' ? document.activeElement : null)
  const contentRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const content = contentRef.current
    const focusable = () => [...content?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') || []]
    const focusInitial = () => { const target = content?.querySelector('[autofocus]') || focusable()[0]; target?.focus() }
    const frame = window.requestAnimationFrame(focusInitial)
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current?.()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (openerRef.current instanceof HTMLElement && document.contains(openerRef.current)) openerRef.current.focus()
    }
  }, [])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="modal-backdrop" data-modal-layer style={{ zIndex: LAYER_TOKENS.modalBackdrop }} onMouseDown={event => { if (event.target === event.currentTarget) onCloseRef.current?.() }}>
      <div ref={contentRef} className="modal" role="dialog" aria-modal="true" style={{ zIndex: LAYER_TOKENS.modal }}>{children}</div>
    </div>,
    document.body,
  )
}

function AccountDialog({ mode, initialUsername = '', initialDisplayName = '', initialEmail = '', onClose, onSubmit }) {
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [username, setUsername] = useState(initialUsername)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [email, setEmail] = useState(initialEmail)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const title = mode === 'protect' ? 'Proteger conta' : mode === 'login' ? 'Entrar em conta protegida' : mode === 'password' ? 'Alterar senha' : mode === 'rename' ? 'Renomear conta' : 'Adicionar conta'
  const submit = async event => { event.preventDefault(); setError(''); if (mode === 'create-local' && !email.trim()) return setError('Informe o e-mail.'); if ((mode === 'protect' || mode === 'login' || mode === 'password') && !password.trim()) return setError('Informe a senha.'); if ((mode === 'protect' || mode === 'password') && password !== confirmPassword) return setError('As senhas não conferem.'); if ((mode === 'protect' || mode === 'rename' || mode === 'create-local') && !displayName.trim()) return setError('Informe o nome visual da conta.'); if ((mode === 'login' || mode === 'protect') && !username.trim()) return setError('Informe o username.'); if ((mode === 'protect' || mode === 'create-local') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Informe um e-mail válido.'); setBusy(true); try { await onSubmit(mode, { displayName, username, email, password, confirmPassword, currentPassword }); } catch (e) { setError(errorText(e)) } finally { setBusy(false) } }
  if (mode === 'add') return <ModalLayer onClose={onClose}><div className="modal-head"><div><span className="eyebrow">CONTAS</span><h2>Adicionar conta</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div><p className="modal-copy">Crie uma nova conta local ou entre em uma conta protegida existente.</p><div className="account-add-options"><button type="button" className="secondary" onClick={() => onSubmit('create-local-form', {})} disabled={busy}>Criar nova conta local</button><button type="button" className="primary" onClick={() => onSubmit('login-form', {})} disabled={busy}>Entrar em conta protegida</button></div>{error && <div className="alert error">{error}</div>}</ModalLayer>
  return <ModalLayer onClose={onClose}><form onSubmit={submit}><div className="modal-head"><div><span className="eyebrow">CONTAS</span><h2>{mode === 'create-local' ? 'Criar conta local' : title}</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div>{mode === 'login' && <p className="modal-copy">Use o username e a senha da conta. Seus dados serão carregados no contexto correto.</p>}{mode === 'create-local' && <p className="modal-copy">O e-mail será usado para identificar sua conta e não fica visível para outros usuários.</p>}{error && <div className="alert error">{error}</div>}{(mode === 'protect' || mode === 'rename' || mode === 'create-local') && <label>Nome da conta<input autoFocus value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength="80" /></label>}{(mode === 'protect' || mode === 'create-local') && <label>E-mail<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength="254" /></label>}{(mode === 'protect' || mode === 'login') && <label>Username<input autoFocus={mode === 'login'} autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} maxLength="64" /></label>}{mode === 'password' && <label>Senha atual<input autoFocus type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label>}{(mode === 'protect' || mode === 'login' || mode === 'password') && <label>{mode === 'password' ? 'Nova senha' : 'Senha'}<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>}{(mode === 'protect' || mode === 'password') && <label>Confirmar senha<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>}{(mode === 'protect' || mode === 'create-local') && <small className="field-hint">O e-mail deve ser válido. A senha precisa ter 8 caracteres, letra maiúscula, minúscula e número.</small>}{mode === 'login' && <small className="field-hint">Use o username e a senha da conta protegida.</small>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button><button type="submit" className="primary" disabled={busy}>{busy ? 'Processando…' : mode === 'login' ? 'Entrar' : mode === 'protect' ? 'Proteger conta' : mode === 'password' ? 'Alterar senha' : 'Criar conta'}</button></div></form></ModalLayer>
}

function AccountDeleteModal({ displayName, isLocal, onClose, onConfirm }) {
  const [confirmation, setConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const expected = isLocal ? 'APAGAR MINHA CONTA' : displayName
  const submit = async event => { event.preventDefault(); if (busy) return; setError(''); if (confirmation.trim() !== expected) return setError(`Digite exatamente ${expected} para confirmar.`); if (!isLocal && !password) return setError('Informe a senha atual da conta.'); setBusy(true); try { await onConfirm({ confirmation, password: isLocal ? undefined : password }) } catch (e) { setError(errorText(e)); setBusy(false) } }
  return <ModalLayer onClose={() => { if (!busy) onClose() }}><form onSubmit={submit}><div className="modal-head"><div><span className="eyebrow">AÇÃO DESTRUTIVA</span><h2>Excluir conta</h2></div><button type="button" className="icon-button" onClick={onClose} disabled={busy}>×</button></div><p className="modal-copy">Excluir esta conta apagará todos os dados financeiros associados. Esta ação não pode ser desfeita.</p>{!isLocal && <p className="modal-copy">Por segurança, confirme o nome da conta e informe a senha atual.</p>}{error && <div className="alert error">{error}</div>}<label>Digite “{expected}” para confirmar<input autoFocus value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} /></label>{!isLocal && <label>Senha atual<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button><button type="submit" className="danger-button" disabled={busy}>{busy ? 'Excluindo…' : 'Excluir conta'}</button></div></form></ModalLayer>
}


function SupportPage({ account }) {
  return <section className="account-page support-page"><div className="page-heading"><div><span className="eyebrow">AJUDA</span><h2>Suporte</h2><p>Entre em contato para tirar dúvidas, relatar problemas ou enviar sugestões.</p></div><LifeBuoy size={34} aria-hidden="true" /></div><article className="account-card support-card"><div className="account-card-icon"><Mail size={20} /></div><div><span className="eyebrow">CANAL DE CONTATO</span><h3>alocafinance.app@gmail.com</h3><p>Responderemos pelo e-mail informado assim que possível.</p><a className="primary support-contact-button" href="mailto:alocafinance.app@gmail.com"><Mail size={17} />Entrar em contato</a></div></article></section>
}

function ProfileSecurityPage({ account, onUpdateProfile, onSecurity, onDelete }) {
  const [displayName, setDisplayName] = useState(account.displayName || '')
  const [email, setEmail] = useState(account.email || '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setDisplayName(account.displayName || ''); setEmail(account.email || '') }, [account.id, account.displayName, account.email])
  const save = async event => { event.preventDefault(); setError(''); setSaved(false); if (!displayName.trim()) return setError('Informe o nome da conta.'); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Informe um e-mail válido.'); setSaving(true); try { await onUpdateProfile({ displayName, email }); setSaved(true) } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  const accountType = account.isLocal ? 'Local neste dispositivo' : 'Protegida por senha'
  const securityLabel = account.isLocal ? 'Ainda não protegida' : 'Protegida'
  return <section className="account-page profile-page"><div className="page-heading"><div><span className="eyebrow">MINHA CONTA</span><h2>Perfil e Segurança</h2><p>Atualize seus dados e mantenha sua conta protegida.</p></div><UserCircle size={34} aria-hidden="true" /></div><header className="profile-hero"><div className="profile-hero-banner" aria-hidden="true"><span>ALOCA</span></div><div className="profile-hero-content"><span className="account-identity-avatar" aria-hidden="true">{(account.displayName || 'A').slice(0, 1).toUpperCase()}</span><div className="profile-hero-copy"><h3>{account.displayName || 'Sua conta'}</h3><p>{account.isLocal ? 'Conta local' : 'Conta protegida'}</p><span className={`account-status ${account.isLocal ? 'is-local' : ''}`}><ShieldCheck size={15} />{securityLabel}</span></div><button type="button" className="profile-edit-link" onClick={() => document.querySelector('.account-form input')?.focus()}><Pencil size={15} />Editar perfil</button></div></header><div className="account-summary" aria-label="Resumo da conta"><div><span>Conta</span><strong>{accountType}</strong></div><div><span>Segurança</span><strong className={account.isLocal ? 'summary-muted' : ''}>{securityLabel}</strong></div><div><span>Username</span><strong>{account.username || 'Ainda não definido'}</strong></div><div><span>E-mail</span><strong>{account.email || 'Não informado'}</strong></div></div><div className="account-page-grid"><section className="account-card account-profile-card"><div className="account-card-heading"><div><span className="eyebrow">PERFIL</span><h3>Informações pessoais</h3></div><Pencil size={18} aria-hidden="true" /></div><form onSubmit={save} className="account-form">{error && <div className="alert error">{error}</div>}<label>Nome da conta<input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength="80" /></label><label>E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength="254" /><small className="field-hint">Seu e-mail é privado e usado apenas para identificar sua conta.</small></label><div className="account-form-actions"><button className="primary" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button>{saved && <span className="form-success" role="status">Alterações salvas</span>}</div></form></section><section className={`account-card account-security-card ${account.isLocal ? 'is-unprotected' : 'is-protected'}`}><div className="account-card-heading"><div><span className="eyebrow">SEGURANÇA</span><h3>Segurança da conta</h3></div><ShieldCheck size={18} aria-hidden="true" /></div><div className="security-state"><span className="security-state-icon" aria-hidden="true">{account.isLocal ? '○' : '✓'}</span><strong>{account.isLocal ? 'Conta ainda não protegida' : 'Conta protegida'}</strong></div><p>{account.isLocal ? 'Esta conta existe somente neste dispositivo. Proteja-a para acessar seus dados em outro dispositivo.' : 'Sua conta usa senha para proteger o acesso.'}</p>{!account.isLocal && <dl className="security-details"><div><dt>Usuário</dt><dd>{account.username || 'Ainda não definido'}</dd></div><div><dt>E-mail</dt><dd>{account.email || 'Não informado'}</dd></div></dl>}<button className="secondary" type="button" onClick={() => onSecurity(account.isLocal ? 'protect' : 'password')}>{account.isLocal ? 'Proteger minha conta' : 'Alterar senha'}</button></section><section className="account-card danger-zone"><div className="danger-copy"><div className="account-card-heading"><div><span className="eyebrow">ZONA DE PERIGO</span><h3>Excluir conta</h3></div><TriangleAlert size={18} aria-hidden="true" /></div><p>Exclui permanentemente a conta e seus dados.</p></div><button className="danger-button" type="button" onClick={onDelete}>Excluir conta</button></section></div></section>
}

const calculatorNumber = value => Math.round((value + Number.EPSILON) * 1e10) / 1e10

function evaluateCalculatorExpression(expression) {
  const source = String(expression).replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/')
  const tokens = []
  let cursor = 0
  while (cursor < source.length) {
    const char = source[cursor]
    if (/\s/.test(char)) { cursor += 1; continue }
    if (/\d|\./.test(char)) {
      const start = cursor
      let dots = 0
      while (cursor < source.length && /\d|\./.test(source[cursor])) { if (source[cursor] === '.') dots += 1; cursor += 1 }
      const value = source.slice(start, cursor)
      if (dots > 1 || value === '.') throw new Error('Número inválido.')
      tokens.push({ type: 'number', value: Number(value) })
      continue
    }
    if ('+-*/%()'.includes(char)) { tokens.push({ type: char, value: char }); cursor += 1; continue }
    throw new Error('Use apenas números e operadores válidos.')
  }
  let position = 0
  const peek = () => tokens[position]?.type
  const consume = type => { if (peek() !== type) throw new Error('Expressão incompleta.'); position += 1 }
  const parseExpression = () => {
    let value = parseTerm()
    while (peek() === '+' || peek() === '-') { const operator = tokens[position++].type; const right = parseTerm(); value = calculatorNumber(operator === '+' ? value + right : value - right) }
    return value
  }
  const parseTerm = () => {
    let value = parseUnary()
    while (peek() === '*' || peek() === '/') {
      const operator = tokens[position++].type
      const right = parseUnary()
      if (operator === '/' && right === 0) throw new Error('Não é possível dividir por zero.')
      value = calculatorNumber(operator === '*' ? value * right : value / right)
    }
    return value
  }
  const parseUnary = () => { if (peek() === '+' || peek() === '-') { const operator = tokens[position++].type; const value = parseUnary(); return calculatorNumber(operator === '-' ? -value : value) } return parsePostfix() }
  const parsePostfix = () => { let value = parsePrimary(); while (peek() === '%') { position += 1; value = calculatorNumber(value / 100) } return value }
  const parsePrimary = () => { if (peek() === 'number') return tokens[position++].value; if (peek() === '(') { position += 1; const value = parseExpression(); consume(')'); return value } throw new Error('Informe uma expressão válida.') }
  if (!tokens.length) throw new Error('Informe uma expressão.')
  const result = parseExpression()
  if (position !== tokens.length) throw new Error('Verifique os parênteses e operadores.')
  if (!Number.isFinite(result)) throw new Error('Resultado inválido.')
  return calculatorNumber(result)
}

const formatCalculatorNumber = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 10 }).format(Number(value) || 0)

function CalculatorPopover({ open, onClose }) {
  const [expression, setExpression] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const popoverRef = useRef(null)
  const keypadRef = useRef(null)
  const calculate = () => { try { const value = evaluateCalculatorExpression(expression); setResult(value); setError(''); setCopied(false) } catch (e) { setError(e.message); setResult(null) } }
  const append = value => { setError(''); setCopied(false); setExpression(current => result !== null ? (/^[\d.,(]$/.test(value) ? value : `${result}${value}`) : current + value); setResult(null) }
  const clear = () => { setExpression(''); setResult(null); setError(''); setCopied(false) }
  const erase = () => { setExpression(current => current.slice(0, -1)); setError(''); setResult(null) }
  const copyResult = async () => { if (result === null) return; try { await navigator.clipboard.writeText(String(result).replace('.', ',')); setCopied(true) } catch { setError('Não foi possível copiar o resultado.') } }

  useEffect(() => {
    if (!open) return undefined
    const focusFrame = window.requestAnimationFrame(() => keypadRef.current?.focus())
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key === 'Enter' || event.key === '=') { event.preventDefault(); calculate(); return }
      if (event.key === 'Backspace') { event.preventDefault(); erase(); return }
      const key = event.key === '*' ? '×' : event.key === '/' ? '÷' : event.key
      if (/^[\d.,+\-()%]$/.test(key) || key === '×' || key === '÷') { event.preventDefault(); append(key) }
    }
    const onPointerDown = event => { if (!popoverRef.current?.contains(event.target) && !event.target.closest('.calculator-trigger')) onClose() }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => { window.cancelAnimationFrame(focusFrame); document.removeEventListener('keydown', onKeyDown); document.removeEventListener('mousedown', onPointerDown) }
  }, [open, expression, result, onClose])

  if (!open || typeof document === 'undefined') return null
  const buttons = [['C', 'clear'], ['⌫', 'erase'], ['(', '('], [')', ')'], ['7', '7'], ['8', '8'], ['9', '9'], ['÷', '÷'], ['4', '4'], ['5', '5'], ['6', '6'], ['×', '×'], ['1', '1'], ['2', '2'], ['3', '3'], ['−', '-'], ['%', '%'], ['0', '0'], [',', ','], ['+', '+']]
  return createPortal(<div ref={popoverRef} className="calculator-popover" role="dialog" aria-label="Calculadora" style={{ zIndex: LAYER_TOKENS.popover }}><div className="calculator-header"><div><span className="eyebrow">UTILITÁRIO</span><strong>Calculadora</strong></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar calculadora">×</button></div><div className="calculator-display"><div className="calculator-expression" aria-label="Expressão atual">{expression || '0'}</div><div className="calculator-result" aria-live="polite">{result === null ? '—' : formatCalculatorNumber(result)}</div>{error && <small className="calculator-error" role="alert">{error}</small>}</div><div ref={keypadRef} className="calculator-keypad" tabIndex="0" aria-label="Teclado da calculadora">{buttons.map(([label, value]) => <button key={label} type="button" className={value === 'clear' ? 'calculator-clear' : ['+', '-', '×', '÷', '%'].includes(value) ? 'calculator-operator' : ''} onClick={() => value === 'clear' ? clear() : value === 'erase' ? erase() : append(value)}>{label}</button>)}<button type="button" className="calculator-equals" onClick={calculate}>=</button></div><div className="calculator-actions"><button type="button" className="tertiary" onClick={copyResult} disabled={result === null}>{copied ? 'Copiado' : 'Copiar resultado'}</button><span>Enter calcula · Esc fecha</span></div></div>, document.body)
}

const getInitialTheme = () => {
  const saved = localStorage.getItem(THEME_STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [theme])

  const setTheme = nextTheme => {
    setThemeState(currentTheme => {
      const resolvedTheme = typeof nextTheme === 'function' ? nextTheme(currentTheme) : nextTheme
      if (resolvedTheme !== 'light' && resolvedTheme !== 'dark') return currentTheme
      document.documentElement.dataset.theme = resolvedTheme
      document.documentElement.style.colorScheme = resolvedTheme
      localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme)
      return resolvedTheme
    })
  }

  const value = useMemo(() => ({ theme, setTheme, toggleTheme: () => setTheme(currentTheme => currentTheme === 'light' ? 'dark' : 'light') }), [theme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

const useTheme = () => useContext(ThemeContext)

function ApiUnavailableScreen({ checking, retrying, onRetry, status }) {
  return <div className="api-unavailable-screen" role="alertdialog" aria-labelledby="api-unavailable-title" aria-describedby="api-unavailable-description">
    <div className="api-orb api-orb-left" aria-hidden="true" /><div className="api-orb api-orb-right" aria-hidden="true" /><div className="api-orb api-orb-center" aria-hidden="true" />
    <section className="api-unavailable-card">
      <div className="api-unavailable-logo" aria-hidden="true"><CircleAlert size={23} strokeWidth={1.7} /></div>
      <span className="api-unavailable-eyebrow">ALOCA</span>
      <h1 id="api-unavailable-title">Serviço fora de ar</h1>
      <p id="api-unavailable-description">No momento, o serviço está indisponível.<br />Tente novamente em instantes.</p>
      <button type="button" className="primary api-retry-button" onClick={onRetry} disabled={checking || retrying}>
        {(checking || retrying) && <span className="api-retry-spinner" aria-hidden="true" />}{checking || retrying ? 'Verificando conexão…' : 'Tentar novamente'}
      </button>
      <p className="api-reconnect-status" aria-live="polite">{status || 'Estamos tentando restabelecer a conexão automaticamente.'}</p>
    </section>
  </div>
}

function ApiAvailabilityBoundary({ children }) {
  const [availability, setAvailability] = useState('checking')
  const [checking, setChecking] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [status, setStatus] = useState('')
  const attemptRef = useRef(0)
  const timerRef = useRef(null)

  const check = async (manual = false) => {
    if (checking) return false
    setChecking(true); if (manual) setRetrying(true); setStatus(manual ? 'Verificando a conexão…' : '')
    try { await api.health(); attemptRef.current = 0; setAvailability('online'); setStatus(''); return true }
    catch { setAvailability('offline'); setStatus(manual ? 'Ainda não foi possível conectar. Vamos tentar novamente em instantes.' : 'Estamos tentando restabelecer a conexão automaticamente.'); return false }
    finally { setChecking(false); setRetrying(false) }
  }

  useEffect(() => {
    const onUnavailable = () => { attemptRef.current = 0; check() }
    const onRecovered = () => { attemptRef.current = 0; setAvailability('online'); setStatus('') }
    window.addEventListener(apiAvailabilityEvents.unavailable, onUnavailable)
    window.addEventListener(apiAvailabilityEvents.recovered, onRecovered)
    return () => { window.removeEventListener(apiAvailabilityEvents.unavailable, onUnavailable); window.removeEventListener(apiAvailabilityEvents.recovered, onRecovered); clearTimeout(timerRef.current) }
  }, [])

  useEffect(() => { check() }, [])

  useEffect(() => {
    if (availability !== 'offline') return undefined
    const delay = [5000, 10000, 15000, 30000][Math.min(attemptRef.current, 3)]
    timerRef.current = setTimeout(async () => { attemptRef.current += 1; await check() }, delay)
    return () => clearTimeout(timerRef.current)
  }, [availability, checking])

  if (availability === 'checking') return <div className="api-unavailable-screen api-checking-screen" aria-busy="true" aria-label="Verificando disponibilidade do serviço"><div className="api-orb api-orb-left" aria-hidden="true" /><div className="api-orb api-orb-right" aria-hidden="true" /></div>
  return <>{availability === 'online' && children}{availability === 'offline' && <ApiUnavailableScreen checking={checking} retrying={retrying} onRetry={() => check(true)} status={status} />}</>
}

function NavItem({ href, label, icon: Glyph, active }) {
  return <a className={`app-nav-item${active ? ' is-active' : ''}`} href={href} aria-label={label} aria-current={active ? 'page' : undefined} data-tooltip={label}>
    <Icon icon={Glyph} size={22} />
  </a>
}

function AppSidebar({ view }) {
  const primaryItems = [
    ['#dashboard', 'Visão geral', LayoutDashboard, view === 'dashboard'],
    ['#movimentacoes', 'Movimentações', ArrowLeftRight, view === 'incomes'],
    ['#compromissos', 'Compromissos', CalendarDays, view === 'commitments'],
    ['#previsoes', 'Previsões e Dados', BarChart3, view === 'forecast'],
    ['#grupos', 'Grupos', Folder, view === 'groups'],
  ]
  const secondaryItems = [
    ['#perfil', 'Perfil e configurações', Settings, view === 'profile'],
    ['#suporte', 'Suporte', LifeBuoy, view === 'support'],
  ]
  return <aside className="app-sidebar" aria-label="Navegação principal">
    <nav className="app-sidebar-primary">
      {primaryItems.map(([href, label, Glyph, active]) => <NavItem key={href} href={href} label={label} icon={Glyph} active={active} />)}
    </nav>
    <nav className="app-sidebar-secondary" aria-label="Navegação secundária">
      {secondaryItems.map(([href, label, Glyph, active]) => <NavItem key={href} href={href} label={label} icon={Glyph} active={active} />)}
    </nav>
  </aside>
}

function AppTopbar({ account, createMenuOpen, onToggleCreate, onNewIncome, onNewRecurring, onNewCommitment, theme, onToggleTheme, onAccount }) {
  return <header className="app-topbar">
    <label className="app-search"><Icon icon={Search} size={22} /><input type="search" placeholder="Buscar algo..." aria-label="Buscar algo" /></label>
    <div className="app-topbar-actions">
      <div className="app-create-wrap">
        <button type="button" className="app-create-button" aria-haspopup="menu" aria-expanded={createMenuOpen} onClick={onToggleCreate}><Icon icon={Plus} size={19} /> Novo</button>
        {createMenuOpen && <div className="app-create-menu" role="menu"><button type="button" role="menuitem" onClick={onNewIncome}>Nova entrada</button><button type="button" role="menuitem" onClick={onNewRecurring}>Nova entrada recorrente</button><button type="button" role="menuitem" onClick={onNewCommitment}>Novo compromisso</button></div>}
      </div>
      <button type="button" className="app-theme-toggle" onClick={onToggleTheme} aria-label="Alternar tema" title="Alternar tema"><Sun size={16} /><span><i /></span><Moon size={16} /></button>
      <button type="button" className="app-account-button" onClick={onAccount} aria-label="Abrir perfil e configurações"><span className="app-account-avatar">{(account?.displayName || 'M').slice(0, 1).toUpperCase()}</span><span><strong>Minha conta</strong><small>{account?.isLocal ? 'Conta local' : 'Conta protegida'}</small></span><ChevronDown size={17} /></button>
    </div>
  </header>
}

function App() {
  const [accountState, setAccountState] = useState(null)
  const [accountReady, setAccountReady] = useState(false)
  const [accountDialog, setAccountDialog] = useState(null)
  const [accountDeleteOpen, setAccountDeleteOpen] = useState(false)
  const [accountMutationBusy, setAccountMutationBusy] = useState(false)
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false)
  const [summary, setSummary] = useState(null)
  const [monthlySummary, setMonthlySummary] = useState(null)
  const [monthlySummaryLoading, setMonthlySummaryLoading] = useState(true)
  const [monthlySummaryError, setMonthlySummaryError] = useState('')
  const [commitments, setCommitments] = useState([])
  const [categories, setCategories] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ category: '', priority: '', status: 'active', coverage: '', payment: '', deficit: false, payable: false, sort: 'priority' })
  const [collapsed, setCollapsed] = useState({})
  const [categoryDialog, setCategoryDialog] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState(null)
   const [loading, setLoading] = useState(true)
   const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(null)
  const [balanceModal, setBalanceModal] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [incomes, setIncomes] = useState([])
  const [expenses, setExpenses] = useState([])
  const [recurringIncomes, setRecurringIncomes] = useState([])
  const [incomeDialog, setIncomeDialog] = useState(false)
  const [recurringDialog, setRecurringDialog] = useState(false)
  const [expenseDialog, setExpenseDialog] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [incomeDelete, setIncomeDelete] = useState(null)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [selectedMonth, setSelectedMonth] = useState(() => sessionStorage.getItem('aloca-selected-month') || currentMonth)
  const [commitmentObjective, setCommitmentObjective] = useState(() => localStorage.getItem('aloca-commitment-objective') || '')
  const getView = () => window.location.hash === '#movimentacoes' ? 'incomes' : window.location.hash === '#compromissos' ? 'commitments' : window.location.hash === '#previsoes' ? 'forecast' : window.location.hash === '#grupos' ? 'groups' : window.location.hash === '#suporte' ? 'support' : window.location.hash === '#perfil' ? 'profile' : 'dashboard'
  const [view, setView] = useState(getView())
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const refreshVersionRef = useRef(0)
  const accountTransitionRef = useRef(0)
  useEffect(() => { if (!notice) return undefined; const timer = window.setTimeout(() => setNotice(''), 3500); return () => window.clearTimeout(timer) }, [notice])

  const refresh = async (expectedAccountId = accountState?.current?.id, transitionToken = accountTransitionRef.current) => {
    const refreshVersion = ++refreshVersionRef.current
    const isCurrent = () => transitionToken === accountTransitionRef.current
    setLoading(true); setMonthlySummaryLoading(true); setError('')
    try {
      const [core, monthlyResult] = await Promise.allSettled([
        Promise.all([api.summary(), api.commitments(filters.status), api.categories(), api.incomes(), api.expenses(), api.recurringIncomes()]),
        api.monthlySummary(selectedMonth)
      ])
      if (core.status === 'rejected') throw core.reason
      const [nextSummary, nextCommitments, nextCategories, nextIncomes, nextExpenses, nextRecurring] = core.value
      if (refreshVersion !== refreshVersionRef.current || !isCurrent()) return
      setSummary(nextSummary); setCommitments(nextCommitments); setCategories(nextCategories); setIncomes(nextIncomes.items || []); setExpenses(nextExpenses.items || []); setRecurringIncomes(nextRecurring || [])
      if (monthlyResult.status === 'fulfilled') {
        setMonthlySummary(monthlyResult.value)
        setMonthlySummaryError('')
      } else {
        // Monthly failures are local to this panel. Keep the last successful
        // response visible while the selected month is retried.
        setMonthlySummaryError(errorText(monthlyResult.reason))
      }
    } catch (e) { if (isCurrent()) setError(errorText(e)) } finally { if (isCurrent()) { setLoading(false); setMonthlySummaryLoading(false); setInitialLoadComplete(true) } }
  }
  const retryMonthlySummary = async () => {
    const version = ++refreshVersionRef.current
    setMonthlySummaryLoading(true); setMonthlySummaryError('')
    try { setMonthlySummary(await api.monthlySummary(selectedMonth)); if (version === refreshVersionRef.current) setMonthlySummaryError('') }
    catch (e) { if (version === refreshVersionRef.current) setMonthlySummaryError(errorText(e)) }
    finally { if (version === refreshVersionRef.current) setMonthlySummaryLoading(false) }
  }
  useEffect(() => {
    let cancelled = false
    const bootstrapAccount = async () => {
      try {
        let next = await api.account()
        // A protected account saved on the device must never turn the initial
        // bootstrap into a login screen. The local account is the default
        // context and the API operation is idempotent.
        if (!next.current) {
          await api.continueLocal()
          next = await api.account()
        }
        if (!cancelled) setAccountState(next)
      } catch (e) {
        if (!cancelled) setError(errorText(e))
      } finally {
        if (!cancelled) setAccountReady(true)
      }
    }
    bootstrapAccount()
    return () => { cancelled = true }
  }, [])
  useEffect(() => { if (accountReady && accountState?.current && !isSwitchingAccount) refresh(accountState.current.id) }, [accountReady, accountState?.current?.id, selectedMonth, filters.status, isSwitchingAccount])
  useEffect(() => { const onRecovered = () => { if (accountReady && accountState?.current) refresh() }; window.addEventListener(apiAvailabilityEvents.recovered, onRecovered); return () => window.removeEventListener(apiAvailabilityEvents.recovered, onRecovered) }, [accountReady, accountState?.current?.id])
  useEffect(() => { sessionStorage.setItem('aloca-selected-month', selectedMonth) }, [selectedMonth])
  useEffect(() => { const onHash = () => setView(getView()); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash) }, [])
  useEffect(() => { const timer = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 250); return () => clearTimeout(timer) }, [searchInput])
  useEffect(() => {
    if (!createMenuOpen) return undefined
    const close = event => { if (event.key === 'Escape' || !event.target.closest('.app-create-wrap')) setCreateMenuOpen(false) }
    document.addEventListener('keydown', close); document.addEventListener('mousedown', close)
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('mousedown', close) }
  }, [createMenuOpen])
  useEffect(() => {
    if (!filtersOpen) return undefined
    const closeOnEscape = event => { if (event.key === 'Escape') setFiltersOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = '' }
  }, [filtersOpen])
  const filtered = commitments.filter(item => {
    const coverage = item.coverageStatus
    const payment = item.paidInstallments === 0 ? 'none' : item.isCompleted ? 'done' : 'progress'
    return (!search || item.name.toLowerCase().includes(search)) && (!filters.category || (filters.category === 'none' ? !item.categoryId : item.categoryId === filters.category)) && (!filters.priority || (filters.priority === 'none' ? !item.priority : String(item.priority) === filters.priority)) && (!filters.status || (filters.status === 'completed' ? item.isCompleted : !item.isCompleted)) && (!filters.coverage || coverage === filters.coverage) && (!filters.payment || payment === filters.payment) && (!filters.deficit || item.missingForFullCoverage > 0) && (!filters.payable || item.canPay)
  }).sort((a, b) => { const c = a.categoryName || 'Sem grupo'; const d = b.categoryName || 'Sem grupo'; if (filters.sort === 'name') return a.name.localeCompare(b.name); if (filters.sort === 'total') return b.totalAmount - a.totalAmount; if (filters.sort === 'remaining') return b.remainingAmount - a.remainingAmount; if (filters.sort === 'next') return a.missingForNextInstallment - b.missingForNextInstallment; if (filters.sort === 'progress') return (b.paidInstallments / b.totalInstallments) - (a.paidInstallments / a.totalInstallments); if (filters.sort === 'category') return c.localeCompare(d) || a.name.localeCompare(b.name); return (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name) })
  const groups = filtered.reduce((acc, item) => { const key = item.categoryId || 'none'; (acc[key] ||= []).push(item); return acc }, {})
  const clearFilters = () => { setSearchInput(''); setFilters({ category: '', priority: '', status: 'active', coverage: '', payment: '', deficit: false, payable: false, sort: 'priority' }) }
  const activeFilterCount = ['category', 'priority', 'status', 'coverage', 'payment'].filter(key => filters[key]).length + (filters.deficit ? 1 : 0) + (filters.payable ? 1 : 0) + (filters.sort !== 'priority' ? 1 : 0)
  const editCategory = category => setCategoryDialog(category)
  const deleteCategory = category => setDeleteDialog(category)

  const run = async action => { setError(''); setNotice(''); try { await action(); await refresh(); setNotice('Alterações salvas com sucesso.') } catch (e) { setError(errorText(e)) } }
  const syncAccount = async () => { const next = await api.account(); setAccountState(next); return next }
  const reloadAfterAccountEntry = () => {
    setAccountDialog(null)
    setIsSwitchingAccount(false)
    setAccountMutationBusy(false)
    window.location.reload()
  }
  const clearAccountData = () => { setSummary(null); setMonthlySummary(null); setMonthlySummaryError(''); setCommitments([]); setCategories([]); setIncomes([]); setExpenses([]); setRecurringIncomes([]) }
  const runAccountMutation = async mutation => {
    setAccountMutationBusy(true)
    setError('')
    try {
      await mutation()
      const next = await syncAccount()
      if (next.current) await refresh()
      // The account effect refetches all account-scoped data using the new
      // current account. Clear only after the mutation has succeeded.
      if (!next.current) clearAccountData()
      return next
    } catch (e) {
      setError(errorText(e))
      throw e
    } finally {
      // Every account mutation owns the layer it opened. This also runs when
      // the API rejects, so a failed request can never leave a backdrop or
      // body scroll lock behind.
      setAccountDialog(null)
      setAccountDeleteOpen(false)
      setAccountMutationBusy(false)
    }
  }
  const handleAccountSubmit = async (mode, data) => { if (mode === 'create-local-form') { setAccountDialog({ mode: 'create-local' }); return } if (mode === 'create-local') { await api.createLocal(data.displayName, data.email); reloadAfterAccountEntry(); return } if (mode === 'login-form') { setAccountDialog({ mode: 'login' }); return } if (mode === 'login') { await api.login(data.username, data.password); reloadAfterAccountEntry(); return } if (mode === 'rename') { await runAccountMutation(() => api.renameAccount(data.displayName)); return } if (mode === 'protect') { await runAccountMutation(() => api.protectAccount(data)); return } if (mode === 'password') { await runAccountMutation(() => api.changePassword(data)) } }
  const updateProfile = data => runAccountMutation(() => api.updateProfile(data))
  const removeAccount = async () => runAccountMutation(() => api.removeAccountFromDevice())
  const deleteAccount = async request => runAccountMutation(() => api.deleteAccount(request))
  const goToCommitments = () => { window.location.hash = 'compromissos' }
  const priorityItems = [...commitments].sort((a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER) || (a.nextDueDate || a.dueDate || '').localeCompare(b.nextDueDate || b.dueDate || '')).slice(0, 3)
  const urgentItems = commitments.filter(item => item.urgent && item.requiresAttention).map(item => ({ ...item, allocatedAmount: item.overallAllocatedAmount ?? item.allocatedAmount, totalAmount: item.overallTotalAmount ?? item.totalAmount, remainingAmount: item.overallRemainingAmount ?? item.remainingAmount, overallCoverage: item.overallCoverage ?? item.coveragePercentage }))
  const saveCommitmentObjective = objective => { setCommitmentObjective(objective); localStorage.setItem('aloca-commitment-objective', objective) }
  if (!accountReady) return <div className="app-shell"><div className="loading">Preparando sua conta local…</div></div>
  if (!accountState?.current) return <div className="app-shell"><div className="loading account-recovery"><strong>Não foi possível abrir uma conta local</strong><span>Gerencie as contas deste dispositivo para liberar espaço e entrar no Aloca.</span></div></div>
  return <div className="app-shell">
    <div className="app-logo-slot" aria-hidden="true"><img src={theme === 'dark' ? '/aloca-logo-dark.png' : '/aloca-logo.png'} alt="" /></div>
    <AppTopbar account={accountState.current} createMenuOpen={createMenuOpen} onToggleCreate={() => setCreateMenuOpen(value => !value)} onNewIncome={() => { setCreateMenuOpen(false); setIncomeDialog(true) }} onNewRecurring={() => { setCreateMenuOpen(false); setRecurringDialog(true) }} onNewCommitment={() => { setCreateMenuOpen(false); setEditing({}) }} theme={theme} onToggleTheme={toggleTheme} onAccount={() => { window.location.hash = 'perfil' }} />
    <AppSidebar view={view} />
    <CalculatorPopover open={calculatorOpen} onClose={() => setCalculatorOpen(false)} />
    <main className="app-main">
      <div className="page-content">
      {error && <div className="alert error">{error}</div>}

       {view === 'forecast' ? <FinancialForecastPage /> : view === 'support' ? <SupportPage account={accountState.current} /> : view === 'profile' ? <ProfileSecurityPage account={accountState.current} onUpdateProfile={updateProfile} onSecurity={mode => setAccountDialog({ mode, username: accountState.current.username || '' })} onDelete={() => setAccountDeleteOpen(true)} /> : loading && !initialLoadComplete ? <div className="loading">Carregando sua vida financeira…</div> : view === 'incomes' ? <IncomeManagement incomes={incomes} expenses={expenses} recurringIncomes={recurringIncomes} categories={categories} onCreate={() => setIncomeDialog(true)} onCreateRecurring={() => setRecurringDialog(true)} onCreateExpense={() => setExpenseDialog(true)} onDelete={income => setIncomeDelete(income)} onEditExpense={setEditingExpense} onDeleteExpense={expense => setDeleteDialog({ ...expense, transaction: true })} onRefresh={refresh} onRecurringDeleted={() => setNotice('Entrada recorrente excluída com sucesso.')} /> : view === 'commitments' ? <CommitmentsPage commitments={commitments} filtered={filtered} groups={groups} categories={categories} summary={summary} filters={filters} setFilters={setFilters} searchInput={searchInput} setSearchInput={setSearchInput} filtersOpen={filtersOpen} setFiltersOpen={setFiltersOpen} activeFilterCount={activeFilterCount} setEditing={setEditing} setCollapsed={setCollapsed} collapsed={collapsed} run={run} refresh={refresh} /> : view === 'groups' ? <GroupManagement categories={categories} onCreate={async name => { await api.createCategory(name); await refresh() }} onEdit={editCategory} onDelete={deleteCategory} /> : <>
        <BalanceCommandCenter summary={summary} monthlySummary={monthlySummary} onBalance={() => setBalanceModal(true)} onViewCommitments={goToCommitments} />
        <div className="dashboard-grid">
          <div className="dashboard-main-column">
            <section className="dashboard-card dashboard-objective-card"><CommitmentObjective summary={summary} commitments={commitments} selectedObjective={commitmentObjective} onChange={saveCommitmentObjective} /></section>
            <section className="dashboard-card dashboard-summary-card"><MonthlyFinancialSummary summary={monthlySummary} loading={monthlySummaryLoading} error={monthlySummaryError} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} onRetry={retryMonthlySummary} onView={goToCommitments} /></section>
          </div>
          <aside className="dashboard-card dashboard-commitments-card"><UrgentCommitmentsSection items={urgentItems} onOpen={id => { const item = commitments.find(commitment => commitment.id === id); if (item) setEditing(item) }} /><section className="section-heading commitments-preview-heading"><div><span className="eyebrow">COMPROMISSOS FINANCEIROS</span><h2>Próximos compromissos</h2></div><button type="button" className="secondary" onClick={goToCommitments}>Ver todos</button></section>{priorityItems.length ? <div className="commitment-preview-list">{priorityItems.map(item => <CommitmentPreviewCard key={item.id} item={item} />)}</div> : <div className="empty"><strong>Nenhum compromisso ainda</strong><span>Crie um compromisso para começar a organizar seu saldo.</span></div>}</aside>
          <section className="dashboard-card dashboard-movements-card" id="movimentacoes"><RecentIncomeSection incomes={incomes} expenses={expenses} onCreate={() => setIncomeDialog(true)} onCreateExpense={() => setExpenseDialog(true)} onEditExpense={setEditingExpense} onDeleteExpense={expense => setDeleteDialog({ ...expense, transaction: true })} onViewAll={() => { window.location.hash = 'movimentacoes' }} /></section>
        </div>
      </>}
      </div>
    </main>
    <footer className="app-footer"><span>© 2026 Aloca. Todos os direitos reservados.</span><span>Desenvolvido por Maxwell Xavier.</span><a href="https://github.com/xavierr-max" target="_blank" rel="noopener noreferrer">GitHub: github.com/xavierr-max</a></footer>
    {editing && <CommitmentModal item={editing} categories={categories} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); run(async () => {}) }} />}
    {balanceModal && <InitialBalanceModal value={summary?.initialBalance ?? 0} onClose={() => setBalanceModal(false)} onSaved={() => { setBalanceModal(false); refresh(); setNotice('Saldo inicial atualizado.') }} />}
    {incomeDialog && <IncomeModal categories={categories} onClose={() => setIncomeDialog(false)} onSaved={() => { setIncomeDialog(false); run(async () => {}) }} />}
    {recurringDialog && <RecurringIncomeModal categories={categories} onClose={() => setRecurringDialog(false)} onSaved={() => { setRecurringDialog(false); run(async () => {}) }} />}
    {(expenseDialog || editingExpense) && <ExpenseModal item={editingExpense} categories={categories} currentBalance={summary?.saldoReal ?? 0} onClose={() => { setExpenseDialog(false); setEditingExpense(null) }} onSaved={() => { setExpenseDialog(false); setEditingExpense(null); run(async () => {}) }} />}
    {incomeDelete && <ConfirmModal title="Excluir entrada?" message={`Esta ação não poderá ser desfeita. A entrada “${incomeDelete.description}” de ${money(incomeDelete.amount)} será removida do saldo real.`} onClose={() => setIncomeDelete(null)} onConfirm={() => run(async () => { await api.deleteIncome(incomeDelete.id); setIncomeDelete(null) })} />}
    {filtersOpen && <FilterDrawer filters={filters} setFilters={setFilters} categories={categories} onClear={clearFilters} onClose={() => setFiltersOpen(false)} />}
    {categoryDialog && <CategoryModal category={categoryDialog} onClose={() => setCategoryDialog(null)} onSaved={() => { setCategoryDialog(null); run(async () => {}) }} />}
    {deleteDialog && <ConfirmModal title={deleteDialog.transaction ? 'Excluir saída?' : `Excluir o grupo “${deleteDialog.name}”?`} message={deleteDialog.transaction ? `A saída “${deleteDialog.description}” de ${money(deleteDialog.amount)} será removida do saldo real.` : `Os registros associados não serão excluídos e passarão para “Sem grupo”.`} confirmLabel={deleteDialog.transaction ? 'Excluir' : 'Excluir grupo'} onClose={() => setDeleteDialog(null)} onConfirm={() => run(async () => { if (deleteDialog.transaction) await api.deleteExpense(deleteDialog.id); else { await api.deleteCategory(deleteDialog.id); if (filters.category === deleteDialog.id) setFilters(current => ({ ...current, category: '' })) } setDeleteDialog(null) })} />}
    {accountDialog?.mode !== 'remove' && accountDialog && <AccountDialog mode={accountDialog.mode} initialUsername={accountDialog.username} initialDisplayName={accountState?.current?.displayName || ''} initialEmail={accountState?.current?.email || ''} onClose={() => setAccountDialog(null)} onSubmit={handleAccountSubmit} />}
    {accountDialog?.mode === 'remove' && <ConfirmModal title="Remover conta deste dispositivo?" message="A conta será desvinculada deste dispositivo e liberará um espaço na lista de contas. Os dados da conta não serão excluídos." confirmLabel="Remover" busy={accountMutationBusy} onClose={() => { if (!accountMutationBusy) setAccountDialog(null) }} onConfirm={removeAccount} />}
    {accountDeleteOpen && <AccountDeleteModal displayName={accountState?.current?.displayName || ''} isLocal={accountState?.current?.isLocal} onClose={() => setAccountDeleteOpen(false)} onConfirm={deleteAccount} />}
    {notice && <div className="app-toast success" role="status" aria-live="polite">✓ {notice.replace(' com sucesso', '')}</div>}
  </div>
}

const COMMITMENT_OBJECTIVES = [
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

function CommitmentObjective({ summary, commitments, selectedObjective, onChange }) {
  const editorRef = useRef(null)
  const feedbackTimerRef = useRef(null)
  const [suggestionStart, setSuggestionStart] = useState(() => {
    const previous = Number(window.localStorage.getItem('aloca-objective-suggestion-start'))
    return Number.isFinite(previous) ? previous : 0
  })
  const [objectiveEditing, setObjectiveEditing] = useState(false)
  const [savedFeedback, setSavedFeedback] = useState(false)
  const selectedText = selectedObjective?.startsWith('custom:')
    ? selectedObjective.slice(7)
    : COMMITMENT_OBJECTIVES.find(item => item.id === selectedObjective)?.label || ''
  const [draft, setDraft] = useState(selectedText)
  const suggestions = useMemo(() => COMMITMENT_OBJECTIVES, [])
  const visibleSuggestions = useMemo(() => Array.from({ length: 3 }, (_, index) => suggestions[(suggestionStart + index) % suggestions.length]), [suggestionStart, suggestions])

  useEffect(() => {
    if (selectedObjective == null) {
      setDraft('')
      setObjectiveEditing(false)
      return
    }
    const nextText = selectedObjective.startsWith('custom:') ? selectedObjective.slice(7) : COMMITMENT_OBJECTIVES.find(item => item.id === selectedObjective)?.label || ''
    if (nextText === draft) return
    setDraft(nextText)
    setObjectiveEditing(false)
  }, [selectedObjective])
  useEffect(() => {
    if (!editorRef.current) return
    editorRef.current.style.height = '72px'
  }, [draft])
  useEffect(() => {
    window.localStorage.setItem('aloca-objective-suggestion-start', String((suggestionStart + 3) % suggestions.length))
  }, [])
  useEffect(() => () => window.clearTimeout(feedbackTimerRef.current), [])

  const focusEditor = () => {
    window.requestAnimationFrame(() => {
      editorRef.current?.focus()
      const end = editorRef.current?.value.length || 0
      editorRef.current?.setSelectionRange(end, end)
    })
  }
  const beginEditing = () => {
    setObjectiveEditing(true)
    focusEditor()
  }
  const saveDraft = value => {
    setDraft(value)
  }
  const chooseSuggestion = suggestion => {
    setDraft(suggestion.label)
    setObjectiveEditing(true)
    focusEditor()
  }
  const saveObjective = () => {
    const nextObjective = draft.trim()
    onChange(nextObjective ? `custom:${nextObjective}` : '')
    setObjectiveEditing(false)
    setSavedFeedback(true)
    window.clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = window.setTimeout(() => setSavedFeedback(false), 1600)
  }
  const cancelEditing = () => {
    setDraft(selectedText)
    setObjectiveEditing(false)
  }
  const rotateSuggestions = event => {
    event.stopPropagation()
    setSuggestionStart(currentStart => (currentStart + 3) % suggestions.length)
  }
  const currentObjective = selectedText || draft.trim()
  const hasSavedObjective = Boolean(currentObjective)
  return <div className="command-objective" aria-label="Objetivo da reserva">
    <div className="objective-heading"><div><span className="eyebrow">DIREÇÃO DO SALDO</span><h3>Objetivo da reserva <InfoTooltip title="Objetivo da reserva" description="Representa a prioridade financeira que você definiu para orientar suas decisões e reservas." /></h3></div><span className="objective-icon" aria-hidden="true">✦</span></div>
    <div className={`objective-composer has-suggestions${objectiveEditing ? ' is-editing' : ''}`}>
      {objectiveEditing ? <div className="objective-editing">
        <span className="objective-mobile-help">Escreva aqui seu objetivo financeiro</span>
        <textarea ref={editorRef} className="objective-editor" aria-label="Objetivo da reserva" value={draft} placeholder="Ex.: quitar dívidas, montar reserva, organizar o próximo mês" rows="2" onClick={event => event.stopPropagation()} onChange={event => saveDraft(event.target.value)} />
        <div className="objective-edit-actions"><button type="button" className="secondary" onClick={cancelEditing}>Cancelar</button><button type="button" className="primary" onClick={saveObjective}>Salvar</button></div>
      </div> : <>
        {hasSavedObjective ? <div className="objective-current"><div><span className="objective-current-label">Objetivo atual</span><p>{currentObjective}</p></div><button type="button" className="objective-edit-button" onClick={beginEditing}>✎ <span>Editar</span></button></div> : <button type="button" className="objective-empty" onClick={beginEditing}><span className="objective-current-label">Objetivo atual</span><span className="objective-empty-copy">Ex.: quitar dívidas, montar reserva, organizar o próximo mês</span><span className="objective-empty-action">Escrever objetivo</span></button>}
      </>}
      <div className="objective-suggestions" aria-live="polite">
        <div className="objective-suggestions-header"><span className="objective-suggestions-label">{hasSavedObjective ? 'Sugestões' : 'Sugestões para começar'}</span><button className="objective-suggestions-refresh" type="button" onClick={rotateSuggestions} aria-label="Mostrar outras sugestões" title="Mostrar outras sugestões"><span aria-hidden="true"><Icon icon={RotateCw} size={15} /></span></button></div>
        <div className="objective-suggestion-list">{visibleSuggestions.map((suggestion, index) => <button className={`objective-suggestion ${index === 0 ? 'is-primary' : ''}`} type="button" key={suggestion.id} onClick={event => { event.stopPropagation(); chooseSuggestion(suggestion) }}><span aria-hidden="true">{index === 0 ? '✦' : '•'}</span>{suggestion.label}</button>)}</div>
      </div>
    </div>
    <small className={`objective-saved-feedback${savedFeedback ? ' is-visible' : ''}`} role="status" aria-live="polite">Objetivo atualizado</small>
  </div>
}

function BalanceCommandCenter({ summary, monthlySummary, onBalance, onViewCommitments }) {
  const real = Number(summary?.currentBalance ?? summary?.saldoReal) || 0
  const committed = Number(summary?.allocatedBalance ?? summary?.totalReservado) || 0
  const unallocated = Number(summary?.unallocatedBalance ?? summary?.saldoNaoAlocado) || 0
  const free = Number(summary?.freeBalance ?? summary?.saldoLivre) || 0
  const deficit = Number(summary?.coverageDeficit ?? summary?.deficitCobertura) || 0
  const estimatedFinal = Number(monthlySummary?.estimatedFinalBalance) || 0
  return <section className="command-center" aria-label="Situação financeira atual">
    <div className="command-balance">
      <div className="command-balance-head"><div><span className="eyebrow">SALDO ATUAL <InfoTooltip title="Saldo atual" description="Valor disponível atualmente na conta, considerando as movimentações já confirmadas." /></span><h2>{money(real)}</h2><span className="command-status">Disponível hoje</span></div><button className="secondary command-balance-action" onClick={onBalance}>{summary?.initialBalance > 0 ? 'Editar saldo inicial' : 'Informar saldo inicial'}</button></div>
    </div>
    <div className="command-allocation"><Metric label="SALDO RESERVADO" value={money(committed)} tooltip={{ title: 'Saldo reservado', description: 'Parte do seu saldo que já foi reservada para compromissos, parcelas ou outras obrigações futuras.' }} />{unallocated > 0 && <button className="metric-action command-secondary-action" onClick={onViewCommitments}>Alocar saldo não distribuído</button>}</div>
    <div className={`command-free ${unallocated > 0 ? 'is-positive' : ''}`}><span className="eyebrow">SALDO NÃO ALOCADO <InfoTooltip title="Saldo não alocado" description="Valor que ainda não foi reservado para nenhum compromisso e continua disponível para novas alocações." /></span><strong>{money(unallocated)}</strong><small>Disponível para novas alocações</small>{deficit > 0 && <small className="command-deficit-inline">Déficit de cobertura: {money(deficit)} <InfoTooltip title="Déficit de cobertura" description="Valor que ainda falta reservar para cobrir compromissos previstos no período." /></small>}</div>
    <div className="command-estimated"><span className="eyebrow">SALDO FINAL ESTIMADO <InfoTooltip title="Saldo final estimado" description="Estimativa do saldo ao final do mês considerando os dados do resumo mensal." /></span><strong>{money(estimatedFinal)}</strong><small>Previsão ao final do mês</small></div>
    <details className="calculation-details"><summary>Ver cálculo</summary><div className="calculation-content"><p>Saldo não alocado = saldo atual − valor reservado, limitado a zero.</p><div className="calculation-breakdown"><div><span>Saldo atual</span><strong>{money(real)}</strong></div><div><span>Saldo reservado</span><strong>{money(committed)}</strong></div><div><span>Saldo não alocado</span><strong>{money(unallocated)}</strong></div><div><span>Saldo livre</span><strong>{money(free)}</strong></div>{deficit > 0 && <div><span>Déficit de cobertura</span><strong className="danger-text">{money(deficit)}</strong></div>}</div><p className="calculation-note">Reservas continuam no saldo atual, mas já têm destino definido. O déficit compara o necessário para cobrir compromissos com o que já está reservado.</p></div></details>
  </section>
}

function Metric({ label, value, tone = '', action, tooltip }) { return <article className={`metric ${tone}`}><div className="metric-label"><span>{label} {tooltip && <InfoTooltip {...tooltip} />}</span></div><strong>{value}</strong>{action}</article> }

function SectionError({ message, onRetry, loading = false }) { return <div className="inline-error" role="alert"><span>{message}</span>{onRetry && <button type="button" className="secondary" onClick={onRetry} disabled={loading}>{loading ? 'Carregando…' : 'Tentar novamente'}</button>}</div> }

function MonthlyFinancialSummary({ summary, loading, error, selectedMonth, onMonthChange, onRetry, onView }) {
  if (loading && !summary) return <section className="month-decision"><div className="month-decision-heading"><div><span className="eyebrow">CONTEXTO TEMPORAL</span><h2>Resumo financeiro do mês</h2><p>Entradas recorrentes, compromissos e projeção do mês selecionado.</p></div></div><div className="loading">Carregando o resumo deste mês…</div></section>
  if (error && !summary) return <section className="month-decision"><div className="month-decision-heading"><div><span className="eyebrow">CONTEXTO TEMPORAL</span><h2>Resumo financeiro do mês</h2><p>Entradas recorrentes, compromissos e projeção do mês selecionado.</p></div></div><SectionError message={error} onRetry={onRetry} loading={loading} /></section>
  if (!summary) return null
  const month = { totalIncome: summary.recurringIncomeTotal, result: summary.monthlyResult, projectedBalance: summary.estimatedFinalBalance }
  const commitmentExpenses = (summary.commitments || []).map(item => ({ ...item, description: item.name, amount: item.dueAmount, reservedAmount: item.allocatedAmount, installment: item.installmentNumber, date: item.dueDate }))
  const expenses = commitmentExpenses
  const commitmentTotal = Number(summary.commitmentTotal)
  const commitmentReserved = Number(summary.allocatedAmount)
  const coverageDeficit = Number(summary.missingAmount)
  const coveragePercentage = Number(summary.coveragePercentage)
  const hasContextualAlert = coverageDeficit > 0
  const commitmentStatus = item => item.coverageStatus === 'covered' ? 'Coberta' : item.coverageStatus === 'partial' ? 'Parcialmente coberta' : 'Sem reserva'
  const uncoveredCommitments = commitmentExpenses.filter(item => Number(item.remainingAmount) > 0)
  const insight = uncoveredCommitments.length > 1
    ? `Faltam ${money(coverageDeficit)} para cobrir ${uncoveredCommitments.length} compromissos de ${formatMonthYear(selectedMonth)}.`
    : `Faltam ${money(coverageDeficit)} para cobrir os compromissos de ${formatMonthYear(selectedMonth)}.`
  const monthPicker = <label className="month-picker">Mês selecionado<input type="month" value={selectedMonth} onChange={event => onMonthChange(event.target.value)} /></label>
  return <section className="month-decision"><div className="month-decision-heading"><div><span className="eyebrow">CONTEXTO TEMPORAL</span><h2>Resumo financeiro do mês</h2><p>Entradas recorrentes, compromissos e projeção do mês selecionado.</p></div><div className="month-heading-actions">{monthPicker}<button className="secondary" onClick={onView}>Ver compromissos</button></div></div><div className="monthly-financial-metrics"><div className="monthly-metric income-metric"><span>Entradas recorrentes</span><strong className="positive">{money(month.totalIncome)}</strong><small>Recebimentos previstos</small></div><div className="monthly-metric expense-metric"><span>Compromissos do mês</span><strong className="negative">{money(commitmentTotal)}</strong><small>Cobranças previstas</small></div><div className="monthly-metric result-metric"><span>Resultado do mês</span><strong className={month.result < 0 ? 'negative' : 'positive'}>{signedMoney(month.result)}</strong><small>Entradas menos compromissos</small></div><div className="monthly-metric monthly-coverage-metric"><span>Reservado / alocado</span><strong className="positive">{money(commitmentReserved)} de {money(commitmentTotal)}</strong><small>{coveragePercentage.toFixed(1).replace('.', ',')}% coberto</small></div><div className="monthly-metric balance-metric"><span>Saldo estimado final</span><strong className={month.projectedBalance < 0 ? 'negative' : 'positive'}>{money(month.projectedBalance)}</strong><small>Retornado pelo resumo mensal</small></div></div>{hasContextualAlert ? <div className="monthly-insight has-alert"><div className="monthly-insight-header"><div className="monthly-insight-copy"><strong><span className="attention-icon" aria-hidden="true">!</span>Cobertura do mês pendente</strong><span>{insight}</span></div></div><details className="guidance-details"><summary><span>Ver detalhes</span><small>Veja as cobranças do mês</small></summary><div className="coverage-detail-list">{commitmentExpenses.map(item => <div className={`coverage-detail ${item.coverageStatus || ''}`} key={item.id}><span className="coverage-detail-name"><strong>{item.description}</strong><small>{item.installment != null && item.totalInstallments != null ? `Parcela ${item.installment}/${item.totalInstallments}` : 'Parcela prevista'}</small></span><span className="coverage-detail-value"><b>{money(item.amount)}</b><small>Reservado {money(item.reservedAmount || 0)} · Faltante {money(item.remainingAmount || 0)}</small></span><span className="coverage-detail-status"><b>{Number(item.coveragePercentage ?? 0).toFixed(1).replace('.', ',')}%</b><small>{commitmentStatus(item)}</small></span></div>)}</div></details></div> : commitmentExpenses.length > 0 && <p className="monthly-insight"><strong><span className="attention-icon success-icon" aria-hidden="true">✓</span>Cobertura completa</strong><span>Todos os compromissos de {formatMonthYear(selectedMonth)} estão cobertos.</span></p>}<div className="month-details"><details open><summary>Detalhes dos compromissos <span>{expenses.length ? `${expenses.length} cobranças` : 'Nenhuma cobrança'}</span></summary><div className="month-detail-content">{expenses.length ? expenses.map(item => <div className="decision-row" key={item.id}><span><strong>{item.description}</strong><small>{formatDate(item.date)}{item.installment != null && item.totalInstallments != null ? ` · parcela ${item.installment}/${item.totalInstallments}` : ''} · {commitmentStatus(item)}</small></span><b className="negative">{money(item.amount)}</b></div>) : <span className="decision-empty">Nenhum compromisso previsto para este mês.</span>}</div></details></div></section>
}

function UrgentCommitmentsSection({ items, onOpen }) {
  if (!items.length) return null
  return <section className="urgent-global-section" aria-labelledby="urgent-global-title"><div className="urgent-global-heading"><div><span className="eyebrow">COBERTURA GLOBAL</span><h2 id="urgent-global-title">Urgentes</h2><p>{items.length === 1 ? '1 compromisso ainda precisa de cobertura.' : `${items.length} compromissos ainda precisam de cobertura.`}</p></div></div><div className="urgent-global-list">{items.map(item => <button type="button" className="urgent-global-item" key={item.id} onClick={() => onOpen(item.id)}><span className="urgent-global-name"><strong><span className="urgent-badge">⚠ Urgente</span><span className="urgent-global-commitment">{item.name}</span></strong><small>{money(item.allocatedAmount)} reservados de {money(item.totalAmount)}</small></span><span className="urgent-global-status"><strong>Faltam {money(item.remainingAmount)}</strong><small><b>{Number(item.overallCoverage ?? 0).toFixed(1).replace('.', ',')}%</b> coberto</small></span></button>)}</div></section>
}

function InitialBalanceModal({ value, onClose, onSaved }) {
  const [amount, setAmount] = useState(formatDecimalInput(value ?? 0)); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const save = async e => { e.preventDefault(); const numeric = parseAmount(amount); if (!Number.isFinite(numeric) || numeric < 0) { setError('Informe um valor válido maior ou igual a zero.'); return } setSaving(true); setError(''); try { await api.updateSettings(numeric); onSaved() } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">CONFIGURAÇÃO FINANCEIRA</span><h2>{value > 0 ? 'Editar saldo inicial' : 'Informar saldo inicial'}</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div><p className="modal-copy">Informe quanto você já possui antes de registrar novas movimentações. Isso não cria uma transação.</p>{error && <div className="alert error">{error}</div>}<label>Saldo inicial<input autoFocus required inputMode="decimal" placeholder="1500,00" value={amount} onChange={e => setAmount(e.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>Salvar saldo inicial</button></div></form></div>
}

function CategoryModal({ category, onClose, onSaved }) { const [name, setName] = useState(category?.name || ''); const [error, setError] = useState(''); const save = async e => { e.preventDefault(); if (!name.trim()) { setError('Informe o nome do grupo.'); return } try { await api.updateCategory(category.id, name.trim()); onSaved() } catch (e) { setError(errorText(e)) } }; return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">GRUPOS</span><h2>Editar grupo</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{error && <div className="alert error">{error}</div>}<label>Nome<input autoFocus value={name} onChange={e => setName(e.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary">Salvar</button></div></form></div> }
function GroupManagement({ categories, onCreate, onEdit, onDelete }) {
  const [createOpen, setCreateOpen] = useState(false)
  return <section className="groups-page"><div className="page-heading"><div><span className="eyebrow">ORGANIZAÇÃO</span><h2>Grupos</h2><p>Organize compromissos, entradas e outros registros financeiros.</p></div><button className="primary" type="button" onClick={() => setCreateOpen(true)}><Icon icon={Plus} size={17} /> Novo grupo</button></div><div className="group-manager"><div className="group-manager-heading"><strong>Gerenciar grupos</strong><span>{categories.length} cadastrados</span></div>{categories.length ? <div className="group-manager-list">{categories.map(category => <div className="group-manager-row" key={category.id}><strong>{category.name}</strong><span><button className="secondary" type="button" onClick={() => onEdit(category)}>Editar</button><button className="icon-button danger-text" type="button" onClick={() => onDelete(category)} aria-label={`Excluir ${category.name}`}>×</button></span></div>)}</div> : <div className="empty"><strong>Nenhum grupo criado</strong><span>Crie um grupo para reutilizá-lo em toda a aplicação.</span></div>}</div>{createOpen && <CategoryCreateModal onClose={() => setCreateOpen(false)} onSaved={async name => { await onCreate(name); setCreateOpen(false) }} />}</section>
}
function ConfirmModal({ title, message, onClose, onConfirm, confirmLabel = 'Confirmar', busy = false, busyLabel = 'Processando…', error = '', tone = 'default' }) { return <ModalLayer onClose={onClose}><div className={`modal-content modal-tone-${tone}`}><h2>{title}</h2><p className="modal-copy">{message}</p>{error && <div className="alert error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button><button type="button" className={tone === 'danger' ? 'danger-button' : 'primary'} onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</button></div></div></ModalLayer> }
function AlertModal({ title, message, onClose }) { return <ModalLayer onClose={onClose}><div className="modal-content modal-tone-warning"><h2>{title}</h2><p className="modal-copy">{message}</p><div className="modal-actions"><button type="button" className="primary" onClick={onClose}>Entendi</button></div></div></ModalLayer> }

function RecentIncomeSection({ incomes, expenses, onCreate, onCreateExpense, onEditExpense, onDeleteExpense, onViewAll }) {
  const items = [...incomes.map(x => ({ ...x, movementType: 'income' })), ...expenses.map(x => ({ ...x, movementType: 'expense' }))].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  return <section className="income-section recent-income"><div className="income-heading"><div><span className="eyebrow">MOVIMENTAÇÕES</span><h2>Movimentações recentes</h2><small>Entradas e saídas registradas</small></div><div className="income-actions"><button className="secondary" onClick={onViewAll}>Ver todas</button><button className="expense-action" onClick={onCreateExpense}><Icon icon={ArrowUpFromLine} size={17} /> Nova saída</button><button className="primary" onClick={onCreate}><Icon icon={Plus} size={17} /> Nova entrada</button></div></div>{items.length ? <div className="income-list">{items.map(item => <article className={`income-row ${item.movementType === 'expense' ? 'expense-row' : ''}`} key={item.id}><div className="income-icon">{item.movementType === 'expense' ? '↓' : '↑'}</div><div className="income-info"><strong>{item.description}</strong><span><em className="category-badge">{item.categoryName || 'Sem grupo'}</em> · {new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')}</span></div><strong className={`income-amount ${item.movementType === 'expense' ? 'negative' : 'positive'}`}>{item.movementType === 'expense' ? '- ' : '+ '}{money(item.amount)}</strong>{item.movementType === 'expense' && <div className="row-actions"><button className="icon-button" onClick={() => onEditExpense(item)}>✎</button><button className="icon-button danger-text" onClick={() => onDeleteExpense(item)}>⋯</button></div>}</article>)}</div> : <div className="empty income-empty compact-empty"><strong>Nenhuma movimentação ainda</strong><span>Registre uma entrada ou saída para atualizar seu saldo.</span><button className="expense-action" onClick={onCreateExpense}><Icon icon={ArrowUpFromLine} size={17} /> Nova saída</button></div>}</section>
}

function IncomeManagement({ incomes, expenses, recurringIncomes, categories, onCreate, onCreateRecurring, onDelete, onEditExpense, onDeleteExpense, onRefresh, onRecurringDeleted, onCreateExpense }) {
  const [typeFilter, setTypeFilter] = useState('all')
  const changeType = type => setTypeFilter(type)
  const actions = typeFilter === 'recurring'
    ? <button type="button" className="primary" onClick={onCreateRecurring}><Icon icon={Plus} size={17} /> Nova entrada recorrente</button>
    : typeFilter === 'expense'
      ? <button type="button" className="expense-action" onClick={onCreateExpense}><Icon icon={ArrowUpFromLine} size={17} /> Nova saída</button>
      : <details className="movement-create-menu"><summary className="primary"><Icon icon={Plus} size={17} /> Novo</summary><div className="movement-create-popover" role="menu"><button type="button" role="menuitem" onClick={onCreate}>Nova entrada</button><button type="button" role="menuitem" onClick={onCreateExpense}>Nova saída</button><button type="button" role="menuitem" onClick={onCreateRecurring}>Nova entrada recorrente</button></div></details>
  return <section className="income-management"><div className="page-heading"><div><span className="eyebrow">MOVIMENTAÇÕES</span><h2>Movimentações</h2><p>Entradas e saídas já realizadas, além de entradas recorrentes cadastradas.</p></div><div className="income-actions movement-actions">{actions}</div></div><div className="income-tabs management-tabs" role="tablist"><button type="button" className={typeFilter === 'all' ? 'active' : ''} onClick={() => changeType('all')}>Todas <span>{incomes.length + expenses.length}</span></button><button type="button" className={typeFilter === 'income' ? 'active' : ''} onClick={() => changeType('income')}>Entradas <span>{incomes.length}</span></button><button type="button" className={typeFilter === 'expense' ? 'active' : ''} onClick={() => changeType('expense')}>Saídas <span>{expenses.length}</span></button><button type="button" className={typeFilter === 'recurring' ? 'active' : ''} onClick={() => changeType('recurring')}>Entradas recorrentes <span>{recurringIncomes.length}</span></button></div>{typeFilter === 'recurring' ? <RecurringIncomeList items={recurringIncomes} categories={categories} onRefresh={onRefresh} onDeleted={onRecurringDeleted} /> : <AllMovementsSection incomes={incomes} expenses={expenses} categories={categories} typeFilter={typeFilter} onTypeFilterChange={changeType} onDeleteIncome={onDelete} onEditExpense={onEditExpense} onDeleteExpense={onDeleteExpense} />}</section>
}

function MovementFilters({ label, search, setSearch, category, setCategory, period, setPeriod, sort, setSort, type = 'all', setType = () => {}, categories }) {
  const activeCount = (search ? 1 : 0) + (category ? 1 : 0) + (period ? 1 : 0) + (sort !== 'date-desc' ? 1 : 0) + (type !== 'all' ? 1 : 0)
  return <details className="income-filters-disclosure"><summary>Filtrar e ordenar{activeCount ? ` (${activeCount})` : ''}</summary><div className="income-filters"><select aria-label="Filtrar por tipo" value={type} onChange={e => setType(e.target.value)}><option value="all">Todos os tipos</option><option value="income">Entradas</option><option value="expense">Saídas</option><option value="recurring">Recorrentes</option></select><input aria-label={`Pesquisar ${label}`} placeholder="Pesquisar por descrição..." value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Filtrar por grupo" value={category} onChange={e => setCategory(e.target.value)}><option value="">Todos os grupos</option><option value="none">Sem grupo</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select><input aria-label="Filtrar por período" type="month" value={period} onChange={e => setPeriod(e.target.value)} /><select aria-label={`Ordenar ${label}`} value={sort} onChange={e => setSort(e.target.value)}><option value="date-desc">Mais recentes</option><option value="date-asc">Mais antigas</option><option value="amount-desc">Maior valor</option><option value="amount-asc">Menor valor</option></select></div></details>
}

function RegularIncomeSection({ incomes, categories, onDelete }) {
  const [search, setSearch] = useState(''); const [category, setCategory] = useState(''); const [period, setPeriod] = useState(''); const [sort, setSort] = useState('date-desc')
  const items = incomes.filter(item => (!search || item.description.toLowerCase().includes(search.toLowerCase())) && (!category || (category === 'none' ? !item.categoryId : item.categoryId === category)) && (!period || item.date.slice(0, 7) === period)).sort((a, b) => sort === 'amount-desc' ? b.amount - a.amount : sort === 'amount-asc' ? a.amount - b.amount : sort === 'date-asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))
  return <section className="income-section"><div className="income-heading"><div><span className="eyebrow">MOVIMENTAÇÕES</span><h2>Entradas</h2><small>{items.length} entrada(s) encontrada(s)</small></div></div><MovementFilters label="entradas" search={search} setSearch={setSearch} category={category} setCategory={setCategory} period={period} setPeriod={setPeriod} sort={sort} setSort={setSort} categories={categories} />{items.length ? <div className="income-list">{items.map(item => <article className="income-row" key={item.id}><div className="income-icon">↗</div><div className="income-info"><strong>{item.description}</strong><span>{item.categoryName} · {new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')}</span></div><strong className="income-amount">+ {money(item.amount)}</strong><button className="icon-button danger-text" onClick={() => onDelete(item)} aria-label={`Excluir entrada ${item.description}`}>×</button></article>)}</div> : <div className="empty income-empty"><strong>{incomes.length ? 'Nenhuma entrada encontrada' : 'Nenhuma entrada ainda'}</strong><span>{incomes.length ? 'Ajuste os filtros para encontrar uma entrada.' : 'Registre sua primeira entrada para atualizar seu saldo.'}</span></div>}</section>
}

function AllMovementsSection({ incomes, expenses, categories, typeFilter, onTypeFilterChange, onDeleteIncome, onEditExpense, onDeleteExpense }) {
  const [search, setSearch] = useState(''); const [category, setCategory] = useState(''); const [period, setPeriod] = useState(''); const [sort, setSort] = useState('date-desc')
  const allItems = [...incomes.map(item => ({ ...item, movementType: 'income' })), ...expenses.map(item => ({ ...item, movementType: 'expense' }))]
  const items = allItems.filter(item => (!typeFilter || typeFilter === 'all' || item.movementType === typeFilter) && (!search || item.description.toLowerCase().includes(search.toLowerCase())) && (!category || (category === 'none' ? !item.categoryId : item.categoryId === category)) && (!period || item.date.slice(0, 7) === period)).sort((a, b) => sort === 'amount-desc' ? b.amount - a.amount : sort === 'amount-asc' ? a.amount - b.amount : sort === 'date-asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))
  const label = typeFilter === 'income' ? 'entradas' : typeFilter === 'expense' ? 'saídas' : 'movimentações'
  const title = typeFilter === 'income' ? 'Entradas' : typeFilter === 'expense' ? 'Saídas' : 'Todas'
  return <section className="income-section all-movements-section"><div className="income-heading"><div><span className="eyebrow">MOVIMENTAÇÕES</span><h2>{title}</h2><small>{items.length} {items.length === 1 ? 'item encontrado' : 'itens encontrados'}</small></div></div><MovementFilters label={label} search={search} setSearch={setSearch} category={category} setCategory={setCategory} period={period} setPeriod={setPeriod} sort={sort} setSort={setSort} type={typeFilter || 'all'} setType={onTypeFilterChange} categories={categories} />{items.length ? <div className="income-list">{items.map(item => <article className={`income-row ${item.movementType === 'expense' ? 'expense-row' : ''}`} key={`${item.movementType}-${item.id}`}><div className="income-icon">{item.movementType === 'expense' ? '↓' : '↑'}</div><div className="income-info"><strong>{item.description}</strong><span><em className={`movement-type-label ${item.movementType}`}>{item.movementType === 'expense' ? 'Saída' : 'Entrada'}</em> · {item.categoryName || 'Sem grupo'} · {formatDate(item.date)}</span></div><strong className={`income-amount ${item.movementType === 'expense' ? 'negative' : 'positive'}`}>{item.movementType === 'expense' ? '- ' : '+ '}{money(item.amount)}</strong>{item.movementType === 'expense' ? <div className="row-actions"><button className="icon-button" onClick={() => onEditExpense(item)} aria-label={`Editar saída ${item.description}`}>✎</button><button className="icon-button danger-text" onClick={() => onDeleteExpense(item)} aria-label={`Excluir saída ${item.description}`}>×</button></div> : <button className="icon-button danger-text" onClick={() => onDeleteIncome(item)} aria-label={`Excluir entrada ${item.description}`}>×</button>}</article>)}</div> : <div className="empty income-empty"><strong>{allItems.length ? 'Nenhum resultado encontrado' : 'Nenhuma movimentação ainda'}</strong><span>{allItems.length ? 'Ajuste os filtros para encontrar uma movimentação.' : 'Registre uma entrada ou saída para atualizar seu saldo.'}</span></div>}</section>
}

function IncomeSection({ incomes, recurringIncomes, categories, onCreate, onDelete, onRefresh, onRecurringDeleted }) {
  const [tab, setTab] = useState('all')
  const [recurringDialog, setRecurringDialog] = useState(false)
  const visible = tab === 'recurring' ? [] : incomes
  return <section className="income-section"><div className="income-heading"><div><span className="eyebrow">MOVIMENTAÇÕES RECENTES</span><h2>Movimentações recentes</h2><small>{tab === 'recurring' ? `${recurringIncomes.length} entrada(s) recorrente(s)` : `${incomes.length} entrada(s) recentes`}</small></div><div className="income-actions"><button className="secondary" onClick={() => setRecurringDialog(true)}>Nova entrada recorrente</button><button className="primary" onClick={onCreate}>Nova entrada</button></div></div><div className="income-tabs" role="tablist"><button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Todas</button><button className={tab === 'recurring' ? 'active' : ''} onClick={() => setTab('recurring')}>Entradas recorrentes <span>{recurringIncomes.length}</span></button></div>{tab === 'all' && <RegularIncomeSection incomes={visible} categories={categories} onDelete={onDelete} />}{tab === 'recurring' && <RecurringIncomeList items={recurringIncomes} categories={categories} onRefresh={onRefresh} onDeleted={onRecurringDeleted} />}{recurringDialog && <RecurringIncomeModal categories={categories} onClose={() => setRecurringDialog(false)} onSaved={() => { setRecurringDialog(false); onRefresh() }} />}</section>
}

const frequencyLabels = { Once: 'Única vez', Weekly: 'Semanal', Fortnightly: 'Quinzenal', Monthly: 'Mensal', Bimonthly: 'Bimestral', Quarterly: 'Trimestral', Semiannual: 'Semestral', Annual: 'Anual' }
function RecurringIncomeList({ items, categories, onRefresh, onDeleted }) {
  const [query, setQuery] = useState(''); const [status, setStatus] = useState('all'); const [selected, setSelected] = useState(null); const [pendingDelete, setPendingDelete] = useState(null); const [pendingReceive, setPendingReceive] = useState(null); const [deletingId, setDeletingId] = useState(null); const [receiving, setReceiving] = useState(false); const [deleteError, setDeleteError] = useState('')
  useEffect(() => {
    if (!selected) return
    const updated = items.find(item => item.id === selected.id)
    setSelected(current => updated ? (current === updated ? current : updated) : null)
  }, [items, selected])
  const filtered = items.filter(x => (!query || x.description.toLowerCase().includes(query.toLowerCase())) && (status === 'all' || (status === 'active' ? x.isActive : !x.isActive)))
  const act = async fn => { await fn(); await onRefresh() }
  const receive = async () => { setReceiving(true); try { await api.receiveRecurringOccurrence(pendingReceive.occurrence.id); setPendingReceive(null); await onRefresh() } finally { setReceiving(false) } }
  const deleteRecurring = async () => { setDeletingId(pendingDelete.id); setDeleteError(''); try { await api.deleteRecurringIncome(pendingDelete.id); setPendingDelete(null); setSelected(null); await onRefresh(); onDeleted() } catch (e) { setDeleteError(errorText(e)) } finally { setDeletingId(null) } }
  return <div className="recurring-panel"><div className="recurring-tools"><input aria-label="Pesquisar entradas recorrentes" placeholder="Pesquisar entrada recorrente..." value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Filtrar entradas recorrentes" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todos os status</option><option value="active">Ativas</option><option value="paused">Pausadas</option></select></div>{filtered.length ? <div className="recurring-list">{filtered.map(item => <button type="button" className="recurring-row" key={item.id} onClick={() => setSelected(item)}><span className="recurring-main"><strong>{item.description}</strong><span>{money(item.amount)} · {frequencyLabels[item.frequency]}</span></span><span className="recurring-next"><small>Próxima ocorrência</small><strong>{item.nextOccurrence ? new Date(`${item.nextOccurrence}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem próximas'}</strong></span><span className="movement-type-label recurring">Entrada recorrente</span>{item.automaticProcessing && <span className="recurring-status active" title="Processamento automático ativado">Automático</span>}<span className={`recurring-status ${item.isActive ? 'active' : 'paused'}`}>{item.isActive ? 'Ativa' : 'Pausada'}</span><span className="recurring-open" aria-hidden="true">›</span></button>)}</div> : <div className="empty"><strong>Nenhuma entrada recorrente encontrada</strong><span>Cadastre salário, aluguel recebido ou outra entrada periódica.</span></div>}{selected && <RecurringIncomeDrawer item={selected} categories={categories} onClose={() => setSelected(null)} onToggle={async () => { await act(() => selected.isActive ? api.pauseRecurringIncome(selected.id) : api.activateRecurringIncome(selected.id)) }} onDelete={() => { setDeleteError(''); setPendingDelete(selected) }} onReceive={occurrence => setPendingReceive({ item: selected, occurrence })} onSaved={onRefresh} />}{pendingReceive && <ConfirmModal title="Confirmar recebimento antecipado?" message={`A ocorrência de ${new Date(`${pendingReceive.occurrence.scheduledDate}T12:00:00`).toLocaleDateString('pt-BR')} será registrada hoje no saldo real. Ela será removida da projeção, e as próximas entradas recorrentes continuarão previstas.`} confirmLabel="Receber hoje" busy={receiving} onClose={() => { if (!receiving) setPendingReceive(null) }} onConfirm={receive} />}{pendingDelete && <ConfirmModal title="Excluir entrada recorrente?" message="Essa ação removerá esta entrada recorrente e não poderá ser desfeita." confirmLabel="Excluir" busy={deletingId !== null} error={deleteError} onClose={() => { if (!deletingId) setPendingDelete(null) }} onConfirm={deleteRecurring} />}</div>
}

function AppDrawer({ open = true, onClose, eyebrow, title, titleId, badges, children, footer, className = '' }) {
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

function RecurringIncomeDrawer({ item, categories, onClose, onToggle, onDelete, onReceive, onSaved }) {
  const [mode, setMode] = useState('view')
  const occurrences = [...(item.occurrences || [])].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
  const editFormId = 'recurring-income-edit-form'
  const footer = mode === 'edit' ? <><button type="button" className="secondary" onClick={() => setMode('view')}>Cancelar</button><button type="submit" form={editFormId} className="primary">Salvar alterações</button></> : <><button type="button" className="secondary" onClick={() => setMode('edit')}>Editar</button><button type="button" className="secondary" onClick={onToggle}>{item.isActive ? 'Pausar' : 'Reativar'}</button><button type="button" className="danger-button" onClick={onDelete}>Excluir</button></>
  const content = mode === 'edit' ? <RecurringIncomeModal embedded formId={editFormId} item={item} categories={categories} onClose={() => setMode('view')} onSaved={onSaved} /> : <><div className="recurring-detail-hero"><strong>{money(item.amount)}</strong><span>{frequencyLabels[item.frequency]} · {item.categoryName}</span></div><dl className="detail-facts"><div><dt>Próxima ocorrência</dt><dd>{item.nextOccurrence ? formatDate(item.nextOccurrence) : 'Sem próximas'}</dd></div><div><dt>Início</dt><dd>{formatDate(item.startDate)}</dd></div><div><dt>Término</dt><dd>{item.endDate ? formatDate(item.endDate) : 'Sem término'}</dd></div></dl><section className="recurring-history"><div className="drawer-section-heading"><h3>Histórico</h3><span>{occurrences.length} ocorrências</span></div>{occurrences.length ? <div className="history-list">{occurrences.map(occurrence => <div className="history-item" key={occurrence.id}><span className={`history-dot ${occurrence.status.toLowerCase()}`} /><div><strong>{formatDate(occurrence.scheduledDate)}</strong><small>{occurrence.status === 'Received' ? 'Recebida' : occurrence.status === 'Cancelled' ? 'Cancelada' : occurrence.status === 'Paused' ? 'Pausada' : 'Prevista'}</small></div><b>{money(occurrence.amount)}</b>{occurrence.status === 'Planned' && item.isActive && <button className="tertiary" onClick={() => onReceive(occurrence)}>Receber</button>}</div>)}</div> : <p className="drawer-empty">Nenhuma ocorrência registrada ainda.</p>}</section></>
  return <AppDrawer className="recurring-detail-drawer" eyebrow={mode === 'edit' ? 'EDITAR ENTRADA RECORRENTE' : 'ENTRADA RECORRENTE'} title={mode === 'edit' ? 'Editar entrada recorrente' : item.description} titleId="recurring-detail-title" badges={mode === 'view' && <><span className={`recurring-status ${item.isActive ? 'active' : 'paused'}`}>{item.isActive ? 'Ativa' : 'Pausada'}</span>{item.automaticProcessing && <span className="recurring-status active" title="Processamento automático ativado">Automático</span>}</>} footer={footer} onClose={onClose}>{mode === 'edit' ? <RecurringIncomeModal embedded formId={editFormId} item={item} categories={categories} onClose={() => setMode('view')} onSaved={async () => { await onSaved(); setMode('view') }} /> : content}</AppDrawer>
}

function RecurringIncomeModal({ categories, item, onClose, onSaved, embedded = false, formId }) {
  const [form, setForm] = useState(() => item ? { description: item.description, amount: String(item.amount).replace('.', ','), categoryId: item.categoryId || "", frequency: item.frequency, startDate: item.startDate, endDate: item.endDate || '', automaticProcessing: item.automaticProcessing ?? false } : { description: '', amount: '', categoryId: '', frequency: 'Monthly', startDate: new Date().toISOString().slice(0, 10), endDate: '', automaticProcessing: false }); const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const update = (key, value) => setForm(x => ({ ...x, [key]: value }))
  const dayOfMonth = Number(form.startDate.slice(8, 10))
  const save = async e => { e.preventDefault(); if (!form.description.trim() || !form.amount || !form.startDate) return setError('Preencha descrição, valor e a primeira ocorrência.'); if (form.endDate && form.endDate < form.startDate) return setError('A data final deve ser igual ou posterior ao início.'); setSaving(true); setError(''); try { const body = { ...form, amount: parseAmount(form.amount), categoryId: optionalCategoryId(form.categoryId), dayOfMonth: form.frequency === 'Monthly' ? dayOfMonth : null, endDate: form.endDate || null }; await (item ? api.updateRecurringIncome(item.id, body) : api.createRecurringIncome(body)); await onSaved() } catch (e) { console.error('Falha ao salvar entrada recorrente', e); setError(e?.status >= 400 ? 'Não foi possível salvar a entrada recorrente.' : errorText(e)) } finally { setSaving(false) } }
  const fields = <>{error && <div className="alert error">{error}</div>}<label>Descrição<input autoFocus required value={form.description} onChange={e => update('description', e.target.value)} /></label><div className="form-grid income-form-grid"><label>Valor<input required inputMode="decimal" placeholder="0,00" value={form.amount} onChange={e => update('amount', e.target.value)} /></label><label>Grupo<select value={form.categoryId} onChange={e => update('categoryId', e.target.value || null)}><option value="">Sem grupo</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div><div className="form-grid recurring-form-grid"><label>Primeira ocorrência<input required type="date" value={form.startDate} onChange={e => update('startDate', e.target.value)} /></label><label>Frequência<select value={form.frequency} onChange={e => update('frequency', e.target.value)}>{Object.entries(frequencyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{form.frequency === 'Monthly' && <span className="field-hint">Repete todo dia {dayOfMonth}; o dia 31 cai no último dia válido.</span>}</label><label>Data de término <span className="field-hint">(opcional)</span><input type="date" value={form.endDate} onChange={e => update('endDate', e.target.value)} /></label></div><CheckboxOption checked={form.automaticProcessing} onChange={e => update('automaticProcessing', e.target.checked)} title="Receber automaticamente na data" description="O valor será adicionado ao saldo automaticamente na data da ocorrência." /><p className="modal-copy">A primeira ocorrência define o dia das entradas mensais. As previsões não alteram seu saldo real.</p></>
  if (embedded) return <form id={formId} className="app-drawer-form" onSubmit={save}>{fields}</form>
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">ENTRADA RECORRENTE</span><h2>{item ? 'Editar entrada recorrente' : 'Nova entrada recorrente'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{fields}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{item ? 'Salvar alterações' : 'Salvar entrada recorrente'}</button></div></form></div>
}

function IncomeModal({ categories, onClose, onSaved }) {
  const [form, setForm] = useState({ description: '', amount: '', categoryId: '', date: new Date().toISOString().slice(0, 10) }); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const save = async event => { event.preventDefault(); const amount = parseAmount(form.amount); if (!form.description.trim()) return setError('Informe a descrição da entrada.'); if (!Number.isFinite(amount) || amount <= 0) return setError('Informe um valor maior que zero.'); setSaving(true); setError(''); try { await api.createIncome({ description: form.description.trim(), amount, date: form.date, categoryId: form.categoryId || null }); onSaved() } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">MOVIMENTAÇÃO</span><h2>Nova entrada</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{error && <div className="alert error">{error}</div>}<label>Descrição<input autoFocus required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><label>Valor<input required inputMode="decimal" placeholder="0,00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label><div className="form-grid income-form-grid"><label>Grupo<select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}><option value="">Sem grupo</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Data<input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label></div><p className="modal-copy">Entradas não podem ser editadas depois de criadas. Se necessário, exclua e cadastre novamente.</p><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>Salvar entrada</button></div></form></div>
}

function ExpenseModal({ item, categories, currentBalance, onClose, onSaved }) {
  const [form, setForm] = useState({ description: item?.description || '', amount: item?.amount ?? '', categoryId: item?.categoryId || '', date: item?.date?.slice(0, 10) || new Date().toISOString().slice(0, 10) }); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const save = async event => { event.preventDefault(); const amount = parseAmount(form.amount); if (!form.description.trim()) return setError('Informe a descrição da saída.'); if (!Number.isFinite(amount) || amount <= 0) return setError('Informe um valor maior que zero.'); if (!item && amount > Number(currentBalance) && !window.confirm(`Esta saída é maior que o saldo real disponível (${money(currentBalance)}). Deseja confirmar mesmo assim?`)) return; setSaving(true); setError(''); try { const body = { description: form.description.trim(), amount, date: form.date, categoryId: form.categoryId || null, type: 'Expense' }; if (item) await api.updateTransaction(item.id, body); else await api.createExpense(body); onSaved() } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">MOVIMENTAÇÃO</span><h2>Nova saída</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{error && <div className="alert error">{error}</div>}<p className="modal-copy">Registre um gasto já realizado. Ele reduz o saldo real e não cria compromisso, reserva ou parcela.</p><label>Descrição<input autoFocus required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><label>Valor<input required inputMode="decimal" placeholder="0,00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label><div className="form-grid income-form-grid"><label>Grupo <span className="field-hint">(opcional)</span><select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}><option value="">Sem grupo</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Data<input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label></div><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>Registrar saída</button></div></form></div>
}

function StatusFilter({ status, onStatus }) {
  return <div className="status-chips" aria-label="Filtrar por status"><button className={`filter-control ${status === 'active' ? 'active' : ''}`} onClick={() => onStatus('active')}>Ativos</button><button className={`filter-control ${status === 'completed' ? 'active' : ''}`} onClick={() => onStatus('completed')}>Concluídos</button><button className={`filter-control ${status === 'all' ? 'active' : ''}`} onClick={() => onStatus('all')}>Todos</button></div>
}

function CommitmentFilters({ search, setSearch, categories, selectedCategory, onCategory, onOpenFilters, status, onStatus }) {
  return <><div className="filters-toolbar"><input aria-label="Pesquisar compromissos" placeholder="Pesquisar por nome..." value={search} onChange={e => setSearch(e.target.value)} /><button className="secondary mobile-filter-button" onClick={onOpenFilters}>Filtros</button></div><div className="category-chips" aria-label="Filtrar por grupo"><button className={`category-chip ${!selectedCategory ? 'active' : ''}`} onClick={() => onCategory('')}>Todos os grupos</button><button className={`category-chip ${selectedCategory === 'none' ? 'active' : ''}`} onClick={() => onCategory('none')}>Sem grupo</button>{categories.map(category => <button className={`category-chip ${selectedCategory === category.id ? 'active' : ''}`} key={category.id} onClick={() => onCategory(category.id)}>{category.name}</button>)}</div></>
}

function CommitmentPreviewCard({ item }) {
  const coverage = Number(item.coveragePercentage)
  const priority = item.priorityLabel || ['Indefinida', 'Alta', 'Média', 'Baixa'][item.priority]
  const status = item.isCompleted ? 'Concluído' : 'Ativo'
  const nextDueDate = item.nextDueDate || addMonths(item.dueDate, item.paidInstallments)
  return <article className="commitment-static-card commitment-static-preview-card" data-commitment-part="card"><header className="commitment-static-preview-header"><div className="commitment-static-preview-heading"><h3>{item.name}</h3><div className="commitment-static-badges">{item.categoryName && <span className="commitment-static-badge">{item.categoryName}</span>}{priority && <span className={`commitment-static-badge commitment-static-priority-${item.priority}`}>{priority}</span>}</div></div><span className={`commitment-static-status ${item.isCompleted ? 'is-complete' : ''}`}>{status}</span></header><section className="commitment-static-preview-stats" data-commitment-part="next"><div><span>Próxima parcela</span><strong>{money(item.installmentAmount)}</strong></div><div><span>Vencimento</span><strong>{formatDate(nextDueDate)}</strong></div><div><span>Cobertura</span><strong>{Math.round(coverage)}%</strong></div></section><div className="commitment-static-progress" role="progressbar" aria-label={`Cobertura da próxima parcela: ${Math.round(coverage)}%`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(coverage)}><span style={{ width: `${coverage}%` }} /></div></article>
}

function CommitmentsPage({ commitments, filtered, groups, categories, summary, filters, setFilters, searchInput, setSearchInput, filtersOpen, setFiltersOpen, activeFilterCount, setEditing, setCollapsed, collapsed, run, refresh }) {
 const filterLabels = { priority: { none: 'Prioridade: Sem prioridade', '1': 'Prioridade: Alta', '2': 'Prioridade: Média', '3': 'Prioridade: Baixa' }, status: { active: 'Status: Ativos', completed: 'Status: Concluídos' }, coverage: { none: 'Cobertura: Sem reserva', partial: 'Cobertura: Parcial', next: 'Cobertura: Próxima parcela', full: 'Cobertura: Total' }, payment: { none: 'Pagamento: Não iniciado', progress: 'Pagamento: Em andamento', done: 'Pagamento: Quitado' }, sort: { name: 'Ordenado: Nome', total: 'Ordenado: Valor total', remaining: 'Ordenado: Valor restante', next: 'Ordenado: Próxima parcela', progress: 'Ordenado: Progresso', category: 'Ordenado: Grupo' } }
 const activeChips = [{ key: 'search', label: searchInput ? `Busca: ${searchInput}` : '', clear: () => setSearchInput('') }, { key: 'category', label: filters.category ? `Grupo: ${filters.category === 'none' ? 'Sem grupo' : categories.find(x => x.id === filters.category)?.name || 'Selecionado'}` : '', clear: () => setFilters(x => ({ ...x, category: '' })) }, ...['priority', 'status', 'coverage', 'payment'].map(key => ({ key, label: filterLabels[key][filters[key]] || '', clear: () => setFilters(x => ({ ...x, [key]: '' })) })), { key: 'deficit', label: filters.deficit ? 'Com déficit' : '', clear: () => setFilters(x => ({ ...x, deficit: false })) }, { key: 'payable', label: filters.payable ? 'Aptos para pagar' : '', clear: () => setFilters(x => ({ ...x, payable: false })) }, { key: 'sort', label: filters.sort !== 'priority' ? filterLabels.sort[filters.sort] : '', clear: () => setFilters(x => ({ ...x, sort: 'priority' })) }].filter(item => item.label)
 return <section className="commitments-page"><div className="page-heading"><div><span className="eyebrow">COMPROMISSOS FINANCEIROS</span><h2>Compromissos</h2><p>Organize reservas e acompanhe cada parcela no seu ritmo.</p></div><div className="section-actions"><button className="secondary" onClick={() => setFiltersOpen(true)}> <Icon icon={Filter} size={17} />Filtros{activeFilterCount ? ` (${activeFilterCount})` : ''}</button><button className="primary" onClick={() => setEditing({})}>Novo compromisso</button></div></div><CommitmentFilters search={searchInput} setSearch={setSearchInput} categories={categories} selectedCategory={filters.category} onCategory={category => setFilters(x => ({ ...x, category }))} onOpenFilters={() => setFiltersOpen(true)} onCreateCategory={async name => { await api.createCategory(name); await refresh() }} />{activeChips.length > 0 && <div className="active-filter-chips" aria-label="Filtros ativos">{activeChips.map(item => <button className="active-filter-chip" key={item.key} onClick={item.clear}>{item.label}<span aria-hidden="true">×</span></button>)}</div>}<div className="commitments-result-count">{filtered.length} de {commitments.length} compromissos</div>{commitments.length === 0 ? <div className="empty"><strong>Nenhum compromisso ainda</strong><span>Crie um compromisso para começar a organizar seu saldo.</span></div> : filtered.length === 0 ? <div className="empty"><strong>Nenhum resultado encontrado</strong><span>Ajuste os filtros ou limpe a busca.</span></div> : <div className="commitment-groups">{Object.entries(groups).map(([key, items]) => { const category = categories.find(x => x.id === key); const pending = items.reduce((sum, x) => sum + x.remainingAmount, 0); return <section className="commitment-group" key={key}><button className="group-header" onClick={() => setCollapsed(x => ({ ...x, [key]: !x[key] }))}><span><strong>{category?.name || 'Sem grupo'}</strong><small>{items.length} compromisso(s) · {money(pending)} pendente</small></span><span>{collapsed[key] ? '＋' : '−'}</span></button>{!collapsed[key] && <div className="commitment-list">{items.map(item => <CommitmentCard key={item.id} item={item} availableBalance={summary?.unallocatedBalance ?? summary?.saldoNaoAlocado ?? 0} onChange={refresh} onEdit={() => setEditing(item)} onDelete={() => run(() => api.deleteCommitment(item.id))} />)}</div>}</section> })}</div>}</section>
}

function FilterDrawer({ filters, setFilters, categories, onClear, onClose, onEditCategory, onDeleteCategory }) {
  const update = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  return <div className="drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><aside className="filter-drawer" role="dialog" aria-modal="true" aria-labelledby="filters-title"><div className="drawer-head"><div><span className="eyebrow">PERSONALIZE A LISTA</span><h2 id="filters-title">Filtros</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar filtros">×</button></div><div className="drawer-content"><fieldset><legend>Classificação</legend><label>Grupo<select value={filters.category} onChange={e => update('category', e.target.value)}><option value="">Todos os grupos</option><option value="none">Sem grupo</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Prioridade<select value={filters.priority} onChange={e => update('priority', e.target.value)}><option value="">Todas as prioridades</option><option value="none">Sem prioridade</option><option value="1">Alta</option><option value="2">Média</option><option value="3">Baixa</option></select></label></fieldset><fieldset><legend>Situação</legend><label>Status<select value={filters.status} onChange={e => update('status', e.target.value)}><option value="">Todos os status</option><option value="active">Ativos</option><option value="completed">Concluídos</option></select></label><label>Cobertura<select value={filters.coverage} onChange={e => update('coverage', e.target.value)}><option value="">Todas as coberturas</option><option value="none">Sem reserva</option><option value="partial">Parcial</option><option value="next">Próxima parcela coberta</option><option value="full">Totalmente reservado</option></select></label><label>Pagamento<select value={filters.payment} onChange={e => update('payment', e.target.value)}><option value="">Todos os pagamentos</option><option value="none">Não iniciado</option><option value="progress">Em andamento</option><option value="done">Quitado</option></select></label></fieldset><fieldset><legend>Ordenação</legend><label>Ordenar por<select value={filters.sort} onChange={e => update('sort', e.target.value)}><option value="priority">Prioridade</option><option value="name">Nome</option><option value="total">Valor total</option><option value="remaining">Valor restante</option><option value="next">Próxima parcela</option><option value="progress">Progresso</option><option value="category">Grupo</option></select></label></fieldset><fieldset><legend>Filtros rápidos</legend><CheckboxOption compact checked={filters.deficit} onChange={e => update('deficit', e.target.checked)} title="Com déficit" /><CheckboxOption compact checked={filters.payable} onChange={e => update('payable', e.target.checked)} title="Aptos para pagar" /></fieldset><section className="category-tools" aria-label="Gerenciar grupos"><strong>Gerenciar grupos</strong>{categories.length ? categories.map(category => <span key={category.id}>{category.name}<button type="button" onClick={() => onEditCategory(category)} aria-label={`Editar ${category.name}`}>✎</button><button type="button" onClick={() => onDeleteCategory(category)} aria-label={`Excluir ${category.name}`}>×</button></span>) : <small>Nenhum grupo criado.</small>}</section></div><div className="drawer-actions"><button className="secondary" onClick={onClear}>Limpar filtros</button><button className="primary" onClick={onClose}>Aplicar filtros</button></div></aside></div>
}

function CategoryCreateModal({ onClose, onSaved }) { const [name, setName] = useState(''); const [error, setError] = useState(''); const save = async e => { e.preventDefault(); if (!name.trim()) { setError('Informe o nome do grupo.'); return } try { await onSaved(name.trim()) } catch (e) { setError(errorText(e)) } }; return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">GRUPOS</span><h2>Novo grupo</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{error && <div className="alert error">{error}</div>}<label>Nome<input autoFocus value={name} onChange={e => setName(e.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary">Criar</button></div></form></div> }

function CommitmentMenu({ item, onDetails, onEdit, onDelete }) {
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

function CommitmentCard({ item, availableBalance, categories, onChange, onEdit, onDelete }) {
  const [detailsOpen, setDetailsOpen] = useState(false); const [busy, setBusy] = useState(false); const [actionError, setActionError] = useState(''); const [actionMessage, setActionMessage] = useState(''); const [deletePending, setDeletePending] = useState(false); const [deleteError, setDeleteError] = useState(''); const [deleting, setDeleting] = useState(false)
  const requestDelete = () => { setDeleteError(''); setDeletePending(true) }
  const confirmDelete = async () => { setDeleting(true); try { await onDelete(); setDeletePending(false); setDetailsOpen(false) } catch (error) { setDeleteError(errorText(error)) } finally { setDeleting(false) } }
  const overallCoverage = Number(item.isOpenEnded ? item.coveragePercentage : item.overallCoveragePercentage)
  const overallRemaining = Number(item.isOpenEnded ? item.remainingForNextInstallment : item.overallRemainingAmount)
  const overallReserved = Number(item.isOpenEnded ? item.allocatedForNextInstallment : item.totalAllocatedAmount)
  const overallHeading = item.isOpenEnded ? 'Recorrente' : 'Progresso geral'
  const installmentCoverage = Number(item.coveragePercentage)
  const priority = item.priorityLabel || (item.priority ? ['Indefinida', 'Alta', 'Média', 'Baixa'][item.priority] : null)
  const nextDueDate = item.nextDueDate || addMonths(item.dueDate, item.paidInstallments)
  const actionableUrgent = Boolean(item.urgent && overallCoverage < 100)
  const needsAllocation = !item.isCompleted && !item.canPay
  const nextActionState = item.isCompleted ? 'paid' : needsAllocation ? (installmentCoverage > 0 ? 'partial' : 'uncovered') : 'ready'
  const occurrenceLabel = item.isRecurring ? 'cobrança' : 'vencimento'
  const primaryLabel = item.isCompleted ? 'Cobrança concluída' : needsAllocation ? 'Reservar para próxima cobrança' : `Confirmar ${occurrenceLabel} como pago`
  if (item.isOpenEnded) item = { ...item, totalAmount: item.installmentAmount }
  const runPrimaryAction = async event => { event.stopPropagation(); if (item.isCompleted || busy || (needsAllocation && !item.canAllocate)) return; setBusy(true); setActionError(''); setActionMessage(''); try { if (needsAllocation) { await api.allocateNextInstallment(item.id); setActionMessage(`Cobertura atualizada: ${money(item.missingForNextInstallment ?? item.installmentAmount)} reservados para a próxima cobrança.`) } else { await api.payInstallment(item.id); setActionMessage('Cobrança marcada como paga com sucesso.') } await onChange() } catch (error) { setActionError(errorText(error)) } finally { setBusy(false) } }
  const contextCopy = nextActionState === 'paid' ? 'Cobrança já registrada como paga.' : nextActionState === 'ready' ? 'Cobertura concluída. Agora você pode confirmar o pagamento.' : nextActionState === 'partial' ? `Ainda faltam ${money(item.missingForNextInstallment ?? Math.max(0, item.installmentAmount - item.allocatedAmount))} para cobrir totalmente a próxima cobrança.` : 'Primeiro reserve o valor necessário. Depois confirme o pagamento.'
  const actionHint = nextActionState === 'paid' ? 'Esta cobrança não precisa de outra ação.' : nextActionState === 'ready' ? 'A confirmação registra o pagamento; ela não cria uma reserva.' : 'Reservar separa o saldo; ainda não registra a cobrança como paga.'
  return <article className={`commitment-static-card ${actionableUrgent ? 'is-urgent' : ''} is-next-${nextActionState}`} data-commitment-part="card"><header className="commitment-static-header" data-commitment-part="header"><button type="button" className="commitment-static-summary-trigger" title="Abrir detalhes do compromisso" onClick={() => setDetailsOpen(true)} aria-expanded={detailsOpen}><span className="commitment-static-title"><span className="commitment-static-avatar" aria-hidden="true">{item.name.slice(0, 1).toUpperCase()}</span><span className="commitment-static-heading"><span className="commitment-static-name-row"><h3 title={item.name}>{item.name}</h3>{item.categoryName && <span className="commitment-static-badge">{item.categoryName}</span>}{priority && <span className={`commitment-static-badge commitment-static-priority-${item.priority}`}>{priority}</span>}{item.urgent && <span className="commitment-static-urgent-badge">⚠ Urgente</span>}</span></span></span><span className="commitment-static-chevron" aria-hidden="true">›</span></button><span><CommitmentMenu item={item} onDetails={() => setDetailsOpen(true)} onEdit={onEdit} onDelete={onDelete} /></span></header><div className="commitment-static-body"><section className={`commitment-static-overall ${actionableUrgent ? 'is-urgent' : ''} ${overallCoverage >= 100 ? 'is-complete' : ''}`} data-commitment-part="overall" aria-label="Progresso geral do compromisso"><div className="commitment-static-section-heading"><h4>{overallHeading}</h4><strong>{Math.round(overallCoverage)}%</strong></div><div className="commitment-static-reserved"><strong>{money(overallReserved)}</strong><span>reservados de</span><strong>{money(item.totalAmount)}</strong></div><div className="commitment-static-remaining"><span>Faltam</span><strong>{money(overallRemaining)}</strong></div><div className="commitment-static-progress" role="progressbar" aria-label={`Cobertura geral: ${Math.round(overallCoverage)}%`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(overallCoverage)}><span style={{ width: `${Math.min(100, Math.max(0, overallCoverage))}%` }} /></div></section><section className="commitment-static-next" data-commitment-part="next" aria-label="Próxima parcela"><div className="commitment-static-section-heading"><h4>Próxima parcela</h4><span className="commitment-static-next-badge">{nextActionState === 'paid' ? '✓ Paga' : nextActionState === 'ready' ? '✓ Pronta para confirmar' : installmentCoverage > 0 ? 'Cobertura parcial' : 'Sem cobertura'}</span></div><div className="commitment-static-next-grid"><div className="commitment-static-next-main"><strong>{money(item.installmentAmount)}</strong><span>Vence em {formatDate(nextDueDate)}</span></div><div className="commitment-static-next-status"><strong>{Number(installmentCoverage).toFixed(1).replace('.', ',')}% coberta</strong>{installmentCoverage < 100 && <span> · faltam {money(item.missingForNextInstallment ?? Math.max(0, item.installmentAmount - item.allocatedAmount))}</span>}</div><div className="commitment-static-context"><strong>{nextActionState === 'paid' ? 'Status da cobrança' : 'Próxima ação'}</strong><span>{contextCopy}</span></div><span className="commitment-static-action"><button type="button" className={`commitment-static-action-button ${needsAllocation ? 'is-allocate' : 'is-pay'}`} disabled={item.isCompleted || busy || (needsAllocation && availableBalance <= 0)} onClick={runPrimaryAction}><span aria-hidden="true">{needsAllocation ? '↗' : item.isCompleted ? '✓' : '✓'}</span>{busy ? 'Processando…' : primaryLabel}</button><small>{actionHint}</small>{needsAllocation && availableBalance <= 0 && <small>Abra os detalhes para ajustar a reserva.</small>}</span></div></section>{actionMessage && <div className="commitment-static-success" role="status">✓ {actionMessage}</div>}{actionError && <div className="commitment-static-error" role="status">{actionError}</div>}</div>{detailsOpen && <CommitmentDetailsDrawer item={item} availableBalance={availableBalance} priority={priority} onClose={() => setDetailsOpen(false)} onEdit={onEdit} onDelete={onDelete} onChange={onChange} />}</article>
}

function CommitmentDetailsDrawer({ item, availableBalance, priority, onClose, onEdit, onDelete, onChange }) {
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
  const history = Array.from({ length: item.isOpenEnded ? Math.min(item.paidInstallments + 1, 24) : item.totalInstallments }, (_, index) => { const paid = index < item.paidInstallments; const current = index === item.paidInstallments; const reservedAmount = paid ? item.installmentAmount : current ? Math.min(item.allocatedForNextInstallment, item.installmentAmount) : 0; return { number: index + 1, paid, current, reserved: reservedAmount, missing: Math.max(0, item.installmentAmount - reservedAmount), dueDate: addMonths(item.dueDate, index) } })
  const releaseAll = async () => { setConfirmRelease(false); await mutate(() => api.releaseAllAllocation(item.id)) }
  const overallCoverage = Number(item.overallCoveragePercentage)
  const urgentUncovered = Boolean(item.requiresAttention)
  const nextDueDate = item.nextDueDate || addMonths(item.dueDate, item.paidInstallments)
  const missingForNext = Number(item.remainingForNextInstallment)
  const status = item.isCompleted ? ['Concluído', 'complete'] : ['Ativo', 'active']
  const footer = <><div className="commitment-drawer-actions"><div className="commitment-drawer-action-copy">{urgentUncovered && <span className="urgent-critical-message" role="alert">⚠ Faltam <strong>{money(item.overallRemainingAmount ?? item.remainingAmount)}</strong></span>}<small>Ações do compromisso</small></div><div className="commitment-drawer-action-buttons"><button className="secondary" onClick={onEdit} disabled={busy || deleting}>Editar</button><button className="danger-button" onClick={() => setConfirmDelete(true)} disabled={busy || deleting}>Excluir compromisso</button></div></div>{confirmDelete && <ConfirmModal title="Excluir compromisso?" message={`“${item.name}” será excluído permanentemente. As reservas e alocações vinculadas também serão removidas.`} confirmLabel="Excluir compromisso" busy={deleting} busyLabel="Excluindo…" error={deleteError} tone="danger" onClose={() => { if (!deleting) setConfirmDelete(false) }} onConfirm={deleteCommitment} />}{invalidAllocation && <AlertModal title={invalidAllocation.operation === 'withdrawal' ? 'Valor para retirar inválido' : 'Valor de reserva inválido'} message={invalidAllocation.reason || `Disponível: ${money(invalidAllocation.allowed)}. Valor solicitado: ${money(invalidAllocation.value)}.`} onClose={() => setInvalidAllocation(null)} />}</>
  const badges = <>{item.urgent && <span className="urgent-badge">⚠ Urgente</span>}<span className={`status-badge ${status[1] === 'complete' ? 'complete' : ''}`}>{status[0]}</span>{item.automaticProcessing && <span className="status-badge">Automático</span>}{item.isOpenEnded && <span className="status-badge">Sem término</span>}{priority && <span className={`priority-badge priority-${item.priority}`}>{priority}</span>}</>
  return <AppDrawer className="commitment-detail-drawer" eyebrow="COMPROMISSO" title={item.name} titleId="commitment-drawer-title" badges={badges} footer={footer} onClose={onClose}><section className="drawer-panel drawer-summary"><div className="drawer-section-heading"><h3>Resumo</h3><span>{Math.round(overallCoverage)}% coberto</span></div><div className="drawer-summary-main"><strong>{money(item.allocatedAmount)} <small>reservados de</small> {money(item.totalAmount)}</strong><b>Faltam {money(item.overallRemainingAmount ?? item.remainingAmount)}</b></div><div className="progress-track"><div style={{ width: `${Math.min(100, overallCoverage)}%` }} /></div><div className="drawer-summary-grid"><span>Valor total<strong>{money(item.totalAmount)}</strong></span><span>Reservado<strong>{money(item.allocatedAmount)}</strong></span><span>Parcelas<strong>{item.isOpenEnded ? 'Sem término' : `${item.paidInstallments}/${item.totalInstallments}`}</strong></span></div></section><section className="drawer-panel"><div className="drawer-section-heading"><h3>Parcelas</h3><span>{item.paidInstallments} pagas</span></div><div className="drawer-installments">{history.map(row => <div className={`drawer-installment ${row.paid ? 'is-paid' : row.current ? 'is-current' : ''}`} key={row.number}><div><strong>Parcela {row.number}</strong><small>{formatDate(row.dueDate)} · {row.paid ? 'Paga' : row.current ? 'Próxima' : 'Pendente'}</small></div><div><strong>{money(item.installmentAmount)}</strong><small>Reservado {money(row.reserved)} · Faltam {money(row.missing)}</small></div></div>)}</div></section><section className="drawer-panel drawer-control-section"><div className="drawer-section-heading"><h3>Reserva</h3><span>Disponível {money(available)}</span></div><label className="drawer-field">Valor<input inputMode="decimal" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} /></label><div className="drawer-button-row"><button className="primary" disabled={busy || missingFull <= 0} onClick={submitAllocation}>Alocar</button><button className="secondary" disabled={busy || reserved <= 0} onClick={submitWithdrawal}>Retirar</button><button className="secondary" disabled={busy || Number(item.missingForNextInstallment) <= 0} onClick={allocateNext}>Alocar próxima parcela</button><button className="secondary" disabled={busy || missingFull <= 0} onClick={allocateRemaining}>Alocar valor restante</button></div><p className="drawer-reserve-total">Reserva atual <strong>{money(item.allocatedAmount)}</strong></p>{item.allocatedAmount > 0 && <button className="release-reserve-button" disabled={busy} onClick={() => setConfirmRelease(true)}>↶ Retirar toda a reserva</button>}</section><section className="drawer-panel drawer-control-section"><div className="drawer-section-heading"><h3>Pagamento</h3><span>{item.canPay ? 'Cobertura suficiente' : `Faltam ${money(missingForNext)}`}</span></div>{item.isCompleted ? <span className="payment-status">Compromisso concluído</span> : <button className="pay-button" disabled={busy || !item.canPay} onClick={() => mutate(() => api.payInstallment(item.id))}>Marcar parcela como paga</button>}{item.paidInstallments > 0 && <button className="tertiary undo-payment" disabled={busy} onClick={() => mutate(async () => { await api.reversePayment(item.id); setMessage('Pagamento desfeito. Reserva e saldo restaurados.') })}>Desfazer último pagamento</button>}</section>{message && <div className="inline-error" role="status">{message}</div>}{item.objective && <p className="drawer-note"><strong>Objetivo</strong>{item.objective}</p>}{confirmRelease && <div className="release-confirmation" role="alert"><strong>Retirar toda a reserva?</strong><p>{money(item.allocatedAmount)} voltarão a ficar disponíveis para novas alocações. O compromisso continuará ativo.</p><div><button className="secondary" onClick={() => setConfirmRelease(false)}>Cancelar</button><button className="release-confirm-button" onClick={releaseAll}>Retirar reserva</button></div></div>}</AppDrawer>
}

function CommitmentModal({ item, categories, onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ name: item.name || '', installmentAmount: item.installmentAmount || '', frequency: item.frequency || 'Monthly', endDate: item.endDate || '', priority: item.priority ?? '', categoryId: item.categoryId || '', automaticProcessing: item.automaticProcessing ?? false, urgent: item.urgent ?? false, dueDate: item.dueDate || today, objective: item.objective || '' }); const [error, setError] = useState('')
  const update = (key, value) => setForm(x => ({ ...x, [key]: value }))
  const recurrencePreview = useMemo(() => getCommitmentRecurrencePreview(form), [form.dueDate, form.frequency, form.endDate])
  const recurrenceLastDate = recurrencePreview.kind === 'scheduled' ? recurrencePreview.occurrences[recurrencePreview.occurrences.length - 1] : ''
  const recurrencePreviewContent = recurrencePreview.kind === 'open' ? <p>Sem término · cobranças futuras conforme a frequência definida.</p> : recurrencePreview.kind === 'missing-start' || recurrencePreview.kind === 'invalid' ? <p>{recurrencePreview.message}</p> : recurrencePreview.kind === 'scheduled' ? <div className="recurrence-preview-summary"><strong>{recurrencePreview.occurrences.length} {recurrencePreview.occurrences.length === 1 ? 'cobrança prevista' : 'cobranças previstas'}</strong><span>Última cobrança em {formatDate(recurrenceLastDate)}</span><small>{formatDate(recurrencePreview.occurrences[0])} → {formatDate(recurrenceLastDate)}</small></div> : null
  const recurrencePreviewBlock = form.frequency === 'Once' ? null : <section className={`recurrence-preview ${recurrencePreview.kind === 'invalid' ? 'is-invalid' : ''}`} aria-live="polite" role={recurrencePreview.kind === 'invalid' ? 'alert' : 'status'}>{recurrencePreviewContent}</section>
  const save = async e => { e.preventDefault(); setError(''); const amount = parseAmount(form.installmentAmount); if (!form.name.trim()) return setError('Informe o nome do compromisso.'); if (!Number.isFinite(amount) || amount <= 0) return setError('Informe um valor válido.'); if (!form.dueDate) return setError('Informe o primeiro vencimento.'); if (form.frequency !== 'Once' && form.endDate && form.endDate < form.dueDate) return setError('A data de término deve ser igual ou posterior ao primeiro vencimento.'); const payload = { name: form.name.trim(), installmentAmount: amount, totalInstallments: null, frequency: form.frequency, priority: form.priority ? Number(form.priority) : null, automaticProcessing: form.automaticProcessing, urgent: form.urgent, categoryId: form.categoryId || null, dueDate: form.dueDate, endDate: form.frequency === 'Once' ? form.dueDate : (form.endDate || null), objective: form.objective.trim() || null }; try { if (item.id) await api.updateCommitment(item.id, payload); else await api.createCommitment(payload); onSaved() } catch (e) { setError(errorText(e)) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">COMPROMISSO</span><h2>{item.id ? 'Editar compromisso' : 'Novo compromisso'}</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div>{error && <div className="alert error">{error}</div>}<label>Nome<input required value={form.name} onChange={e => update('name', e.target.value)} /></label><div className="form-grid"><label>Valor<input required inputMode="decimal" placeholder="0,00" value={form.installmentAmount} onChange={e => update('installmentAmount', e.target.value)} /></label><label>Grupo<select value={form.categoryId || ''} onChange={e => update('categoryId', e.target.value || null)}><option value="">Sem grupo</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Prioridade<select value={form.priority} onChange={e => update('priority', e.target.value || null)}><option value="">Sem prioridade</option><option value="1">Alta</option><option value="2">Média</option><option value="3">Baixa</option></select></label></div><div className="form-grid recurring-form-grid"><label>Primeiro vencimento<input required type="date" value={form.dueDate} onChange={e => update('dueDate', e.target.value)} /></label><label>Frequência<select value={form.frequency} onChange={e => update('frequency', e.target.value)}>{Object.entries(frequencyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Data de término <span className="field-hint">(opcional)</span><input type="date" disabled={form.frequency === 'Once'} value={form.frequency === 'Once' ? '' : form.endDate} onChange={e => update('endDate', e.target.value)} aria-invalid={recurrencePreview.kind === 'invalid'} /></label></div>{form.frequency === 'Once' ? <div className="preview-list"><strong>Vencimento</strong><span>{form.dueDate ? formatDate(form.dueDate) : 'Informe a data'}</span></div> : recurrencePreviewBlock}<div className="checkbox-options-grid"><CheckboxOption checked={form.automaticProcessing} onChange={e => update('automaticProcessing', e.target.checked)} title="Pagar automaticamente no vencimento" description="A cobrança será processada automaticamente quando chegar a data de vencimento, respeitando as regras de saldo e cobertura." /><CheckboxOption checked={form.urgent} onChange={e => update('urgent', e.target.checked)} title="Marcar como urgente" description="Mantém este compromisso em destaque até que esteja totalmente coberto." variant="urgent" /></div><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary">Salvar compromisso</button></div></form></div>
}


createRoot(document.getElementById('root')).render(<ThemeProvider><ErrorBoundary><ApiAvailabilityBoundary><App /></ApiAvailabilityBoundary></ErrorBoundary></ThemeProvider>)
