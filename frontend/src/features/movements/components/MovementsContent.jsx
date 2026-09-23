import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, ArrowDownLeft, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Link2, MoreHorizontal, Pencil, RefreshCw, Trash2, Zap } from 'lucide-react'

const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
const formatDate = value => {
  const [year, month, day] = String(value || '').slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return 'Sem data'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day)).replace('.', '')
}

function MovementRow({ item, onEdit, onDelete, onManage }) {
  const income = item.movementType === 'income'
  const [open, setOpen] = useState(false)
  const actionsRef = useRef(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const [menuPosition, setMenuPosition] = useState(null)
  const menuKey = `${item.movementType}-${item.id}`
  useEffect(() => {
    if (!open) return undefined
    const close = event => { if (event.type === 'movement-menu-open' && event.detail !== menuKey) { setOpen(false); return } if (event.key === 'Escape' || (event.type === 'mousedown' && !actionsRef.current?.contains(event.target) && !menuRef.current?.contains(event.target))) setOpen(false) }
    document.addEventListener('keydown', close)
    document.addEventListener('mousedown', close)
    document.addEventListener('movement-menu-open', close)
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('mousedown', close); document.removeEventListener('movement-menu-open', close) }
  }, [open, menuKey])
  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) return undefined
    const updatePosition = () => {
      const button = buttonRef.current.getBoundingClientRect()
      const menu = menuRef.current.getBoundingClientRect()
      const gap = 5
      const edge = 8
      const opensBelow = window.innerHeight - button.bottom >= menu.height + gap || button.top < menu.height + gap
      const top = opensBelow ? button.bottom + gap : button.top - menu.height - gap
      const left = Math.max(edge, Math.min(button.right - menu.width, window.innerWidth - menu.width - edge))
      setMenuPosition({ top: Math.max(edge, Math.min(top, window.innerHeight - menu.height - edge)), left })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => { window.removeEventListener('resize', updatePosition); window.removeEventListener('scroll', updatePosition, true) }
  }, [open])
  const toggle = () => { if (!open) document.dispatchEvent(new CustomEvent('movement-menu-open', { detail: menuKey })); setOpen(value => !value) }
  const menu = open && typeof document !== 'undefined' ? createPortal(<div ref={menuRef} className="movement-actions-menu" role="menu" style={menuPosition ? { top: menuPosition.top, left: menuPosition.left } : { top: 0, left: 0, visibility: 'hidden' }}>{item.isRecurringDefinition && <button type="button" role="menuitem" onClick={() => { setOpen(false); onManage(item) }}><RefreshCw size={14} />Gerenciar</button>}<button type="button" role="menuitem" onClick={() => { setOpen(false); onEdit(item) }}><Pencil size={14} />Editar</button><button type="button" role="menuitem" onClick={() => { setOpen(false); onDelete(item) }}><Trash2 size={14} />Excluir</button></div>, document.body) : null
  return <li className={`movement-row${item.isRecurringDefinition ? ' is-recurring-definition' : ''}`}>
    <span className={`movement-type-icon is-${item.movementType}`} aria-hidden="true">{income ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span>
    <div className="movement-main"><strong title={item.description}>{item.description}</strong><div className="movement-meta"><span>{item.categoryName || 'Sem grupo'}</span><span><CalendarDays size={12} aria-hidden="true" />{formatDate(item.date)}</span>{item.wasAutomatic && <span className="movement-badge"><Zap size={11} aria-hidden="true" />Automática</span>}{item.isRecurring && <span className="movement-badge"><RefreshCw size={11} aria-hidden="true" />Recorrente</span>}{item.financialCommitmentId && <span className="movement-badge"><Link2 size={11} aria-hidden="true" />Compromisso</span>}</div></div>
    <strong className={`movement-amount is-${item.movementType}`}>{income ? '+' : '-'} {money(item.amount)}</strong>
    <div className={`movement-actions${open ? ' is-open' : ''}`} ref={actionsRef}><button ref={buttonRef} type="button" className="movement-actions-button" aria-label={`Ações para ${item.description}`} aria-haspopup="menu" aria-expanded={open} onClick={toggle}><MoreHorizontal size={18} /></button></div>{menu}
  </li>
}

function MovementsSkeleton() {
  return <ul className="movements-list movements-skeleton" aria-label="Carregando movimentações" aria-busy="true">{[1, 2, 3, 4].map(item => <li className="movement-row" key={item}><span className="movement-skeleton-icon" /><div className="movement-skeleton-main"><span /><small /></div><span className="movement-skeleton-amount" /></li>)}</ul>
}

function MovementsPagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  return <nav className="movements-pagination" aria-label="Paginação de movimentações"><button type="button" onClick={() => onPageChange(page - 1)} disabled={page === 1} aria-label="Página anterior"><ChevronLeft size={16} /></button><span>Página {page} de {totalPages}</span><button type="button" onClick={() => onPageChange(page + 1)} disabled={page === totalPages} aria-label="Próxima página"><ChevronRight size={16} /></button></nav>
}

export default function MovementsContent({ activeTab, items, totalItems, hasItemsBeforeFilters, page, totalPages, onPageChange, loading, error, onRetry, onEdit, onDelete, onManage }) {
  return <section id="movements-panel" className="movements-content" role="tabpanel" aria-label={`Conteúdo de ${activeTab}`}>
    {loading ? <MovementsSkeleton /> : error ? <div className="movements-state" role="alert"><AlertCircle size={18} aria-hidden="true" /><strong>{error}</strong><button type="button" className="secondary" onClick={onRetry}><RefreshCw size={14} />Tentar novamente</button></div> : <>
      <div className="movements-result-count">{totalItems} {activeTab === 'recurring' ? (totalItems === 1 ? 'recorrência' : 'recorrências') : (totalItems === 1 ? 'movimentação' : 'movimentações')}</div>
      {items.length ? <ul className="movements-list">{items.map(item => <MovementRow item={item} onEdit={onEdit} onDelete={onDelete} onManage={onManage} key={`${item.movementType}-${item.id}`} />)}</ul> : <div className="movements-state"><strong>{hasItemsBeforeFilters ? 'Nenhuma movimentação encontrada com estes filtros.' : 'Nenhuma movimentação registrada.'}</strong></div>}
      <MovementsPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </>}
  </section>
}
