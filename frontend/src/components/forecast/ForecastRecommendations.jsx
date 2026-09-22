const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ForecastRecommendations({ month }) {
  const deficit = Math.max(0, Number(month?.coverageDeficit) || 0)
  const commitments = (month?.commitments || []).filter(item => Number(item.remainingAmount) > 0)
  const recommendations = deficit > 0
    ? [{ icon: '↗', value: money(deficit), label: 'para cobrir compromissos', tone: 'warning' }]
    : commitments.length > 0
      ? commitments.slice(0, 2).map(item => ({ icon: '!', value: money(item.remainingAmount), label: `${item.description} pendente`, tone: 'warning' }))
      : []
  return <section className="forecast-surface forecast-recommendations"><div className="forecast-card-title"><h3>Recomendações</h3><span>{recommendations.length ? 'Prioritárias' : 'Sem pendências'}</span></div>{recommendations.length ? <div className={`forecast-recommendation-list ${recommendations.length === 1 ? 'has-single' : ''}`}>{recommendations.slice(0, 2).map((item, index) => <div className={`forecast-recommendation-card is-${item.tone}`} key={`${item.label}-${index}`}><span aria-hidden="true">{item.icon}</span><strong>{item.value}</strong><small>{item.label}</small></div>)}</div> : <div className="forecast-recommendation-empty"><span aria-hidden="true">✓</span><p>Nenhuma recomendação para este mês</p></div>}</section>
}
