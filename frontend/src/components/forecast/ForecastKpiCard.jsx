import { ArrowDownLeft, ArrowUpRight, BarChart3, WalletCards } from 'lucide-react'

const icons = { income: ArrowDownLeft, expense: ArrowUpRight, result: BarChart3, balance: WalletCards }

export default function ForecastKpiCard({ kind, label, value, secondary, tone = 'neutral' }) {
  const Icon = icons[kind] || WalletCards
  return <article className={`forecast-kpi-card is-${tone}`}>
    <div className="forecast-kpi-heading"><span className="forecast-icon"><Icon size={19} strokeWidth={1.8} /></span><span>{label}</span></div>
    <strong>{value}</strong>
    {secondary && <span className="forecast-kpi-secondary">{secondary}</span>}
  </article>
}
