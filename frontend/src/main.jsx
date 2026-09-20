import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { api } from './services/api'
import { TutorialProvider, useTutorial } from './tutorials'
import './styles.css'
import './projection.css'
import './balance.css'
import './payment.css'
import './transactions.css'
import './dashboard.css'
import './semantic.css'
import './dashboard-compact.css'
import './theme.css'
import './calculator.css'
import './responsive-system.css'
import './tutorial.css'
import './commitment-static-card.css'

const formatCurrency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
const money = formatCurrency
const signedMoney = (value, positive = '+') => `${Number(value) < 0 ? '-' : positive} ${formatCurrency(Math.abs(Number(value) || 0))}`
const errorText = error => error?.message || 'Não foi possível concluir a operação.'
const parseAmount = value => { const normalized = String(value).trim().replace(',', '.'); if (!normalized || !/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN; return Number(normalized) }
const addMonths = (date, months) => { if (!date) return ''; const [year, month, day] = date.slice(0, 10).split('-').map(Number); const result = new Date(Date.UTC(year, month - 1 + months, 1)); const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate(); result.setUTCDate(Math.min(day, lastDay)); return result.toISOString().slice(0, 10) }
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

function App() {
  const [summary, setSummary] = useState(null)
  const [commitments, setCommitments] = useState([])
  const [categories, setCategories] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ category: '', priority: '', status: '', coverage: '', payment: '', deficit: false, payable: false, sort: 'priority' })
  const [collapsed, setCollapsed] = useState({})
  const [categoryDialog, setCategoryDialog] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState(null)
   const [loading, setLoading] = useState(true)
   const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState(null)
  const [modal, setModal] = useState(false)
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
  const [projection, setProjection] = useState(null)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [selectedMonth, setSelectedMonth] = useState(() => sessionStorage.getItem('aloca-selected-month') || currentMonth)
  const [projectionMonths, setProjectionMonths] = useState(Number(localStorage.getItem('aloca-projection-months') || 12))
  const [commitmentObjective, setCommitmentObjective] = useState(() => localStorage.getItem('aloca-commitment-objective') || '')
  const { theme, toggleTheme } = useTheme()
  const { start: startTutorial } = useTutorial()
  const getView = () => window.location.hash === '#movimentacoes' ? 'incomes' : window.location.hash === '#compromissos' ? 'commitments' : 'dashboard'
  const [view, setView] = useState(getView())
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [calculatorOpen, setCalculatorOpen] = useState(false)

  const projectionHorizon = Math.max(3, projectionMonths, monthDistance(currentMonth, selectedMonth))

  const refresh = async () => {
    setLoading(true); setError('')
    try { const [nextSummary, nextCommitments, nextCategories, nextIncomes, nextExpenses, nextRecurring, nextProjection] = await Promise.all([api.summary(), api.commitments(), api.categories(), api.incomes(), api.expenses(), api.recurringIncomes(), api.projection(projectionHorizon)]); setSummary(nextSummary); setCommitments(nextCommitments); setCategories(nextCategories); setIncomes(nextIncomes.items || []); setExpenses(nextExpenses.items || []); setRecurringIncomes(nextRecurring || []); setProjection(nextProjection) }
     catch (e) { setError(errorText(e)) } finally { setLoading(false); setInitialLoadComplete(true) }
  }
  useEffect(() => { refresh() }, [projectionHorizon])
  useEffect(() => { sessionStorage.setItem('aloca-selected-month', selectedMonth) }, [selectedMonth])
  useEffect(() => { const onHash = () => setView(getView()); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash) }, [])
  useEffect(() => { const timer = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 250); return () => clearTimeout(timer) }, [searchInput])
  useEffect(() => {
    if (!filtersOpen) return undefined
    const closeOnEscape = event => { if (event.key === 'Escape') setFiltersOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = '' }
  }, [filtersOpen])
  useEffect(() => {
    if (!createMenuOpen) return undefined
    const closeOnEscape = event => { if (event.key === 'Escape') setCreateMenuOpen(false) }
    const closeOnOutsideClick = event => { if (!event.target.closest('.global-create')) setCreateMenuOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => { document.removeEventListener('keydown', closeOnEscape); document.removeEventListener('mousedown', closeOnOutsideClick) }
  }, [createMenuOpen])
  useEffect(() => {
    if (loading) return
    const markers = view === 'incomes'
      ? [['.income-management .page-heading', 'movements-page'], ['.movement-actions', 'movement-create'], '.management-tabs', '.income-filters-disclosure', '.all-movements-section', '.management-tabs button:last-child'].map(item => Array.isArray(item) ? item : [item, item === '.management-tabs' ? 'movement-tabs' : item === '.income-filters-disclosure' ? 'movement-filters' : item === '.all-movements-section' ? 'movement-results' : 'recurring-tab'])
      : view === 'commitments'
        ? [['.commitments-page .page-heading', 'commitments-page'], ['.commitments-page .section-actions .primary', 'create-commitment'], ['.commitments-page .filters-toolbar input', 'commitment-search'], ['.commitments-page .section-actions .secondary', 'commitment-filters'], ['.commitments-page .category-chips', 'commitment-groups']]
        : []
    markers.forEach(([selector, marker]) => document.querySelector(selector)?.setAttribute('data-tour', marker))
  }, [commitments.length, expenses.length, incomes.length, loading, view])

  const filtered = commitments.filter(item => {
    const coverage = item.remainingInstallments === 0 ? 'full' : item.allocatedAmount <= 0 ? 'none' : item.allocatedAmount >= item.installmentAmount ? 'next' : 'partial'
    const payment = item.paidInstallments === 0 ? 'none' : item.isCompleted ? 'done' : 'progress'
    return (!search || item.name.toLowerCase().includes(search)) && (!filters.category || (filters.category === 'none' ? !item.categoryId : item.categoryId === filters.category)) && (!filters.priority || (filters.priority === 'none' ? !item.priority : String(item.priority) === filters.priority)) && (!filters.status || (filters.status === 'completed' ? item.isCompleted : !item.isCompleted)) && (!filters.coverage || coverage === filters.coverage) && (!filters.payment || payment === filters.payment) && (!filters.deficit || item.missingForFullCoverage > 0) && (!filters.payable || item.allocatedAmount >= item.installmentAmount && !item.isCompleted)
  }).sort((a, b) => { const c = a.categoryName || 'Sem grupo'; const d = b.categoryName || 'Sem grupo'; if (filters.sort === 'name') return a.name.localeCompare(b.name); if (filters.sort === 'total') return b.totalAmount - a.totalAmount; if (filters.sort === 'remaining') return b.remainingAmount - a.remainingAmount; if (filters.sort === 'next') return a.missingForNextInstallment - b.missingForNextInstallment; if (filters.sort === 'progress') return (b.paidInstallments / b.totalInstallments) - (a.paidInstallments / a.totalInstallments); if (filters.sort === 'category') return c.localeCompare(d) || a.name.localeCompare(b.name); return (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name) })
  const groups = filtered.reduce((acc, item) => { const key = item.categoryId || 'none'; (acc[key] ||= []).push(item); return acc }, {})
  const clearFilters = () => { setSearchInput(''); setFilters({ category: '', priority: '', status: '', coverage: '', payment: '', deficit: false, payable: false, sort: 'priority' }) }
  const activeFilterCount = ['category', 'priority', 'status', 'coverage', 'payment'].filter(key => filters[key]).length + (filters.deficit ? 1 : 0) + (filters.payable ? 1 : 0) + (filters.sort !== 'priority' ? 1 : 0)
  const editCategory = category => setCategoryDialog(category)
  const deleteCategory = category => setDeleteDialog(category)

  const run = async action => { setError(''); setNotice(''); try { await action(); await refresh(); setNotice('Alterações salvas com sucesso.') } catch (e) { setError(errorText(e)) } }
  const openDistribution = async () => { setError(''); try { setPreview(await api.preview()); setModal(true) } catch (e) { setError(errorText(e)) } }
  const distribute = () => run(async () => { await api.distribute(); setModal(false); setPreview(null) })

  const goToCommitments = () => { window.location.hash = 'compromissos' }
  const priorityItems = [...commitments].sort((a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER) || (a.nextDueDate || a.dueDate || '').localeCompare(b.nextDueDate || b.dueDate || '')).slice(0, 3)
  const saveCommitmentObjective = objective => { setCommitmentObjective(objective); localStorage.setItem('aloca-commitment-objective', objective) }
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="eyebrow">CONTROLE FINANCEIRO</span><h1>Aloca</h1></div><nav className="main-nav" aria-label="Navegação principal"><a className={view === 'dashboard' ? 'active' : ''} href="#dashboard">Visão geral</a><a className={view === 'incomes' ? 'active' : ''} href="#movimentacoes">Movimentações</a><a className={view === 'commitments' ? 'active' : ''} href="#compromissos">Compromissos</a></nav><div className="topbar-actions"><div className="global-create"><button type="button" className="primary global-create-trigger" aria-haspopup="menu" aria-expanded={createMenuOpen} onClick={() => setCreateMenuOpen(value => !value)}>+ Novo</button>{createMenuOpen && <div className="global-create-menu" role="menu"><button type="button" role="menuitem" onClick={() => { setCreateMenuOpen(false); setIncomeDialog(true) }}>Nova entrada</button><button type="button" role="menuitem" onClick={() => { setCreateMenuOpen(false); setRecurringDialog(true) }}>Nova recorrência</button><button type="button" role="menuitem" onClick={() => { setCreateMenuOpen(false); setEditing({}) }}>Novo compromisso</button></div>}</div><button className={`calculator-trigger ${calculatorOpen ? 'active' : ''}`} type="button" onClick={() => setCalculatorOpen(value => !value)} aria-label="Abrir calculadora" aria-expanded={calculatorOpen} title="Calculadora"><span aria-hidden="true">▣</span></button><button type="button" className="theme-toggle" onClick={toggleTheme} aria-pressed={theme === 'dark'} aria-label={theme === 'dark' ? 'Tema escuro. Alternar para tema claro' : 'Tema claro. Alternar para tema escuro'} title={theme === 'dark' ? 'Tema escuro' : 'Tema claro'}><span className="theme-toggle-icon" aria-hidden="true">☀</span><span className="theme-toggle-track" aria-hidden="true"><span /></span><span className="theme-toggle-icon" aria-hidden="true">☾</span></button><button className="help-button" type="button" data-tour="help" onClick={startTutorial} aria-label="Iniciar tutorial desta página" title="Iniciar tutorial desta página">?</button></div></header>
    <CalculatorPopover open={calculatorOpen} onClose={() => setCalculatorOpen(false)} />
    <main>
      {error && <div className="alert error">{error}</div>}{notice && <div className="alert success">{notice}</div>}

       {loading && !initialLoadComplete ? <div className="loading">Carregando sua vida financeira…</div> : view === 'incomes' ? <IncomeManagement incomes={incomes} expenses={expenses} recurringIncomes={recurringIncomes} categories={categories} onCreate={() => setIncomeDialog(true)} onCreateRecurring={() => setRecurringDialog(true)} onCreateExpense={() => setExpenseDialog(true)} onDelete={income => setIncomeDelete(income)} onEditExpense={setEditingExpense} onDeleteExpense={expense => setDeleteDialog({ ...expense, transaction: true })} onRefresh={refresh} onRecurringDeleted={() => setNotice('Entrada recorrente excluída com sucesso.')} /> : view === 'commitments' ? <CommitmentsPage commitments={commitments} filtered={filtered} groups={groups} categories={categories} summary={summary} filters={filters} setFilters={setFilters} searchInput={searchInput} setSearchInput={setSearchInput} filtersOpen={filtersOpen} setFiltersOpen={setFiltersOpen} activeFilterCount={activeFilterCount} setEditing={setEditing} setCollapsed={setCollapsed} collapsed={collapsed} run={run} refresh={refresh} /> : <>
        <BalanceCommandCenter summary={summary} commitments={commitments} projection={projection} selectedObjective={commitmentObjective} onObjectiveChange={saveCommitmentObjective} onBalance={() => setBalanceModal(true)} onDistribute={openDistribution} />
        <details className="dashboard-secondary" data-tour="dashboard-details">
          <summary>Explorar detalhes do mês</summary>
          <div className="dashboard-secondary-content">
            <details className="dashboard-panel" data-tour="dashboard-summary"><summary>Resumo financeiro do mês <span>Entradas, saídas e saldo estimado</span></summary><div className="dashboard-panel-content"><MonthlyFinancialSummary projection={projection} commitments={commitments} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} onView={goToCommitments} /></div></details>
            <details className="dashboard-panel" data-tour="dashboard-projection"><summary>Projeção de saldo <span>Visão dos próximos meses</span></summary><div className="dashboard-panel-content"><FinancialProjectionChart data={projection} period={projectionMonths} onPeriodChange={value => { localStorage.setItem('aloca-projection-months', value); setProjectionMonths(value) }} onMonthChange={setSelectedMonth} selectedMonth={selectedMonth} /></div></details>
            <details className="dashboard-panel" id="movimentacoes" data-tour="dashboard-movements"><summary>Movimentações recentes <span>{incomes.length + expenses.length} registradas</span></summary><div className="dashboard-panel-content"><RecentIncomeSection incomes={incomes} expenses={expenses} onCreate={() => setIncomeDialog(true)} onCreateExpense={() => setExpenseDialog(true)} onEditExpense={setEditingExpense} onDeleteExpense={expense => setDeleteDialog({ ...expense, transaction: true })} onViewAll={() => { window.location.hash = 'movimentacoes' }} /></div></details>
             <details className="dashboard-panel"><summary>Próximos compromissos <span>Itens que merecem atenção</span></summary><div className="dashboard-panel-content"><section className="section-heading commitments-preview-heading"><div><span className="eyebrow">COMPROMISSOS FINANCEIROS</span><h2>Próximos compromissos</h2></div><button type="button" className="secondary" onClick={goToCommitments}>Ver todos</button></section>{priorityItems.length ? <div className="commitment-preview-list">{priorityItems.map(item => <CommitmentPreviewCard key={item.id} item={item} />)}</div> : <div className="empty"><strong>Nenhum compromisso ainda</strong><span>Crie um compromisso para começar a organizar seu saldo.</span></div>}</div></details>
          </div>
        </details>
      </>}
    </main>
    {editing && <CommitmentModal item={editing} categories={categories} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); run(async () => {}) }} />}
    {balanceModal && <InitialBalanceModal value={summary?.initialBalance ?? 0} onClose={() => setBalanceModal(false)} onSaved={() => { setBalanceModal(false); refresh(); setNotice('Saldo inicial atualizado.') }} />}
    {incomeDialog && <IncomeModal categories={categories} onClose={() => setIncomeDialog(false)} onSaved={() => { setIncomeDialog(false); run(async () => {}) }} />}
    {recurringDialog && <RecurringIncomeModal categories={categories} onClose={() => setRecurringDialog(false)} onSaved={() => { setRecurringDialog(false); run(async () => {}) }} />}
    {(expenseDialog || editingExpense) && <ExpenseModal item={editingExpense} categories={categories} currentBalance={summary?.saldoReal ?? 0} onClose={() => { setExpenseDialog(false); setEditingExpense(null) }} onSaved={() => { setExpenseDialog(false); setEditingExpense(null); run(async () => {}) }} />}
    {incomeDelete && <ConfirmModal title="Excluir entrada?" message={`Esta ação não poderá ser desfeita. A entrada “${incomeDelete.description}” de ${money(incomeDelete.amount)} será removida do saldo real.`} onClose={() => setIncomeDelete(null)} onConfirm={() => run(async () => { await api.deleteIncome(incomeDelete.id); setIncomeDelete(null) })} />}
    {modal && <DistributionModal preview={preview} onClose={() => setModal(false)} onConfirm={distribute} />}
    {filtersOpen && <FilterDrawer filters={filters} setFilters={setFilters} categories={categories} onClear={clearFilters} onClose={() => setFiltersOpen(false)} onEditCategory={editCategory} onDeleteCategory={deleteCategory} />}
    {categoryDialog && <CategoryModal category={categoryDialog} onClose={() => setCategoryDialog(null)} onSaved={() => { setCategoryDialog(null); run(async () => {}) }} />}
    {deleteDialog && <ConfirmModal title={deleteDialog.transaction ? 'Excluir saída?' : 'Excluir grupo?'} message={deleteDialog.transaction ? `A saída “${deleteDialog.description}” de ${money(deleteDialog.amount)} será removida do saldo real.` : `Os itens do grupo “${deleteDialog.name}” não serão excluídos. Eles passarão para “Sem grupo”.`} confirmLabel={deleteDialog.transaction ? 'Excluir' : 'Excluir grupo'} onClose={() => setDeleteDialog(null)} onConfirm={() => run(async () => { if (deleteDialog.transaction) await api.deleteExpense(deleteDialog.id); else { await api.deleteCategory(deleteDialog.id); if (filters.category === deleteDialog.id) setFilters(current => ({ ...current, category: '' })) } setDeleteDialog(null) })} />}
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

