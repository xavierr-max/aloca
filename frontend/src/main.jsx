import React, { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import ErrorBoundary from './ErrorBoundary.jsx'
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BarChart3, BadgeCheck, Bell, Calculator,
  CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleAlert, CircleCheck, Eye,
  Folder, Info, LayoutDashboard, List, Pencil, Plus, RotateCw, Settings, ShieldCheck, Target,
  Menu, Moon, Sun, Trash2, TriangleAlert, Undo2, UserCircle, Users, Wallet, LockKeyhole, Mail, LifeBuoy, Camera,
} from 'lucide-react'
import { api, apiAvailabilityEvents, markAccountContextChanged } from './services/api'
import { APP_VERSION } from './appVersion'
import { CheckboxOption } from './components/CheckboxOption'
import PageHeader from './components/PageHeader.jsx'
import FinancialForecastPage from './pages/FinancialForecastPage.jsx'
import MovementsPage from './features/movements/MovementsPage.jsx'
import MovementFormModal from './features/movements/components/MovementFormModal.jsx'
import './styles.css'
import './balance.css'
import './payment.css'
import './transactions.css'
import './semantic.css'
import './theme.css'
import './calculator.css'
import './responsive-system.css'
import './account.css'
import './profile-page.css'
import './navigation.css'
import './ux-overhaul.css'
import './dashboard-overview.css'
import './commitments-base.css'
import './responsive-overrides.css'
import './account-contrast.css'
import './mobile-foundation.css'
import { businessMonth, businessToday } from './utils/businessDate.js'

const navigationItems = [
  { id: 'dashboard', href: '#dashboard', view: 'dashboard', desktopLabel: 'Visão geral', mobileLabel: 'Início', icon: LayoutDashboard },
  { id: 'movimentacoes', href: '#movimentacoes', view: 'incomes', desktopLabel: 'Movimentações', mobileLabel: 'Movimentos', icon: ArrowLeftRight },
  { id: 'compromissos', href: '#compromissos', view: 'commitments', desktopLabel: 'Compromissos', mobileLabel: 'Compromissos', icon: CalendarDays },
  { id: 'previsoes', href: '#previsoes', view: 'forecast', desktopLabel: 'Previsões e Dados', mobileLabel: 'Previsões', icon: BarChart3 },
  { id: 'grupos', href: '#grupos', view: 'groups', desktopLabel: 'Grupos', mobileLabel: 'Grupos', icon: Folder },
  { id: 'perfil', href: '#perfil', view: 'profile', desktopLabel: 'Perfil e configurações', mobileLabel: 'Perfil', icon: Settings },
  { id: 'suporte', href: '#suporte', view: 'support', desktopLabel: 'Suporte', mobileLabel: 'Suporte', icon: LifeBuoy },
]

const navigationItemMatchesHash = (item, hash) => hash === item.href || hash.startsWith(`${item.href}/`)
const navigationItemIsActive = (item, view) => item.view === view

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
      <Info size={12} strokeWidth={2} aria-hidden="true" />
    </button>
    {tooltip}
  </span>
}

const formatCurrency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
const money = formatCurrency
const signedMoney = value => `${Number(value) < 0 ? '-' : Number(value) > 0 ? '+' : ''} ${formatCurrency(Math.abs(Number(value) || 0))}`.trim()
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
const THEME_STORAGE_KEY = 'theme'
const ThemeContext = createContext(null)

// Keep every global layer in one place so local stacking contexts cannot change the order.
const LAYER_TOKENS = Object.freeze({
  page: 0,
  popover: 850,
  drawerBackdrop: 800,
  drawer: 810,
  modalBackdrop: 900,
  modal: 910,
  toast: 1000,
})

function ModalLayer({ children, onClose, className = '', backdropClassName = '' }) {
  const openerRef = useRef(typeof document !== 'undefined' ? document.activeElement : null)
  const contentRef = useRef(null)
  const backdropRef = useRef(null)
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
    const isTopLayer = () => {
      const layers = [...document.querySelectorAll('[data-modal-layer]')]
      return layers[layers.length - 1] === backdropRef.current
    }
    const onKeyDown = event => {
      if (!isTopLayer()) return
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
    <div ref={backdropRef} className={`modal-backdrop ${backdropClassName}`.trim()} data-modal-layer style={{ zIndex: LAYER_TOKENS.modalBackdrop }} onMouseDown={event => { if (event.target === event.currentTarget) onCloseRef.current?.() }}>
      <div ref={contentRef} className={`modal ${className}`.trim()} role="dialog" aria-modal="true" style={{ zIndex: LAYER_TOKENS.modal }}>{children}</div>
    </div>,
    document.body,
  )
}

function AccountDialog({ mode, initialDisplayName = '', initialEmail = '', onClose, onSubmit }) {
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const title = mode === 'protect' ? 'Proteger conta' : mode === 'login' ? 'Entrar em conta protegida' : mode === 'password' ? 'Alterar senha' : 'Renomear conta'
  const submit = async event => { event.preventDefault(); setError(''); if ((mode === 'protect' || mode === 'login' || mode === 'password') && !password.trim()) return setError('Informe a senha.'); if ((mode === 'protect' || mode === 'password') && password !== confirmPassword) return setError('As senhas não conferem.'); if ((mode === 'protect' || mode === 'rename') && !displayName.trim()) return setError('Informe o nome da conta.'); if ((mode === 'login' || mode === 'protect') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Informe um e-mail válido.'); setBusy(true); try { await onSubmit(mode, { displayName, email, password, confirmPassword, currentPassword }); } catch (e) { setError(errorText(e)) } finally { setBusy(false) } }
  if (mode === 'add') return <ModalLayer onClose={onClose}><div className="modal-head"><div><span className="eyebrow">CONTAS</span><h2>Adicionar conta</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div><p className="modal-copy">Continue localmente sem cadastro ou entre em uma conta protegida existente.</p><div className="account-add-options"><button type="button" className="secondary" onClick={() => onSubmit('create-local', {})} disabled={busy}>Continuar localmente</button><button type="button" className="primary" onClick={() => onSubmit('login-form', {})} disabled={busy}>Entrar em conta protegida</button></div>{error && <div className="alert error">{error}</div>}</ModalLayer>
  return <ModalLayer onClose={onClose}><form onSubmit={submit}><div className="modal-head"><div><span className="eyebrow">CONTAS</span><h2>{title}</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div>{mode === 'login' && <p className="modal-copy">Use o e-mail e a senha da conta protegida para acessar os dados financeiros existentes.</p>}{mode === 'protect' && <p className="modal-copy">A conta atual será protegida sem criar uma nova conta nem alterar seus dados financeiros.</p>}{error && <div className="alert error">{error}</div>}{(mode === 'protect' || mode === 'rename') && <label>Nome da conta<input autoFocus value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength="80" /></label>}{(mode === 'protect' || mode === 'login') && <label>E-mail<input type="email" autoFocus={mode === 'login'} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength="254" /></label>}{mode === 'password' && <label>Senha atual<input autoFocus type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label>}{(mode === 'protect' || mode === 'login' || mode === 'password') && <label>{mode === 'password' ? 'Nova senha' : 'Senha'}<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>}{(mode === 'protect' || mode === 'password') && <label>Confirmar senha<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>}{mode === 'protect' && <small className="field-hint">Use este e-mail e senha para entrar novamente em sua conta protegida.</small>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button><button type="submit" className="primary" disabled={busy}>{busy ? 'Processando…' : mode === 'login' ? 'Entrar' : mode === 'protect' ? 'Proteger conta' : mode === 'password' ? 'Alterar senha' : 'Renomear'}</button></div></form></ModalLayer>
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

function AccountAvatar({ account, size = 'default', className = '', decorative = true }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [account?.avatarUrl])
  const initial = (account?.displayName || 'M').slice(0, 1).toUpperCase()
  return <span className={`account-avatar-view account-avatar-view-${size} ${className}`.trim()} aria-hidden={decorative ? 'true' : undefined}>
    {account?.avatarUrl && !failed ? <img src={account.avatarUrl} alt={decorative ? '' : 'Pré-visualização da foto de perfil'} onError={() => setFailed(true)} /> : initial}
  </span>
}

function ProfileImageDialog({ account, busy, onClose, onSave, onRemove }) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])
  const choose = event => {
    const next = event.target.files?.[0]
    event.target.value = ''
    if (!next) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) return setError('Use uma imagem JPEG, PNG ou WebP.')
    if (next.size > 5 * 1024 * 1024) return setError('A foto deve ter no máximo 5 MB.')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setError(''); setFile(next); setPreviewUrl(URL.createObjectURL(next))
  }
  const save = async () => { if (!file || busy) return; setError(''); try { await onSave(file) } catch (e) { setError(errorText(e)) } }
  const remove = async () => { if (busy) return; setError(''); try { await onRemove() } catch (e) { setError(errorText(e)) } }
  return <ModalLayer onClose={() => { if (!busy) onClose() }}><div className="modal-head"><div><span className="eyebrow">PERFIL</span><h2>Alterar foto de perfil</h2></div><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Fechar">×</button></div><div className="profile-image-dialog-content"><AccountAvatar account={file ? { ...account, avatarUrl: previewUrl } : account} size="preview" decorative={false} /><p>{file?.name || (account.avatarUrl ? 'Foto atual' : 'Nenhuma foto selecionada')}</p></div>{error && <div className="alert error" role="alert">{error}</div>}<input id="profile-image-file" type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={choose} /><div className="profile-image-dialog-actions"><label className="secondary" htmlFor="profile-image-file">Escolher imagem</label>{account.avatarUrl && <button type="button" className="secondary" onClick={remove} disabled={busy}>{busy ? 'Salvando…' : 'Remover foto'}</button>}<button type="button" className="primary" onClick={save} disabled={!file || busy}>{busy ? 'Salvando…' : 'Salvar foto'}</button></div></ModalLayer>
}

function AccountPopover({ accountState, busy, onClose, onProfile, onProtect, onSwitch, onAdd, onRemove }) {
  const popoverRef = useRef(null)
  const current = accountState?.current
  const accounts = accountState?.accounts || []
  const atLimit = accounts.length >= (accountState?.limit || 4)
  useEffect(() => {
    const close = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.type === 'mousedown' && !popoverRef.current?.contains(event.target) && !event.target.closest('.app-account-button')) onClose()
    }
    document.addEventListener('keydown', close)
    document.addEventListener('mousedown', close)
    const first = popoverRef.current?.querySelector('button')
    first?.focus()
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('mousedown', close) }
  }, [onClose])
  if (!current) return null
  const run = action => { if (!busy) action() }
  return <div ref={popoverRef} className="account-popover account-card-popover" role="dialog" aria-label="Gerenciamento da conta">
    <div className="account-popover-identity"><AccountAvatar account={current} /><span><strong>{current.displayName || 'Minha conta'}</strong><small>{current.isLocal ? 'Conta local' : 'Conta protegida'}</small></span></div>
    {current.isLocal ? <section className="account-protection-card"><div className="account-protection-copy"><span className="account-protection-icon"><ShieldCheck size={16} /></span><div><div className="account-protection-title-row"><strong>Proteja sua conta</strong></div><p>Use e-mail e senha para acessar esta mesma conta com segurança em outros contextos.</p></div></div><button type="button" className="account-protection-cta" onClick={() => run(onProtect)} disabled={busy}>Proteger conta</button></section> : <div className="account-protected-state"><ShieldCheck size={15} /> Conta protegida{current.email ? ` · ${current.email}` : ''}</div>}
    <div className="account-popover-divider" />
    <div className="account-actions account-management">
      <button type="button" onClick={() => run(onProfile)} disabled={busy}><Settings size={17} /> Perfil e Segurança <ChevronRight size={15} /></button>
      <button type="button" onClick={() => run(onSwitch)} disabled={busy}><Users size={17} /> Trocar conta <ChevronRight size={15} /></button>
      <button type="button" onClick={() => run(onAdd)} disabled={busy || atLimit}><Plus size={17} /> Adicionar conta <Plus size={15} /></button>
    </div>
    {atLimit && <p className="account-limit-message">Limite de 4 contas atingido. Remova uma conta protegida deste dispositivo para liberar espaço.</p>}
    {!current.isLocal && <button type="button" className="account-remove-device" onClick={() => run(onRemove)} disabled={busy}>Remover deste dispositivo</button>}
    <div className="account-popover-footer" aria-label={`Versão ${APP_VERSION}`}><strong>Aloca</strong><span>{APP_VERSION}</span></div>
  </div>
}


function SupportPage({ account }) {
  return <section className="account-page support-page"><div className="page-heading"><PageHeader eyebrow="AJUDA" title="Suporte" description="Entre em contato para tirar dúvidas, relatar problemas ou enviar sugestões." /><LifeBuoy size={34} aria-hidden="true" /></div><article className="account-card support-card"><div className="account-card-icon"><Mail size={20} /></div><div><span className="eyebrow">CANAL DE CONTATO</span><h3>alocafinance.app@gmail.com</h3><p>Responderemos pelo e-mail informado assim que possível.</p><a className="primary support-contact-button" href="mailto:alocafinance.app@gmail.com"><Mail size={17} />Entrar em contato</a></div></article></section>
}

