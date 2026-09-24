import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, PieChart } from 'lucide-react'
import FinancialInfoTooltip from './FinancialInfoTooltip.jsx'

const icons = { allocated: PieChart, free: CircleDollarSign, income: ArrowDownLeft, expense: ArrowUpRight }

export default function ForecastMiniCard({ kind, label, value }) {
  const Icon = icons[kind] || CircleDollarSign
  const descriptions = {
    allocated: 'Parte do saldo atual já separada para compromissos futuros. Reserva não é pagamento nem saída.',
    unallocated: 'Parte do saldo atual que ainda não foi reservada para compromissos. Não significa necessariamente dinheiro livre.',
    free: 'Parte do saldo não alocado que sobra depois de considerar compromissos ainda sem cobertura. É uma estimativa do que pode permanecer livre sem deixá-los descobertos.',
    income: 'Soma das entradas realizadas e previstas no período selecionado. O detalhamento separa o que já entrou do que ainda está previsto.',
    expense: 'Soma das saídas realizadas e previstas no período selecionado. O detalhamento separa o que já saiu do que ainda está previsto.'
  }
  return <article className={`forecast-mini-card is-${kind}`}><span className="forecast-icon"><Icon size={17} strokeWidth={1.8} /></span><div><span>{label}{descriptions[kind] && <> <FinancialInfoTooltip title={label} description={descriptions[kind]} /></>}</span><strong>{value}</strong></div></article>
}
