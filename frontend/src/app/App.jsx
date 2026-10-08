import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ErrorBoundary from '../ErrorBoundary.jsx'
import {
  ArrowLeftRight, BarChart3, Calculator, ChevronDown, CircleAlert,
  LayoutDashboard, Plus, Settings, Target, Menu,
} from 'lucide-react'
import { api, apiAvailabilityEvents, markAccountContextChanged } from '../services/api'
import { APP_VERSION } from '../appVersion'
import ModalLayer from '../components/ModalLayer.jsx'
import DashboardPage from '../features/dashboard/DashboardPage.jsx'
import PlanningPage from '../features/planning/PlanningPage.jsx'
import { AccountDialog, AccountDeleteModal, AccountPopover, AccountAvatar, PasswordRecoveryPage, ProfileSecurityPage, SettingsPage } from '../features/settings/SettingsComponents.jsx'
import { AlertModal, CategoryModal, CommitmentModal, CommitmentsPage, ConfirmModal, CurrentBalanceModal, ExpenseModal, FilterDrawer, IncomeModal, RecurringIncomeDrawer, RecurringIncomeModal } from '../features/movements/CommitmentsFeature.jsx'
import MovementsArea from '../features/movements/MovementsArea.jsx'
import FinancialForecastPage from '../features/forecast/ForecastPage.jsx'
import MovementsPage from '../features/movements/MovementsPage.jsx'
import MovementFormModal from '../features/movements/components/MovementFormModal.jsx'
import { AppSidebar, MobileBottomNavigation, MobileNavigation } from './AppNavigation.jsx'
import '../structural.css'
import { businessMonth, businessToday } from '../utils/businessDate.js'
import { errorText, money } from '../utils/financial.js'

const navigationItems = [
  { id: 'dashboard', href: '#dashboard', view: 'dashboard', desktopLabel: 'Dashboard', mobileLabel: 'Dashboard', icon: LayoutDashboard },
  { id: 'movimentacoes', href: '#movimentacoes', view: 'movements', desktopLabel: 'Movimentações', mobileLabel: 'Movimentações', icon: ArrowLeftRight },
  { id: 'previsoes', href: '#previsoes', view: 'forecast', desktopLabel: 'Previsões', mobileLabel: 'Previsões', icon: BarChart3 },
  { id: 'planejamento', href: '#planejamento', view: 'planning', desktopLabel: 'Planejamento', mobileLabel: 'Planejamento', icon: Target },
  { id: 'configuracoes', href: '#configuracoes', view: 'settings', desktopLabel: 'Configurações', mobileLabel: 'Configurações', icon: Settings },
]
const legacyHashRedirects = { '#compromissos': '#movimentacoes/obrigacoes', '#grupos': '#configuracoes', '#perfil': '#configuracoes', '#suporte': '#configuracoes' }