function ProfileSecurityPage({ account, onUpdateProfile, onSecurity, onDelete, onSaveAvatar, onRemoveAvatar, accountMutationBusy }) {
  const [displayName, setDisplayName] = useState(account.displayName || '')
  const [email, setEmail] = useState(account.email || '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false)
  useEffect(() => { setDisplayName(account.displayName || ''); setEmail(account.email || '') }, [account.id, account.displayName, account.email])
  const save = async event => { event.preventDefault(); setError(''); setSaved(false); if (!displayName.trim()) return setError('Informe o nome da conta.'); if (!account.isLocal && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Informe um e-mail válido.'); setSaving(true); try { await onUpdateProfile(account.isLocal ? { displayName } : { displayName, email }); setSaved(true) } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  const accountType = account.isLocal ? 'Local neste dispositivo' : 'Protegida por senha'
  const securityLabel = account.isLocal ? 'Ainda não protegida' : 'Protegida'
  const focusProfile = () => { const input = document.querySelector('#profile-name'); input?.scrollIntoView({ behavior: 'smooth', block: 'center' }); input?.focus() }
  return <section className="account-page profile-page"><div className="page-heading"><PageHeader eyebrow="CONFIGURAÇÕES" title="Perfil e Segurança" description="Gerencie suas informações e mantenha sua conta protegida." /></div><header className="profile-hero"><div className="profile-hero-banner" aria-hidden="true"><span>ALOCA <small>BETA</small></span></div><div className="profile-hero-content"><button type="button" className="profile-avatar-button" onClick={() => setAvatarDialogOpen(true)} disabled={accountMutationBusy} aria-label="Alterar foto de perfil" title="Alterar foto de perfil"><AccountAvatar account={account} size="hero" /><span className="profile-avatar-edit" aria-hidden="true"><Camera size={13} /></span></button><div className="profile-hero-copy"><h3>{account.displayName || 'Sua conta'}</h3><p>{account.isLocal ? 'Conta local' : 'Conta protegida'}</p><span className={`account-status ${account.isLocal ? 'is-local' : ''}`}><ShieldCheck size={15} />{securityLabel}</span></div><button type="button" className="profile-edit-link" onClick={focusProfile}><Pencil size={15} />Editar perfil</button></div></header><div className="account-summary" aria-label="Resumo da conta"><div><div className="summary-label"><UserCircle size={14} aria-hidden="true" /><span>Conta ativa</span></div><strong>{accountType}</strong></div><div><div className="summary-label"><ShieldCheck size={14} aria-hidden="true" /><span>Segurança</span></div><strong className={account.isLocal ? 'summary-muted' : 'summary-success'}>{securityLabel}</strong></div><div><div className="summary-label"><Info size={14} aria-hidden="true" /><span>Contexto</span></div><strong>{account.isLocal ? 'Seus dados ficam neste dispositivo.' : 'Acesso por e-mail e senha.'}</strong></div></div><div className="account-page-grid"><section className="account-card account-profile-card"><div className="account-card-heading"><div><span className="eyebrow">PERFIL</span><h3>Perfil</h3><p>Gerencie suas informações básicas.</p></div><Pencil size={18} aria-hidden="true" /></div><form onSubmit={save} className="account-form">{error && <div className="alert error" role="alert" aria-live="assertive">{error}</div>}<label>Nome da conta<input id="profile-name" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength="80" /></label>{!account.isLocal && <label>E-mail<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength="254" /><small className="field-hint">Seu e-mail é privado e usado para acessar sua conta.</small></label>}<div className="account-form-actions"><button className="primary" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button>{saved && <span className="form-success" role="status">Alterações salvas</span>}</div></form></section><section className={`account-card account-security-card ${account.isLocal ? 'is-unprotected' : 'is-protected'}`}><div className="account-card-heading"><div><span className="eyebrow">SEGURANÇA</span><h3>Segurança da conta</h3><p>{account.isLocal ? 'Mantenha seus dados protegidos e acessíveis.' : 'Gerencie o acesso seguro à sua conta.'}</p></div><ShieldCheck size={18} aria-hidden="true" /></div>{account.isLocal ? <><div className="security-local-callout"><strong>Conta local</strong><span>Esta conta usa apenas um nome neste dispositivo. Seus dados ficam salvos localmente.</span></div><div className="security-protect-copy"><strong>Proteja sua conta</strong><p>Crie uma conta com e-mail e senha para manter seus dados seguros e acessíveis em outros dispositivos.</p></div><button className="primary" type="button" onClick={() => onSecurity('protect')}>Configurar conta segura</button></> : <><div className="security-state"><span className="security-state-icon" aria-hidden="true">✓</span><strong>Conta protegida</strong></div><dl className="security-details"><div><dt>E-mail</dt><dd>{account.email}</dd></div></dl><button className="secondary" type="button" onClick={() => onSecurity('password')}>Alterar senha</button></>}</section><section className="account-card danger-zone"><div className="danger-copy"><div className="account-card-heading"><div><span className="eyebrow">ZONA DE PERIGO</span><h3>Excluir conta</h3></div><TriangleAlert size={18} aria-hidden="true" /></div><p>Estas ações são permanentes e não podem ser desfeitas.</p><small>Exclui permanentemente a conta e todos os seus dados.</small></div><button className="danger-button" type="button" onClick={onDelete}>Excluir conta</button></section></div>{avatarDialogOpen && <ProfileImageDialog account={account} busy={accountMutationBusy} onClose={() => setAvatarDialogOpen(false)} onSave={async file => { await onSaveAvatar(file); setAvatarDialogOpen(false) }} onRemove={async () => { await onRemoveAvatar(); setAvatarDialogOpen(false) }} />}</section>
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
  const primaryItems = navigationItems.slice(0, 5)
  const secondaryItems = navigationItems.slice(5)
  return <aside className="app-sidebar" aria-label="Navegação principal">
    <nav className="app-sidebar-primary">
      {primaryItems.map(item => <NavItem key={item.id} href={item.href} label={item.desktopLabel} icon={item.icon} active={navigationItemIsActive(item, view)} />)}
    </nav>
    <nav className="app-sidebar-secondary" aria-label="Navegação secundária">
      {secondaryItems.map(item => <NavItem key={item.id} href={item.href} label={item.desktopLabel} icon={item.icon} active={navigationItemIsActive(item, view)} />)}
    </nav>
  </aside>
}

function AppTopbar({ account, accountState, accountMutationBusy, accountPopoverOpen, onToggleAccount, onCloseAccount, onAccountAction, createMenuOpen, onToggleCreate, onNewIncome, onNewExpense, onNewRecurring, onNewCommitment, theme, onToggleTheme, onOpenNavigation, calculatorOpen, onToggleCalculator }) {
  return <header className="app-topbar">
    <img className="app-mobile-brand" src="/aloca-mark-mobile.png" alt="Aloca" />
    <button type="button" className="app-mobile-menu-button" onClick={onOpenNavigation} aria-label="Abrir navegação" aria-controls="mobile-navigation"><Menu size={20} /></button>
    <div className="app-topbar-actions">
      <div className="app-create-wrap">
        <button type="button" className="app-create-button" aria-label="Novo" title="Novo" aria-haspopup="menu" aria-expanded={createMenuOpen} onClick={onToggleCreate}><Icon icon={Plus} size={19} /><span className="app-create-label">Novo</span></button>
        {createMenuOpen && <div className="app-create-menu" role="menu"><button type="button" role="menuitem" onClick={onNewIncome}>Nova entrada</button><button type="button" role="menuitem" onClick={onNewExpense}>Nova saída</button><button type="button" role="menuitem" onClick={onNewRecurring}>Nova entrada recorrente</button><button type="button" role="menuitem" onClick={onNewCommitment}>Novo compromisso</button></div>}
      </div>
      <button type="button" className={`calculator-trigger${calculatorOpen ? ' active' : ''}`} onClick={onToggleCalculator} aria-label="Calculadora" aria-expanded={calculatorOpen} title="Calculadora"><Calculator size={20} /></button>
      <button type="button" className="app-theme-toggle" onClick={onToggleTheme} aria-label="Alternar tema" title="Alternar tema"><Sun size={16} /><span><i /></span><Moon size={16} /></button>
      <div className="app-account-wrap"><button type="button" className="app-account-button" onClick={onToggleAccount} aria-haspopup="dialog" aria-expanded={accountPopoverOpen} aria-controls={accountPopoverOpen ? 'account-popover' : undefined} aria-label="Abrir gerenciamento da conta"><AccountAvatar account={account} className="app-account-avatar" /><span><strong>{account?.displayName || 'Minha conta'}</strong><small>{account?.isLocal ? 'Conta local' : 'Conta protegida'}</small></span><ChevronDown size={17} /></button>{accountPopoverOpen && <div id="account-popover"><AccountPopover accountState={accountState} busy={accountMutationBusy} onClose={onCloseAccount} onProfile={onAccountAction.profile} onProtect={onAccountAction.protect} onSwitch={onAccountAction.switch} onAdd={onAccountAction.add} onRemove={onAccountAction.remove} /></div>}</div>
    </div>
  </header>
}

function MobileNavigation({ view, onClose }) {
  return <div className="mobile-navigation-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <aside id="mobile-navigation" className="mobile-navigation" role="dialog" aria-modal="true" aria-label="Navegação">
      <div className="mobile-navigation-header"><span className="eyebrow">ALOCA</span><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar navegação">×</button></div>
      <nav>{navigationItems.map(item => <a key={item.id} href={item.href} className={navigationItemIsActive(item, view) ? 'is-active' : ''} onClick={onClose}><item.icon size={19} /><span>{item.desktopLabel}</span></a>)}</nav>
    </aside>
  </div>
}

function MobileBottomNavigation({ view }) {
  return <nav className="mobile-bottom-navigation" aria-label="Navegação mobile">
    <div className="mobile-bottom-navigation-scroll">
      {navigationItems.map(item => {
        const active = navigationItemIsActive(item, view)
        const Glyph = item.icon
        return <a key={item.id} href={item.href} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined}>
          <Glyph size={19} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
          <span>{item.mobileLabel}</span>
        </a>
      })}
    </div>
  </nav>
}

const dashboardCards = [
  { key: 'current', variant: 'solid-light', label: 'SALDO ATUAL', icon: Wallet, title: 'Saldo atual', description: 'Quanto dinheiro você possui efetivamente agora. Considera entradas, saídas e ajustes já realizados; não considera reservas ou previsões.' },
  { key: 'reserved', variant: 'neutral', label: 'SALDO RESERVADO', icon: LockKeyhole, title: 'Saldo reservado', description: 'Parte do seu saldo atual que já foi separada para compromissos futuros. Esse dinheiro continua no saldo atual, mas já possui destino.' },
  { key: 'unallocated', variant: 'solid-accent', label: 'SALDO NÃO ALOCADO', icon: Wallet, title: 'Saldo não alocado', description: 'Parte do seu saldo atual que ainda não foi reservada. Não significa necessariamente dinheiro livre, pois podem existir compromissos sem cobertura.' },
  { key: 'free', variant: 'neutral', label: 'SALDO LIVRE', icon: BarChart3, title: 'Saldo livre', description: 'Parte do saldo não alocado que realmente sobra depois de considerar compromissos ainda sem cobertura.' },
]

function DashboardPage({ account, summary, monthlySummary, monthlyLoading, monthlyError, selectedMonth, onMonthChange, onRetryMonthly, commitments, onViewCommitments, incomes, expenses, dataError, onRetry, onEditBalance }) {
  const [objective, setObjective] = useState(() => window.localStorage.getItem('aloca-commitment-objective') || '')
  const values = {
    current: Number(summary?.currentBalance) || 0,
    reserved: Number(summary?.allocatedBalance) || 0,
    unallocated: Number(summary?.unallocatedBalance) || 0,
    free: Number(summary?.freeBalance) || 0,
  }
  return <section className="dashboard-page" aria-labelledby="dashboard-title">
    <div className="dashboard-desktop-view">
    <header className="dashboard-header">
      <h1 id="dashboard-title">Bem-vindo de volta!</h1>
      <p>Seu dinheiro, sob controle.</p>
    </header>
    <div className="dashboard-balance-grid" aria-label="Saldos financeiros">
      {dashboardCards.map(({ key, variant, label, icon: Glyph, title, description }) => <article key={key} className={`dashboard-balance-card dashboard-balance-card--${variant}`}>
        <div className="dashboard-card-topline"><span className="dashboard-card-label">{label} <InfoTooltip title={title} description={description} /></span><span className="dashboard-card-actions"><span className="dashboard-card-icon" aria-hidden="true"><Glyph size={19} strokeWidth={1.8} /></span>{key === 'current' && <button type="button" className="dashboard-balance-edit" onClick={onEditBalance} aria-label="Editar saldo atual" title="Editar saldo atual"><Pencil size={16} /></button>}</span></div>
        <div className="dashboard-card-content"><strong className="dashboard-card-value">{money(values[key])}</strong><div className="dashboard-card-auxiliary">{key === 'current' && <span className="dashboard-card-status">Disponível</span>}</div></div>
      </article>)}
    </div>
    <div className="dashboard-secondary-grid">
      <MonthlySummaryCard summary={monthlySummary} commitments={commitments} loading={monthlyLoading} error={monthlyError} selectedMonth={selectedMonth} onMonthChange={onMonthChange} onRetry={onRetryMonthly} />
      <section className="dashboard-secondary-card dashboard-objective-card">
        <CommitmentObjective selectedObjective={objective} onChange={value => { setObjective(value); window.localStorage.setItem('aloca-commitment-objective', value) }} />
      </section>
    </div>
    <UpcomingCommitmentsSection commitments={commitments} onViewAll={onViewCommitments} />
    <RecentMovementsSection incomes={incomes} expenses={expenses} error={dataError} onRetry={onRetry} onViewAll={() => { window.location.hash = 'movimentacoes' }} />
    </div>
    <MobileDashboard account={account} summary={summary} monthlySummary={monthlySummary} monthlyLoading={monthlyLoading} monthlyError={monthlyError} selectedMonth={selectedMonth} onMonthChange={onMonthChange} onRetryMonthly={onRetryMonthly} commitments={commitments} incomes={incomes} expenses={expenses} dataError={dataError} onRetry={onRetry} onViewCommitments={onViewCommitments} onEditBalance={onEditBalance} />
  </section>
}

function MobileDashboard({ account, summary, monthlySummary, monthlyLoading, monthlyError, selectedMonth, onMonthChange, onRetryMonthly, commitments = [], incomes = [], expenses = [], dataError = '', onRetry, onViewCommitments, onEditBalance }) {
  const [objective, setObjective] = useState(() => window.localStorage.getItem('aloca-commitment-objective') || '')
  const current = Number(summary?.currentBalance) || 0
  const reserved = Number(summary?.allocatedBalance) || 0
  const unallocated = Number(summary?.unallocatedBalance) || 0
  const free = Number(summary?.freeBalance) || 0
  const upcoming = [...commitments]
    .filter(item => !item.isCompleted && (item.nextDueDate || item.dueDate))
    .sort((left, right) => (left.priority ?? Number.MAX_SAFE_INTEGER) - (right.priority ?? Number.MAX_SAFE_INTEGER) || String(left.nextDueDate || left.dueDate).localeCompare(String(right.nextDueDate || right.dueDate)) || left.name.localeCompare(right.name))
    .slice(0, 3)
  const firstName = String(account?.displayName || '').trim().split(/\s+/)[0] || 'aqui'

  return <div className="mobile-dashboard" aria-label="Resumo financeiro mobile">
    <header className="mobile-dashboard-heading"><p>Olá, {firstName} <span aria-hidden="true">👋</span></p><h1>Seu resumo financeiro</h1></header>
    <div className="mobile-dashboard-month"><CalendarDays size={17} strokeWidth={1.8} aria-hidden="true" /><MonthPicker value={selectedMonth} onChange={onMonthChange} /></div>
    <section className="mobile-dashboard-section mobile-dashboard-summary" aria-labelledby="mobile-summary-title"><header className="mobile-dashboard-section-heading"><h2 id="mobile-summary-title">Resumo</h2><a href="#previsoes">Ver tudo</a></header><div className="mobile-dashboard-context-chips" aria-label="Contexto do resumo"><span className="is-active" aria-current="page">Este mês</span></div></section>
    <section className="mobile-dashboard-hero" aria-label="Saldo atual"><div className="mobile-dashboard-hero-label"><span>SALDO ATUAL <InfoTooltip title="Saldo atual" description="Quanto dinheiro você possui efetivamente agora. Considera entradas, saídas e ajustes já realizados; não considera reservas, previsões ou compromissos não pagos." /></span><span className="mobile-dashboard-hero-actions"><Wallet size={18} strokeWidth={1.8} aria-hidden="true" /><button type="button" className="dashboard-balance-edit" onClick={onEditBalance} aria-label="Editar saldo atual" title="Editar saldo atual"><Pencil size={16} /></button></span></div><strong>{money(current)}</strong><span>Disponível hoje</span></section>
    <section className="mobile-dashboard-metrics" aria-label="Saldos financeiros"><article><span>Reservado <InfoTooltip title="Saldo reservado" description="Parte do seu saldo atual que já foi separada para compromissos futuros. Esse dinheiro continua no saldo atual, mas já possui destino." /></span><strong>{money(reserved)}</strong></article><article><span>Não alocado <InfoTooltip title="Saldo não alocado" description="Parte do seu saldo atual que ainda não foi reservada. Não significa necessariamente dinheiro livre, pois podem existir compromissos sem cobertura." /></span><strong>{money(unallocated)}</strong></article><article><span>Saldo livre <InfoTooltip title="Saldo livre" description="Parte do saldo não alocado que realmente sobra depois de considerar compromissos ainda sem cobertura." /></span><strong>{money(free)}</strong></article></section>
    <MonthlyFinancialSummary summary={monthlySummary} commitments={commitments} loading={monthlyLoading} error={monthlyError} selectedMonth={selectedMonth} onMonthChange={onMonthChange} onRetry={onRetryMonthly} onView={onViewCommitments} mobileCompact />
    <section className="mobile-dashboard-section mobile-dashboard-objective" aria-labelledby="mobile-objective-title"><header className="mobile-dashboard-section-heading"><h2 id="mobile-objective-title">Objetivo da reserva</h2></header><CommitmentObjective selectedObjective={objective} onChange={value => { setObjective(value); window.localStorage.setItem('aloca-commitment-objective', value) }} /></section>
    <section className="mobile-dashboard-section mobile-dashboard-upcoming" aria-labelledby="mobile-upcoming-title"><header className="mobile-dashboard-section-heading"><h2 id="mobile-upcoming-title">Próximos pagamentos</h2><button type="button" onClick={onViewCommitments}>Ver todos</button></header>{monthlyError && !monthlySummary && <div className="mobile-dashboard-inline-error" role="alert"><span>Não foi possível carregar o resumo do mês.</span><button type="button" onClick={onRetryMonthly}>Tentar novamente</button></div>}{upcoming.length ? <div className="mobile-dashboard-payment-list">{upcoming.map(item => { const urgent = Boolean(item.urgent || item.requiresAttention); const amount = Number(item.installmentAmount ?? item.missingForNextInstallment ?? 0); const coverage = Math.min(100, Math.max(0, Number(item.isOpenEnded ? item.coveragePercentage : item.overallCoveragePercentage) || 0)); return <button type="button" className={`mobile-dashboard-payment${urgent ? ' is-urgent' : ''}`} key={item.id} onClick={onViewCommitments} aria-label={`Abrir compromissos. ${item.name}`}><span className="mobile-dashboard-payment-icon" aria-hidden="true">{urgent ? <CircleAlert size={17} /> : <CalendarDays size={17} />}</span><span className="mobile-dashboard-payment-copy"><strong>{item.name}</strong><small>{formatDate(item.nextDueDate || item.dueDate)} · Cobertura {Math.round(coverage)}%</small></span><strong className="mobile-dashboard-payment-amount">{money(amount)}</strong><ChevronRight size={17} aria-hidden="true" /></button> })}</div> : <p className="mobile-dashboard-empty">Nenhum pagamento próximo.</p>}</section>
    <RecentMovementsSection incomes={incomes} expenses={expenses} error={dataError} onRetry={onRetry} onViewAll={() => { window.location.hash = 'movimentacoes' }} />
  </div>
}

function UpcomingCommitmentsSection({ commitments, onViewAll }) {
  const upcoming = [...(commitments || [])]
    .filter(item => !item.isCompleted && (item.nextDueDate || item.dueDate))
    .sort((left, right) => (left.priority ?? Number.MAX_SAFE_INTEGER) - (right.priority ?? Number.MAX_SAFE_INTEGER) || String(left.nextDueDate || left.dueDate).localeCompare(String(right.nextDueDate || right.dueDate)) || left.name.localeCompare(right.name))
    .slice(0, 3)
  return <section className="dashboard-upcoming" aria-labelledby="upcoming-commitments-title">
    <header className="dashboard-upcoming-header"><div><span className="eyebrow">COMPROMISSOS FINANCEIROS</span><h2 id="upcoming-commitments-title">Próximos compromissos</h2></div><button type="button" className="dashboard-upcoming-link" onClick={onViewAll}>Ver todos</button></header>
    {upcoming.length ? <div className="dashboard-upcoming-grid">{upcoming.map(item => {
      const coverage = Math.min(100, Math.max(0, Number(item.isOpenEnded ? item.coveragePercentage : item.overallCoveragePercentage) || 0))
      const nextAmount = Number(item.installmentAmount ?? item.missingForNextInstallment ?? 0)
      const priority = item.urgent || item.requiresAttention ? 'Atenção' : item.priority === 1 ? 'Alta' : ''
      return <article className={`dashboard-upcoming-card${priority ? ' is-attention' : ''}`} key={item.id}>
        <div className="dashboard-upcoming-title"><h3>{item.name}</h3>{priority && <span>{priority}</span>}</div>
        <div className="dashboard-upcoming-main"><div><small>Próxima parcela</small><strong>{money(nextAmount)}</strong></div><div><small>Vencimento</small><strong>{formatDate(item.nextDueDate || item.dueDate)}</strong></div></div>
        <div className="dashboard-upcoming-coverage"><div><small>Cobertura</small><strong>{Math.round(coverage)}%</strong></div><div className="dashboard-upcoming-progress" role="progressbar" aria-label={`Cobertura de ${item.name}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(coverage)}><span className={coverage >= 100 ? 'is-complete' : coverage > 0 ? 'is-partial' : 'is-empty'} style={{ width: `${coverage}%` }} /></div></div>
      </article>
    })}</div> : <div className="dashboard-upcoming-empty"><strong>Nenhum compromisso próximo.</strong><span>Seus próximos compromissos aparecerão aqui.</span></div>}
  </section>
}

function RecentMovementsSection({ incomes = [], expenses = [], error = '', onRetry, onViewAll }) {
  const movements = [...incomes.map(item => ({ ...item, movementType: 'income' })), ...expenses.map(item => ({ ...item, movementType: 'expense' }))]
    .sort((left, right) => String(right.date).localeCompare(String(left.date)))
    .slice(0, 4)
  return <section className="dashboard-recent" aria-labelledby="recent-movements-title">
    <header className="dashboard-recent-header"><div><span className="eyebrow">MOVIMENTAÇÕES</span><h2 id="recent-movements-title">Movimentações recentes</h2></div><button type="button" className="dashboard-recent-link" onClick={onViewAll}>Ver todas</button></header>
    {error ? <div className="dashboard-recent-empty" role="alert"><strong>Não foi possível carregar as movimentações recentes.</strong><button type="button" className="dashboard-recent-retry" onClick={onRetry}>Tentar novamente</button></div> : movements.length ? <div className="dashboard-recent-list">{movements.map(item => {
      const isIncome = item.movementType === 'income'
      const IconGlyph = isIncome ? ArrowUpRight : ArrowDownLeft
      return <div className="dashboard-recent-row" key={`${item.movementType}-${item.id}`}>
        <span className={`dashboard-recent-icon is-${item.movementType}`} aria-hidden="true"><IconGlyph size={17} strokeWidth={1.9} /></span>
        <span className="dashboard-recent-description"><strong>{item.description}</strong>{item.isBalanceAdjustment && <small className="dashboard-recent-state" title="Correção manual utilizada para alinhar o saldo atual ao valor real informado. Não é considerada receita nem despesa.">Ajuste de saldo</small>}{item.isRealized === false && <small className="dashboard-recent-state">Agendada</small>}{item.categoryName && <small>{item.categoryName}</small>}</span>
        <time dateTime={item.date}>{formatDate(item.date)}</time>
        <strong className={`dashboard-recent-amount is-${item.movementType}`}>{isIncome ? '+ ' : '- '}{money(item.amount)}</strong>
      </div>
    })}</div> : <div className="dashboard-recent-empty"><strong>Nenhuma movimentação recente.</strong><span>Suas entradas e saídas aparecerão aqui.</span></div>}
  </section>
}

const normalizeMonth = value => {
  const match = /^(\d{4})-(\d{2})/.exec(String(value || ''))
  if (match && Number(match[2]) >= 1 && Number(match[2]) <= 12) return `${match[1]}-${match[2]}`
  return businessMonth()
}
const monthLabel = value => {
  const month = normalizeMonth(value)
  const [year, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, monthNumber - 1, 1))
}
const monthPickerNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function MonthPicker({ value, onChange }) {
  const normalized = normalizeMonth(value)
  const [selectedYear, selectedMonthNumber] = normalized.split('-').map(Number)
  const [displayYear, setDisplayYear] = useState(selectedYear)
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const pickerRef = useRef(null)

  useEffect(() => {
    setDisplayYear(selectedYear)
  }, [selectedYear])

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutsideClick = event => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = event => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const chooseMonth = month => {
    onChange(`${displayYear}-${String(month).padStart(2, '0')}`)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return <div ref={pickerRef} className={`dashboard-month-picker${open ? ' is-open' : ''}`}>
    <button ref={triggerRef} type="button" className="dashboard-month-picker-trigger" aria-label="Selecionar mês do resumo financeiro" aria-expanded={open} aria-haspopup="dialog" onClick={() => { setDisplayYear(selectedYear); setOpen(current => !current) }}>
      <span>{monthLabel(normalized)}</span><ChevronDown size={15} strokeWidth={1.9} aria-hidden="true" />
    </button>
    {open && <div className="dashboard-month-popover" role="dialog" aria-label={`Selecionar mês de ${displayYear}`}>
      <div className="dashboard-month-popover-header"><button type="button" className="dashboard-month-year-button" aria-label={`Ano anterior a ${displayYear}`} onClick={() => setDisplayYear(year => year - 1)}><ChevronLeft size={17} aria-hidden="true" /></button><strong>{displayYear}</strong><button type="button" className="dashboard-month-year-button" aria-label={`Ano posterior a ${displayYear}`} onClick={() => setDisplayYear(year => year + 1)}><ChevronRight size={17} aria-hidden="true" /></button></div>
      <div className="dashboard-month-grid">{monthPickerNames.map((name, index) => {
        const month = index + 1
        const isSelected = displayYear === selectedYear && month === selectedMonthNumber
        const current = new Date()
        const isCurrent = displayYear === current.getFullYear() && month === current.getMonth() + 1
        return <button type="button" key={name} className={`dashboard-month-option${isSelected ? ' is-selected' : ''}${isCurrent ? ' is-current' : ''}`} aria-label={`${name} de ${displayYear}`} aria-current={isSelected ? 'date' : undefined} onClick={() => chooseMonth(month)}>{name}</button>
      })}</div>
    </div>}
  </div>
}

function MonthlySummaryCard({ summary, commitments = [], loading, error, selectedMonth, onMonthChange, onRetry }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const metrics = summary ? [
    { key: 'income', label: 'Entradas do mês', value: money(summary.entradasTotais ?? 0), detail: `Realizadas ${money(summary.entradasRealizadas ?? 0)} · Previstas ${money(summary.entradasPrevistas ?? 0)}`, icon: ArrowDownLeft, tone: 'income', tooltip: 'Reúne o que já entrou e o que ainda está previsto para entrar no período. O total é a soma de realizadas e previstas.' },
    { key: 'expenses', label: 'Saídas do mês', value: money(summary.saidasTotais ?? 0), detail: `Realizadas ${money(summary.saidasRealizadas ?? 0)} · Previstas ${money(summary.saidasPrevistas ?? 0)}`, icon: ArrowUpRight, tone: 'expense', tooltip: 'Reúne o que já saiu e o que ainda está previsto para sair no período. Compromissos pagos entram como realizados; pendentes entram como previstos.' },
    { key: 'real-result', label: 'Resultado real', value: signedMoney(summary.resultadoReal ?? 0), detail: 'Entradas realizadas − saídas realizadas', icon: ArrowLeftRight, tone: Number(summary.resultadoReal) < 0 ? 'negative' : Number(summary.resultadoReal) > 0 ? 'positive' : 'neutral', tooltip: 'Diferença entre as entradas e saídas que realmente aconteceram no período. Valores previstos não entram.' },
    { key: 'forecast-result', label: 'Resultado previsto', value: signedMoney(summary.resultadoPrevisto ?? 0), detail: 'Entradas totais − saídas totais', icon: ArrowLeftRight, tone: Number(summary.resultadoPrevisto) < 0 ? 'negative' : Number(summary.resultadoPrevisto) > 0 ? 'positive' : 'neutral', tooltip: 'Diferença entre todas as entradas e saídas do período, considerando valores realizados e previstos.' },
    { key: 'reserved', variant: 'solid-light', label: 'Reservado / alocado', value: money(summary.allocatedAmount ?? 0), icon: Wallet, tone: 'reserved', tooltip: 'Valor já alocado para cobrir os compromissos deste mês.' },
    { key: 'final', variant: 'solid-accent', label: 'Saldo final estimado', value: money(summary.estimatedFinalBalance ?? 0), icon: BarChart3, tone: Number(summary.estimatedFinalBalance) < 0 ? 'negative' : 'positive', tooltip: 'Parte do saldo atual e considera somente eventos futuros ainda não realizados.' },
  ] : []
  const monthlyCommitments = summary?.commitments || []
  const pendingCommitments = monthlyCommitments.filter(item => !item.isCovered)
  const urgentPending = monthlyCommitments.filter(item => Boolean(item.urgent && item.requiresAttention))
  const globalUrgentCommitments = summary?.urgentCommitments || []
  const urgentCommitments = globalUrgentCommitments.length > 0
    ? globalUrgentCommitments
    : Array.from(new Map(urgentPending.map(item => [String(item.commitmentId || item.id).split(':')[0], item])).values())
  const hasDeficit = Number(summary?.missingAmount) > 0
  const monthText = monthLabel(selectedMonth)
  const missingForUrgent = urgentCommitments.reduce((total, item) => total + (Number(item.overallRemainingAmount) || 0), 0)
  useEffect(() => { setDetailsOpen(false) }, [selectedMonth])
  return <section className="dashboard-secondary-card dashboard-month-summary" aria-labelledby="monthly-summary-title">
    <header className="dashboard-month-header"><div><span className="eyebrow">CONTEXTO TEMPORAL</span><h2 id="monthly-summary-title">Resumo financeiro do mês</h2></div><MonthPicker value={selectedMonth} onChange={onMonthChange} /></header>
    {loading && !summary ? <div className="dashboard-month-loading" aria-busy="true"><span /><span /><span /><span /><span /></div> : error && !summary ? <div className="dashboard-month-error" role="alert"><span>{error}</span><button type="button" className="secondary" onClick={onRetry}>Tentar novamente</button></div> : <>
      <div className="dashboard-month-metrics">{metrics.map(({ key, variant, label, value, detail, icon: Glyph, tone, tooltip }) => <article className={`dashboard-month-metric dashboard-month-metric--${variant || 'neutral'} is-${tone}`} key={key}><span className="dashboard-month-icon" aria-hidden="true"><Glyph size={17} strokeWidth={1.8} /></span><div className="dashboard-month-metric-title metric-label-row"><span className="dashboard-month-label">{label}</span><InfoTooltip title={label} description={tooltip} /></div><strong>{value}</strong>{detail && <small>{detail}</small>}</article>)}</div>
      {(monthlyCommitments.length > 0 || urgentCommitments.length > 0) && <div className={`dashboard-month-coverage ${urgentCommitments.length ? 'is-urgent' : hasDeficit ? 'is-pending' : 'is-covered'}`}>
        {monthlyCommitments.length > 0 && (hasDeficit ? <div className="dashboard-month-coverage-alert"><span className="dashboard-month-coverage-icon" aria-hidden="true"><TriangleAlert size={16} /></span><div><strong>Cobertura do mês pendente</strong><span>Faltam {money(summary.missingAmount)} para cobrir os compromissos de {monthText}.</span></div></div> : <span className="dashboard-month-covered-message"><CircleCheck size={15} aria-hidden="true" /> Compromissos do mês cobertos</span>)}
        {urgentCommitments.length > 0 && <div className="dashboard-month-coverage-alert dashboard-month-global-urgent"><span className="dashboard-month-coverage-icon" aria-hidden="true"><TriangleAlert size={16} /></span><div><strong>{urgentCommitments.length} compromisso{urgentCommitments.length === 1 ? '' : 's'} urgente{urgentCommitments.length === 1 ? '' : 's'} ainda precisa{urgentCommitments.length === 1 ? '' : 'm'} de atenção</strong><span>Faltam {money(missingForUrgent)} no total desses compromissos.</span></div></div>}
        {hasDeficit && <button type="button" className="dashboard-month-details-toggle" aria-expanded={detailsOpen} aria-controls="monthly-commitment-details" onClick={() => setDetailsOpen(value => !value)}>{detailsOpen ? 'Ocultar detalhes' : 'Ver detalhes'}</button>}
        {detailsOpen && <div id="monthly-commitment-details" className="dashboard-month-commitment-details">{pendingCommitments.map(item => { const coverage = Math.min(100, Math.max(0, Number(item.coveragePercentage) || 0)); return <article className="dashboard-month-commitment" key={item.id}><div className="dashboard-month-commitment-heading"><strong>{item.name}</strong>{item.urgent && item.requiresAttention && <span className="dashboard-month-urgent-badge">Urgente</span>}</div><div className="dashboard-month-commitment-meta"><span>Vence em {formatDate(item.dueDate)}</span><span>Parcela {money(item.dueAmount)}</span><span>Alocado {money(item.allocatedAmount)}</span><span>Falta {money(item.remainingAmount)}</span><strong>{Math.round(coverage)}%</strong></div><div className="dashboard-month-commitment-progress" role="progressbar" aria-label={`Cobertura de ${item.name}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(coverage)}><span style={{ width: `${coverage}%` }} /></div></article>})}</div>}
      </div>}
    </>}
  </section>
}

