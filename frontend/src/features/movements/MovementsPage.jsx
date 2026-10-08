import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../services/api.js'
import MovementsHeader from './components/MovementsHeader.jsx'
import MovementsSummary from './components/MovementsSummary.jsx'
import MovementsTabs from './components/MovementsTabs.jsx'
import MovementsFilters from './components/MovementsFilters.jsx'
import MovementsContent from './components/MovementsContent.jsx'
import { businessDate } from '../../utils/businessDate.js'

const periodOptions = [
  { value: 'current', label: 'Este mês' },
  { value: 'previous', label: 'Mês anterior' },
  { value: 'last-three', label: 'Últimos 3 meses' },
  { value: 'all', label: 'Todo o período' },
]

const sortOptions = [
  { value: 'date-desc', label: 'Mais recentes' },
  { value: 'date-asc', label: 'Mais antigas' },
  { value: 'amount-desc', label: 'Maior valor' },
  { value: 'amount-asc', label: 'Menor valor' },
]

const dateFromPeriod = (period, today = new Date()) => {
  const year = today.getFullYear()
  const month = today.getMonth()
  if (period === 'current') return new Date(year, month, 1)
  if (period === 'previous') return new Date(year, month - 1, 1)
  if (period === 'last-three') return new Date(year, month - 2, 1)
  return null
}

const dateToPeriod = (period, today = new Date()) => {
  const year = today.getFullYear()
  const month = today.getMonth()
  if (period === 'current') return new Date(year, month + 1, 0)
  if (period === 'previous') return new Date(year, month, 0)
  if (period === 'last-three') return new Date(year, month + 1, 0)
  return null
}

const dateValue = value => {
  if (!value) return null
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}

