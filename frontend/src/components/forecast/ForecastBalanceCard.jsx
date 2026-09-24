import { Layers3, WalletCards } from 'lucide-react'
import FinancialInfoTooltip from './FinancialInfoTooltip.jsx'

export function ForecastBalanceCard({ kind, value, label, detail }) {
  const Icon = kind === 'balance' ? WalletCards : Layers3
  const description = kind === 'balance'
    ? 'Valor usado como ponto de partida para a projeção. No primeiro mês, corresponde ao saldo atual; nos meses seguintes, a abertura vem do fechamento anterior. Não inclui eventos futuros novamente.'
    : 'Parte do saldo atual que já foi separada para compromissos futuros. Continua pertencendo ao saldo atual e não é uma saída.'
  return <article className={`forecast-balance-card ${kind === 'balance' ? 'is-highlighted' : ''}`}>
    <div className="forecast-balance-heading"><span className="forecast-icon"><Icon size={20} strokeWidth={1.8} /></span><div><span>{label} <FinancialInfoTooltip title={label} description={description} /></span><small>{kind === 'balance' ? 'Disponível' : 'Total'}</small></div></div>
    <strong>{value}</strong>
    <span>{detail}</span>
  </article>
}