function App() {
  const [accountState, setAccountState] = useState(null)
  const [accountReady, setAccountReady] = useState(false)
  const [accountDialog, setAccountDialog] = useState(null)
  const [accountDeleteOpen, setAccountDeleteOpen] = useState(false)
  const [accountMutationBusy, setAccountMutationBusy] = useState(false)
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false)
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
  const [categoryDialog, setCategoryDialog] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState(null)
   const [loading, setLoading] = useState(true)
   const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [balanceDialog, setBalanceDialog] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [incomes, setIncomes] = useState([])
  const [expenses, setExpenses] = useState([])
  const [recurringIncomes, setRecurringIncomes] = useState([])
  const [incomeDialog, setIncomeDialog] = useState(false)
  const [recurringDialog, setRecurringDialog] = useState(false)
  const [expenseDialog, setExpenseDialog] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [incomeDelete, setIncomeDelete] = useState(null)
  const [movementForm, setMovementForm] = useState(null)
  const [movementDelete, setMovementDelete] = useState(null)
  const [movementDeleteBusy, setMovementDeleteBusy] = useState(false)
  const [movementDeleteError, setMovementDeleteError] = useState('')
  const [recurringDelete, setRecurringDelete] = useState(null)
  const [recurringDeleteBusy, setRecurringDeleteBusy] = useState(false)
  const [recurringDeleteError, setRecurringDeleteError] = useState('')
  const [recurringManage, setRecurringManage] = useState(null)
  const [recurringReceive, setRecurringReceive] = useState(null)
  const [recurringReceiveBusy, setRecurringReceiveBusy] = useState(false)
  useEffect(() => {
    if (!recurringManage) return
    const updated = recurringIncomes.find(item => item.id === recurringManage.id)
    if (updated) setRecurringManage(updated)
  }, [recurringIncomes, recurringManage?.id])
  const currentMonth = businessMonth(summary?.businessDate)
  const [selectedMonth, setSelectedMonth] = useState(() => normalizeMonth(sessionStorage.getItem('aloca-selected-month') || currentMonth))
  useEffect(() => { if (summary?.businessDate && !sessionStorage.getItem('aloca-selected-month')) setSelectedMonth(businessMonth(summary.businessDate)) }, [summary?.businessDate])
  const getView = () => navigationItems.find(item => navigationItemMatchesHash(item, window.location.hash))?.view || 'dashboard'
  const [view, setView] = useState(getView())
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  useEffect(() => {
    if (!mobileNavigationOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = event => { if (event.key === 'Escape') setMobileNavigationOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', closeOnEscape) }
  }, [mobileNavigationOpen])
  const { theme, toggleTheme } = useTheme()
  const refreshVersionRef = useRef(0)
  const accountTransitionRef = useRef(0)
  useEffect(() => { if (!notice) return undefined; const timer = window.setTimeout(() => setNotice(''), 3500); return () => window.clearTimeout(timer) }, [notice])

  const refresh = async (expectedAccountId = accountState?.current?.id, transitionToken = accountTransitionRef.current) => {
    const refreshVersion = ++refreshVersionRef.current
    const isCurrent = () => transitionToken === accountTransitionRef.current
    setLoading(true); setError('')
    try {
      setMonthlySummaryLoading(true)
      const [core, monthlyResult] = await Promise.allSettled([
        Promise.all([api.summary(), api.commitments(filters.status), api.categories(), api.incomes(), api.expenses(), api.recurringIncomes()]),
        api.monthlySummary(selectedMonth),
      ])
      if (core.status === 'rejected') throw core.reason
      const [nextSummary, nextCommitments, nextCategories, nextIncomes, nextExpenses, nextRecurring] = core.value
      if (refreshVersion !== refreshVersionRef.current || !isCurrent()) return
      setSummary(nextSummary); setCommitments(nextCommitments); setCategories(nextCategories); setIncomes(nextIncomes.items || []); setExpenses(nextExpenses.items || []); setRecurringIncomes(nextRecurring || [])
      if (monthlyResult.status === 'fulfilled') { setMonthlySummary(monthlyResult.value); setMonthlySummaryError('') } else setMonthlySummaryError(errorText(monthlyResult.reason))
    } catch (e) { if (isCurrent()) setError(errorText(e)) } finally { if (isCurrent()) { setLoading(false); setMonthlySummaryLoading(false); setInitialLoadComplete(true) } }
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
  useEffect(() => { if (accountReady && accountState?.current && !isSwitchingAccount) refresh(accountState.current.id) }, [accountReady, accountState?.current?.id, filters.status, selectedMonth, isSwitchingAccount])
  useEffect(() => { const onRecovered = () => { if (accountReady && accountState?.current) refresh() }; window.addEventListener(apiAvailabilityEvents.recovered, onRecovered); return () => window.removeEventListener(apiAvailabilityEvents.recovered, onRecovered) }, [accountReady, accountState?.current?.id])
  useEffect(() => { const onHash = () => setView(getView()); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash) }, [])
  useEffect(() => { sessionStorage.setItem('aloca-selected-month', selectedMonth) }, [selectedMonth])
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
  const clearFilters = () => { setSearchInput(''); setFilters({ category: '', priority: '', status: 'active', coverage: '', payment: '', deficit: false, payable: false, sort: 'priority' }) }
  const activeFilterCount = ['category', 'priority', 'status', 'coverage', 'payment'].filter(key => filters[key]).length + (filters.deficit ? 1 : 0) + (filters.payable ? 1 : 0) + (filters.sort !== 'priority' ? 1 : 0)
  const editCategory = category => setCategoryDialog(category)
  const deleteCategory = category => setDeleteDialog(category)

  const run = async action => { setError(''); setNotice(''); try { await action(); await refresh(); setNotice('Alterações salvas com sucesso.') } catch (e) { setError(errorText(e)) } }
  const retryMonthlySummary = () => refresh()
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
  const handleAccountSubmit = async (mode, data) => { if (mode === 'create-local') { await api.createLocal(); reloadAfterAccountEntry(); return } if (mode === 'login-form') { setAccountDialog({ mode: 'login' }); return } if (mode === 'login') { await api.login(data.email, data.password); reloadAfterAccountEntry(); return } if (mode === 'rename') { await runAccountMutation(() => api.renameAccount(data.displayName)); return } if (mode === 'protect') { await runAccountMutation(() => api.protectAccount(data)); return } if (mode === 'password') { await runAccountMutation(() => api.changePassword(data)) } }
  const updateProfile = data => runAccountMutation(() => api.updateProfile(data))
  const saveAvatar = file => runAccountMutation(() => api.uploadAvatar(file))
  const removeAvatar = () => runAccountMutation(() => api.removeAvatar())
  const removeAccount = async () => runAccountMutation(() => api.removeAccountFromDevice())
  const deleteAccount = async request => runAccountMutation(() => api.deleteAccount(request))
  const switchAccount = async () => {
    setAccountPopoverOpen(false)
    if (accountMutationBusy) return
    const accounts = accountState?.accounts || []
    if (accounts.length < 2) { setAccountDialog({ mode: 'add' }); return }
    setAccountDialog({ mode: 'switch' })
  }
  const performAccountSwitch = async id => {
    if (id === accountState?.current?.id || accountMutationBusy) return
    setAccountMutationBusy(true); setIsSwitchingAccount(true); setError(''); clearAccountData(); markAccountContextChanged()
    try {
      await api.switchAccount(id)
      await syncAccount()
      await refresh(id, accountTransitionRef.current)
    } catch (e) { setError(errorText(e)) } finally { setIsSwitchingAccount(false); setAccountMutationBusy(false); setAccountDialog(null) }
  }
  if (!accountReady) return <div className="app-shell"><div className="loading">Preparando sua conta local…</div></div>
  if (!accountState?.current) return <div className="app-shell"><div className="loading account-recovery"><strong>Não foi possível abrir uma conta local</strong><span>Gerencie as contas deste dispositivo para liberar espaço e entrar no Aloca.</span></div></div>
  return <div className="app-shell">
    <div className="app-logo-slot" aria-hidden="true"><img src={theme === 'dark' ? '/aloca-logo-dark.png' : '/aloca-logo.png'} alt="" /><span className="app-logo-beta">beta</span></div>
    <AppTopbar account={accountState.current} accountState={accountState} accountMutationBusy={accountMutationBusy} accountPopoverOpen={accountPopoverOpen} onToggleAccount={() => setAccountPopoverOpen(value => !value)} onCloseAccount={() => setAccountPopoverOpen(false)} onAccountAction={{ profile: () => { setAccountPopoverOpen(false); window.location.hash = 'perfil' }, protect: () => { setAccountPopoverOpen(false); setAccountDialog({ mode: 'protect' }) }, switch: switchAccount, add: () => { setAccountPopoverOpen(false); setAccountDialog({ mode: 'add' }) }, remove: () => { setAccountPopoverOpen(false); setAccountDialog({ mode: 'remove' }) }}} createMenuOpen={createMenuOpen} onToggleCreate={() => setCreateMenuOpen(value => !value)} onNewIncome={() => { setCreateMenuOpen(false); setMovementForm({ mode: 'create-income' }) }} onNewExpense={() => { setCreateMenuOpen(false); setMovementForm({ mode: 'create-expense' }) }} onNewRecurring={() => { setCreateMenuOpen(false); setRecurringDialog(true) }} onNewCommitment={() => { setCreateMenuOpen(false); setEditing({}) }} theme={theme} onToggleTheme={toggleTheme} onOpenNavigation={() => setMobileNavigationOpen(true)} calculatorOpen={calculatorOpen} onToggleCalculator={() => setCalculatorOpen(value => !value)} />
    <AppSidebar view={view} />
    {mobileNavigationOpen && <MobileNavigation view={view} onClose={() => setMobileNavigationOpen(false)} />}
    <MobileBottomNavigation view={view} />
    <CalculatorPopover open={calculatorOpen} onClose={() => setCalculatorOpen(false)} />
    <main className="app-main">
      <div className="page-content">
      {error && view !== 'commitments' && <div className="alert error">{error}</div>}

       {view === 'forecast' ? <FinancialForecastPage businessDate={summary?.businessDate} /> : view === 'support' ? <SupportPage account={accountState.current} /> : view === 'profile' ? <ProfileSecurityPage account={accountState.current} onUpdateProfile={updateProfile} onSaveAvatar={saveAvatar} onRemoveAvatar={removeAvatar} accountMutationBusy={accountMutationBusy} onSecurity={mode => setAccountDialog({ mode })} onDelete={() => setAccountDeleteOpen(true)} /> : loading && !initialLoadComplete && view !== 'commitments' ? <div className="loading">Carregando sua vida financeira…</div> : view === 'incomes' ? <MovementsPage incomes={incomes} expenses={expenses} recurringIncomes={recurringIncomes} summary={summary} categories={categories} onEdit={item => item.isRecurringDefinition ? setRecurringDialog(item) : setMovementForm({ mode: 'edit', item })} onDelete={item => { if (item.isRecurringDefinition) { setRecurringDeleteError(''); setRecurringDelete(item) } else { setMovementDeleteError(''); setMovementDelete(item) } }} onManage={item => setRecurringManage(item)} /> : view === 'commitments' ? <CommitmentsPage commitments={commitments} filtered={filtered} categories={categories} filters={filters} setFilters={setFilters} searchInput={searchInput} setSearchInput={setSearchInput} activeFilterCount={activeFilterCount} onOpenFilters={() => setFiltersOpen(true)} summary={summary} onCreate={() => setEditing({})} setEditing={setEditing} run={run} refresh={refresh} loading={loading} initialLoadComplete={initialLoadComplete} error={error} onRetry={() => refresh()} onClearFilters={clearFilters} /> : view === 'groups' ? <GroupManagement categories={categories} onCreate={async name => { await api.createCategory(name); await refresh() }} onEdit={editCategory} onDelete={deleteCategory} /> : <DashboardPage account={accountState.current} summary={summary} monthlySummary={monthlySummary} monthlyLoading={monthlySummaryLoading} monthlyError={monthlySummaryError} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} onRetryMonthly={retryMonthlySummary} commitments={commitments} onViewCommitments={() => { window.location.hash = 'compromissos' }} incomes={incomes} expenses={expenses} dataError={error} onRetry={() => refresh()} onEditBalance={() => setBalanceDialog(true)} />}
      </div>
    </main>
    <footer className="app-footer"><span>© 2026 Aloca</span><span aria-hidden="true">·</span><span>{APP_VERSION}</span><span aria-hidden="true">·</span><span>Desenvolvido por Maxwell Xavier</span><span aria-hidden="true">·</span><a href="https://github.com/xavierr-max" target="_blank" rel="noopener noreferrer">GitHub</a></footer>
    {editing && <CommitmentModal item={editing} categories={categories} businessDate={summary?.businessDate} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); run(async () => {}) }} />}
    {balanceDialog && <CurrentBalanceModal value={summary?.currentBalance ?? 0} onClose={() => setBalanceDialog(false)} onSaved={async () => { setBalanceDialog(false); await refresh(); setNotice('Saldo atual atualizado.') }} />}
    {movementForm && <MovementFormModal mode={movementForm.mode} item={movementForm.item} categories={categories} currentBalance={summary?.currentBalance ?? 0} businessDate={summary?.businessDate} onClose={() => setMovementForm(null)} onSaved={async message => { setMovementForm(null); await refresh(); setNotice(message) }} />}
    {movementDelete && <ConfirmModal title="Excluir movimentação?" message={`“${movementDelete.description}” será removida e o saldo relacionado será atualizado.`} confirmLabel="Excluir" busy={movementDeleteBusy} busyLabel="Excluindo…" error={movementDeleteError} tone="danger" onClose={() => { if (!movementDeleteBusy) setMovementDelete(null) }} onConfirm={async () => { setMovementDeleteBusy(true); setMovementDeleteError(''); try { if (movementDelete.type === 'Income') await api.deleteIncome(movementDelete.id); else await api.deleteExpense(movementDelete.id); setMovementDelete(null); await refresh(); setNotice('Movimentação excluída.') } catch (e) { setMovementDeleteError(errorText(e)) } finally { setMovementDeleteBusy(false) } }} />}
    {recurringDialog && <RecurringIncomeModal item={recurringDialog.id ? recurringDialog : undefined} categories={categories} businessDate={summary?.businessDate} onClose={() => setRecurringDialog(false)} onSaved={() => { setRecurringDialog(false); run(async () => {}) }} />}
    {recurringDelete && <ConfirmModal title="Excluir entrada recorrente?" message={`A recorrência “${recurringDelete.description}” deixará de gerar novas entradas. Ocorrências futuras não realizadas serão removidas; recebimentos já realizados permanecerão no histórico.`} confirmLabel="Excluir recorrência" busy={recurringDeleteBusy} busyLabel="Excluindo…" error={recurringDeleteError} tone="danger" onClose={() => { if (!recurringDeleteBusy) setRecurringDelete(null) }} onConfirm={async () => { setRecurringDeleteBusy(true); setRecurringDeleteError(''); try { await api.deleteRecurringIncome(recurringDelete.id); setRecurringDelete(null); await refresh(); setNotice('Entrada recorrente excluída.') } catch (e) { setRecurringDeleteError(errorText(e)) } finally { setRecurringDeleteBusy(false) } }} />}
    {recurringManage && <RecurringIncomeDrawer item={recurringManage} categories={categories} onClose={() => setRecurringManage(null)} onToggle={async () => { await (recurringManage.isActive ? api.pauseRecurringIncome(recurringManage.id) : api.activateRecurringIncome(recurringManage.id)); await refresh() }} onDelete={() => { setRecurringManage(null); setRecurringDeleteError(''); setRecurringDelete(recurringManage) }} onReceive={occurrence => setRecurringReceive({ item: recurringManage, occurrence })} onSaved={async () => { await refresh(); setRecurringManage(null) }} />}
    {recurringReceive && <ConfirmModal title="Confirmar recebimento?" message={`A ocorrência de ${formatDate(recurringReceive.occurrence.scheduledDate)} será adicionada ao saldo real e removida da projeção.`} confirmLabel="Receber" busy={recurringReceiveBusy} busyLabel="Recebendo…" onClose={() => { if (!recurringReceiveBusy) setRecurringReceive(null) }} onConfirm={async () => { setRecurringReceiveBusy(true); try { await api.receiveRecurringOccurrence(recurringReceive.occurrence.id); setRecurringReceive(null); await refresh() } catch (e) { setError(errorText(e)) } finally { setRecurringReceiveBusy(false) } }} />}
    {(expenseDialog || editingExpense) && <ExpenseModal item={editingExpense} categories={categories} currentBalance={summary?.currentBalance ?? 0} businessDate={summary?.businessDate} onClose={() => { setExpenseDialog(false); setEditingExpense(null) }} onSaved={() => { setExpenseDialog(false); setEditingExpense(null); run(async () => {}) }} />}
    {incomeDelete && <ConfirmModal title="Excluir entrada?" message={`Esta ação não poderá ser desfeita. A entrada “${incomeDelete.description}” de ${money(incomeDelete.amount)} será removida do saldo real.`} onClose={() => setIncomeDelete(null)} onConfirm={() => run(async () => { await api.deleteIncome(incomeDelete.id); setIncomeDelete(null) })} />}
    {filtersOpen && <FilterDrawer filters={filters} setFilters={setFilters} categories={categories} onClear={clearFilters} onClose={() => setFiltersOpen(false)} />}
    {categoryDialog && <CategoryModal category={categoryDialog} onClose={() => setCategoryDialog(null)} onSaved={() => { setCategoryDialog(null); run(async () => {}) }} />}
    {deleteDialog && <ConfirmModal title={deleteDialog.transaction ? 'Excluir saída?' : `Excluir o grupo “${deleteDialog.name}”?`} message={deleteDialog.transaction ? `A saída “${deleteDialog.description}” de ${money(deleteDialog.amount)} será removida do saldo real.` : `Os registros associados não serão excluídos e passarão para “Sem grupo”.`} confirmLabel={deleteDialog.transaction ? 'Excluir' : 'Excluir grupo'} onClose={() => setDeleteDialog(null)} onConfirm={() => run(async () => { if (deleteDialog.transaction) await api.deleteExpense(deleteDialog.id); else { await api.deleteCategory(deleteDialog.id); if (filters.category === deleteDialog.id) setFilters(current => ({ ...current, category: '' })) } setDeleteDialog(null) })} />}
    {accountDialog?.mode === 'switch' && <ModalLayer onClose={() => setAccountDialog(null)}><div className="modal-head"><div><span className="eyebrow">CONTAS NESTE DISPOSITIVO</span><h2>Trocar conta</h2></div><button type="button" className="icon-button" onClick={() => setAccountDialog(null)}>×</button></div><div className="account-switch-list">{(accountState.accounts || []).map(item => <button type="button" key={item.id} className={item.id === accountState.current.id ? 'account-switch-item is-current' : 'account-switch-item'} onClick={() => performAccountSwitch(item.id)} disabled={accountMutationBusy}><AccountAvatar account={item} size="small" /><span><strong>{item.displayName}</strong><small>{item.isLocal ? 'Conta local' : 'Conta protegida'}</small></span>{item.id === accountState.current.id && <b>✓</b>}</button>)}</div></ModalLayer>}
    {accountDialog && accountDialog.mode !== 'remove' && accountDialog.mode !== 'switch' && <AccountDialog mode={accountDialog.mode} initialDisplayName={accountState?.current?.displayName || ''} initialEmail={accountState?.current?.email || ''} onClose={() => setAccountDialog(null)} onSubmit={handleAccountSubmit} />}
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

