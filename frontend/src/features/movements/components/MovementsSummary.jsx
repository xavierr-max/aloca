import React from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Wallet } from 'lucide-react'
import MovementsInfoTooltip from '../../../components/MovementsInfoTooltip.jsx'

const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)

export default function MovementsSummary({ values, periodLabel }) {
  const result = values.income - values.expense
  const cards = [
    { key: 'income', label: 'Entradas', value: values.income, tone: 'positive', icon: ArrowDownLeft, description: 'Total recebido no período selecionado.' },
    { key: 'expense', label: 'Saídas', value: values.expense, tone: 'negative', icon: ArrowUpRight, description: 'Total gasto no período selecionado.' },
    { key: 'result', label: 'Resultado', value: result, tone: result > 0 ? 'positive' : result < 0 ? 'negative' : 'neutral', icon: ArrowLeftRight, description: 'Diferença entre as entradas e as saídas do período.' },
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
