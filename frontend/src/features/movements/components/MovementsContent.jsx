import React, { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowDownLeft, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Link2, MoreHorizontal, Pencil, RefreshCw, Trash2, Zap } from 'lucide-react'

const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
const formatDate = value => {
  const [year, month, day] = String(value || '').slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return 'Sem data'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day)).replace('.', '')
}

function MovementRow({ item, onEdit, onDelete }) {
  const income = item.movementType === 'income'
  const [open, setOpen] = useState(false)
  const actionsRef = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const close = event => { if (event.key === 'Escape' || (event.type === 'mousedown' && !actionsRef.current?.contains(event.target))) setOpen(false) }
    document.addEventListener('keydown', close)
    document.addEventListener('mousedown', close)
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('mousedown', close) }
  }, [open])
  return <li className="movement-row">
    <span className={`movement-type-icon is-${item.movementType}`} aria-hidden="true">{income ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span>
    <div className="movement-main"><strong title={item.description}>{item.description}</strong><div className="movement-meta"><span>{item.categoryName || 'Sem grupo'}</span><span><CalendarDays size={12} aria-hidden="true" />{formatDate(item.date)}</span>{item.wasAutomatic && <span className="movement-badge"><Zap size={11} aria-hidden="true" />Automática</span>}{item.isRecurring && <span className="movement-badge"><RefreshCw size={11} aria-hidden="true" />Recorrente</span>}{item.financialCommitmentId && <span className="movement-badge"><Link2 size={11} aria-hidden="true" />Compromisso</span>}</div></div>
    <strong className={`movement-amount is-${item.movementType}`}>{income ? '+' : '-'} {money(item.amount)}</strong>
    <div className={`movement-actions${open ? ' is-open' : ''}`} ref={actionsRef}><button type="button" className="movement-actions-button" aria-label={`Ações para ${item.description}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}><MoreHorizontal size={18} /></button><div className="movement-actions-menu" role="menu"><button type="button" role="menuitem" onClick={() => { setOpen(false); onEdit(item) }}><Pencil size={14} />Editar</button><button type="button" role="menuitem" onClick={() => { setOpen(false); onDelete(item) }}><Trash2 size={14} />Excluir</button></div></div>
  </li>
}

function MovementsSkeleton() {
  return <ul className="movements-list movements-skeleton" aria-label="Carregando movimentações" aria-busy="true">{[1, 2, 3, 4].map(item => <li className="movement-row" key={item}><span className="movement-skeleton-icon" /><div className="movement-skeleton-main"><span /><small /></div><span className="movement-skeleton-amount" /></li>)}</ul>
}

function MovementsPagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  return <nav className="movements-pagination" aria-label="Paginação de movimentações"><button type="button" onClick={() => onPageChange(page - 1)} disabled={page === 1} aria-label="Página anterior"><ChevronLeft size={16} /></button><span>Página {page} de {totalPages}</span><button type="button" onClick={() => onPageChange(page + 1)} disabled={page === totalPages} aria-label="Próxima página"><ChevronRight size={16} /></button></nav>
}

export default function MovementsContent({ activeTab, items, totalItems, hasItemsBeforeFilters, page, totalPages, onPageChange, loading, error, onRetry, onEdit, onDelete }) {
  return <section id="movements-panel" className="movements-content" role="tabpanel" aria-label={`Conteúdo de ${activeTab}`}>
    {loading ? <MovementsSkeleton /> : error ? <div className="movements-state" role="alert"><AlertCircle size={18} aria-hidden="true" /><strong>{error}</strong><button type="button" className="secondary" onClick={onRetry}><RefreshCw size={14} />Tentar novamente</button></div> : <>
      <div className="movements-result-count">{totalItems} {totalItems === 1 ? 'movimentação' : 'movimentações'}</div>
      {items.length ? <ul className="movements-list">{items.map(item => <MovementRow item={item} onEdit={onEdit} onDelete={onDelete} key={`${item.movementType}-${item.id}`} />)}</ul> : <div className="movements-state"><strong>{hasItemsBeforeFilters ? 'Nenhuma movimentação encontrada com estes filtros.' : 'Nenhuma movimentação registrada.'}</strong></div>}
      <MovementsPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </>}
  </section>
}