function CommitmentObjective({ summary, commitments, projection, selectedObjective, onChange }) {
  const editorRef = useRef(null)
  const feedbackTimerRef = useRef(null)
  const [suggestionStart, setSuggestionStart] = useState(() => {
    const previous = Number(window.localStorage.getItem('aloca-objective-suggestion-start'))
    return Number.isFinite(previous) ? previous : 0
  })
  const [objectiveEditing, setObjectiveEditing] = useState(false)
  const [objectiveEdited, setObjectiveEdited] = useState(Boolean(selectedObjective))
  const [savedFeedback, setSavedFeedback] = useState(false)
  const selectedText = selectedObjective?.startsWith('custom:')
    ? selectedObjective.slice(7)
    : COMMITMENT_OBJECTIVES.find(item => item.id === selectedObjective)?.label || ''
  const [draft, setDraft] = useState(selectedText)
  const suggestions = useMemo(() => COMMITMENT_OBJECTIVES, [])
  const visibleSuggestions = useMemo(() => Array.from({ length: 3 }, (_, index) => suggestions[(suggestionStart + index) % suggestions.length]), [suggestionStart, suggestions])

  useEffect(() => {
    if (selectedObjective == null) return
    const nextText = selectedObjective.startsWith('custom:') ? selectedObjective.slice(7) : COMMITMENT_OBJECTIVES.find(item => item.id === selectedObjective)?.label || ''
    if (nextText === draft) return
    setDraft(nextText)
    setObjectiveEdited(Boolean(nextText))
    setObjectiveEditing(false)
  }, [draft, selectedObjective])
  useEffect(() => {
    if (!editorRef.current) return
    editorRef.current.style.height = 'auto'
    editorRef.current.style.height = `${Math.max(editorRef.current.scrollHeight, 78)}px`
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
    setObjectiveEdited(true)
    focusEditor()
  }
  const saveDraft = value => {
    setDraft(value)
    setObjectiveEdited(true)
    onChange(value.trim() ? `custom:${value}` : '')
  }
  const chooseSuggestion = suggestion => {
    setDraft(suggestion.label)
    setObjectiveEditing(true)
    setObjectiveEdited(true)
    onChange(`custom:${suggestion.label}`)
    focusEditor()
  }
  const handleBlur = () => {
    if (draft.trim()) {
      setSavedFeedback(true)
      window.clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = window.setTimeout(() => setSavedFeedback(false), 1600)
    } else {
      setObjectiveEditing(false)
      setObjectiveEdited(false)
    }
  }
  const rotateSuggestions = event => {
    event.stopPropagation()
    setSuggestionStart(currentStart => (currentStart + 3) % suggestions.length)
  }
  const showSuggestions = !objectiveEditing && !objectiveEdited && !draft.trim()
  return <div className="command-objective" data-tour="dashboard-objective" aria-label="Objetivo do comprometimento">
    <div className="objective-heading"><div><span className="eyebrow">DIREÇÃO DO SALDO</span><h3>Objetivo do comprometimento</h3></div><span className="objective-icon" aria-hidden="true">✦</span></div>
    <div className={`objective-composer${objectiveEditing ? ' is-editing' : ''}`} onClick={beginEditing}>
      <textarea ref={editorRef} className="objective-editor" aria-label="Objetivo do comprometimento" value={draft} placeholder="Descreva como deseja direcionar o saldo comprometido..." rows="2" onFocus={() => { setObjectiveEditing(true); setObjectiveEdited(true) }} onClick={event => event.stopPropagation()} onChange={event => saveDraft(event.target.value)} onBlur={handleBlur} />
      <div className={`objective-suggestions${showSuggestions ? '' : ' is-hidden'}`} aria-live="polite">
        <span className="objective-suggestions-label">Escolha uma sugestão ou clique para escrever</span>
        <div className="objective-suggestion-list">{visibleSuggestions.map((suggestion, index) => <button className={`objective-suggestion ${index === 0 ? 'is-primary' : ''}`} type="button" key={suggestion.id} onClick={event => { event.stopPropagation(); chooseSuggestion(suggestion) }}><span aria-hidden="true">{index === 0 ? '✦' : '•'}</span>{suggestion.label}</button>)}<button className="objective-suggestions-refresh" type="button" onClick={rotateSuggestions} aria-label="Mostrar outras sugestões" title="Mostrar outras sugestões"><span aria-hidden="true">↻</span></button></div>
      </div>
    </div>
    <small className={`objective-saved-feedback${savedFeedback ? ' is-visible' : ''}`} role="status" aria-live="polite">Objetivo salvo</small>
  </div>
}

function BalanceCommandCenter({ summary, commitments, projection, selectedObjective, onObjectiveChange, onBalance, onDistribute }) {
  const real = Number(summary?.saldoReal) || 0
  const committed = Number(summary?.totalReservado) || 0
  const unallocated = Number(summary?.saldoNaoAlocado) || 0
  const free = Number(summary?.saldoLivre ?? summary?.freeBalance) || 0
  const deficit = Number(summary?.deficitCobertura) || 0
  return <section className="command-center" data-tour="dashboard-command" aria-label="Situação financeira atual">
    <div className="command-balance" data-tour="dashboard-balance">
      <div className="command-balance-head"><div><span className="eyebrow">SALDO ATUAL</span><h2>{money(real)}</h2><span className="command-status">Disponível hoje</span></div><button className="secondary command-balance-action" data-tour="initial-balance" onClick={onBalance}>{summary?.initialBalance > 0 ? 'Editar saldo inicial' : 'Informar saldo inicial'}</button></div>
    </div>
    <div className="command-allocation"><Metric label="SALDO COMPROMETIDO" value={money(committed)} /><button className="metric-action command-secondary-action" data-tour="allocation-action" onClick={onDistribute} disabled={unallocated <= 0}>{unallocated > 0 ? 'Alocar saldo não distribuído' : 'Saldo totalmente distribuído'}</button></div>
    <CommitmentObjective summary={summary} commitments={commitments} projection={projection} selectedObjective={selectedObjective} onChange={onObjectiveChange} />
    <div className={`command-free ${free > 0 ? 'is-positive' : ''}`}><span className="eyebrow">SALDO DISPONÍVEL</span><strong>{money(free)}</strong>{deficit > 0 && <small className="command-deficit-inline">Déficit de {money(deficit)}</small>}</div>
    <details className="calculation-details"><summary>Ver cálculo</summary><div className="calculation-content"><p>Saldo livre = saldo atual − valor comprometido.</p><div className="calculation-breakdown"><div><span>Saldo atual</span><strong>{money(real)}</strong></div><div><span>Comprometido / reservado</span><strong>{money(committed)}</strong></div><div><span>Não alocado</span><strong>{money(unallocated)}</strong></div><div><span>Saldo livre</span><strong>{money(free)}</strong></div>{deficit > 0 && <div><span>Déficit de cobertura</span><strong className="danger-text">{money(deficit)}</strong></div>}</div><p className="calculation-note">Reservas continuam no saldo atual, mas já têm destino definido. O déficit compara o necessário para cobrir compromissos com o que já está reservado.</p></div></details>
  </section>
}

function Metric({ label, value, tone = '', action }) { return <article className={`metric ${tone}`}><div className="metric-label"><span>{label}</span></div><strong>{value}</strong>{action}</article> }

function MonthlyFinancialSummary({ projection, commitments, selectedMonth, onMonthChange, onView }) {
  const selectedProjection = useMemo(() => {
    const selectedKey = String(selectedMonth).slice(0, 7)
    const months = projection?.months || []
    return months.find(item => String(item.month).slice(0, 7) === selectedKey) || months[0]
  }, [projection?.months, selectedMonth])
  if (!selectedProjection) return null
  const month = selectedProjection
  const expenses = [...(month.expenses || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const recordedExpenses = expenses.filter(item => item.installment == null)
  const commitmentExpenses = expenses.filter(item => item.installment != null)
  const largestExpense = expenses.reduce((largest, item) => Number(item.amount) > Number(largest?.amount || 0) ? item : largest, null)
  const coveredCommitments = commitmentExpenses.length
  const commitmentTotal = Number(month.commitmentExpense ?? commitmentExpenses.reduce((sum, item) => sum + Number(item.amount), 0))
  const commitmentReserved = Number(month.commitmentReserved ?? commitmentExpenses.reduce((sum, item) => sum + Number(item.reservedAmount || 0), 0))
  const coverageDeficit = Number(month.commitmentPending ?? commitmentExpenses.reduce((sum, item) => sum + Math.max(Number(item.amount) - Number(item.reservedAmount || 0), 0), 0))
  const coveragePercentage = commitmentTotal > 0 ? Math.min(100, commitmentReserved / commitmentTotal * 100) : 100
  const hasContextualAlert = coverageDeficit > 0
  const urgentCommitments = (projection?.urgentCommitments || []).filter(item => item.requiresAttention)
  const hasUrgentAlert = urgentCommitments.length > 0
  const commitmentStatus = item => item.coverageStatus === 'covered' ? 'Coberta' : item.coverageStatus === 'partial' ? 'Parcialmente coberta' : 'Sem reserva'
  const uncoveredCommitments = commitmentExpenses.filter(item => Number(item.remainingAmount ?? Math.max(Number(item.amount) - Number(item.reservedAmount || 0), 0)) > 0)
  const insight = uncoveredCommitments.length > 1
    ? `Faltam ${money(coverageDeficit)} para cobrir ${uncoveredCommitments.length} compromissos de ${formatMonthYear(selectedMonth)}.`
    : `Faltam ${money(coverageDeficit)} para cobrir os compromissos de ${formatMonthYear(selectedMonth)}.`
  const monthPicker = <label className="month-picker">Mês selecionado<input type="month" value={selectedMonth} onChange={event => onMonthChange(event.target.value)} /></label>
  return <section className="month-decision"><div className="month-decision-heading"><div><span className="eyebrow">CONTEXTO TEMPORAL</span><h2>Resumo financeiro do mês</h2><p>{formatMonthYear(selectedMonth)}</p></div><div className="month-heading-actions">{monthPicker}<button className="secondary" onClick={onView}>Ver compromissos</button></div></div><div className="monthly-financial-metrics"><div className="monthly-metric income-metric"><span>Entradas do mês</span><strong className="positive">{money(month.totalIncome)}</strong><small>Recebimentos previstos</small></div><div className="monthly-metric expense-metric"><span>Saídas realizadas</span><strong className="negative">{money(recordedExpenses.reduce((sum, item) => sum + Number(item.amount), 0))}</strong><small>Lançamentos pagos</small></div><div className="monthly-metric result-metric"><span>Resultado do mês</span><strong className={month.result < 0 ? 'negative' : 'positive'}>{signedMoney(month.result)}</strong><small>Entradas menos saídas</small></div><div className="monthly-metric monthly-coverage-metric"><span>Comprometido / alocado</span><strong className="positive">{money(commitmentReserved)} de {money(commitmentTotal)}</strong><small>{coveragePercentage.toFixed(1).replace('.', ',')}% coberto</small></div><div className="monthly-metric balance-metric"><span>Saldo estimado final</span><strong className={month.projectedBalance < 0 ? 'negative' : 'positive'}>{money(month.projectedBalance)}</strong><small>Projeção para o fim do mês</small></div></div>{(hasContextualAlert || hasUrgentAlert) ? <div className={`monthly-insight has-alert ${hasUrgentAlert ? 'has-urgent-alert' : ''}`}><div className="monthly-insight-header"><div className="monthly-insight-copy"><strong><span className="attention-icon" aria-hidden="true">!</span>Atenção</strong>{hasContextualAlert && <span>{insight}</span>}{hasUrgentAlert && <span>Há {urgentCommitments.length} compromisso{urgentCommitments.length === 1 ? '' : 's'} urgente{urgentCommitments.length === 1 ? '' : 's'} ainda não totalmente coberto{urgentCommitments.length === 1 ? '' : 's'}.</span>}</div><button className="secondary" onClick={onView}>Ver compromissos</button></div>{hasContextualAlert && <details className="guidance-details"><summary><span>Detalhes dos compromissos</span><small>Veja o que ainda precisa de cobertura</small></summary><div className="coverage-detail-list">{commitmentExpenses.map(item => <div className={`coverage-detail ${item.coverageStatus || ''}`} key={item.id}><span className="coverage-detail-name"><strong>{item.description}</strong><small>{item.installment != null && item.totalInstallments != null ? `Parcela ${item.installment}/${item.totalInstallments}` : 'Parcela prevista'}</small></span><span className="coverage-detail-value"><b>{money(item.amount)}</b><small>Reservado {money(item.reservedAmount || 0)} · Restante {money(item.remainingAmount ?? Math.max(Number(item.amount) - Number(item.reservedAmount || 0), 0))}</small></span><span className="coverage-detail-status"><b>{Number(item.coveragePercentage ?? 0).toFixed(1).replace('.', ',')}%</b><small>{commitmentStatus(item)}</small></span></div>)}</div></details>}{hasUrgentAlert && <div className="monthly-urgent-alerts">{urgentCommitments.map(item => <div className="urgent-commitment-alert" key={item.id}><span className="urgent-badge">⚠ Urgente</span><strong>{item.name}</strong><span>{money(item.totalAmount)} total · {money(item.allocatedAmount)} reservado</span><b>Faltam {money(item.remainingAmount)} · {Number(item.overallCoverage ?? 0).toFixed(0)}% coberto</b></div>)}</div>}</div> : commitmentExpenses.length > 0 && <p className="monthly-insight"><strong><span className="attention-icon success-icon" aria-hidden="true">✓</span>Cobertura completa</strong><span>Todos os compromissos de {formatMonthYear(selectedMonth)} estão cobertos.</span></p>}<div className="month-details"><details><summary>Principais impactos <span>{expenses.length ? `${expenses.length} lançamentos` : 'Nenhum lançamento'}</span></summary><div className="month-detail-content">{expenses.length ? <><div className="decision-row"><span><strong>{expenses.length} impactos no período</strong><small>{coveredCommitments ? `${coveredCommitments} compromisso${coveredCommitments === 1 ? '' : 's'} parcelado${coveredCommitments === 1 ? '' : 's'}` : 'Inclui saídas registradas'}</small></span><b className="negative">{money(month.totalExpense)}</b></div>{largestExpense && <div className="decision-row"><span><strong>Maior impacto: {money(largestExpense.amount)}</strong><small>{largestExpense.description} · {formatDate(largestExpense.date)}</small></span></div>}</> : <span className="decision-empty">Nenhum impacto financeiro no período.</span>}</div></details><details><summary>Vencimentos do período <span>{expenses.length}</span></summary><div className="month-detail-content">{expenses.length ? expenses.map(item => <div className="decision-row" key={item.id}><span><strong>{item.description}</strong><small>{formatDate(item.date)}{item.installment != null && item.totalInstallments != null ? ` · parcela ${item.installment}/${item.totalInstallments}` : ' · saída realizada'}</small></span><b className="negative">{signedMoney(-Number(item.amount), '-')}</b></div>) : <span className="decision-empty">Nenhum vencimento ou saída no período.</span>}</div></details></div></section>
}

function FinancialProjectionChart({ data, period, onPeriodChange, onMonthChange, selectedMonth }) {
  const [selected, setSelected] = useState(null)
  if (!data) return null
  const months = (data.months || []).slice(0, period)
  if (!months.length) return <section className="projection-section"><div className="projection-empty">Ainda não há meses para projetar.</div></section>
  const width = Math.max(680, months.length * 82), height = 300, left = 66, right = 18, top = 18, bottom = 42
  const values = months.flatMap(x => [Number(x.projectedBalance), Number(x.totalIncome), -Number(x.totalExpense), 0])
  const rawMin = Math.min(...values), rawMax = Math.max(...values), range = rawMax - rawMin || 1
  const stepMagnitude = 10 ** Math.floor(Math.log10(range / 6)), normalizedStep = (range / 6) / stepMagnitude
  const step = stepMagnitude * (normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 2.5 ? 2.5 : normalizedStep <= 5 ? 5 : 10)
  const min = Math.floor(rawMin / step) * step, max = Math.ceil(rawMax / step) * step, tickCount = Math.max(1, Math.round((max - min) / step))
  const x = i => left + (width - left - right) * (months.length <= 1 ? 0.5 : i / (months.length - 1)), y = v => top + (max - v) / (max - min || 1) * (height - top - bottom)
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => max - i * step), zero = y(0)
  const points = months.map((m, i) => `${x(i)},${y(m.projectedBalance)}`).join(' ')
  const moneyShort = v => formatCurrency(v).replace(/,00$/, ''), label = v => { const date = new Date(`${v}T12:00:00`); const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''); return date.getFullYear() !== new Date().getFullYear() ? `${month} ${String(date.getFullYear()).slice(-2)}` : month }
  const balanceDelta = Number(data.finalProjectedBalance) - Number(data.currentBalance), incomeOccurrences = months.reduce((sum, month) => sum + (month.incomes?.length || 0), 0)
  const activeMonth = selected == null ? null : months[selected]
  return <section className="projection-section"><div className="projection-heading"><div><span className="eyebrow">PROJEÇÃO FINANCEIRA</span><h2>Projeção de saldo</h2><p>Entradas, saídas e saldo esperado mês a mês.</p></div><div className="projection-controls"><details className="projection-calculation"><summary aria-label="Como calculamos a projeção">ⓘ Como calculamos</summary><div><p><strong>Saldo projetado = saldo atual + entradas previstas − saídas previstas.</strong></p><p>Consideramos movimentações confirmadas e previstas, entradas recorrentes, saídas, parcelas e compromissos futuros. Reservas não reduzem o saldo até o pagamento acontecer.</p></div></details><label>Período<select aria-label="Período da projeção" value={period} onChange={e => { setSelected(null); onPeriodChange(Number(e.target.value)) }}><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option><option value="24">24 meses</option></select></label></div></div><div className="projection-stats"><span>Saídas previstas<strong className="negative">{signedMoney(data.totalProjectedExpense, '-')}</strong></span><span title="Cada ocorrência de entrada prevista no período selecionado">Entradas previstas<strong className="positive">{signedMoney(data.totalProjectedIncome)}</strong><small>{incomeOccurrences} {incomeOccurrences === 1 ? 'lançamento previsto no período' : 'lançamentos previstos no período'}</small></span><span>Saldo projetado<strong className={data.finalProjectedBalance < 0 ? 'negative' : ''}>{money(data.finalProjectedBalance)}</strong><small className={balanceDelta < 0 ? 'negative' : 'positive'}>{balanceDelta < 0 ? '↓' : '↑'} {money(Math.abs(balanceDelta))} no período</small></span></div><div className="projection-chart-wrap" onClick={() => setSelected(null)}><div className="projection-scroll"><svg className="projection-chart" role="img" aria-label={`Entradas, saídas e saldo projetado em ${months.length} meses`} viewBox={`0 0 ${width} ${height}`}>{ticks.map(tick => <g key={tick}><line className="projection-grid" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} /><text className="projection-axis" x="4" y={y(tick) + 4}>{moneyShort(tick)}</text></g>)}<line className="projection-zero" x1={left} x2={width - right} y1={zero} y2={zero} /><polyline className="projection-line" points={points} />{months.map((m, i) => { const isSelected = selected === i; const isDashboardMonth = String(m.month).slice(0, 7) === String(selectedMonth).slice(0, 7); return <g className={`projection-month ${isSelected ? 'is-selected' : ''} ${isDashboardMonth ? 'is-dashboard-month' : ''}`} key={m.month} tabIndex="0" role="button" aria-pressed={isSelected} aria-label={`Abrir detalhes de ${label(m.month)}`} onMouseEnter={() => setSelected(i)} onFocus={() => setSelected(i)} onClick={e => { e.stopPropagation(); setSelected(isSelected ? null : i); onMonthChange?.(String(m.month).slice(0, 7)) }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(isSelected ? null : i); onMonthChange?.(String(m.month).slice(0, 7)) } }}><rect className="projection-income-bar" x={x(i) - 18} y={y(Number(m.totalIncome))} width="15" height={Math.max(0, zero - y(Number(m.totalIncome)))} /><rect className="projection-expense-bar" x={x(i) + 3} y={zero} width="15" height={Math.max(0, y(-Number(m.totalExpense)) - zero)} /><circle className="projection-hit" cx={x(i)} cy={y(m.projectedBalance)} r="15" /><circle className="projection-point" cx={x(i)} cy={y(m.projectedBalance)} r={isSelected ? 5 : 3} /><text className="projection-label" x={x(i)} y={height - 10} textAnchor="middle">{label(m.month)}</text></g> })}</svg></div></div>{selected == null && <span className="projection-interaction-hint">Passe o cursor ou clique em um mês para explorar sua composição</span>}{selected != null && <ProjectionTooltip item={activeMonth} onClose={() => setSelected(null)} onUseMonth={() => onMonthChange?.(String(activeMonth.month).slice(0, 7))} />}<div className="projection-legend"><span><i className="legend-income" />Entradas</span><span><i className="legend-expense" />Saídas</span><span><i className="legend-balance" />Saldo projetado</span><span className="legend-selected"><i />Mês selecionado</span></div></section>
}