function CommitmentObjective({ selectedObjective, onChange }) {
  const editorRef = useRef(null)
  const [suggestionStart, setSuggestionStart] = useState(() => {
    const previous = Number(window.localStorage.getItem('aloca-objective-suggestion-start'))
    return Number.isFinite(previous) ? previous : 0
  })
  const [objectiveEditing, setObjectiveEditing] = useState(false)
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
  return <div className="dashboard-objective-content" aria-label="Objetivo da reserva">
    <div className="dashboard-objective-heading"><div><span className="eyebrow">DIREÇÃO DO SALDO</span><h3>Objetivo da reserva <InfoTooltip title="Objetivo da reserva" description="Representa a prioridade financeira que você definiu para orientar suas decisões e reservas." /></h3></div></div>
    <div className={`dashboard-objective-body${objectiveEditing ? ' is-editing' : ''}`}>
      {objectiveEditing ? <div className="objective-edit-form">
        <span className="dashboard-objective-edit-help">Escreva aqui seu objetivo financeiro</span>
        <textarea ref={editorRef} className="dashboard-objective-editor" aria-label="Objetivo da reserva" value={draft} placeholder="Ex.: quitar dívidas, montar reserva, organizar o próximo mês" rows="2" onClick={event => event.stopPropagation()} onChange={event => saveDraft(event.target.value)} />
        <div className="dashboard-objective-edit-actions"><button type="button" className="secondary" onClick={cancelEditing}>Cancelar</button><button type="button" className="primary" onClick={saveObjective}>Salvar</button></div>
      </div> : <>
        {hasSavedObjective ? <div className="dashboard-objective-box"><span className="dashboard-objective-icon" aria-hidden="true"><Target size={19} strokeWidth={1.8} /></span><div className="dashboard-objective-copy"><span className="dashboard-objective-label">Objetivo atual</span><p>{currentObjective}</p></div><button type="button" className="dashboard-objective-edit" onClick={beginEditing} aria-label="Editar objetivo"><Pencil size={14} aria-hidden="true" /><span>Editar</span></button></div> : <button type="button" className="dashboard-objective-box dashboard-objective-empty" onClick={beginEditing}><span className="dashboard-objective-icon" aria-hidden="true"><Target size={19} strokeWidth={1.8} /></span><span className="dashboard-objective-copy"><span className="dashboard-objective-label">Objetivo atual</span><span className="dashboard-objective-empty-copy">Nenhum objetivo definido</span></span><span className="dashboard-objective-empty-action">Definir objetivo</span></button>}
      </>}
      <div className="dashboard-objective-suggestions" aria-live="polite">
        <div className="dashboard-objective-suggestions-header"><span className="dashboard-objective-suggestions-label">{hasSavedObjective ? 'Sugestões' : 'Sugestões para começar'}</span><button className="dashboard-objective-refresh" type="button" onClick={rotateSuggestions} aria-label="Atualizar sugestões" title="Atualizar sugestões"><RotateCw size={15} aria-hidden="true" /></button></div>
        <div className="dashboard-objective-suggestions-list">{visibleSuggestions.map((suggestion, index) => <button className={`dashboard-objective-suggestion ${index === 0 ? 'is-primary' : ''}`} type="button" key={suggestion.id} onClick={event => { event.stopPropagation(); chooseSuggestion(suggestion) }}><Plus size={16} strokeWidth={2} aria-hidden="true" />{suggestion.label}</button>)}</div>
      </div>
    </div>
  </div>
}

