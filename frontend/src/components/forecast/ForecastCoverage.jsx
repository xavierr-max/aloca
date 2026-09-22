export default function ForecastCoverage({ month }) {
  const coverage = Number(month?.coverage || 0)
  const committed = Number(month?.committed || 0)
  const allocated = Number(month?.allocated || 0)
  const deficit = Number(month?.coverageDeficit || 0)
  const hasCoverageTarget = committed > 0
  return <section className="forecast-surface forecast-coverage"><div className="forecast-card-title"><h3>Cobertura do mês</h3><span>{month ? new Date(`${month.startDate}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : 'Mês atual'}</span></div><div className={`forecast-donut-placeholder ${hasCoverageTarget ? '' : 'is-empty'}`} style={{ '--coverage': `${Math.min(100, Math.max(0, coverage))}%` }}><strong>{hasCoverageTarget ? `${coverage.toFixed(0)}%` : '—'}</strong></div>{hasCoverageTarget ? <><p>{allocated.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de {committed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} cobertos</p>{deficit > 0 && <small>Faltam {deficit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</small>}</> : <p>Nenhum valor a cobrir neste mês</p>}</section>
}