export default function MovementsPage({ incomes = [], expenses = [], recurringIncomes = [], summary = null, categories = [], onEdit, onDelete, onManage }) {
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [period, setPeriod] = useState('current')
  const [sort, setSort] = useState('date-desc')
  const [loadedIncomes, setLoadedIncomes] = useState(incomes)
  const [loadedExpenses, setLoadedExpenses] = useState(expenses)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    const loadAll = async resource => {
      const items = []
      let currentPage = 1
      let totalPages = 1
      do {
        const response = await resource({ Page: currentPage, PageSize: 100 })
        items.push(...(response?.items || []))
        totalPages = Number(response?.totalPages || 0)
        currentPage += 1
      } while (currentPage <= totalPages)
      return items
    }
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [nextIncomes, nextExpenses] = await Promise.all([loadAll(api.incomes), loadAll(api.expenses)])
        if (!cancelled) { setLoadedIncomes(nextIncomes); setLoadedExpenses(nextExpenses) }
      } catch {
        if (!cancelled) setError('Não foi possível carregar as movimentações.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [retryToken])

  useEffect(() => { setLoadedIncomes(incomes); setLoadedExpenses(expenses) }, [incomes, expenses])

  const periodLabel = periodOptions.find(option => option.value === period)?.label || 'Este mês'
  const referenceDate = dateValue(businessDate(summary?.businessDate)) || new Date()
  const periodStart = dateFromPeriod(period, referenceDate)
  const periodEnd = dateToPeriod(period, referenceDate)

  const inPeriod = item => {
    const date = dateValue(item.date)
    return !periodStart || !date || (date >= periodStart && date <= periodEnd)
  }

  const filteredIncomes = useMemo(() => loadedIncomes.filter(inPeriod), [loadedIncomes, period])
  const filteredExpenses = useMemo(() => loadedExpenses.filter(inPeriod), [loadedExpenses, period])
  const visibleSummary = useMemo(() => ({
    income: filteredIncomes.filter(item => item.isRealized !== false && !item.isBalanceAdjustment).reduce((total, item) => total + Number(item.amount || 0), 0),
    expense: filteredExpenses.filter(item => item.isRealized !== false && !item.isBalanceAdjustment).reduce((total, item) => total + Number(item.amount || 0), 0),
    currentBalance: Number(summary?.currentBalance ?? 0),
  }), [filteredIncomes, filteredExpenses, summary])

  const movements = useMemo(() => [
    ...filteredIncomes.map(item => ({ ...item, movementType: 'income' })),
    ...filteredExpenses.map(item => ({ ...item, movementType: 'expense' })),
  ], [filteredIncomes, filteredExpenses])
  const recurringMovements = useMemo(() => recurringIncomes.map(item => ({
    id: item.id,
    description: item.description,
    amount: item.amount,
    type: 'Income',
    movementType: 'income',
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    date: item.nextOccurrence || item.startDate,
    isRecurring: true,
    isRecurringDefinition: true,
    recurringStatus: item.isActive ? 'active' : 'paused',
    nextOccurrence: item.nextOccurrence,
    startDate: item.startDate,
    endDate: item.endDate,
    automaticProcessing: item.automaticProcessing,
    dayOfMonth: item.dayOfMonth,
    occurrences: item.occurrences,
    frequency: item.frequency,
  })), [recurringIncomes])
  const visibleMovements = useMemo(() => movements
    .filter(item => activeTab !== 'recurring' && (activeTab === 'all' || (activeTab === 'income' && item.movementType === 'income') || (activeTab === 'expense' && item.movementType === 'expense')))
    .filter(item => {
      const query = search.trim().toLocaleLowerCase('pt-BR')
      return !query || `${item.description || ''} ${item.categoryName || ''}`.toLocaleLowerCase('pt-BR').includes(query)
    })
    .filter(item => !category || item.categoryId === category)
    .sort((left, right) => {
      if (sort === 'amount-desc') return Number(right.amount) - Number(left.amount)
      if (sort === 'amount-asc') return Number(left.amount) - Number(right.amount)
      const leftDate = String(left.date || '')
      const rightDate = String(right.date || '')
      return sort === 'date-asc' ? leftDate.localeCompare(rightDate) : rightDate.localeCompare(leftDate)
    }), [movements, activeTab, search, category, sort])
  const visibleRecurringMovements = useMemo(() => recurringMovements
    .filter(item => {
      const query = search.trim().toLocaleLowerCase('pt-BR')
      return !query || `${item.description || ''} ${item.categoryName || ''}`.toLocaleLowerCase('pt-BR').includes(query)
    })
    .filter(item => !category || item.categoryId === category)
    .sort((left, right) => {
      if (sort === 'amount-desc') return Number(right.amount) - Number(left.amount)
      if (sort === 'amount-asc') return Number(left.amount) - Number(right.amount)
      const leftDate = String(left.date || '')
      const rightDate = String(right.date || '')
      return sort === 'date-asc' ? leftDate.localeCompare(rightDate) : rightDate.localeCompare(leftDate)
    }), [recurringMovements, activeTab, search, category, sort])
  const displayedMovements = activeTab === 'recurring' ? visibleRecurringMovements : visibleMovements
  const pageSize = 15
  const totalPages = Math.max(1, Math.ceil(displayedMovements.length / pageSize))
  const pageItems = displayedMovements.slice((page - 1) * pageSize, page * pageSize)
  const resetPage = () => setPage(1)

  useEffect(() => { resetPage() }, [activeTab, search, category, period, sort])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  return <section className="movements-page" aria-labelledby="movements-page-title">
    <MovementsHeader />
    <MovementsSummary values={visibleSummary} periodLabel={periodLabel} />
    <MovementsTabs activeTab={activeTab} onChange={setActiveTab} />
    <MovementsFilters search={search} onSearchChange={setSearch} category={category} onCategoryChange={setCategory} period={period} periodOptions={periodOptions} onPeriodChange={setPeriod} sort={sort} sortOptions={sortOptions} onSortChange={setSort} categories={categories} />
    <MovementsContent activeTab={activeTab} items={pageItems} totalItems={displayedMovements.length} hasItemsBeforeFilters={(activeTab === 'recurring' ? recurringMovements : movements).length > 0} page={page} totalPages={totalPages} onPageChange={setPage} loading={loading} error={error} onRetry={() => setRetryToken(value => value + 1)} onEdit={onEdit} onDelete={onDelete} onManage={onManage} />
  </section>
}