function BalanceCommandCenter({ summary, monthlySummary, onBalance, onViewCommitments }) {
  const real = Number(summary?.currentBalance) || 0
  const committed = Number(summary?.allocatedBalance) || 0
  const unallocated = Number(summary?.unallocatedBalance) || 0
  const free = Number(summary?.freeBalance) || 0
  const deficit = Number(summary?.coverageDeficit ?? summary?.deficitCobertura) || 0
  const estimatedFinal = Number(monthlySummary?.estimatedFinalBalance) || 0
  return <section className="command-center" aria-label="Situação financeira atual">
    <div className="command-balance">
      <div className="command-balance-head"><div><span className="eyebrow">SALDO ATUAL <InfoTooltip title="Saldo atual" description="Dinheiro que você possui efetivamente agora. Entram movimentações realizadas e ajustes manuais; não entram reservas, previsões ou compromissos não pagos." /></span><h2>{money(real)}</h2><span className="command-status">Disponível hoje</span></div><button className="secondary command-balance-action" onClick={onBalance}>Editar saldo atual</button></div>
    </div>
    <div className="command-allocation"><Metric label="SALDO RESERVADO" value={money(committed)} tooltip={{ title: 'Saldo reservado', description: 'Parte do seu saldo atual que já foi separada para compromissos futuros. Esse dinheiro continua no saldo atual, mas já possui destino.' }} />{unallocated > 0 && <button className="metric-action command-secondary-action" onClick={onViewCommitments}>Alocar saldo não distribuído</button>}</div>
    <div className={`command-free ${unallocated > 0 ? 'is-positive' : ''}`}><span className="eyebrow">SALDO NÃO ALOCADO <InfoTooltip title="Saldo não alocado" description="Parte do seu saldo atual que ainda não foi reservada para compromissos. Não significa necessariamente dinheiro livre, pois podem existir compromissos sem cobertura." /></span><strong>{money(unallocated)}</strong><small>Ainda sem reserva explícita</small><small>Saldo livre: {money(free)} <InfoTooltip title="Saldo livre" description="Parte do saldo não alocado que sobra depois de considerar compromissos que ainda precisam de reserva. É uma estimativa do que pode permanecer livre sem deixá-los descobertos." /></small>{deficit > 0 && <small className="command-deficit-inline">Ainda sem cobertura: {money(deficit)} <InfoTooltip title="Valor ainda sem cobertura" description="Valor dos compromissos pendentes que ainda não possui reserva suficiente. A reserva já existente não é subtraída novamente." /></small>}</div>
    <div className="command-estimated"><span className="eyebrow">SALDO FINAL ESTIMADO <InfoTooltip title="Saldo final estimado" description="Estimativa do saldo ao final do mês considerando os dados do resumo mensal." /></span><strong>{money(estimatedFinal)}</strong><small>Previsão ao final do mês</small></div>
    <details className="calculation-details"><summary>Ver cálculo</summary><div className="calculation-content"><p>Saldo não alocado = saldo atual − valor reservado, limitado a zero.</p><div className="calculation-breakdown"><div><span>Saldo atual</span><strong>{money(real)}</strong></div><div><span>Saldo reservado</span><strong>{money(committed)}</strong></div><div><span>Saldo não alocado</span><strong>{money(unallocated)}</strong></div><div><span>Saldo livre</span><strong>{money(free)}</strong></div>{deficit > 0 && <div><span>Déficit de cobertura</span><strong className="danger-text">{money(deficit)}</strong></div>}</div><p className="calculation-note">Reservas continuam no saldo atual, mas já têm destino definido. O déficit compara o necessário para cobrir compromissos com o que já está reservado.</p></div></details>
  </section>
}

