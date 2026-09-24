import FinancialInfoTooltip from './FinancialInfoTooltip.jsx'

export default function ForecastCoverage({ month }) {
  const coverage = Math.min(100, Math.max(0, Number(month?.coverage) || 0))
  const committed = Math.max(0, Number(month?.committed) || 0)
  const allocated = Math.max(0, Number(month?.allocated) || 0)
  const deficit = Math.max(0, Number(month?.coverageDeficit) || 0)
  const hasCoverageTarget = committed > 0
  const radius = 39
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - coverage / 100)
  const monthLabel = month ? new Date(`${month.startDate}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '') : 'Mês atual'
  return <section className="forecast-surface forecast-coverage"><div className="forecast-card-title"><h3>Cobertura do mês <FinancialInfoTooltip title="Cobertura do mês" description="Percentual dos compromissos do mês selecionado que já possui dinheiro reservado. Não representa saldo reservado global nem pagamentos realizados." /></h3><span>{monthLabel}</span></div><div className={`forecast-donut-placeholder ${hasCoverageTarget ? '' : 'is-empty'}`} role="img" aria-label={hasCoverageTarget ? `${coverage.toFixed(0)}% de cobertura` : 'Nenhum valor a cobrir neste mês'}><svg viewBox="0 0 100 100" aria-hidden="true"><circle className="forecast-donut-track" cx="50" cy="50" r={radius} /><circle className="forecast-donut-value" cx="50" cy="50" r={radius} pathLength="100" style={{ strokeDasharray: '100 100', strokeDashoffset: `${100 - coverage}` }} /></svg><strong>{hasCoverageTarget ? `${coverage.toFixed(0)}%` : '—'}</strong></div>{hasCoverageTarget ? <><p>{allocated.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de {committed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} cobertos</p>{deficit > 0 && <small>Ainda sem cobertura: {deficit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</small>}</> : <p>Nenhum compromisso pendente neste mês</p>}</section>
}
