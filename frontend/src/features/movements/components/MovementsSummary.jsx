import React from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Wallet } from 'lucide-react'
import MovementsInfoTooltip from '../../../components/MovementsInfoTooltip.jsx'

const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)

export default function MovementsSummary({ values, periodLabel }) {
  const result = values.income - values.expense
  const cards = [
    { key: 'income', label: 'Entradas realizadas', value: values.income, tone: 'positive', icon: ArrowDownLeft, description: 'Entradas efetivamente recebidas no período selecionado. Valores futuros não entram.' },
    { key: 'expense', label: 'Saídas realizadas', value: values.expense, tone: 'negative', icon: ArrowUpRight, description: 'Saídas efetivamente realizadas no período selecionado. Compromissos pendentes não entram.' },
    { key: 'result', label: 'Resultado realizado', value: result, tone: result > 0 ? 'positive' : result < 0 ? 'negative' : 'neutral', icon: ArrowLeftRight, description: 'Entradas realizadas menos saídas realizadas no período selecionado.' },
    { key: 'balance', label: 'Saldo atual', value: values.currentBalance, tone: 'balance', icon: Wallet, description: 'Saldo real disponível, considerando as movimentações confirmadas.' },
  ]
  return <section className="movements-summary" aria-label="Resumo financeiro das movimentações">
    {cards.map(({ key, label, value, tone, icon: Icon, description }) => <article className={`movements-summary-card is-${tone}`} key={key}>
      <div className="movements-summary-label"><Icon size={16} aria-hidden="true" /><span>{label}</span><MovementsInfoTooltip title={label} description={description} /></div>
      <strong>{money(value)}</strong>
      <small>{key === 'balance' ? 'saldo real' : periodLabel.toLowerCase()}</small>
    </article>)}
  </section>
}