const navigationItemMatchesHash = (item, hash) => hash === item.href || hash.startsWith(`${item.href}/`)
const iconProps = { size: 18, strokeWidth: 1.8, 'aria-hidden': true, focusable: false }
const Icon = ({ icon: Glyph, size, className = '' }) => <Glyph {...iconProps} size={size ?? iconProps.size} className={className} />
const formatDate = date => date ? new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data informada'
const normalizeMonth = value => {
  const match = /^(\d{4})-(\d{2})/.exec(String(value || ''))
  if (match && Number(match[2]) >= 1 && Number(match[2]) <= 12) return `${match[1]}-${match[2]}`
  return businessMonth()
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
  return createPortal(<div ref={popoverRef} className="calculator-popover" role="dialog" aria-label="Calculadora"><div className="calculator-header"><div><span className="eyebrow">UTILITÁRIO</span><strong>Calculadora</strong></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar calculadora">×</button></div><div className="calculator-display"><div className="calculator-expression" aria-label="Expressão atual">{expression || '0'}</div><div className="calculator-result" aria-live="polite">{result === null ? '—' : formatCalculatorNumber(result)}</div>{error && <small className="calculator-error" role="alert">{error}</small>}</div><div ref={keypadRef} className="calculator-keypad" tabIndex="0" aria-label="Teclado da calculadora">{buttons.map(([label, value]) => <button key={label} type="button" className={value === 'clear' ? 'calculator-clear' : ['+', '-', '×', '÷', '%'].includes(value) ? 'calculator-operator' : ''} onClick={() => value === 'clear' ? clear() : value === 'erase' ? erase() : append(value)}>{label}</button>)}<button type="button" className="calculator-equals" onClick={calculate}>=</button></div><div className="calculator-actions"><button type="button" className="tertiary" onClick={copyResult} disabled={result === null}>{copied ? 'Copiado' : 'Copiar resultado'}</button><span>Enter calcula · Esc fecha</span></div></div>, document.body)
}

function ApiUnavailableScreen({ checking, retrying, onRetry, status }) {
  return <div className="api-unavailable-screen" role="alertdialog" aria-labelledby="api-unavailable-title" aria-describedby="api-unavailable-description">
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

  if (availability === 'checking') return <div className="api-unavailable-screen api-checking-screen" aria-busy="true" aria-label="Verificando disponibilidade do serviço" />
  return <>{availability === 'online' && children}{availability === 'offline' && <ApiUnavailableScreen checking={checking} retrying={retrying} onRetry={() => check(true)} status={status} />}</>
}

function AppTopbar({ account, accountState, accountMutationBusy, accountPopoverOpen, onToggleAccount, onCloseAccount, onAccountAction, createMenuOpen, onToggleCreate, onNewIncome, onNewExpense, onNewRecurring, onNewCommitment, onOpenNavigation, calculatorOpen, onToggleCalculator }) {
  return <header className="app-topbar">
    <span className="app-mobile-brand">Aloca</span>
    <button type="button" className="app-mobile-menu-button" onClick={onOpenNavigation} aria-label="Abrir navegação" aria-controls="mobile-navigation"><Menu size={20} /></button>
    <div className="app-topbar-actions">
      <div className="app-create-wrap">
        <button type="button" className="app-create-button" aria-label="Novo" title="Novo" aria-haspopup="menu" aria-expanded={createMenuOpen} onClick={onToggleCreate}><Icon icon={Plus} size={19} /><span className="app-create-label">Novo</span></button>
        {createMenuOpen && <div className="app-create-menu" role="menu"><button type="button" role="menuitem" onClick={onNewIncome}>Nova entrada</button><button type="button" role="menuitem" onClick={onNewExpense}>Nova saída</button><button type="button" role="menuitem" onClick={onNewRecurring}>Nova entrada recorrente</button><button type="button" role="menuitem" onClick={onNewCommitment}>Novo compromisso</button></div>}
      </div>
      <button type="button" className={`calculator-trigger${calculatorOpen ? ' active' : ''}`} onClick={onToggleCalculator} aria-label="Calculadora" aria-expanded={calculatorOpen} title="Calculadora"><Calculator size={20} /></button>
      <div className="app-account-wrap"><button type="button" className="app-account-button" onClick={onToggleAccount} aria-haspopup="dialog" aria-expanded={accountPopoverOpen} aria-controls={accountPopoverOpen ? 'account-popover' : undefined} aria-label="Abrir gerenciamento da conta"><AccountAvatar account={account} className="app-account-avatar" /><span><strong>{account?.displayName || 'Minha conta'}</strong><small>{account?.isLocal ? 'Conta local' : 'Conta protegida'}</small></span><ChevronDown size={17} /></button>{accountPopoverOpen && <div id="account-popover"><AccountPopover accountState={accountState} busy={accountMutationBusy} onClose={onCloseAccount} onProfile={onAccountAction.profile} onProtect={onAccountAction.protect} onSwitch={onAccountAction.switch} onAdd={onAccountAction.add} onRemove={onAccountAction.remove} /></div>}</div>
    </div>
  </header>
}

function App() {
  const [accountState, setAccountState] = useState(null)
  const [accountReady, setAccountReady] = useState(false)
  const [accountDialog, setAccountDialog] = useState(() => new URLSearchParams(window.location.search).get('openLogin') === '1' ? { mode: 'login' } : null)
  const [passwordRecoveryOpen, setPasswordRecoveryOpen] = useState(false)
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
  const getView = () => { const hash = window.location.hash || '#dashboard'; if (legacyHashRedirects[hash]) return hash === '#compromissos' ? 'movements' : 'settings'; return navigationItems.find(item => navigationItemMatchesHash(item, hash))?.view || 'dashboard' }
  const [view, setView] = useState(getView())
  const getMovementSection = () => window.location.hash === '#movimentacoes/obrigacoes' || window.location.hash === '#compromissos' ? 'obrigacoes' : window.location.hash === '#movimentacoes/recorrentes' ? 'recorrentes' : 'historico'
  const [movementSection, setMovementSection] = useState(getMovementSection())
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('openLogin') === '1') window.history.replaceState({}, '', '/')
  }, [])
  useEffect(() => {
    if (!mobileNavigationOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = event => { if (event.key === 'Escape') setMobileNavigationOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', closeOnEscape) }
  }, [mobileNavigationOpen])
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
  useEffect(() => { const onHash = () => { const target = legacyHashRedirects[window.location.hash]; if (target) { window.location.hash = target; return } setView(getView()); setMovementSection(getMovementSection()); setMobileNavigationOpen(false) }; onHash(); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash) }, [])
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
  const movementsProps = { incomes, expenses, recurringIncomes, summary, categories, onEdit: item => item.isRecurringDefinition ? setRecurringDialog(item) : setMovementForm({ mode: 'edit', item }), onDelete: item => { if (item.isRecurringDefinition) { setRecurringDeleteError(''); setRecurringDelete(item) } else { setMovementDeleteError(''); setMovementDelete(item) } }, onManage: item => setRecurringManage(item) }
  const commitmentsProps = { commitments, filtered, categories, filters, setFilters, searchInput, setSearchInput, activeFilterCount, onOpenFilters: () => setFiltersOpen(true), summary, onCreate: () => setEditing({}), setEditing, run, refresh, loading, initialLoadComplete, error, onRetry: () => refresh(), onClearFilters: clearFilters }
  const profileProps = { onUpdateProfile: updateProfile, onSaveAvatar: saveAvatar, onRemoveAvatar: removeAvatar, accountMutationBusy, onSecurity: mode => setAccountDialog({ mode }), onDelete: () => setAccountDeleteOpen(true) }
  const groupsProps = { categories, onCreate: async name => { await api.createCategory(name); await refresh() }, onEdit: editCategory, onDelete: deleteCategory }
  if (!accountReady) return <div className="app-shell"><div className="loading">Preparando sua conta local…</div></div>
  if (!accountState?.current) return <div className="app-shell"><div className="loading account-recovery"><strong>Não foi possível abrir uma conta local</strong><span>Gerencie as contas deste dispositivo para liberar espaço e entrar no Aloca.</span></div></div>
  return <div className="app-shell">
    <AppTopbar account={accountState.current} accountState={accountState} accountMutationBusy={accountMutationBusy} accountPopoverOpen={accountPopoverOpen} onToggleAccount={() => setAccountPopoverOpen(value => !value)} onCloseAccount={() => setAccountPopoverOpen(false)} onAccountAction={{ profile: () => { setAccountPopoverOpen(false); window.location.hash = '#configuracoes' }, protect: () => { setAccountPopoverOpen(false); setAccountDialog({ mode: 'protect' }) }, switch: switchAccount, add: () => { setAccountPopoverOpen(false); setAccountDialog({ mode: 'add' }) }, remove: () => { setAccountPopoverOpen(false); setAccountDialog({ mode: 'remove' }) }}} createMenuOpen={createMenuOpen} onToggleCreate={() => setCreateMenuOpen(value => !value)} onNewIncome={() => { setCreateMenuOpen(false); setMovementForm({ mode: 'create-income' }) }} onNewExpense={() => { setCreateMenuOpen(false); setMovementForm({ mode: 'create-expense' }) }} onNewRecurring={() => { setCreateMenuOpen(false); setRecurringDialog(true) }} onNewCommitment={() => { setCreateMenuOpen(false); window.location.hash = '#movimentacoes/obrigacoes' }} onOpenNavigation={() => setMobileNavigationOpen(true)} calculatorOpen={calculatorOpen} onToggleCalculator={() => setCalculatorOpen(value => !value)} />
    <AppSidebar items={navigationItems} view={view} />
    {mobileNavigationOpen && <MobileNavigation items={navigationItems} view={view} onClose={() => setMobileNavigationOpen(false)} />}
    <MobileBottomNavigation items={navigationItems} view={view} />
    <CalculatorPopover open={calculatorOpen} onClose={() => setCalculatorOpen(false)} />
    <main className="app-main">
      <div className="page-content">
      {error && view !== 'movements' && <div className="alert error">{error}</div>}

       {view === 'forecast' ? <FinancialForecastPage businessDate={summary?.businessDate} /> : view === 'planning' ? <PlanningPage /> : view === 'settings' ? <SettingsPage account={accountState.current} profileProps={profileProps} groupsProps={groupsProps} /> : loading && !initialLoadComplete && view !== 'movements' ? <div className="loading">Carregando sua vida financeira…</div> : view === 'movements' ? <MovementsArea movementSection={movementSection} movementsProps={movementsProps} commitmentsProps={commitmentsProps} /> : <DashboardPage summary={summary} monthlySummary={monthlySummary} monthlyLoading={monthlySummaryLoading} monthlyError={monthlySummaryError} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} onRetryMonthly={retryMonthlySummary} onEditBalance={() => setBalanceDialog(true)} />}
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
    {accountDialog && accountDialog.mode !== 'remove' && accountDialog.mode !== 'switch' && <AccountDialog mode={accountDialog.mode} initialDisplayName={accountState?.current?.displayName || ''} initialEmail={accountState?.current?.email || ''} onClose={() => setAccountDialog(null)} onSubmit={handleAccountSubmit} onForgotPassword={() => { setAccountDialog(null); setPasswordRecoveryOpen(true) }} />}
    {passwordRecoveryOpen && <ModalLayer className="recovery-modal" onClose={() => { setPasswordRecoveryOpen(false); setAccountDialog({ mode: 'login' }) }}><PasswordRecoveryPage onBack={() => { setPasswordRecoveryOpen(false); setAccountDialog({ mode: 'login' }) }} /></ModalLayer>}
    {accountDialog?.mode === 'remove' && <ConfirmModal title="Remover conta deste dispositivo?" message="A conta será desvinculada deste dispositivo e liberará um espaço na lista de contas. Os dados da conta não serão excluídos." confirmLabel="Remover" busy={accountMutationBusy} onClose={() => { if (!accountMutationBusy) setAccountDialog(null) }} onConfirm={removeAccount} />}
    {accountDeleteOpen && <AccountDeleteModal displayName={accountState?.current?.displayName || ''} isLocal={accountState?.current?.isLocal} onClose={() => setAccountDeleteOpen(false)} onConfirm={deleteAccount} />}
    {notice && <div className="app-toast success" role="status" aria-live="polite">✓ {notice.replace(' com sucesso', '')}</div>}
  </div>
}

function RootApp() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/'
  if (path === '/reset-password') {
    const token = new URLSearchParams(window.location.search).get('token') || ''
    return <PasswordRecoveryPage initialToken={token} />
  }
  return <ErrorBoundary><ApiAvailabilityBoundary><App /></ApiAvailabilityBoundary></ErrorBoundary>
}

export default RootApp
