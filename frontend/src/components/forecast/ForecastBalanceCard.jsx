import { Layers3, WalletCards } from 'lucide-react'

export function ForecastBalanceCard({ kind, value, label, detail }) {
  const Icon = kind === 'balance' ? WalletCards : Layers3
  return <article className={`forecast-balance-card ${kind === 'balance' ? 'is-highlighted' : ''}`}>
    <div className="forecast-balance-heading"><span className="forecast-icon"><Icon size={20} strokeWidth={1.8} /></span><div><span>{label}</span><small>{kind === 'balance' ? 'Disponível' : 'Total'}</small></div></div>
    <strong>{value}</strong>
    <span>{detail}</span>
  </article>
}
