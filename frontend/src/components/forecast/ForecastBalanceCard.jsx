import { Layers3, WalletCards } from 'lucide-react'
import FinancialInfoTooltip from './FinancialInfoTooltip.jsx'

export function ForecastBalanceCard({ kind, value, label, detail }) {
  const Icon = kind === 'balance' ? WalletCards : Layers3
  const description = kind === 'balance' ? 'Valor disponível atualmente na conta antes das movimentações futuras.' : 'Parte do dinheiro que já está reservada para cobrir compromissos.'
  return <article className={`forecast-balance-card ${kind === 'balance' ? 'is-highlighted' : ''}`}>
    <div className="forecast-balance-heading"><span className="forecast-icon"><Icon size={20} strokeWidth={1.8} /></span><div><span>{label} <FinancialInfoTooltip title={label} description={description} /></span><small>{kind === 'balance' ? 'Disponível' : 'Total'}</small></div></div>
    <strong>{value}</strong>
    <span>{detail}</span>
  </article>
}
