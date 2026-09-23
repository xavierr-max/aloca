import { useEffect, useRef, useState } from 'react'
import { api } from '../services/api'
import PageHeader from '../components/PageHeader.jsx'
import { ForecastBalanceCard as BalanceCard } from '../components/forecast/ForecastBalanceCard.jsx'
import ForecastCoverage from '../components/forecast/ForecastCoverage.jsx'
import ForecastKpiCard from '../components/forecast/ForecastKpiCard.jsx'
import ForecastMainChart from '../components/forecast/ForecastMainChart.jsx'
import ForecastMiniCard from '../components/forecast/ForecastMiniCard.jsx'
import ForecastRecommendations from '../components/forecast/ForecastRecommendations.jsx'
import ForecastMonthDrawer from '../components/forecast/ForecastMonthDrawer.jsx'
import './financial-forecast.css'

const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const monthKey = month => month ? `${month.year}-${String(month.month).padStart(2, '0')}` : ''

function ForecastLoading() { return <div className="forecast-loading" aria-label="Carregando previsões"><i /><i /><i /><i /><div /><div /></div> }

export default function FinancialForecastPage() {
  const [months, setMonths] = useState(6)
  const [data, setData] = useState(null)
  const [selectedMonthKey, setSelectedMonthKey] = useState('')
  const [error, setError] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerOpenerRef = useRef(null)
  const currentMonth = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    let cancelled = false
    setError('')
    setDrawerOpen(false)
    api.financialForecast(currentMonth, months).then(next => { if (!cancelled) { setData(next); setSelectedMonthKey(monthKey(next.months?.[0])) } }).catch(reason => { if (!cancelled) setError(reason?.message || 'Não foi possível carregar os dados.') })
    return () => { cancelled = true }
  }, [months])

  const summary = data?.summary
  const month = data?.months?.find(item => monthKey(item) === selectedMonthKey) || data?.months?.[0]
  const incomeSecondary = summary ? 'Total do período' : null
  const expenseSecondary = summary ? 'Total do período' : null
  return <div className="forecast-page-shell">
    <div className="forecast-page-content">
      <section className="forecast-planning-header"><PageHeader className="forecast-planning-copy" eyebrow="ANÁLISE" title="Previsões" description="Visualize entradas, saídas e o saldo projetado para os próximos meses." /><label>Período<select value={months} onChange={event => setMonths(Number(event.target.value))}><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option></select></label></section>
      {error && <div className="forecast-inline-error" role="status">{error}</div>}
      {!data && !error ? <ForecastLoading /> : <>
        <section className="forecast-kpi-grid"><ForecastKpiCard kind="income" label="Entradas previstas" value={money(summary?.totalIncome)} secondary={incomeSecondary} tone="positive" /><ForecastKpiCard kind="expense" label="Saídas previstas" value={money(summary?.totalExpense)} secondary={expenseSecondary} tone="negative" /><ForecastKpiCard kind="result" label="Resultado do período" value={money(summary?.totalResult)} tone={Number(summary?.totalResult) < 0 ? 'negative' : 'positive'} /><ForecastKpiCard kind="balance" label="Saldo projetado" value={money(summary?.projectedClosingBalance)} secondary={data ? `Saldo final (${monthKey(data.months?.[data.months.length - 1])})` : null} /></section>
        <section className="forecast-main-grid"><ForecastMainChart months={data.months || []} selectedMonthKey={selectedMonthKey} onSelectMonth={key => { setSelectedMonthKey(key); setDrawerOpen(false) }} onOpenDetails={selected => { setSelectedMonthKey(monthKey(selected)); setDrawerOpen(true) }} detailsTriggerRef={drawerOpenerRef} /><div className="forecast-side-column"><ForecastCoverage month={month} /><ForecastRecommendations month={month} /></div></section>
        <section className="forecast-balance-grid"><BalanceCard kind="balance" label="Saldo atual" value={money(summary?.initialBalance)} detail="Saldo livre para alocar" /><BalanceCard kind="committed" label="Comprometido" value={money(summary?.totalAllocated)} detail="Reservado para compromissos" /></section>
        <section className="forecast-mini-grid"><ForecastMiniCard kind="allocated" label="Alocado" value={money(summary?.totalAllocated)} /><ForecastMiniCard kind="free" label="Saldo livre" value={money(summary?.freeBalance)} /><ForecastMiniCard kind="income" label="Entradas do mês" value={money(month?.totalIncome)} /><ForecastMiniCard kind="expense" label="Saídas do mês" value={money(month?.totalExpense)} /></section>
      </>}
    </div>{drawerOpen && <ForecastMonthDrawer month={month} onClose={() => setDrawerOpen(false)} openerRef={drawerOpenerRef} />}
  </div>
}
