import React from 'react'

const tabs = [
  { value: 'all', label: 'Todas' },
  { value: 'income', label: 'Entradas' },
  { value: 'expense', label: 'Saídas' },
  { value: 'recurring', label: 'Recorrentes' },
]

export default function MovementsTabs({ activeTab, onChange }) {
  const move = (event, index) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    onChange(tabs[nextIndex].value)
    event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[nextIndex]?.focus()
  }
  return <div className="movements-tabs-wrap">
    <div className="movements-tabs" role="tablist" aria-label="Tipo de movimentação">
      {tabs.map((tab, index) => <button key={tab.value} type="button" role="tab" aria-selected={activeTab === tab.value} aria-controls="movements-panel" tabIndex={activeTab === tab.value ? 0 : -1} className={activeTab === tab.value ? 'is-active' : ''} onClick={() => onChange(tab.value)} onKeyDown={event => move(event, index)}>{tab.label}</button>)}
    </div>
  </div>
}
