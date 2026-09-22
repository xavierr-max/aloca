const width = 760
const height = 190
const padding = { top: 18, right: 18, bottom: 32, left: 54 }

const monthKey = month => `${month.year}-${String(month.month).padStart(2, '0')}`
const monthLabel = month => new Date(`${month.startDate}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '').replace(' de ', ' ')
const fullMonthLabel = month => new Date(`${month.startDate}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const niceStep = value => { const power = 10 ** Math.floor(Math.log10(Math.max(1, value))); const fraction = value / power; return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power }
const ticksFor = (min, max) => { const step = niceStep((max - min) / 4); const start = Math.floor(min / step) * step; const end = Math.ceil(max / step) * step; return Array.from({ length: Math.min(6, Math.round((end - start) / step) + 1) }, (_, index) => Number((start + index * step).toFixed(2))) }

export default function ForecastMainChart({ months = [], selectedMonthKey, onSelectMonth }) {
  const values = months.map(month => Number(month.closingBalance)).filter(Number.isFinite)
  const hasData = months.length > 0 && values.length === months.length
  const min = hasData ? Math.min(0, ...values) : 0
  const max = hasData ? Math.max(0, ...values) : 1
  const range = Math.max(1, max - min)
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const xFor = index => months.length === 1 ? padding.left + chartWidth / 2 : padding.left + index * (chartWidth / (months.length - 1))
  const yFor = value => padding.top + (max - value) / range * chartHeight
  const points = months.map((month, index) => ({ month, key: monthKey(month), x: xFor(index), y: yFor(Number(month.closingBalance)), value: Number(month.closingBalance) }))
  const ticks = ticksFor(min, max)
  const linePoints = points.map(point => `${point.x},${point.y}`).join(' ')
  const selected = points.find(point => point.key === selectedMonthKey) || points[0]
  const accessibleSummary = hasData ? `Evolução do saldo projetado de ${fullMonthLabel(months[0])} a ${fullMonthLabel(months[months.length - 1])}, com ${points.length} pontos. Saldo projetado final: ${money(points[points.length - 1].value)}.` : 'Sem dados de projeção para este período.'
  return <section className="forecast-surface forecast-main-chart"><div className="forecast-card-title"><h3>Evolução do saldo projetado</h3><span>Próximos meses</span></div>{hasData ? <div className="forecast-chart-frame"><svg className="forecast-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={accessibleSummary}><defs><linearGradient id="forecast-area-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--color-success)" stopOpacity=".2" /><stop offset="100%" stopColor="var(--color-success)" stopOpacity="0" /></linearGradient></defs>{ticks.map(tick => <g key={tick}><line x1={padding.left} x2={width - padding.right} y1={yFor(tick)} y2={yFor(tick)} className={tick === 0 ? 'forecast-grid-zero' : 'forecast-grid-line'} /><text x={padding.left - 9} y={yFor(tick) + 4} textAnchor="end" className="forecast-axis-label">{money(tick).replace(',00', '')}</text></g>)}<polygon points={`${padding.left},${height - padding.bottom} ${linePoints} ${width - padding.right},${height - padding.bottom}`} className="forecast-area" />{selected && <text x={selected.x} y={Math.max(12, selected.y - 12)} textAnchor="middle" className="forecast-selected-value">{money(selected.value)}</text>}<polyline points={linePoints} className="forecast-line" />{points.map(point => <g key={point.key}><circle cx={point.x} cy={point.y} r={point.key === selected?.key ? 6 : 4.5} className={`forecast-point ${point.key === selected?.key ? 'is-selected' : ''}`} tabIndex="0" role="button" aria-label={`${fullMonthLabel(point.month)}. Saldo projetado: ${money(point.value)}`} aria-pressed={point.key === selected?.key} onClick={() => onSelectMonth(point.key)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectMonth(point.key) } }} /><text x={point.x} y={height - 9} textAnchor="middle" className="forecast-month-label">{monthLabel(point.month)}</text></g>)}</svg><p className="forecast-chart-accessible-summary">{accessibleSummary}</p></div> : <div className="forecast-chart-empty">Sem dados de projeção para este período.</div>}</section>
}