function Metric({ label, value, tone = '', action, tooltip }) { return <article className={`metric ${tone}`}><div className="metric-label"><span>{label} {tooltip && <InfoTooltip {...tooltip} />}</span></div><strong>{value}</strong>{action}</article> }

function SectionError({ message, onRetry, loading = false }) { return <div className="inline-error" role="alert"><span>{message}</span>{onRetry && <button type="button" className="secondary" onClick={onRetry} disabled={loading}>{loading ? 'Carregando…' : 'Tentar novamente'}</button>}</div> }

function MonthlyFinancialSummary({ summary, loading, error, selectedMonth, onMonthChange, onRetry, onView, mobileCompact = false }) {
  if (loading && !summary) return <section className="month-decision"><div className="month-decision-heading"><div><span className="eyebrow">CONTEXTO TEMPORAL</span><h2>Resumo financeiro do mês</h2><p>Entradas, saídas e resultados do mês selecionado.</p></div></div><div className="loading">Carregando o resumo deste mês…</div></section>
  if (error && !summary) return <section className="month-decision"><div className="month-decision-heading"><div><span className="eyebrow">CONTEXTO TEMPORAL</span><h2>Resumo financeiro do mês</h2><p>Entradas, saídas e resultados do mês selecionado.</p></div></div><SectionError message={error} onRetry={onRetry} loading={loading} /></section>
  if (!summary) return null
  const month = { totalIncome: Number(summary.entradasTotais ?? 0), result: Number(summary.resultadoPrevisto ?? 0), realizedIncome: Number(summary.entradasRealizadas ?? 0), plannedIncome: Number(summary.entradasPrevistas ?? 0), totalExpense: Number(summary.saidasTotais ?? 0), realizedExpense: Number(summary.saidasRealizadas ?? 0), plannedExpense: Number(summary.saidasPrevistas ?? 0), realResult: Number(summary.resultadoReal ?? 0), projectedBalance: Number(summary.estimatedFinalBalance ?? 0) }
  const commitmentExpenses = (summary.commitments || []).map(item => ({ ...item, description: item.name, amount: item.dueAmount, reservedAmount: item.allocatedAmount, installment: item.installmentNumber, date: item.dueDate }))
  const expenses = commitmentExpenses
  const commitmentTotal = Number(summary.commitmentTotal)
  const commitmentReserved = Number(summary.allocatedAmount)
  const coverageDeficit = Number(summary.missingAmount)
  const hasDeficit = coverageDeficit > 0
  const coveragePercentage = Number(summary.coveragePercentage)
  const hasContextualAlert = coverageDeficit > 0
  const monthName = monthLabel(selectedMonth)
  const resultDescription = month.result < 0
    ? `${monthName} deve fechar em ${money(month.projectedBalance)}, com resultado previsto negativo de ${money(Math.abs(month.result))}.`
    : `${monthName} deve fechar em ${money(month.projectedBalance)}, com resultado previsto positivo de ${money(month.result)}.`
  const commitmentStatus = item => item.coverageStatus === 'covered' ? 'Coberta' : item.coverageStatus === 'partial' ? 'Parcialmente coberta' : 'Sem reserva'
  const uncoveredCommitments = commitmentExpenses.filter(item => Number(item.remainingAmount) > 0)
  const insight = uncoveredCommitments.length > 1
    ? `Faltam ${money(coverageDeficit)} para cobrir ${uncoveredCommitments.length} compromissos de ${monthLabel(selectedMonth)}.`
    : `Faltam ${money(coverageDeficit)} para cobrir os compromissos de ${monthLabel(selectedMonth)}.`
  const monthPicker = <label className="month-picker">Mês selecionado<input type="month" value={selectedMonth} onChange={event => onMonthChange(event.target.value)} /></label>
  return <section className="month-decision"><div className="month-decision-heading"><div><span className="eyebrow">CONTEXTO TEMPORAL</span><h2>Resumo financeiro do mês</h2><p>Entradas, saídas e resultados do mês selecionado.</p><p className="month-summary-sentence">{resultDescription}</p></div><div className="month-heading-actions">{monthPicker}<button className="secondary" onClick={onView}>Ver compromissos</button></div></div><div className="monthly-financial-metrics"><div className="monthly-metric income-metric"><span>Entradas do mês <InfoTooltip title="Entradas do mês" description="Soma do que já entrou e do que ainda está previsto para entrar no mês. O total inclui realizadas e previstas; não inclui ajustes de saldo." /></span><strong className="positive">{money(month.totalIncome)}</strong><div className="monthly-breakdown"><span>Realizadas <b>{money(month.realizedIncome)}</b></span><span>Previstas <b>{money(month.plannedIncome)}</b></span></div></div><div className="monthly-metric expense-metric"><span>Saídas do mês <InfoTooltip title="Saídas do mês" description="Soma do que já saiu e do que ainda está previsto para sair no mês. O total inclui realizadas e previstas; não inclui reservas ou ajustes de saldo." /></span><strong className="negative">{money(month.totalExpense)}</strong><div className="monthly-breakdown"><span>Realizadas <b>{money(month.realizedExpense)}</b></span><span>Previstas <b>{money(month.plannedExpense)}</b></span></div></div><div className="monthly-metric result-metric forecast-result-metric"><span>Resultado previsto <InfoTooltip title="Resultado previsto" description="Estimativa de como ficará o resultado real ao final do mês, considerando o que já aconteceu e todas as entradas e saídas ainda previstas." /></span><strong className={month.result < 0 ? 'negative' : 'positive'}>{signedMoney(month.result)}</strong><small>Tendência do mês</small></div><div className="monthly-metric result-metric real-result-metric"><span>Resultado real <InfoTooltip title="Resultado real" description="Diferença entre as entradas e saídas que realmente aconteceram no mês. Valores previstos não entram." /></span><strong className={month.realResult < 0 ? 'negative' : 'positive'}>{signedMoney(month.realResult)}</strong><small>Até agora</small></div><div className="monthly-metric monthly-coverage-metric"><span>Reservado <InfoTooltip title="Reservado" description="Valor já reservado para ajudar a cobrir os compromissos do mês. A reserva continua no saldo atual e não é uma saída." /></span><strong className="positive">{money(commitmentReserved)}</strong><div className="monthly-metric-footer"><small>{money(commitmentTotal)} em compromissos · {coveragePercentage.toFixed(1).replace('.', ',')}% coberto</small>{commitmentExpenses.length > 0 && (hasDeficit ? <small className="monthly-card-status is-pending"><TriangleAlert size={14} aria-hidden="true" /> Ainda sem cobertura: {money(coverageDeficit)}</small> : <small className="monthly-card-status is-covered"><CircleCheck size={14} aria-hidden="true" /> Compromissos do mês cobertos</small>)}</div></div><div className="monthly-metric balance-metric"><span>Saldo final estimado <InfoTooltip title="Saldo final estimado" description="Estimativa de quanto seu saldo atual deverá ser ao fim do mês selecionado, considerando apenas entradas e saídas futuras ainda não realizadas." /></span><strong className={month.projectedBalance < 0 ? 'negative' : 'positive'}>{money(month.projectedBalance)}</strong><small>Fechamento esperado</small></div></div>{hasContextualAlert ? <div className="monthly-insight has-alert"><div className="monthly-insight-header"><div className="monthly-insight-copy"><strong><span className="attention-icon" aria-hidden="true">!</span>Cobertura do mês pendente</strong><span>{insight}</span></div></div>{mobileCompact ? <button type="button" className="dashboard-month-details-toggle" onClick={onView}>Ver detalhes</button> : <details className="guidance-details"><summary><span>Ver detalhes</span><small>Veja as cobranças do mês</small></summary><div className="coverage-detail-list">{commitmentExpenses.map(item => <div className={`coverage-detail ${item.coverageStatus || ''}`} key={item.id}><span className="coverage-detail-name"><strong>{item.description}</strong><small>{item.installment != null && item.totalInstallments != null ? `Parcela ${item.installment}/${item.totalInstallments}` : 'Parcela prevista'}</small></span><span className="coverage-detail-value"><b>{money(item.amount)}</b><small>Reservado {money(item.reservedAmount || 0)} · Faltante {money(item.remainingAmount || 0)}</small></span><span className="coverage-detail-status"><b>{Number(item.coveragePercentage ?? 0).toFixed(1).replace('.', ',')}%</b><small>{commitmentStatus(item)}</small></span></div>)}</div></details>} </div> : commitmentExpenses.length > 0 && <p className="monthly-insight"><strong><span className="attention-icon success-icon" aria-hidden="true">✓</span>Cobertura completa</strong><span>Todos os compromissos de {monthLabel(selectedMonth)} estão cobertos.</span></p>}{!mobileCompact && <div className="month-details"><details open><summary>Detalhes dos compromissos <span>{expenses.length ? `${expenses.length} cobranças` : 'Nenhuma cobrança'}</span></summary><div className="month-detail-content">{expenses.length ? expenses.map(item => <div className="decision-row" key={item.id}><span><strong>{item.description}</strong><small>{formatDate(item.date)}{item.installment != null && item.totalInstallments != null ? ` · parcela ${item.installment}/${item.totalInstallments}` : ''} · {commitmentStatus(item)}</small></span><b className="negative">{money(item.amount)}</b></div>) : <span className="decision-empty">Nenhum compromisso previsto para este mês.</span>}</div></details></div>}</section>
}

