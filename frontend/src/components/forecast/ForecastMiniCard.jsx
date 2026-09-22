import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, PieChart } from 'lucide-react'

const icons = { allocated: PieChart, free: CircleDollarSign, income: ArrowDownLeft, expense: ArrowUpRight }

export default function ForecastMiniCard({ kind, label, value }) {
  const Icon = icons[kind] || CircleDollarSign
  return <article className={`forecast-mini-card is-${kind}`}><span className="forecast-icon"><Icon size={17} strokeWidth={1.8} /></span><div><span>{label}</span><strong>{value}</strong></div></article>
}
