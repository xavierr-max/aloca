import React from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Wallet } from 'lucide-react'

const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)

export default function MovementsSummary({ values, periodLabel }) {
  const result = values.income - values.expense
  const cards = [
    { key: 'income', label: 'Entradas', value: values.income, tone: 'positive', icon: ArrowDownLeft },
    { key: 'expense', label: 'Saídas', value: values.expense, tone: 'negative', icon: ArrowUpRight },
    { key: 'result', label: 'Resultado', value: result, tone: result > 0 ? 'positive' : result < 0 ? 'negative' : 'neutral', icon: ArrowLeftRight },
    { key: 'balance', label: 'Saldo atual', value: values.currentBalance, tone: 'balance', icon: Wallet },
  ]
  return <section className="movements-summary" aria-label="Resumo financeiro das movimentações">
    {cards.map(({ key, label, value, tone, icon: Icon }) => <article className={`movements-summary-card is-${tone}`} key={key}>
      <div className="movements-summary-label"><Icon size={16} aria-hidden="true" /><span>{label}</span></div>
      <strong>{money(value)}</strong>
      <small>{key === 'balance' ? 'saldo real' : periodLabel.toLowerCase()}</small>
    </article>)}
  </section>
}
