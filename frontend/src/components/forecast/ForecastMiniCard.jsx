import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, PieChart } from 'lucide-react'
import FinancialInfoTooltip from './FinancialInfoTooltip.jsx'

const icons = { allocated: PieChart, free: CircleDollarSign, income: ArrowDownLeft, expense: ArrowUpRight }

export default function ForecastMiniCard({ kind, label, value }) {
  const Icon = icons[kind] || CircleDollarSign
  const descriptions = { allocated: 'Valor que já foi direcionado para compromissos.', free: 'Valor disponível que ainda não foi reservado para nenhum compromisso.' }
  return <article className={`forecast-mini-card is-${kind}`}><span className="forecast-icon"><Icon size={17} strokeWidth={1.8} /></span><div><span>{label}{descriptions[kind] && <> <FinancialInfoTooltip title={label} description={descriptions[kind]} /></>}</span><strong>{value}</strong></div></article>
}
