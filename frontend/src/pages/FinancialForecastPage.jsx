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
import { businessMonth } from '../utils/businessDate.js'

const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const monthKey = month => month ? `${month.year}-${String(month.month).padStart(2, '0')}` : ''

function ForecastLoading() { return <div className="forecast-loading" aria-label="Carregando previsões"><i /><i /><i /><i /><div /><div /></div> }

export default function FinancialForecastPage({ businessDate: referenceDate }) {
  const [months, setMonths] = useState(6)
  const [customizingMonths, setCustomizingMonths] = useState(false)
  const [customMonths, setCustomMonths] = useState('6')
  const [data, setData] = useState(null)
  const [selectedMonthKey, setSelectedMonthKey] = useState('')
  const [error, setError] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerOpenerRef = useRef(null)
  const currentMonth = businessMonth(referenceDate)

  useEffect(() => {
    let cancelled = false
    setError('')
    setDrawerOpen(false)
    api.financialForecast(currentMonth, months).then(next => { if (!cancelled) { setData(next); setSelectedMonthKey(monthKey(next.months?.[0])) } }).catch(reason => { if (!cancelled) setError(reason?.message || 'Não foi possível carregar os dados.') })
    return () => { cancelled = true }
  }, [months, currentMonth])

  const summary = data?.summary
  const month = data?.months?.find(item => monthKey(item) === selectedMonthKey) || data?.months?.[0]
  const incomeSecondary = summary ? 'Total do período' : null
  const expenseSecondary = summary ? 'Total do período' : null
  return <div className="forecast-page-shell">
    <div className="forecast-page-content">
      <section className="forecast-planning-header"><PageHeader className="forecast-planning-copy" eyebrow="ANÁLISE" title="Previsões" description="Visualize entradas, saídas e o saldo projetado para os próximos meses." /><div className="forecast-period-control"><span>Período</span><div className="forecast-period-presets" role="group" aria-label="Horizonte da previsão">{[1, 3, 6, 12, 24, 36].map(option => <button type="button" key={option} className={!customizingMonths && months === option ? 'is-selected' : ''} onClick={() => { setCustomizingMonths(false); setMonths(option) }}>{option} meses</button>)}<button type="button" className={customizingMonths ? 'is-selected' : ''} onClick={() => { setCustomMonths(String(months)); setCustomizingMonths(true) }}>Personalizado</button></div>{customizingMonths && <label className="forecast-custom-period">Quantidade de meses<input type="number" min="1" max="36" step="1" value={customMonths} onChange={event => { const raw = event.target.value; setCustomMonths(raw); if (raw === '') return; if (/^\d+$/.test(raw)) { const value = Number(raw); if (value >= 1 && value <= 36) setMonths(value) } }} /></label>}</div></section>
      {error && <div className="forecast-inline-error" role="status">{error}</div>}
      {!data && !error ? <ForecastLoading /> : <>
        <section className="forecast-kpi-grid"><ForecastKpiCard kind="income" label="Entradas totais" value={money(summary?.totalIncome)} secondary={summary ? `Realizadas ${money(summary.realizedIncome)} · Previstas ${money(summary.plannedIncome)}` : incomeSecondary} tone="positive" /><ForecastKpiCard kind="expense" label="Saídas totais" value={money(summary?.totalExpense)} secondary={summary ? `Realizadas ${money(summary.realizedExpense)} · Previstas ${money(summary.plannedExpense)}` : expenseSecondary} tone="negative" /><ForecastKpiCard kind="result" label="Resultado previsto" value={money(summary?.forecastResult)} secondary={summary ? `Realizado ${money(summary.realResult)}` : null} tone={Number(summary?.forecastResult) < 0 ? 'negative' : 'positive'} /><ForecastKpiCard kind="balance" label="Saldo projetado" value={money(summary?.projectedClosingBalance)} secondary={data ? `Saldo de fechamento (${monthKey(data.months?.[data.months.length - 1])})` : null} /></section>
        <section className="forecast-main-grid"><ForecastMainChart months={data.months || []} selectedMonthKey={selectedMonthKey} onSelectMonth={key => { setSelectedMonthKey(key); setDrawerOpen(false) }} onOpenDetails={selected => { setSelectedMonthKey(monthKey(selected)); setDrawerOpen(true) }} detailsTriggerRef={drawerOpenerRef} /><div className="forecast-side-column"><ForecastCoverage month={month} /><ForecastRecommendations month={month} /></div></section>
        <section className="forecast-balance-grid"><BalanceCard kind="balance" label="Saldo de abertura" value={money(summary?.initialBalance)} detail="Primeiro mês: saldo atual" /><BalanceCard kind="committed" label="Saldo reservado" value={money(summary?.totalAllocated)} detail="Separado para compromissos futuros" /></section>
        <section className="forecast-mini-grid"><ForecastMiniCard kind="allocated" label="Saldo reservado" value={money(summary?.totalAllocated)} /><ForecastMiniCard kind="unallocated" label="Saldo não alocado" value={money(summary?.unallocatedBalance)} /><ForecastMiniCard kind="free" label="Saldo livre" value={money(summary?.freeBalance)} /><ForecastMiniCard kind="income" label="Entradas do mês" value={money(month?.totalIncome)} /><ForecastMiniCard kind="expense" label="Saídas do mês" value={money(month?.totalExpense)} /></section>
      </>}
    </div>{drawerOpen && <ForecastMonthDrawer month={month} onClose={() => setDrawerOpen(false)} openerRef={drawerOpenerRef} />}
  </div>
}