function ProjectionTooltip({ item, onClose, onUseMonth }) { const title = new Date(`${item.month}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase(); const result = Number(item.totalIncome) - Number(item.totalExpense); const rows = (items, negative) => items?.length ? items.map(x => <div className="tooltip-row" key={x.id}><span>{x.description}<small>{x.date ? formatDate(x.date) : ''}{x.installment ? ` · Parcela prevista ${x.installment}/${x.totalInstallments}` : x.recurring ? ' · Recorrente' : x.category ? ` · ${x.category}` : ' · Saída realizada'}{x.source ? ` · ${x.source === 'commitment' ? 'compromisso' : x.source === 'transaction' ? 'movimentação' : 'recorrente'}` : ''}</small></span><b className={negative ? 'negative' : 'positive'}>{signedMoney(negative ? -Number(x.amount) : Number(x.amount))}</b></div>) : <small>Nenhuma movimentação prevista.</small>; return <div className="projection-tooltip" role="dialog" aria-label={`Detalhes de ${title}`}><button type="button" className="projection-close" aria-label="Fechar detalhes" onClick={onClose}>×</button><strong>{title}</strong><div className="tooltip-summary"><span>Saldo inicial <b>{money(item.openingBalance)}</b></span><span>Entradas <b className="positive">{signedMoney(item.totalIncome)}</b></span><span>Saídas e parcelas <b className="negative">{signedMoney(-Number(item.totalExpense))}</b></span><span>Resultado do mês <b className={result < 0 ? 'negative' : 'positive'}>{signedMoney(result)}</b></span><span>Saldo projetado <b className={item.projectedBalance < 0 ? 'negative' : ''}>{money(item.projectedBalance)}</b></span></div><div className="tooltip-group"><em>ENTRADAS</em>{rows(item.incomes, false)}</div><div className="tooltip-group"><em>SAÍDAS REALIZADAS E PARCELAS PREVISTAS</em>{rows(item.expenses, true)}</div><button type="button" className="tooltip-use-month" onClick={onUseMonth}>Usar {title.toLowerCase()} no Dashboard</button></div> }

function InitialBalanceModal({ value, onClose, onSaved }) {
  const [amount, setAmount] = useState(String(value ?? 0)); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const save = async e => { e.preventDefault(); const numeric = Number(amount); if (!Number.isFinite(numeric) || numeric < 0) { setError('Informe um valor válido maior ou igual a zero.'); return } setSaving(true); setError(''); try { await api.updateSettings(numeric); onSaved() } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">CONFIGURAÇÃO FINANCEIRA</span><h2>{value > 0 ? 'Editar saldo inicial' : 'Informar saldo inicial'}</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div><p className="modal-copy">Informe quanto você já possui antes de registrar novas movimentações. Isso não cria uma transação.</p>{error && <div className="alert error">{error}</div>}<label>Saldo inicial<input autoFocus required type="number" min="0" step="0.01" placeholder="1500,00" value={amount} onChange={e => setAmount(e.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>Salvar saldo inicial</button></div></form></div>
}

function CategoryModal({ category, onClose, onSaved }) { const [name, setName] = useState(category?.name || ''); const [error, setError] = useState(''); const save = async e => { e.preventDefault(); if (!name.trim()) { setError('Informe o nome do grupo.'); return } try { await api.updateCategory(category.id, name.trim()); onSaved() } catch (e) { setError(errorText(e)) } }; return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">GRUPOS</span><h2>Editar grupo</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{error && <div className="alert error">{error}</div>}<label>Nome<input autoFocus value={name} onChange={e => setName(e.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary">Salvar</button></div></form></div> }
function ConfirmModal({ title, message, onClose, onConfirm, confirmLabel = 'Confirmar', busy = false, busyLabel = 'Processando…', error = '' }) { return <ModalLayer onClose={onClose}><h2>{title}</h2><p className="modal-copy">{message}</p>{error && <div className="alert error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button><button type="button" className="primary" onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</button></div></ModalLayer> }

function RecentIncomeSection({ incomes, expenses, onCreate, onCreateExpense, onEditExpense, onDeleteExpense, onViewAll }) {
  const items = [...incomes.map(x => ({ ...x, movementType: 'income' })), ...expenses.map(x => ({ ...x, movementType: 'expense' }))].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  return <section className="income-section recent-income"><div className="income-heading"><div><span className="eyebrow">MOVIMENTAÇÕES</span><h2>Movimentações recentes</h2><small>Entradas e saídas registradas</small></div><div className="income-actions"><button className="secondary" onClick={onViewAll}>Ver todas</button><button className="expense-action" onClick={onCreateExpense}>− Nova saída</button><button className="primary" onClick={onCreate}>+ Nova entrada</button></div></div>{items.length ? <div className="income-list">{items.map(item => <article className={`income-row ${item.movementType === 'expense' ? 'expense-row' : ''}`} key={item.id}><div className="income-icon">{item.movementType === 'expense' ? '↓' : '↑'}</div><div className="income-info"><strong>{item.description}</strong><span><em className="category-badge">{item.categoryName || 'Sem grupo'}</em> · {new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')}</span></div><strong className={`income-amount ${item.movementType === 'expense' ? 'negative' : 'positive'}`}>{item.movementType === 'expense' ? '- ' : '+ '}{money(item.amount)}</strong>{item.movementType === 'expense' && <div className="row-actions"><button className="icon-button" onClick={() => onEditExpense(item)}>✎</button><button className="icon-button danger-text" onClick={() => onDeleteExpense(item)}>⋯</button></div>}</article>)}</div> : <div className="empty income-empty compact-empty"><strong>Nenhuma movimentação ainda</strong><span>Registre uma entrada ou saída para atualizar seu saldo.</span><button className="expense-action" onClick={onCreateExpense}>− Nova saída</button></div>}</section>
}

function IncomeManagement({ incomes, expenses, recurringIncomes, categories, onCreate, onCreateRecurring, onDelete, onEditExpense, onDeleteExpense, onRefresh, onRecurringDeleted, onCreateExpense }) {
  const [typeFilter, setTypeFilter] = useState('all')
  const changeType = type => setTypeFilter(type)
  const actions = typeFilter === 'recurring'
    ? <button type="button" className="primary" onClick={onCreateRecurring}>+ Nova recorrente</button>
    : typeFilter === 'expense'
      ? <button type="button" className="expense-action" onClick={onCreateExpense}>− Nova saída</button>
      : <details className="movement-create-menu"><summary className="primary">+ Novo</summary><div className="movement-create-popover" role="menu"><button type="button" role="menuitem" onClick={onCreate}>Nova entrada</button><button type="button" role="menuitem" onClick={onCreateExpense}>Nova saída</button><button type="button" role="menuitem" onClick={onCreateRecurring}>Nova recorrente</button></div></details>
  return <section className="income-management"><div className="page-heading"><div><span className="eyebrow">MOVIMENTAÇÕES</span><h2>Movimentações</h2><p>Entradas e saídas já realizadas, além de recorrências cadastradas.</p></div><div className="income-actions movement-actions">{actions}</div></div><div className="income-tabs management-tabs" role="tablist"><button type="button" className={typeFilter === 'all' ? 'active' : ''} onClick={() => changeType('all')}>Todas <span>{incomes.length + expenses.length}</span></button><button type="button" className={typeFilter === 'income' ? 'active' : ''} onClick={() => changeType('income')}>Entradas <span>{incomes.length}</span></button><button type="button" className={typeFilter === 'expense' ? 'active' : ''} onClick={() => changeType('expense')}>Saídas <span>{expenses.length}</span></button><button type="button" className={typeFilter === 'recurring' ? 'active' : ''} onClick={() => changeType('recurring')}>Recorrentes <span>{recurringIncomes.length}</span></button></div>{typeFilter === 'recurring' ? <RecurringIncomeList items={recurringIncomes} categories={categories} onRefresh={onRefresh} onDeleted={onRecurringDeleted} /> : <AllMovementsSection incomes={incomes} expenses={expenses} categories={categories} typeFilter={typeFilter} onTypeFilterChange={changeType} onDeleteIncome={onDelete} onEditExpense={onEditExpense} onDeleteExpense={onDeleteExpense} />}</section>
}

function MovementFilters({ label, search, setSearch, category, setCategory, period, setPeriod, sort, setSort, type = 'all', setType = () => {}, categories }) {
  const activeCount = (search ? 1 : 0) + (category ? 1 : 0) + (period ? 1 : 0) + (sort !== 'date-desc' ? 1 : 0) + (type !== 'all' ? 1 : 0)
  return <details className="income-filters-disclosure"><summary>Filtrar e ordenar{activeCount ? ` (${activeCount})` : ''}</summary><div className="income-filters"><select aria-label="Filtrar por tipo" value={type} onChange={e => setType(e.target.value)}><option value="all">Todos os tipos</option><option value="income">Entradas</option><option value="expense">Saídas</option><option value="recurring">Recorrentes</option></select><input aria-label={`Pesquisar ${label}`} placeholder="Pesquisar por descrição..." value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Filtrar por grupo" value={category} onChange={e => setCategory(e.target.value)}><option value="">Todos os grupos</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select><input aria-label="Filtrar por período" type="month" value={period} onChange={e => setPeriod(e.target.value)} /><select aria-label={`Ordenar ${label}`} value={sort} onChange={e => setSort(e.target.value)}><option value="date-desc">Mais recentes</option><option value="date-asc">Mais antigas</option><option value="amount-desc">Maior valor</option><option value="amount-asc">Menor valor</option></select></div></details>
}

function RegularIncomeSection({ incomes, categories, onDelete }) {
  const [search, setSearch] = useState(''); const [category, setCategory] = useState(''); const [period, setPeriod] = useState(''); const [sort, setSort] = useState('date-desc')
  const items = incomes.filter(item => (!search || item.description.toLowerCase().includes(search.toLowerCase())) && (!category || item.categoryId === category) && (!period || item.date.slice(0, 7) === period)).sort((a, b) => sort === 'amount-desc' ? b.amount - a.amount : sort === 'amount-asc' ? a.amount - b.amount : sort === 'date-asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))
  return <section className="income-section"><div className="income-heading"><div><span className="eyebrow">MOVIMENTAÇÕES</span><h2>Entradas</h2><small>{items.length} entrada(s) encontrada(s)</small></div></div><MovementFilters label="entradas" search={search} setSearch={setSearch} category={category} setCategory={setCategory} period={period} setPeriod={setPeriod} sort={sort} setSort={setSort} categories={categories} />{items.length ? <div className="income-list">{items.map(item => <article className="income-row" key={item.id}><div className="income-icon">↗</div><div className="income-info"><strong>{item.description}</strong><span>{item.categoryName} · {new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')}</span></div><strong className="income-amount">+ {money(item.amount)}</strong><button className="icon-button danger-text" onClick={() => onDelete(item)} aria-label={`Excluir entrada ${item.description}`}>×</button></article>)}</div> : <div className="empty income-empty"><strong>{incomes.length ? 'Nenhuma entrada encontrada' : 'Nenhuma entrada ainda'}</strong><span>{incomes.length ? 'Ajuste os filtros para encontrar uma entrada.' : 'Registre sua primeira entrada para atualizar seu saldo.'}</span></div>}</section>
}

function AllMovementsSection({ incomes, expenses, categories, typeFilter, onTypeFilterChange, onDeleteIncome, onEditExpense, onDeleteExpense }) {
  const [search, setSearch] = useState(''); const [category, setCategory] = useState(''); const [period, setPeriod] = useState(''); const [sort, setSort] = useState('date-desc')
  const allItems = [...incomes.map(item => ({ ...item, movementType: 'income' })), ...expenses.map(item => ({ ...item, movementType: 'expense' }))]
  const items = allItems.filter(item => (!typeFilter || typeFilter === 'all' || item.movementType === typeFilter) && (!search || item.description.toLowerCase().includes(search.toLowerCase())) && (!category || item.categoryId === category) && (!period || item.date.slice(0, 7) === period)).sort((a, b) => sort === 'amount-desc' ? b.amount - a.amount : sort === 'amount-asc' ? a.amount - b.amount : sort === 'date-asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))
  const label = typeFilter === 'income' ? 'entradas' : typeFilter === 'expense' ? 'saídas' : 'movimentações'
  const title = typeFilter === 'income' ? 'Entradas' : typeFilter === 'expense' ? 'Saídas' : 'Todas'
  return <section className="income-section all-movements-section"><div className="income-heading"><div><span className="eyebrow">MOVIMENTAÇÕES</span><h2>{title}</h2><small>{items.length} {items.length === 1 ? 'item encontrado' : 'itens encontrados'}</small></div></div><MovementFilters label={label} search={search} setSearch={setSearch} category={category} setCategory={setCategory} period={period} setPeriod={setPeriod} sort={sort} setSort={setSort} type={typeFilter || 'all'} setType={onTypeFilterChange} categories={categories} />{items.length ? <div className="income-list">{items.map(item => <article className={`income-row ${item.movementType === 'expense' ? 'expense-row' : ''}`} key={`${item.movementType}-${item.id}`}><div className="income-icon">{item.movementType === 'expense' ? '↓' : '↑'}</div><div className="income-info"><strong>{item.description}</strong><span><em className={`movement-type-label ${item.movementType}`}>{item.movementType === 'expense' ? 'Saída' : 'Entrada'}</em> · {item.categoryName || 'Sem grupo'} · {formatDate(item.date)}</span></div><strong className={`income-amount ${item.movementType === 'expense' ? 'negative' : 'positive'}`}>{item.movementType === 'expense' ? '- ' : '+ '}{money(item.amount)}</strong>{item.movementType === 'expense' ? <div className="row-actions"><button className="icon-button" onClick={() => onEditExpense(item)} aria-label={`Editar saída ${item.description}`}>✎</button><button className="icon-button danger-text" onClick={() => onDeleteExpense(item)} aria-label={`Excluir saída ${item.description}`}>×</button></div> : <button className="icon-button danger-text" onClick={() => onDeleteIncome(item)} aria-label={`Excluir entrada ${item.description}`}>×</button>}</article>)}</div> : <div className="empty income-empty"><strong>{allItems.length ? 'Nenhum resultado encontrado' : 'Nenhuma movimentação ainda'}</strong><span>{allItems.length ? 'Ajuste os filtros para encontrar uma movimentação.' : 'Registre uma entrada ou saída para atualizar seu saldo.'}</span></div>}</section>
}

function IncomeSection({ incomes, recurringIncomes, categories, onCreate, onDelete, onRefresh, onRecurringDeleted }) {
  const [tab, setTab] = useState('all')
  const [recurringDialog, setRecurringDialog] = useState(false)
  const visible = tab === 'recurring' ? [] : incomes
  return <section className="income-section"><div className="income-heading"><div><span className="eyebrow">MOVIMENTAÇÕES RECENTES</span><h2>Movimentações recentes</h2><small>{tab === 'recurring' ? `${recurringIncomes.length} recorrência(s)` : `${incomes.length} entrada(s) recentes`}</small></div><div className="income-actions"><button className="secondary" onClick={() => setRecurringDialog(true)}>Nova recorrente</button><button className="primary" onClick={onCreate}>Nova entrada</button></div></div><div className="income-tabs" role="tablist"><button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Todas</button><button className={tab === 'recurring' ? 'active' : ''} onClick={() => setTab('recurring')}>Recorrentes <span>{recurringIncomes.length}</span></button></div>{tab === 'all' && <RegularIncomeSection incomes={visible} categories={categories} onDelete={onDelete} />}{tab === 'recurring' && <RecurringIncomeList items={recurringIncomes} categories={categories} onRefresh={onRefresh} onDeleted={onRecurringDeleted} />}{recurringDialog && <RecurringIncomeModal categories={categories} onClose={() => setRecurringDialog(false)} onSaved={() => { setRecurringDialog(false); onRefresh() }} />}</section>
}

const frequencyLabels = { Weekly: 'Semanal', Fortnightly: 'Quinzenal', Monthly: 'Mensal', Bimonthly: 'Bimestral', Quarterly: 'Trimestral', Semiannual: 'Semestral', Annual: 'Anual' }
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
  return <div className="recurring-panel"><div className="recurring-tools"><input aria-label="Pesquisar recorrências" placeholder="Pesquisar recorrência..." value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Filtrar recorrências" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todos os status</option><option value="active">Ativas</option><option value="paused">Pausadas</option></select></div>{filtered.length ? <div className="recurring-list">{filtered.map(item => <button type="button" className="recurring-row" key={item.id} onClick={() => setSelected(item)}><span className="recurring-main"><strong>{item.description}</strong><span>{money(item.amount)} · {frequencyLabels[item.frequency]}</span></span><span className="recurring-next"><small>Próxima ocorrência</small><strong>{item.nextOccurrence ? new Date(`${item.nextOccurrence}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem próximas'}</strong></span><span className="movement-type-label recurring">Recorrente</span><span className={`recurring-status ${item.isActive ? 'active' : 'paused'}`}>{item.isActive ? 'Ativa' : 'Pausada'}</span><span className="recurring-open" aria-hidden="true">›</span></button>)}</div> : <div className="empty"><strong>Nenhuma recorrência encontrada</strong><span>Cadastre salário, aluguel recebido ou outra entrada periódica.</span></div>}{selected && <RecurringIncomeDrawer item={selected} categories={categories} onClose={() => setSelected(null)} onToggle={async () => { await act(() => selected.isActive ? api.pauseRecurringIncome(selected.id) : api.activateRecurringIncome(selected.id)) }} onDelete={() => { setDeleteError(''); setPendingDelete(selected) }} onReceive={occurrence => setPendingReceive({ item: selected, occurrence })} onSaved={onRefresh} />}{pendingReceive && <ConfirmModal title="Confirmar recebimento antecipado?" message={`A ocorrência de ${new Date(`${pendingReceive.occurrence.scheduledDate}T12:00:00`).toLocaleDateString('pt-BR')} será registrada hoje no saldo real. Ela será removida da projeção, e as próximas recorrências continuarão previstas.`} confirmLabel="Receber hoje" busy={receiving} onClose={() => { if (!receiving) setPendingReceive(null) }} onConfirm={receive} />}{pendingDelete && <ConfirmModal title="Excluir recorrência?" message="Essa ação removerá esta recorrência e não poderá ser desfeita." confirmLabel="Excluir" busy={deletingId !== null} error={deleteError} onClose={() => { if (!deletingId) setPendingDelete(null) }} onConfirm={deleteRecurring} />}</div>
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
  return <AppDrawer className="recurring-detail-drawer" eyebrow={mode === 'edit' ? 'EDITAR ENTRADA RECORRENTE' : 'ENTRADA RECORRENTE'} title={mode === 'edit' ? 'Editar recorrência' : item.description} titleId="recurring-detail-title" badges={mode === 'view' && <span className={`recurring-status ${item.isActive ? 'active' : 'paused'}`}>{item.isActive ? 'Ativa' : 'Pausada'}</span>} footer={footer} onClose={onClose}>{mode === 'edit' ? <RecurringIncomeModal embedded formId={editFormId} item={item} categories={categories} onClose={() => setMode('view')} onSaved={async () => { await onSaved(); setMode('view') }} /> : content}</AppDrawer>
}

function RecurringIncomeModal({ categories, item, onClose, onSaved, embedded = false, formId }) {
  const [form, setForm] = useState(() => item ? { description: item.description, amount: String(item.amount).replace('.', ','), categoryId: item.categoryId, frequency: item.frequency, startDate: item.startDate, endDate: item.endDate || '' } : { description: '', amount: '', categoryId: categories[0]?.id || '', frequency: 'Monthly', startDate: new Date().toISOString().slice(0, 10), endDate: '' }); const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const update = (key, value) => setForm(x => ({ ...x, [key]: value }))
  const dayOfMonth = Number(form.startDate.slice(8, 10))
  const save = async e => { e.preventDefault(); if (!form.description.trim() || !form.amount || !form.categoryId || !form.startDate) return setError('Preencha descrição, valor, grupo e a primeira ocorrência.'); if (form.endDate && form.endDate < form.startDate) return setError('A data final deve ser igual ou posterior ao início.'); setSaving(true); setError(''); try { const body = { ...form, amount: parseAmount(form.amount), dayOfMonth: form.frequency === 'Monthly' ? dayOfMonth : null, endDate: form.endDate || null }; await (item ? api.updateRecurringIncome(item.id, body) : api.createRecurringIncome(body)); await onSaved() } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  const fields = <>{error && <div className="alert error">{error}</div>}<label>Descrição<input autoFocus required value={form.description} onChange={e => update('description', e.target.value)} /></label><div className="form-grid income-form-grid"><label>Valor<input required inputMode="decimal" placeholder="0,00" value={form.amount} onChange={e => update('amount', e.target.value)} /></label><label>Grupo<select required value={form.categoryId} onChange={e => update('categoryId', e.target.value)}>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div><div className="form-grid recurring-form-grid"><label>Primeira ocorrência<input required type="date" value={form.startDate} onChange={e => update('startDate', e.target.value)} /></label><label>Frequência<select value={form.frequency} onChange={e => update('frequency', e.target.value)}>{Object.entries(frequencyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{form.frequency === 'Monthly' && <span className="field-hint">Repete todo dia {dayOfMonth}; o dia 31 cai no último dia válido.</span>}</label><label>Data de término <span className="field-hint">(opcional)</span><input type="date" value={form.endDate} onChange={e => update('endDate', e.target.value)} /></label></div><p className="modal-copy">A primeira ocorrência define o dia das recorrências mensais. As previsões não alteram seu saldo real.</p></>
  if (embedded) return <form id={formId} className="app-drawer-form" onSubmit={save}>{fields}</form>
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">ENTRADA RECORRENTE</span><h2>{item ? 'Editar recorrência' : 'Nova recorrência'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{fields}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{item ? 'Salvar alterações' : 'Salvar recorrência'}</button></div></form></div>
}

function IncomeModal({ categories, onClose, onSaved }) {
  const [form, setForm] = useState({ description: '', amount: '', categoryId: categories[0]?.id || '', date: new Date().toISOString().slice(0, 10) }); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const save = async event => { event.preventDefault(); const amount = parseAmount(form.amount); if (!form.description.trim()) return setError('Informe a descrição da entrada.'); if (!Number.isFinite(amount) || amount <= 0) return setError('Informe um valor maior que zero.'); if (!form.categoryId) return setError('Selecione um grupo.'); setSaving(true); setError(''); try { await api.createIncome({ description: form.description.trim(), amount, date: form.date, categoryId: form.categoryId }); onSaved() } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">MOVIMENTAÇÃO</span><h2>Nova entrada</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{error && <div className="alert error">{error}</div>}<label>Descrição<input autoFocus required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><label>Valor<input required inputMode="decimal" placeholder="0,00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label><div className="form-grid income-form-grid"><label>Grupo<select required value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Data<input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label></div><p className="modal-copy">Entradas não podem ser editadas depois de criadas. Se necessário, exclua e cadastre novamente.</p><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>Salvar entrada</button></div></form></div>
}

function ExpenseModal({ item, categories, currentBalance, onClose, onSaved }) {
  const [form, setForm] = useState({ description: item?.description || '', amount: item?.amount ?? '', categoryId: item?.categoryId || '', date: item?.date?.slice(0, 10) || new Date().toISOString().slice(0, 10) }); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const save = async event => { event.preventDefault(); const amount = parseAmount(form.amount); if (!form.description.trim()) return setError('Informe a descrição da saída.'); if (!Number.isFinite(amount) || amount <= 0) return setError('Informe um valor maior que zero.'); if (!item && amount > Number(currentBalance) && !window.confirm(`Esta saída é maior que o saldo real disponível (${money(currentBalance)}). Deseja confirmar mesmo assim?`)) return; setSaving(true); setError(''); try { const body = { description: form.description.trim(), amount, date: form.date, categoryId: form.categoryId || null, type: 'Expense' }; if (item) await api.updateTransaction(item.id, body); else await api.createExpense(body); onSaved() } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">MOVIMENTAÇÃO</span><h2>Nova saída</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{error && <div className="alert error">{error}</div>}<p className="modal-copy">Registre um gasto já realizado. Ele reduz o saldo real e não cria compromisso, reserva ou parcela.</p><label>Descrição<input autoFocus required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><label>Valor<input required inputMode="decimal" placeholder="0,00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label><div className="form-grid income-form-grid"><label>Grupo <span className="field-hint">(opcional)</span><select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}><option value="">Sem grupo</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Data<input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label></div><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>Registrar saída</button></div></form></div>
}

function CommitmentFilters({ search, setSearch, categories, selectedCategory, onCategory, onOpenFilters, onCreateCategory }) {
  const [createOpen, setCreateOpen] = useState(false)
  return <><div className="filters-toolbar"><input aria-label="Pesquisar compromissos" placeholder="Pesquisar por nome..." value={search} onChange={e => setSearch(e.target.value)} /><button className="secondary mobile-filter-button" onClick={onOpenFilters}>Filtros</button><button className="secondary" onClick={() => setCreateOpen(true)}>Novo grupo</button></div><div className="category-chips" aria-label="Filtrar por grupo"><button className={`category-chip ${!selectedCategory ? 'active' : ''}`} onClick={() => onCategory('')}>Todos os grupos</button><button className={`category-chip ${selectedCategory === 'none' ? 'active' : ''}`} onClick={() => onCategory('none')}>Sem grupo</button>{categories.map(category => <button className={`category-chip ${selectedCategory === category.id ? 'active' : ''}`} key={category.id} onClick={() => onCategory(category.id)}>{category.name}</button>)}</div>{createOpen && <CategoryCreateModal onClose={() => setCreateOpen(false)} onSaved={async name => { await onCreateCategory(name); setCreateOpen(false) }} />}</>
}

function CommitmentPreviewCard({ item }) {
  const coverage = item.remainingInstallments > 0 ? Math.min(100, item.allocatedAmount / item.installmentAmount * 100) : 100
  const priority = item.priorityLabel || ['Indefinida', 'Alta', 'Média', 'Baixa'][item.priority]
  const status = item.isCompleted ? 'Concluído' : item.isFullyCommitted ? 'Ativo' : 'Manual'
  const nextDueDate = item.nextDueDate || addMonths(item.dueDate, item.paidInstallments)
  return <article className="commitment-static-card commitment-static-preview-card" data-commitment-part="card"><header className="commitment-static-preview-header"><div className="commitment-static-preview-heading"><h3>{item.name}</h3><div className="commitment-static-badges">{item.categoryName && <span className="commitment-static-badge">{item.categoryName}</span>}{priority && <span className={`commitment-static-badge commitment-static-priority-${item.priority}`}>{priority}</span>}</div></div><span className={`commitment-static-status ${item.isCompleted ? 'is-complete' : ''}`}>{status}</span></header><section className="commitment-static-preview-stats" data-commitment-part="next"><div><span>Próxima parcela</span><strong>{money(item.installmentAmount)}</strong></div><div><span>Vencimento</span><strong>{formatDate(nextDueDate)}</strong></div><div><span>Cobertura</span><strong>{Math.round(coverage)}%</strong></div></section><div className="commitment-static-progress" role="progressbar" aria-label={`Cobertura da próxima parcela: ${Math.round(coverage)}%`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(coverage)}><span style={{ width: `${coverage}%` }} /></div></article>
}

function CommitmentsPage({ commitments, filtered, groups, categories, summary, filters, setFilters, searchInput, setSearchInput, filtersOpen, setFiltersOpen, activeFilterCount, setEditing, setCollapsed, collapsed, run, refresh }) {
 const filterLabels = { priority: { none: 'Prioridade: Sem prioridade', '1': 'Prioridade: Alta', '2': 'Prioridade: Média', '3': 'Prioridade: Baixa' }, status: { active: 'Status: Ativos', completed: 'Status: Concluídos' }, coverage: { none: 'Cobertura: Sem reserva', partial: 'Cobertura: Parcial', next: 'Cobertura: Próxima parcela', full: 'Cobertura: Total' }, payment: { none: 'Pagamento: Não iniciado', progress: 'Pagamento: Em andamento', done: 'Pagamento: Quitado' }, sort: { name: 'Ordenado: Nome', total: 'Ordenado: Valor total', remaining: 'Ordenado: Valor restante', next: 'Ordenado: Próxima parcela', progress: 'Ordenado: Progresso', category: 'Ordenado: Grupo' } }
 const activeChips = [{ key: 'search', label: searchInput ? `Busca: ${searchInput}` : '', clear: () => setSearchInput('') }, { key: 'category', label: filters.category ? `Grupo: ${filters.category === 'none' ? 'Sem grupo' : categories.find(x => x.id === filters.category)?.name || 'Selecionado'}` : '', clear: () => setFilters(x => ({ ...x, category: '' })) }, ...['priority', 'status', 'coverage', 'payment'].map(key => ({ key, label: filterLabels[key][filters[key]] || '', clear: () => setFilters(x => ({ ...x, [key]: '' })) })), { key: 'deficit', label: filters.deficit ? 'Com déficit' : '', clear: () => setFilters(x => ({ ...x, deficit: false })) }, { key: 'payable', label: filters.payable ? 'Aptos para pagar' : '', clear: () => setFilters(x => ({ ...x, payable: false })) }, { key: 'sort', label: filters.sort !== 'priority' ? filterLabels.sort[filters.sort] : '', clear: () => setFilters(x => ({ ...x, sort: 'priority' })) }].filter(item => item.label)
 return <section className="commitments-page"><div className="page-heading"><div><span className="eyebrow">COMPROMISSOS FINANCEIROS</span><h2>Compromissos</h2><p>Organize reservas e acompanhe cada parcela no seu ritmo.</p></div><div className="section-actions"><button className="secondary" onClick={() => setFiltersOpen(true)}>Filtros{activeFilterCount ? ` (${activeFilterCount})` : ''}</button><button className="primary" onClick={() => setEditing({})}>Novo compromisso</button></div></div><CommitmentFilters search={searchInput} setSearch={setSearchInput} categories={categories} selectedCategory={filters.category} onCategory={category => setFilters(x => ({ ...x, category }))} onOpenFilters={() => setFiltersOpen(true)} onCreateCategory={async name => { await api.createCategory(name); await refresh() }} />{activeChips.length > 0 && <div className="active-filter-chips" aria-label="Filtros ativos">{activeChips.map(item => <button className="active-filter-chip" key={item.key} onClick={item.clear}>{item.label}<span aria-hidden="true">×</span></button>)}</div>}<div className="commitments-result-count">{filtered.length} de {commitments.length} compromissos</div>{commitments.length === 0 ? <div className="empty"><strong>Nenhum compromisso ainda</strong><span>Crie um compromisso para começar a organizar seu saldo.</span></div> : filtered.length === 0 ? <div className="empty"><strong>Nenhum resultado encontrado</strong><span>Ajuste os filtros ou limpe a busca.</span></div> : <div className="commitment-groups">{Object.entries(groups).map(([key, items]) => { const category = categories.find(x => x.id === key); const pending = items.reduce((sum, x) => sum + x.remainingAmount, 0); return <section className="commitment-group" key={key}><button className="group-header" onClick={() => setCollapsed(x => ({ ...x, [key]: !x[key] }))}><span><strong>{category?.name || 'Sem grupo'}</strong><small>{items.length} compromisso(s) · {money(pending)} pendente</small></span><span>{collapsed[key] ? '＋' : '−'}</span></button>{!collapsed[key] && <div className="commitment-list">{items.map(item => <CommitmentCard key={item.id} item={item} availableBalance={summary?.saldoNaoAlocado ?? summary?.unallocatedBalance ?? 0} onChange={refresh} onEdit={() => setEditing(item)} onDelete={() => run(() => api.deleteCommitment(item.id))} />)}</div>}</section> })}</div>}</section>
}

function FilterDrawer({ filters, setFilters, categories, onClear, onClose, onEditCategory, onDeleteCategory }) {
  const update = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  return <div className="drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><aside className="filter-drawer" role="dialog" aria-modal="true" aria-labelledby="filters-title"><div className="drawer-head"><div><span className="eyebrow">PERSONALIZE A LISTA</span><h2 id="filters-title">Filtros</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar filtros">×</button></div><div className="drawer-content"><fieldset><legend>Classificação</legend><label>Grupo<select value={filters.category} onChange={e => update('category', e.target.value)}><option value="">Todos os grupos</option><option value="none">Sem grupo</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Prioridade<select value={filters.priority} onChange={e => update('priority', e.target.value)}><option value="">Todas as prioridades</option><option value="none">Sem prioridade</option><option value="1">Alta</option><option value="2">Média</option><option value="3">Baixa</option></select></label></fieldset><fieldset><legend>Situação</legend><label>Status<select value={filters.status} onChange={e => update('status', e.target.value)}><option value="">Todos os status</option><option value="active">Ativos</option><option value="completed">Concluídos</option></select></label><label>Cobertura<select value={filters.coverage} onChange={e => update('coverage', e.target.value)}><option value="">Todas as coberturas</option><option value="none">Sem reserva</option><option value="partial">Parcial</option><option value="next">Próxima parcela coberta</option><option value="full">Totalmente reservado</option></select></label><label>Pagamento<select value={filters.payment} onChange={e => update('payment', e.target.value)}><option value="">Todos os pagamentos</option><option value="none">Não iniciado</option><option value="progress">Em andamento</option><option value="done">Quitado</option></select></label></fieldset><fieldset><legend>Ordenação</legend><label>Ordenar por<select value={filters.sort} onChange={e => update('sort', e.target.value)}><option value="priority">Prioridade</option><option value="name">Nome</option><option value="total">Valor total</option><option value="remaining">Valor restante</option><option value="next">Próxima parcela</option><option value="progress">Progresso</option><option value="category">Grupo</option></select></label></fieldset><fieldset><legend>Filtros rápidos</legend><label className="filter-check"><input type="checkbox" checked={filters.deficit} onChange={e => update('deficit', e.target.checked)} /> Com déficit</label><label className="filter-check"><input type="checkbox" checked={filters.payable} onChange={e => update('payable', e.target.checked)} /> Aptos para pagar</label></fieldset><section className="category-tools" aria-label="Gerenciar grupos"><strong>Gerenciar grupos</strong>{categories.length ? categories.map(category => <span key={category.id}>{category.name}<button type="button" onClick={() => onEditCategory(category)} aria-label={`Editar ${category.name}`}>✎</button><button type="button" onClick={() => onDeleteCategory(category)} aria-label={`Excluir ${category.name}`}>×</button></span>) : <small>Nenhum grupo criado.</small>}</section></div><div className="drawer-actions"><button className="secondary" onClick={onClear}>Limpar filtros</button><button className="primary" onClick={onClose}>Aplicar filtros</button></div></aside></div>
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
  const [detailsOpen, setDetailsOpen] = useState(false); const [busy, setBusy] = useState(false); const [actionError, setActionError] = useState('')
  const overallCoverage = Number(item.overallCoveragePercentage ?? (item.totalAmount > 0 ? Math.min(100, ((item.paidInstallments * item.installmentAmount) + item.allocatedAmount) / item.totalAmount * 100) : 100))
  const overallRemaining = Number(item.overallRemainingAmount ?? item.remainingAmount ?? Math.max(0, Number(item.totalAmount) - Number(item.allocatedAmount)))
  const overallReserved = Math.max(0, Number(item.totalAmount) - overallRemaining)
  const installmentCoverage = item.remainingInstallments > 0 ? Math.min(100, item.allocatedAmount / item.installmentAmount * 100) : 100
  const priority = item.priorityLabel || (item.priority ? ['Indefinida', 'Alta', 'Média', 'Baixa'][item.priority] : null)
  const nextDueDate = item.nextDueDate || addMonths(item.dueDate, item.paidInstallments)
  const actionableUrgent = Boolean(item.urgent && overallCoverage < 100)
  const needsAllocation = !item.isCompleted && Number(item.missingForNextInstallment ?? Math.max(0, item.installmentAmount - item.allocatedAmount)) > 0
  const primaryLabel = item.isCompleted ? 'Concluída' : needsAllocation ? 'Completar parcela' : 'Marcar como paga'
  const runPrimaryAction = async event => { event.stopPropagation(); if (item.isCompleted || busy || (needsAllocation && availableBalance <= 0)) return; setBusy(true); setActionError(''); try { if (needsAllocation) await api.allocateNextInstallment(item.id); else await api.payInstallment(item.id); await onChange() } catch (error) { setActionError(errorText(error)) } finally { setBusy(false) } }
  return <article className={`commitment-static-card ${actionableUrgent ? 'is-urgent' : ''}`} data-tour="commitment-card" data-commitment-part="card"><header className="commitment-static-header" data-commitment-part="header"><button type="button" className="commitment-static-summary-trigger" title="Abrir detalhes do compromisso" onClick={() => setDetailsOpen(true)} aria-expanded={detailsOpen}><span className="commitment-static-title"><span className="commitment-static-avatar" aria-hidden="true">{item.name.slice(0, 1).toUpperCase()}</span><span className="commitment-static-heading"><span className="commitment-static-name-row"><h3 title={item.name}>{item.name}</h3>{item.categoryName && <span className="commitment-static-badge">{item.categoryName}</span>}{priority && <span className={`commitment-static-badge commitment-static-priority-${item.priority}`}>{priority}</span>}{item.urgent && <span className="commitment-static-urgent-badge">⚠ Urgente</span>}</span></span></span><span className="commitment-static-chevron" aria-hidden="true">›</span></button><span data-tour="commitment-card-menu"><CommitmentMenu item={item} onDetails={() => setDetailsOpen(true)} onEdit={onEdit} onDelete={onDelete} /></span></header><div className="commitment-static-body"><section className={`commitment-static-overall ${actionableUrgent ? 'is-urgent' : ''} ${overallCoverage >= 100 ? 'is-complete' : ''}`} data-commitment-part="overall" aria-label="Progresso geral do compromisso"><div className="commitment-static-section-heading"><h4>Progresso geral</h4><strong>{Math.round(overallCoverage)}%</strong></div><div className="commitment-static-reserved"><strong>{money(overallReserved)}</strong><span>reservados de</span><strong>{money(item.totalAmount)}</strong></div><div className="commitment-static-remaining"><span>Faltam</span><strong>{money(overallRemaining)}</strong></div><div className="commitment-static-progress" role="progressbar" aria-label={`Cobertura geral: ${Math.round(overallCoverage)}%`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(overallCoverage)}><span style={{ width: `${Math.min(100, Math.max(0, overallCoverage))}%` }} /></div></section><section className="commitment-static-next" data-commitment-part="next" aria-label="Próxima parcela"><div className="commitment-static-section-heading"><h4>Próxima parcela</h4></div><div className="commitment-static-next-grid"><div className="commitment-static-next-main"><strong>{money(item.installmentAmount)}</strong><span>Vence em {formatDate(nextDueDate)}</span></div><div className="commitment-static-next-status"><strong>{Number(installmentCoverage).toFixed(1).replace('.', ',')}% coberta</strong>{installmentCoverage < 100 && <span> · faltam {money(item.missingForNextInstallment ?? Math.max(0, item.installmentAmount - item.allocatedAmount))}</span>}</div><span className="commitment-static-action"><button type="button" data-tour="commitment-primary-action" data-tour-action={item.isCompleted ? 'completed' : needsAllocation ? 'complete' : 'pay'} className="commitment-static-action-button" disabled={item.isCompleted || busy || (needsAllocation && availableBalance <= 0)} onClick={runPrimaryAction}>{busy ? 'Processando…' : primaryLabel}</button>{needsAllocation && availableBalance <= 0 && <small>Abra os detalhes para ajustar a reserva.</small>}</span></div></section>{actionError && <div className="commitment-static-error" role="status">{actionError}</div>}</div>{detailsOpen && <CommitmentDetailsDrawer item={item} availableBalance={availableBalance} priority={priority} onClose={() => setDetailsOpen(false)} onEdit={onEdit} onDelete={onDelete} onChange={onChange} />}</article>
}

function CommitmentDetailsDrawer({ item, availableBalance, priority, onClose, onEdit, onDelete, onChange }) {
  const [amount, setAmount] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('')
  const coverage = item.remainingInstallments > 0 ? Math.min(100, item.allocatedAmount / item.installmentAmount * 100) : 100
  const overallCoverage = Number(item.overallCoveragePercentage ?? (item.totalAmount > 0 ? Math.min(100, ((item.paidInstallments * item.installmentAmount) + item.allocatedAmount) / item.totalAmount * 100) : 100))
  const urgentUncovered = item.requiresAttention ?? (item.urgent && Number(item.overallRemainingAmount ?? item.remainingAmount) > 0)
  const paymentProgress = overallCoverage
  const nextDueDate = item.nextDueDate || addMonths(item.dueDate, item.paidInstallments)
  const missingForNext = item.missingForNextInstallment ?? Math.max(0, item.installmentAmount - item.allocatedAmount)
  const status = item.isCompleted ? ['Concluído', 'complete'] : item.isFullyCommitted ? ['Distribuição ativa', 'active'] : ['Manual', 'manual']
  item = { ...item, remainingAmount: item.overallRemainingAmount ?? item.remainingAmount }
  const mutate = async action => { setBusy(true); setMessage(''); try { await action(); setAmount(''); await onChange() } catch (e) { setMessage(errorText(e)) } finally { setBusy(false) } }
  const history = Array.from({ length: item.totalInstallments }, (_, index) => ({ number: index + 1, paid: index < item.paidInstallments, current: index === item.paidInstallments }))
  const footer = <>{urgentUncovered && <div className="urgent-critical-message" role="alert">🔴 Compromisso urgente não totalmente coberto. Faltam <strong>{money(item.overallRemainingAmount ?? item.remainingAmount)}</strong> para cobrir o compromisso completo.</div>}<button className="secondary" onClick={onEdit}>Editar</button><button className="danger-button" onClick={onDelete}>Excluir</button></>
  return <AppDrawer className="commitment-detail-drawer" eyebrow="COMPROMISSO" title={item.name} titleId="commitment-drawer-title" badges={<>{priority && <span className={`priority-badge priority-${item.priority}`}>{priority}</span>}{item.urgent && <span className="urgent-badge">⚠ Urgente</span>}<span className={`status-badge ${status[1] === 'complete' ? 'complete' : ''}`}>{status[0]}</span>{item.categoryName && <span className="category-badge">{item.categoryName}</span>}</>} footer={footer} onClose={onClose}><div className="drawer-breakdown"><div><span>Valor total</span><strong>{money(item.totalAmount)}</strong></div><div><span>Valor reservado</span><strong>{money(item.allocatedAmount)}</strong></div><div><span>Saldo restante</span><strong>{money(item.remainingAmount)}</strong></div><div><span>Próxima parcela</span><strong>{money(item.installmentAmount)}</strong></div><div><span>Vencimento</span><strong>{formatDate(nextDueDate)}</strong></div><div><span>Parcelas</span><strong>{item.paidInstallments} / {item.totalInstallments}</strong></div></div><section className="drawer-progress"><span>Cobertura da próxima parcela <b>{Math.round(coverage)}%</b></span><div className="progress-track"><div style={{ width: `${coverage}%` }} /></div><small>{coverage >= 100 ? 'Próxima parcela totalmente coberta' : `Faltam ${money(missingForNext)} para cobrir a próxima parcela`}</small></section><section className="drawer-progress"><span>Progresso geral <b>{Math.round(paymentProgress)}%</b></span><div className="progress-track"><div style={{ width: `${paymentProgress}%` }} /></div></section><section className="drawer-history"><div className="drawer-section-heading"><h3>Histórico</h3><span>{item.paidInstallments} de {item.totalInstallments} pagas</span></div>{history.map(row => <div className={`drawer-history-row ${row.paid ? 'is-paid' : row.current ? 'is-current' : ''}`} key={row.number}><span>{row.paid ? '✓' : row.current ? '•' : '○'}</span><strong>Parcela {row.number}</strong><small>{row.paid ? 'Paga' : row.current ? 'Próxima parcela' : 'Pendente'}</small><b>{money(item.installmentAmount)}</b></div>)}</section><section className="drawer-control-section"><h3>Reserva</h3><div className="allocation-form"><input type="number" min="0.01" step="0.01" placeholder="Valor" aria-label="Valor para reservar ou retirar" value={amount} onChange={e => setAmount(e.target.value)} /><button disabled={busy || !amount || item.missingForFullCoverage <= 0} onClick={() => mutate(() => api.allocate(item.id, amount))}>Alocar</button><button className="secondary" disabled={busy || missingForNext <= 0 || availableBalance <= 0} onClick={() => mutate(() => api.allocateNextInstallment(item.id))}>Alocar próxima parcela</button><button className="secondary" disabled={busy || item.missingForFullCoverage <= 0 || availableBalance <= 0} onClick={() => mutate(() => api.allocate(item.id, Math.min(item.missingForFullCoverage, availableBalance)))}>Completar compromisso</button><button className="tertiary withdraw-button" disabled={busy || !amount || item.allocatedAmount <= 0} onClick={() => mutate(() => api.deallocate(item.id, amount))}>Retirar</button></div></section><section className="drawer-control-section"><h3>Pagamento</h3>{item.isCompleted ? <span className="payment-status">Compromisso concluído</span> : item.allocatedAmount >= item.installmentAmount ? <span className="payment-status payment-ready">✓ Reserva suficiente</span> : <span className="payment-status payment-hint">Faltam {money(missingForNext)}</span>}<button className="pay-button" disabled={busy || item.isCompleted || item.allocatedAmount < item.installmentAmount} onClick={() => mutate(() => api.payInstallment(item.id))}>Marcar parcela como paga</button>{item.paidInstallments > 0 && <button className="tertiary undo-payment" disabled={busy} onClick={() => mutate(async () => { await api.reversePayment(item.id); setMessage('Pagamento desfeito. Reserva e saldo restaurados.') })}>Desfazer último pagamento</button>}</section>{message && <div className={message.startsWith('Pagamento desfeito') ? 'alert success payment-toast' : 'inline-error'} role="status">{message}</div>}{item.objective && <p className="drawer-note"><strong>Objetivo</strong>{item.objective}</p>}</AppDrawer>
}

function CommitmentModal({ item, categories, onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ name: item.name || '', installmentAmount: item.installmentAmount || '', totalInstallments: item.totalInstallments || '', priority: item.priority ?? '', categoryId: item.categoryId || '', isFullyCommitted: item.isFullyCommitted ?? true, urgent: item.urgent ?? false, dueDate: item.dueDate || today, objective: item.objective || '' }); const [error, setError] = useState('')
  const previewAmount = parseAmount(form.installmentAmount); const previewInstallments = Number(form.totalInstallments); const previewLastDate = form.dueDate && Number.isInteger(previewInstallments) && previewInstallments > 0 ? addMonths(form.dueDate, previewInstallments - 1) : ''
  const save = async e => { e.preventDefault(); setError(''); const installmentAmount = parseAmount(form.installmentAmount); const totalInstallments = Number(form.totalInstallments); if (!form.name.trim()) return setError('Informe o nome do compromisso.'); if (!Number.isFinite(installmentAmount) || installmentAmount <= 0) return setError('Informe um valor de parcela válido, como 0,05.'); if (!Number.isInteger(totalInstallments) || totalInstallments <= 0) return setError('Informe o total de parcelas.'); if (!form.dueDate) return setError('Informe o primeiro vencimento.'); const payload = { name: form.name.trim(), installmentAmount, totalInstallments, priority: form.priority ? Number(form.priority) : null, isFullyCommitted: form.isFullyCommitted, urgent: form.urgent, categoryId: form.categoryId || null, dueDate: form.dueDate, objective: form.objective.trim() || null }; try { if (item.id) await api.updateCommitment(item.id, payload); else await api.createCommitment(payload); onSaved() } catch (e) { setError(errorText(e)) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">COMPROMISSO</span><h2>{item.id ? 'Editar compromisso' : 'Novo compromisso'}</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div>{error && <div className="alert error">{error}</div>}<label>Nome<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><div className="form-grid"><label>Valor da parcela<input required inputMode="decimal" placeholder="0,05" value={form.installmentAmount} onChange={e => setForm({ ...form, installmentAmount: e.target.value })} /></label><label>Total de parcelas<input required inputMode="numeric" value={form.totalInstallments} onChange={e => setForm({ ...form, totalInstallments: e.target.value.replace(/\D/g, '') })} /></label><label>Prioridade<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value || null })}><option value="">Sem prioridade</option><option value="1">Alta</option><option value="2">Média</option><option value="3">Baixa</option></select></label><label>Grupo<select value={form.categoryId || ''} onChange={e => setForm({ ...form, categoryId: e.target.value || null })}><option value="">Sem grupo</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div><label>Primeiro vencimento<input required type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /><span className="field-hint">A primeira parcela será cobrada nesta data.</span></label>{Number.isFinite(previewAmount) && previewAmount > 0 && Number.isInteger(previewInstallments) && previewInstallments > 0 && form.dueDate && <div className="preview-list"><strong>Parcelamento</strong><span>{previewInstallments}x de {money(previewAmount)}</span><small>Primeira: {formatDate(form.dueDate)} · Última: {formatDate(previewLastDate)}</small></div>}<label className="check"><input type="checkbox" checked={form.isFullyCommitted} onChange={e => setForm({ ...form, isFullyCommitted: e.target.checked })} /> Participa da distribuição automática</label><label className="check urgent-check"><input type="checkbox" checked={form.urgent} onChange={e => setForm({ ...form, urgent: e.target.checked })} /> ⚠ Marcar como urgente</label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary">Salvar compromisso</button></div></form></div>
}

function DistributionModal({ preview, onClose, onConfirm }) { return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><span className="eyebrow">SIMULAÇÃO</span><h2>Distribuir saldo?</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div><p className="modal-copy">O Aloca vai reservar <strong>{money(preview?.wouldAllocate)}</strong> seguindo a prioridade dos compromissos ativos.</p><div className="preview-list">{preview?.allocations?.length ? preview.allocations.map(x => <div key={x.financialCommitmentId}><span>{x.name}</span><strong>{money(x.amount)}</strong></div>) : <div className="empty small">Nenhuma nova alocação necessária.</div>}</div><div className="preview-total"><span>Saldo livre após</span><strong>{money(preview?.remainingFreeBalance)}</strong></div><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="button" className="primary" onClick={onConfirm} disabled={!preview?.wouldAllocate}>Confirmar distribuição</button></div></div></div> }

createRoot(document.getElementById('root')).render(<ThemeProvider><TutorialProvider><App /></TutorialProvider></ThemeProvider>)

