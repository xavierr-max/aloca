import React from 'react'
import { Search } from 'lucide-react'

export default function MovementsFilters({ search, onSearchChange, category, onCategoryChange, period, periodOptions, onPeriodChange, sort, sortOptions, onSortChange, categories }) {
  return <section className="movements-filters" aria-label="Filtros de movimentações">
    <label className="movements-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Buscar movimentações</span><input value={search} onChange={event => onSearchChange(event.target.value)} placeholder="Buscar movimentações" /></label>
    <label><span className="sr-only">Grupo</span><select value={category} onChange={event => onCategoryChange(event.target.value)}><option value="">Todos os grupos</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label><span className="sr-only">Período</span><select value={period} onChange={event => onPeriodChange(event.target.value)}>{periodOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label><span className="sr-only">Ordenar</span><select value={sort} onChange={event => onSortChange(event.target.value)}>{sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
  </section>
}
