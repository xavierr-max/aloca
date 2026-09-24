import { useEffect, useRef } from 'react'

const money = (value, signed = false) => {
  const amount = Number(value) || 0
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', signDisplay: signed ? 'always' : 'auto' })
}
const date = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Data não informada'
const monthName = month => new Date(`${month.startDate}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

function Movement({ item, expense = false }) {
  return <div className="forecast-drawer-movement"><span><strong>{item.description}</strong><small>{date(item.accountingDate)}{item.installmentNumber != null ? ` · parcela ${item.installmentNumber}${item.scheduledDate ? '' : ''}` : ''}</small></span><b className={expense ? 'is-negative' : 'is-positive'}>{expense ? '-' : '+'}{money(item.amount)}</b></div>
}

export default function ForecastMonthDrawer({ month, onClose, openerRef }) {
  const closeRef = useRef(null)
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = event => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); openerRef?.current?.focus() }
  }, [onClose, openerRef])
  if (!month) return null
  const commitments = month.commitments || []
  const incomeItems = month.incomeItems || []
  const expenseItems = month.expenseItems || []
  return <div className="forecast-drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><aside className="forecast-month-drawer" role="dialog" aria-modal="true" aria-labelledby="forecast-drawer-title"><header className="forecast-drawer-header"><div><span className="forecast-drawer-eyebrow">DETALHES DO MÊS</span><h2 id="forecast-drawer-title">{monthName(month)}</h2><span>Resumo financeiro daquele mês.</span></div><button ref={closeRef} type="button" className="forecast-drawer-close" onClick={onClose} aria-label="Fechar detalhes">×</button></header><section className="forecast-drawer-summary" aria-label="Resumo financeiro"><div><span>Saldo de abertura</span><strong>{money(month.openingBalance)}</strong></div><div><span>Entradas totais</span><strong className="is-positive">+{money(month.totalIncome)}</strong><small>Realizadas {money(month.realizedIncome)} · Previstas {money(month.plannedIncome)}</small></div><div><span>Saídas totais</span><strong className="is-negative">-{money(month.totalExpense)}</strong><small>Realizadas {money(month.realizedExpense)} · Previstas {money(month.plannedExpense)}</small></div><div><span>Resultado previsto</span><strong className={Number(month.monthlyResult) < 0 ? 'is-negative' : 'is-positive'}>{money(month.monthlyResult, true)}</strong><small>Entradas totais − saídas totais</small></div><div><span>Saldo de fechamento</span><strong>{money(month.closingBalance)}</strong></div></section><section className="forecast-drawer-section"><h3>Entradas previstas</h3>{incomeItems.length ? incomeItems.map(item => <Movement key={item.sourceId} item={item} />) : <p className="forecast-drawer-empty">Nenhuma entrada prevista neste mês.</p>}</section><section className="forecast-drawer-section"><h3>Saídas previstas e parcelas</h3>{expenseItems.length ? expenseItems.map(item => <Movement key={item.sourceId} item={item} expense />) : <p className="forecast-drawer-empty">Nenhuma saída prevista ou parcela pendente neste mês.</p>}</section>{commitments.length > 0 && <section className="forecast-drawer-section"><h3>Cobertura do mês</h3>{commitments.map(item => <div className="forecast-drawer-commitment" key={`${item.financialCommitmentId}-${item.installmentNumber}`}><div><strong>{item.description}</strong><span>Reservado {money(item.allocatedAmount)} de {money(item.requiredAmount)}</span>{Number(item.remainingAmount) > 0 && <small>Ainda sem cobertura: {money(item.remainingAmount)}</small>}</div><b>{Math.min(100, Math.max(0, Number(item.coveragePercentage) || 0)).toFixed(0)}%</b><div className="forecast-drawer-progress"><i style={{ width: `${Math.min(100, Math.max(0, Number(item.coveragePercentage) || 0))}%` }} /></div></div>)}</section>}</aside></div>
}
