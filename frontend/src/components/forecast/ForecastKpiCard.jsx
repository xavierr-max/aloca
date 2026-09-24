import { ArrowDownLeft, ArrowUpRight, BarChart3, WalletCards } from 'lucide-react'
import FinancialInfoTooltip from './FinancialInfoTooltip.jsx'

const icons = { income: ArrowDownLeft, expense: ArrowUpRight, result: BarChart3, balance: WalletCards }

const descriptions = { income: 'Soma das entradas realizadas e previstas no período selecionado. Valores já recebidos e ainda esperados aparecem separados no detalhamento.', expense: 'Soma das saídas realizadas e previstas no período selecionado. Valores já pagos e ainda esperados aparecem separados no detalhamento.', result: 'Diferença entre todas as entradas e saídas do período, considerando o que já aconteceu e o que ainda está previsto.', balance: 'Valor estimado ao final do período depois de considerar apenas os eventos futuros que ainda não estão incorporados ao saldo atual.' }

export default function ForecastKpiCard({ kind, label, value, secondary, tone = 'neutral' }) {
  const Icon = icons[kind] || WalletCards
  return <article className={`forecast-kpi-card is-${tone}`}>
    <div className="forecast-kpi-heading"><span className="forecast-icon"><Icon size={19} strokeWidth={1.8} /></span><span>{label} <FinancialInfoTooltip title={label} description={descriptions[kind]} /></span></div>
    <strong>{value}</strong>
    {secondary && <span className="forecast-kpi-secondary">{secondary}</span>}
  </article>
}