function UrgentCommitmentsSection({ items, onOpen }) {
  if (!items.length) return null
  return <section className="urgent-global-section" aria-labelledby="urgent-global-title"><div className="urgent-global-heading"><div><span className="eyebrow">COBERTURA GLOBAL</span><h2 id="urgent-global-title">Urgentes</h2><p>{items.length === 1 ? '1 compromisso ainda precisa de cobertura.' : `${items.length} compromissos ainda precisam de cobertura.`}</p></div></div><div className="urgent-global-list">{items.map(item => <button type="button" className="urgent-global-item" key={item.id} onClick={() => onOpen(item.id)}><span className="urgent-global-name"><strong><span className="urgent-badge">⚠ Urgente</span><span className="urgent-global-commitment">{item.name}</span></strong><small>{money(item.allocatedAmount)} reservados de {money(item.totalAmount)}</small></span><span className="urgent-global-status"><strong>Faltam {money(item.remainingAmount)}</strong><small><b>{Number(item.overallCoverage ?? 0).toFixed(1).replace('.', ',')}%</b> coberto</small></span></button>)}</div></section>
}

function CurrentBalanceModal({ value, onClose, onSaved }) {
  const [amount, setAmount] = useState(formatDecimalInput(value ?? 0)); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const current = Number(value) || 0; const next = parseAmount(amount); const difference = Number.isFinite(next) ? next - current : 0
  const save = async e => { e.preventDefault(); if (!Number.isFinite(next) || next < 0) return setError('Informe um valor válido maior ou igual a zero.'); if (Math.abs(difference) >= 1000 && !window.confirm('A alteração é grande. Deseja registrar este ajuste?')) return; setSaving(true); setError(''); try { await api.updateCurrentBalance(next); await onSaved() } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">AJUSTE FINANCEIRO</span><h2>Editar saldo atual</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div><p className="modal-copy">Esta ação altera o saldo base atual da conta e registra a diferença como um ajuste manual no histórico.</p>{error && <div className="alert error">{error}</div>}<div className="preview-list"><div><span>Saldo atual</span><strong>{money(current)}</strong></div><label>Novo saldo<input autoFocus inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} aria-label="Novo saldo" /></label><div><span>Diferença</span><strong className={difference < 0 ? 'negative' : 'positive'}>{difference >= 0 ? '+ ' : '- '}{money(Math.abs(difference))}</strong></div></div><div className="modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar novo saldo'}</button></div></form></div>
}

function InitialBalanceModal({ value, onClose, onSaved }) {
  const [amount, setAmount] = useState(formatDecimalInput(value ?? 0)); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const save = async e => { e.preventDefault(); const numeric = parseAmount(amount); if (!Number.isFinite(numeric) || numeric < 0) { setError('Informe um valor válido maior ou igual a zero.'); return } setSaving(true); setError(''); try { await api.updateSettings(numeric); onSaved() } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">CONFIGURAÇÃO FINANCEIRA</span><h2>{value > 0 ? 'Editar saldo inicial' : 'Informar saldo inicial'}</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div><p className="modal-copy">Informe quanto você já possui antes de registrar novas movimentações. Isso não cria uma transação.</p>{error && <div className="alert error">{error}</div>}<label>Saldo inicial<input autoFocus required inputMode="decimal" placeholder="1500,00" value={amount} onChange={e => setAmount(e.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>Salvar saldo inicial</button></div></form></div>
}

function CategoryModal({ category, onClose, onSaved }) { const [name, setName] = useState(category?.name || ''); const [error, setError] = useState(''); const save = async e => { e.preventDefault(); if (!name.trim()) { setError('Informe o nome do grupo.'); return } try { await api.updateCategory(category.id, name.trim()); onSaved() } catch (e) { setError(errorText(e)) } }; return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">GRUPOS</span><h2>Editar grupo</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{error && <div className="alert error">{error}</div>}<label>Nome<input autoFocus value={name} onChange={e => setName(e.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary">Salvar</button></div></form></div> }
function GroupManagement({ categories, onCreate, onEdit, onDelete }) {
  const [createOpen, setCreateOpen] = useState(false)
  return <section className="groups-page"><div className="page-heading"><PageHeader eyebrow="ORGANIZAÇÃO" title="Grupos" description="Organize compromissos, entradas e outros registros financeiros." /><button className="primary" type="button" onClick={() => setCreateOpen(true)}><Icon icon={Plus} size={17} /> Novo grupo</button></div><div className="group-manager"><div className="group-manager-heading"><strong>Gerenciar grupos</strong><span>{categories.length} cadastrados</span></div>{categories.length ? <div className="group-manager-list">{categories.map(category => <div className="group-manager-row" key={category.id}><strong>{category.name}</strong><span><button className="secondary" type="button" onClick={() => onEdit(category)}>Editar</button><button className="icon-button danger-text" type="button" onClick={() => onDelete(category)} aria-label={`Excluir ${category.name}`}>×</button></span></div>)}</div> : <div className="empty"><strong>Nenhum grupo criado</strong><span>Crie um grupo para reutilizá-lo em toda a aplicação.</span></div>}</div>{createOpen && <CategoryCreateModal onClose={() => setCreateOpen(false)} onSaved={async name => { await onCreate(name); setCreateOpen(false) }} />}</section>
}
function ConfirmModal({ title, message, onClose, onConfirm, confirmLabel = 'Confirmar', busy = false, busyLabel = 'Processando…', error = '', tone = 'default' }) { return <ModalLayer onClose={onClose}><div className={`modal-content modal-tone-${tone}`}><h2>{title}</h2><p className="modal-copy">{message}</p>{error && <div className="alert error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button><button type="button" className={tone === 'danger' ? 'danger-button' : 'primary'} onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</button></div></div></ModalLayer> }
function AlertModal({ title, message, onClose }) { return <ModalLayer onClose={onClose}><div className="modal-content modal-tone-warning"><h2>{title}</h2><p className="modal-copy">{message}</p><div className="modal-actions"><button type="button" className="primary" onClick={onClose}>Entendi</button></div></div></ModalLayer> }

function RecentIncomeSection({ incomes, expenses, onCreate, onCreateExpense, onEditExpense, onDeleteExpense, onViewAll }) {
  const items = [...incomes.map(x => ({ ...x, movementType: 'income' })), ...expenses.map(x => ({ ...x, movementType: 'expense' }))].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  return <section className="income-section recent-income"><div className="income-heading"><div><span className="eyebrow">MOVIMENTAÇÕES</span><h2>Movimentações recentes</h2><small>Entradas e saídas registradas</small></div><div className="income-actions"><button className="secondary" onClick={onViewAll}>Ver todas</button><button className="expense-action" onClick={onCreateExpense}><Icon icon={ArrowUpFromLine} size={17} /> Nova saída</button><button className="primary" onClick={onCreate}><Icon icon={Plus} size={17} /> Nova entrada</button></div></div>{items.length ? <div className="income-list">{items.map(item => <article className={`income-row ${item.movementType === 'expense' ? 'expense-row' : ''}`} key={item.id}><div className="income-icon">{item.movementType === 'expense' ? '↓' : '↑'}</div><div className="income-info"><strong>{item.description}</strong><span><em className="category-badge">{item.categoryName || 'Sem grupo'}</em> · {new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')}</span></div><strong className={`income-amount ${item.movementType === 'expense' ? 'negative' : 'positive'}`}>{item.movementType === 'expense' ? '- ' : '+ '}{money(item.amount)}</strong>{item.movementType === 'expense' && <div className="row-actions"><button className="icon-button" onClick={() => onEditExpense(item)}>✎</button><button className="icon-button danger-text" onClick={() => onDeleteExpense(item)}>⋯</button></div>}</article>)}</div> : <div className="empty income-empty compact-empty"><strong>Nenhuma movimentação ainda</strong><span>Registre uma entrada ou saída para atualizar seu saldo.</span><button className="expense-action" onClick={onCreateExpense}><Icon icon={ArrowUpFromLine} size={17} /> Nova saída</button></div>}</section>
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

function RecurringIncomeModal({ categories, item, businessDate: referenceDate, onClose, onSaved, embedded = false, formId }) {
  const [form, setForm] = useState(() => item ? { description: item.description, amount: String(item.amount).replace('.', ','), categoryId: item.categoryId || "", frequency: item.frequency, startDate: item.startDate, endDate: item.endDate || '', automaticProcessing: item.automaticProcessing ?? false } : { description: '', amount: '', categoryId: '', frequency: 'Monthly', startDate: referenceDate?.slice(0, 10) || businessToday(), endDate: '', automaticProcessing: false }); const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const update = (key, value) => setForm(x => ({ ...x, [key]: value }))
  const dayOfMonth = Number(form.startDate.slice(8, 10))
  const save = async e => { e.preventDefault(); if (!form.description.trim() || !form.amount || !form.startDate) return setError('Preencha descrição, valor e a primeira ocorrência.'); if (form.endDate && form.endDate < form.startDate) return setError('A data final deve ser igual ou posterior ao início.'); setSaving(true); setError(''); try { const body = { ...form, amount: parseAmount(form.amount), categoryId: optionalCategoryId(form.categoryId), dayOfMonth: form.frequency === 'Monthly' ? dayOfMonth : null, endDate: form.endDate || null }; await (item ? api.updateRecurringIncome(item.id, body) : api.createRecurringIncome(body)); await onSaved() } catch (e) { console.error('Falha ao salvar entrada recorrente', e); setError(e?.status >= 400 ? 'Não foi possível salvar a entrada recorrente.' : errorText(e)) } finally { setSaving(false) } }
  const fields = <>{error && <div className="alert error">{error}</div>}<section className="recurring-form-section"><h3>Informações principais</h3><label>Descrição<input autoFocus required value={form.description} onChange={e => update('description', e.target.value)} /></label><div className="form-grid income-form-grid"><label>Valor<input required inputMode="decimal" placeholder="0,00" value={form.amount} onChange={e => update('amount', e.target.value)} /></label><label>Grupo<select value={form.categoryId} onChange={e => update('categoryId', e.target.value || null)}><option value="">Sem grupo</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div></section><section className="recurring-form-section"><h3>Recorrência</h3><div className="form-grid recurring-form-grid"><label>Primeira ocorrência<input required type="date" value={form.startDate} onChange={e => update('startDate', e.target.value)} /></label><label>Frequência<select value={form.frequency} onChange={e => update('frequency', e.target.value)}>{Object.entries(frequencyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{form.frequency === 'Monthly' && <span className="field-hint">Repete todo dia {dayOfMonth}; o dia 31 cai no último dia válido.</span>}</label><label>Data de término <span className="field-hint">(opcional)</span><input type="date" value={form.endDate} onChange={e => update('endDate', e.target.value)} /></label></div></section><section className="recurring-form-section recurring-form-options"><h3>Automação</h3><CheckboxOption checked={form.automaticProcessing} onChange={e => update('automaticProcessing', e.target.checked)} title="Receber automaticamente na data" description="O valor será adicionado ao saldo automaticamente na data da ocorrência." /><p className="modal-copy">A primeira ocorrência define o dia das entradas mensais. As previsões não alteram seu saldo real.</p></section></>
  if (embedded) return <form id={formId} className="app-drawer-form commitment-setting-form" onSubmit={save}>{fields}</form>
  return <div className="modal-backdrop"><form className="modal commitment-setting-form" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">ENTRADA RECORRENTE</span><h2>{item ? 'Editar entrada recorrente' : 'Nova entrada recorrente'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{fields}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{item ? 'Salvar alterações' : 'Salvar entrada recorrente'}</button></div></form></div>
}

function IncomeModal({ categories, onClose, onSaved }) {
  const [form, setForm] = useState({ description: '', amount: '', categoryId: '', date: businessToday() }); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const save = async event => { event.preventDefault(); const amount = parseAmount(form.amount); if (!form.description.trim()) return setError('Informe a descrição da entrada.'); if (!Number.isFinite(amount) || amount <= 0) return setError('Informe um valor maior que zero.'); setSaving(true); setError(''); try { await api.createIncome({ description: form.description.trim(), amount, date: form.date, categoryId: form.categoryId || null }); onSaved() } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">MOVIMENTAÇÃO</span><h2>Nova entrada</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{error && <div className="alert error">{error}</div>}<label>Descrição<input autoFocus required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><label>Valor<input required inputMode="decimal" placeholder="0,00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label><div className="form-grid income-form-grid"><label>Grupo<select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}><option value="">Sem grupo</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Data<input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label></div><p className="modal-copy">Entradas não podem ser editadas depois de criadas. Se necessário, exclua e cadastre novamente.</p><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>Salvar entrada</button></div></form></div>
}

function ExpenseModal({ item, categories, currentBalance, businessDate: referenceDate, onClose, onSaved }) {
  const [form, setForm] = useState({ description: item?.description || '', amount: item?.amount ?? '', categoryId: item?.categoryId || '', date: item?.date?.slice(0, 10) || referenceDate?.slice(0, 10) || businessToday() }); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const save = async event => { event.preventDefault(); const amount = parseAmount(form.amount); if (!form.description.trim()) return setError('Informe a descrição da saída.'); if (!Number.isFinite(amount) || amount <= 0) return setError('Informe um valor maior que zero.'); if (!item && amount > Number(currentBalance) && !window.confirm(`Esta saída é maior que o saldo real disponível (${money(currentBalance)}). Deseja confirmar mesmo assim?`)) return; setSaving(true); setError(''); try { const body = { description: form.description.trim(), amount, date: form.date, categoryId: form.categoryId || null, type: 'Expense' }; if (item) await api.updateTransaction(item.id, body); else await api.createExpense(body); onSaved() } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">MOVIMENTAÇÃO</span><h2>Nova saída</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{error && <div className="alert error">{error}</div>}<p className="modal-copy">Registre um gasto já realizado. Ele reduz o saldo real e não cria compromisso, reserva ou parcela.</p><label>Descrição<input autoFocus required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><label>Valor<input required inputMode="decimal" placeholder="0,00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label><div className="form-grid income-form-grid"><label>Grupo <span className="field-hint">(opcional)</span><select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}><option value="">Sem grupo</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Data<input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label></div><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>Registrar saída</button></div></form></div>
}

function StatusFilter({ status, onStatus }) {
  return <div className="status-chips" aria-label="Filtrar por status"><button className={`filter-control ${status === 'active' ? 'active' : ''}`} onClick={() => onStatus('active')}>Ativos</button><button className={`filter-control ${status === 'completed' ? 'active' : ''}`} onClick={() => onStatus('completed')}>Concluídos</button><button className={`filter-control ${status === 'all' ? 'active' : ''}`} onClick={() => onStatus('all')}>Todos</button></div>
}

function CommitmentListItem({ item, availableBalance, onChange, onEdit, onDelete }) {
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

function CommitmentSummarySkeleton() { return <div className="commitments-summary commitments-summary-skeleton" aria-hidden="true">{[1, 2, 3, 4].map(key => <div className="commitments-skeleton-block" key={key} />)}</div> }
function CommitmentToolbarSkeleton() { return <div className="commitments-toolbar-skeleton" aria-hidden="true"><span /><span /><span /><span /><span /></div> }
function CommitmentListSkeleton() { return <div className="commitments-list commitments-list-skeleton" aria-hidden="true">{[1, 2, 3, 4].map(key => <div className="commitments-list-skeleton-row" key={key}><span /><span /><span /><span /><span /></div>)}</div> }

function CommitmentsPage({ commitments, filtered, categories, filters, setFilters, searchInput, setSearchInput, activeFilterCount, onOpenFilters, summary, onCreate, setEditing, run, refresh, loading, initialLoadComplete, error, onRetry, onClearFilters }) {
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
      <PageHeader className="commitments-page-heading" eyebrow="PLANEJAMENTO" title="Compromissos" description="Organize valores reservados para despesas e obrigações futuras." titleId="commitments-page-title" />
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
  const totalPaid = Number(item.totalPaidAmount ?? 0)
  const overallReserved = Number(item.isOpenEnded ? item.allocatedForNextInstallment : item.allocatedAmount)
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
  return <article className={`commitment-static-card ${actionableUrgent ? 'is-urgent' : ''} is-next-${nextActionState}`} data-commitment-part="card"><header className="commitment-static-header" data-commitment-part="header"><button type="button" className="commitment-static-summary-trigger" title="Abrir detalhes do compromisso" onClick={() => setDetailsOpen(true)} aria-expanded={detailsOpen}><span className="commitment-static-title"><span className="commitment-static-avatar" aria-hidden="true">{item.name.slice(0, 1).toUpperCase()}</span><span className="commitment-static-heading"><span className="commitment-static-name-row"><h3 title={item.name}>{item.name}</h3>{item.categoryName && <span className="commitment-static-badge">{item.categoryName}</span>}{priority && <span className={`commitment-static-badge commitment-static-priority-${item.priority}`}>{priority}</span>}{item.urgent && <span className="commitment-static-urgent-badge">⚠ Urgente</span>}</span></span></span><span className="commitment-static-chevron" aria-hidden="true">›</span></button><span><CommitmentMenu item={item} onDetails={() => setDetailsOpen(true)} onEdit={onEdit} onDelete={onDelete} /></span></header><div className="commitment-static-body"><section className={`commitment-static-overall ${actionableUrgent ? 'is-urgent' : ''} ${overallCoverage >= 100 ? 'is-complete' : ''}`} data-commitment-part="overall" aria-label="Progresso geral do compromisso"><div className="commitment-static-section-heading"><h4>{overallHeading}</h4><strong>{Math.round(overallCoverage)}%</strong></div><div className="commitment-static-reserved"><span title="Total que já foi efetivamente pago neste compromisso. Esse valor vem dos pagamentos registrados e não muda quando parcelas futuras são editadas.">Pago</span><strong>{money(totalPaid)}</strong><span title="Parte do saldo atual ainda separada para pagamentos futuros deste compromisso.">Reservado</span><strong>{money(overallReserved)}</strong><span>de</span><strong>{money(item.totalAmount)}</strong></div><div className="commitment-static-remaining"><span title="Parte do valor restante que ainda não possui dinheiro reservado.">Ainda sem cobertura</span><strong>{money(overallRemaining)}</strong></div><div className="commitment-static-progress" role="progressbar" aria-label={`Cobertura geral: ${Math.round(overallCoverage)}%`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(overallCoverage)}><span style={{ width: `${Math.min(100, Math.max(0, overallCoverage))}%` }} /></div></section><section className="commitment-static-next" data-commitment-part="next" aria-label="Próxima parcela"><div className="commitment-static-section-heading"><h4>Próxima parcela</h4><span className="commitment-static-next-badge">{nextActionState === 'paid' ? '✓ Paga' : nextActionState === 'ready' ? '✓ Pronta para confirmar' : installmentCoverage > 0 ? 'Cobertura parcial' : 'Sem cobertura'}</span></div><div className="commitment-static-next-grid"><div className="commitment-static-next-main"><strong>{money(item.installmentAmount)}</strong><span>Vence em {formatDate(nextDueDate)}</span></div><div className="commitment-static-next-status"><strong>{Number(installmentCoverage).toFixed(1).replace('.', ',')}% coberta</strong>{installmentCoverage < 100 && <span> · faltam {money(item.missingForNextInstallment ?? Math.max(0, item.installmentAmount - item.allocatedAmount))}</span>}</div><div className="commitment-static-context"><strong>{nextActionState === 'paid' ? 'Status da cobrança' : 'Próxima ação'}</strong><span>{contextCopy}</span></div><span className="commitment-static-action"><button type="button" className={`commitment-static-action-button ${needsAllocation ? 'is-allocate' : 'is-pay'}`} disabled={item.isCompleted || busy || (needsAllocation && availableBalance <= 0)} onClick={runPrimaryAction}><span aria-hidden="true">{needsAllocation ? '↗' : item.isCompleted ? '✓' : '✓'}</span>{busy ? 'Processando…' : primaryLabel}</button><small>{actionHint}</small>{needsAllocation && availableBalance <= 0 && <small>Abra os detalhes para ajustar a reserva.</small>}</span></div></section>{actionMessage && <div className="commitment-static-success" role="status">✓ {actionMessage}</div>}{actionError && <div className="commitment-static-error" role="status">{actionError}</div>}</div>{detailsOpen && <CommitmentDetailsDrawer item={item} availableBalance={availableBalance} priority={priority} onClose={() => setDetailsOpen(false)} onEdit={onEdit} onDelete={onDelete} onChange={onChange} />}</article>
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

function CommitmentModal({ item, categories, businessDate: referenceDate, onClose, onSaved }) {
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


createRoot(document.getElementById('root')).render(<ThemeProvider><ErrorBoundary><ApiAvailabilityBoundary><App /></ApiAvailabilityBoundary></ErrorBoundary></ThemeProvider>)
