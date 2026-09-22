import { ArrowDownLeft, ArrowUpRight, BarChart3, WalletCards } from 'lucide-react'
import FinancialInfoTooltip from './FinancialInfoTooltip.jsx'

const icons = { income: ArrowDownLeft, expense: ArrowUpRight, result: BarChart3, balance: WalletCards }

const descriptions = { income: 'Total de entradas esperadas dentro do período selecionado, incluindo recebimentos futuros considerados pela projeção.', expense: 'Total de saídas esperadas dentro do período selecionado.', result: 'Diferença entre as entradas e saídas previstas no período selecionado.', balance: 'Estimativa de quanto restará ao final do período considerando as movimentações previstas.' }

export default function ForecastKpiCard({ kind, label, value, secondary, tone = 'neutral' }) {
  const Icon = icons[kind] || WalletCards
  return <article className={`forecast-kpi-card is-${tone}`}>
    <div className="forecast-kpi-heading"><span className="forecast-icon"><Icon size={19} strokeWidth={1.8} /></span><span>{label} <FinancialInfoTooltip title={label} description={descriptions[kind]} /></span></div>
    <strong>{value}</strong>
    {secondary && <span className="forecast-kpi-secondary">{secondary}</span>}
  </article>
}
