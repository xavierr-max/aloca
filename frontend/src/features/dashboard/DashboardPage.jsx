import React, { useState } from 'react'
import { Pencil } from 'lucide-react'
import InfoTooltip from '../../components/InfoTooltip.jsx'
import { money, signedMoney } from '../../utils/financial.js'
import { businessMonth } from '../../utils/businessDate.js'

const dashboardCards = [
  { key: 'current', label: 'Saldo atual', title: 'Saldo atual', description: 'Valor disponível na conta antes das alocações.' },
  { key: 'reserved', label: 'Saldo reservado', title: 'Saldo reservado', description: 'Valor separado para obrigações e objetivos.' },
  { key: 'unallocated', label: 'Saldo não alocado', title: 'Saldo não alocado', description: 'Valor ainda sem destino definido.' },
  { key: 'free', label: 'Saldo livre', title: 'Saldo livre', description: 'Valor disponível depois das reservas.' },
]

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
  const chooseMonth = month => { onChange(`${displayYear}-${String(month).padStart(2, '0')}`); setOpen(false) }
  return <div className="dashboard-month-picker">
    <button type="button" className="dashboard-month-trigger" aria-label="Selecionar mês do resumo financeiro" aria-expanded={open} onClick={() => setOpen(value => !value)}><span>{monthLabel(normalized)}</span></button>
    {open && <div className="dashboard-month-popover" role="dialog" aria-label={`Selecionar mês de ${displayYear}`}>
      <div className="dashboard-month-popover-header"><button type="button" className="dashboard-month-year-button" aria-label={`Ano anterior a ${displayYear}`} onClick={() => setDisplayYear(year => year - 1)}>‹</button><strong>{displayYear}</strong><button type="button" className="dashboard-month-year-button" aria-label={`Ano posterior a ${displayYear}`} onClick={() => setDisplayYear(year => year + 1)}>›</button></div>
      <div className="dashboard-month-grid">{monthPickerNames.map((name, index) => { const month = index + 1; const isSelected = displayYear === selectedYear && month === selectedMonthNumber; return <button type="button" key={name} className={`dashboard-month-option${isSelected ? ' is-selected' : ''}`} aria-label={`${name} de ${displayYear}`} aria-current={isSelected ? 'date' : undefined} onClick={() => chooseMonth(month)}>{name}</button> })}</div>
    </div>}
  </div>
}

function DashboardMonthlySummary({ summary, loading, error, selectedMonth, onMonthChange, onRetry }) {
  const metrics = summary ? [
    ['income', 'Entradas do mês', money(summary.entradasTotais ?? 0), `Realizadas ${money(summary.entradasRealizadas ?? 0)} · Previstas ${money(summary.entradasPrevistas ?? 0)}`],
    ['expenses', 'Saídas do mês', money(summary.saidasTotais ?? 0), `Realizadas ${money(summary.saidasRealizadas ?? 0)} · Previstas ${money(summary.saidasPrevistas ?? 0)}`],
    ['real', 'Resultado real', signedMoney(summary.resultadoReal ?? 0), 'Entradas realizadas − saídas realizadas'],
    ['forecast', 'Resultado previsto', signedMoney(summary.resultadoPrevisto ?? 0), 'Entradas totais − saídas totais'],
    ['reserved', 'Reservado / alocado', money(summary.allocatedAmount ?? 0), ''],
    ['final', 'Saldo final estimado', money(summary.estimatedFinalBalance ?? 0), ''],
  ] : []
  return <section className="dashboard-secondary-card dashboard-month-summary" aria-labelledby="monthly-summary-title">
    <header className="dashboard-month-header"><div><span className="eyebrow">CONTEXTO TEMPORAL</span><h2 id="monthly-summary-title">Resumo financeiro do mês</h2></div><MonthPicker value={selectedMonth} onChange={onMonthChange} /></header>
    {loading && !summary ? <div className="loading" aria-busy="true">Carregando o resumo deste mês…</div> : error && !summary ? <div className="alert error" role="alert"><span>{error}</span><button type="button" className="secondary" onClick={onRetry}>Tentar novamente</button></div> : <div className="dashboard-month-metrics">{metrics.map(([key, label, value, detail]) => <article className={`dashboard-month-metric is-${key}`} key={key}><span className="dashboard-month-label">{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>)}</div>}
  </section>
}

export default function DashboardPage({ summary, monthlySummary, monthlyLoading, monthlyError, selectedMonth, onMonthChange, onRetryMonthly, onEditBalance }) {
  const values = { current: Number(summary?.currentBalance) || 0, reserved: Number(summary?.allocatedBalance) || 0, unallocated: Number(summary?.unallocatedBalance) || 0, free: Number(summary?.freeBalance) || 0 }
  const objective = window.localStorage.getItem('aloca-commitment-objective') || ''
  return <section className="dashboard-page" aria-labelledby="dashboard-title">
    <header className="dashboard-header"><h1 id="dashboard-title">Bem-vindo de volta!</h1><p>Seu dinheiro, sob controle.</p></header>
    <section className="dashboard-balance-grid" aria-label="Saldos financeiros">{dashboardCards.map(({ key, label, title, description }) => <article key={key} className="dashboard-balance-card"><div className="dashboard-card-topline"><span className="dashboard-card-label">{label} <InfoTooltip title={title} description={description} /></span>{key === 'current' && <button type="button" className="dashboard-balance-edit" onClick={onEditBalance} aria-label="Editar saldo atual"><Pencil size={16} aria-hidden="true" /></button>}</div><strong className="dashboard-card-value">{money(values[key])}</strong></article>)}</section>
    <DashboardMonthlySummary summary={monthlySummary} loading={monthlyLoading} error={monthlyError} selectedMonth={selectedMonth} onMonthChange={onMonthChange} onRetry={onRetryMonthly} />
    <section className="dashboard-balance-direction" aria-labelledby="balance-direction-title"><span className="eyebrow">DIREÇÃO DO SALDO</span><h2 id="balance-direction-title">{objective || 'Nenhum objetivo definido'}</h2></section>
  </section>
}
