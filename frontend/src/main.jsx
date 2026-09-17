import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { api } from './services/api'
import './styles.css'
import './balance.css'
import './payment.css'

const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0)
const errorText = error => error?.message || 'Não foi possível concluir a operação.'
const parseAmount = value => { const normalized = String(value).trim().replace(',', '.'); if (!normalized || !/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN; return Number(normalized) }

function App() {
  const [summary, setSummary] = useState(null)
  const [commitments, setCommitments] = useState([])
  const [categories, setCategories] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ category: '', priority: '', status: '', coverage: '', payment: '', deficit: false, payable: false, sort: 'priority' })
  const [collapsed, setCollapsed] = useState({})
  const [categoryDialog, setCategoryDialog] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState(null)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [balanceModal, setBalanceModal] = useState(false)

  const refresh = async () => {
    setLoading(true); setError('')
    try { const [nextSummary, nextCommitments, nextCategories] = await Promise.all([api.summary(), api.commitments(), api.categories()]); setSummary(nextSummary); setCommitments(nextCommitments); setCategories(nextCategories) }
    catch (e) { setError(errorText(e)) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])
  useEffect(() => { const timer = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 250); return () => clearTimeout(timer) }, [searchInput])

  const filtered = commitments.filter(item => {
    const coverage = item.remainingInstallments === 0 ? 'full' : item.allocatedAmount <= 0 ? 'none' : item.allocatedAmount >= item.installmentAmount ? 'next' : 'partial'
    const payment = item.paidInstallments === 0 ? 'none' : item.isCompleted ? 'done' : 'progress'
    return (!search || item.name.toLowerCase().includes(search)) && (!filters.category || item.categoryId === filters.category) && (!filters.priority || String(item.priority) === filters.priority) && (!filters.status || (filters.status === 'completed' ? item.isCompleted : !item.isCompleted)) && (!filters.coverage || coverage === filters.coverage) && (!filters.payment || payment === filters.payment) && (!filters.deficit || item.missingForFullCoverage > 0) && (!filters.payable || item.allocatedAmount >= item.installmentAmount && !item.isCompleted)
  }).sort((a, b) => { const c = a.categoryName || 'Sem categoria'; const d = b.categoryName || 'Sem categoria'; if (filters.sort === 'name') return a.name.localeCompare(b.name); if (filters.sort === 'total') return b.totalAmount - a.totalAmount; if (filters.sort === 'remaining') return b.remainingAmount - a.remainingAmount; if (filters.sort === 'next') return a.missingForNextInstallment - b.missingForNextInstallment; if (filters.sort === 'progress') return (b.paidInstallments / b.totalInstallments) - (a.paidInstallments / a.totalInstallments); if (filters.sort === 'category') return c.localeCompare(d) || a.name.localeCompare(b.name); return a.priority - b.priority || a.name.localeCompare(b.name) })
  const groups = filtered.reduce((acc, item) => { const key = item.categoryId || 'none'; (acc[key] ||= []).push(item); return acc }, {})
  const clearFilters = () => { setSearchInput(''); setFilters({ category: '', priority: '', status: '', coverage: '', payment: '', deficit: false, payable: false, sort: 'priority' }) }
  const editCategory = category => setCategoryDialog(category)
  const deleteCategory = category => setDeleteDialog(category)

  const run = async action => { setError(''); setNotice(''); try { await action(); await refresh(); setNotice('Alterações salvas com sucesso.') } catch (e) { setError(errorText(e)) } }
  const openDistribution = async () => { setError(''); try { setPreview(await api.preview()); setModal(true) } catch (e) { setError(errorText(e)) } }
  const distribute = () => run(async () => { await api.distribute(); setModal(false); setPreview(null) })

  return <div className="app-shell">
    <header className="topbar"><div><span className="eyebrow">CONTROLE FINANCEIRO</span><h1>Aloca</h1></div><button className="primary" onClick={openDistribution}>Distribuir saldo</button></header>
    <main>
      {error && <div className="alert error">{error}</div>}{notice && <div className="alert success">{notice}</div>}
      <section className="hero"><div><span className="eyebrow">VISÃO GERAL</span><h2>Seu dinheiro, com destino claro.</h2><p>O saldo livre considera tudo que já está virtualmente comprometido.</p></div><div className="hero-mark">↗</div></section>
      {loading ? <div className="loading">Carregando sua vida financeira…</div> : <>
        <section className="summary-grid">
          <Metric label="Saldo real" value={money(summary?.balance)} tone="dark" caption={`Entradas ${money(summary?.totalIncome)} · Saídas ${money(summary?.totalExpense)}`} action={<button className="metric-action" onClick={() => setBalanceModal(true)}>{summary?.initialBalance > 0 ? 'Editar saldo inicial' : 'Informar saldo inicial'}</button>} />
          <Metric label="Comprometido" value={money(summary?.allocatedAmount)} caption="Reservas virtuais ativas" />
          <Metric label="Saldo livre" value={money(summary?.freeBalance)} tone="green" caption="Disponível para novas alocações" />
          <Metric label="Déficit de cobertura" value={money(summary?.allocationDeficit)} tone={summary?.allocationDeficit > 0 ? 'red' : 'soft'} caption={summary?.allocationDeficit > 0 ? 'Valor que ainda falta reservar.' : 'Todos os compromissos estão cobertos'} />
        </section>
        <section className="section-heading"><div><span className="eyebrow">PLANEJAMENTO</span><h2>Compromissos financeiros</h2><small>{filtered.length} de {commitments.length} encontrados</small></div><button className="secondary" onClick={() => setEditing({})}>Novo compromisso</button></section>
        <CommitmentFilters search={searchInput} setSearch={setSearchInput} filters={filters} setFilters={setFilters} categories={categories} onClear={clearFilters} onEditCategory={editCategory} onDeleteCategory={deleteCategory} onCreateCategory={async name => { await api.createCategory(name); await refresh() }} />
        {commitments.length === 0 ? <div className="empty"><strong>Nenhum compromisso ainda</strong><span>Crie um compromisso para começar a organizar seu saldo.</span></div> : filtered.length === 0 ? <div className="empty"><strong>Nenhum resultado encontrado</strong><span>Ajuste os filtros ou limpe a busca.</span></div> : <div className="commitment-groups">{Object.entries(groups).map(([key, items]) => { const category = categories.find(x => x.id === key); const pending = items.reduce((sum, x) => sum + x.remainingAmount, 0); return <section className="commitment-group" key={key}><button className="group-header" onClick={() => setCollapsed(x => ({ ...x, [key]: !x[key] }))}><span><strong>{category?.name || 'Sem categoria'}</strong><small>{items.length} compromisso(s) · {money(pending)} pendente</small></span><span>{collapsed[key] ? '＋' : '−'}</span></button>{!collapsed[key] && <div className="commitment-list">{items.map(item => <CommitmentCard key={item.id} item={item} availableBalance={summary?.freeBalance ?? 0} categories={categories} onChange={refresh} onEdit={() => setEditing(item)} onDelete={() => run(() => api.deleteCommitment(item.id))} />)}</div>}</section> })}</div>}
      </>}
    </main>
    {editing && <CommitmentModal item={editing} categories={categories} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); run(async () => {}) }} />}
    {balanceModal && <InitialBalanceModal value={summary?.initialBalance ?? 0} onClose={() => setBalanceModal(false)} onSaved={() => { setBalanceModal(false); refresh(); setNotice('Saldo inicial atualizado.') }} />}
    {modal && <DistributionModal preview={preview} onClose={() => setModal(false)} onConfirm={distribute} />}
    {categoryDialog && <CategoryModal category={categoryDialog} onClose={() => setCategoryDialog(null)} onSaved={() => { setCategoryDialog(null); run(async () => {}) }} />}
    {deleteDialog && <ConfirmModal title="Excluir categoria?" message={`A categoria ${deleteDialog.name} será removida. Compromissos vinculados ficarão sem categoria.`} onClose={() => setDeleteDialog(null)} onConfirm={() => run(async () => { await api.deleteCategory(deleteDialog.id); setDeleteDialog(null) })} />}
  </div>
}

function Metric({ label, value, caption, tone = '', action }) { return <article className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{caption}</small>{action}</article> }

function InitialBalanceModal({ value, onClose, onSaved }) {
  const [amount, setAmount] = useState(String(value ?? 0)); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const save = async e => { e.preventDefault(); const numeric = Number(amount); if (!Number.isFinite(numeric) || numeric < 0) { setError('Informe um valor válido maior ou igual a zero.'); return } setSaving(true); setError(''); try { await api.updateSettings(numeric); onSaved() } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">CONFIGURAÇÃO FINANCEIRA</span><h2>{value > 0 ? 'Editar saldo inicial' : 'Informar saldo inicial'}</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div><p className="modal-copy">Informe quanto você já possui antes de registrar novas movimentações. Isso não cria uma transação.</p>{error && <div className="alert error">{error}</div>}<label>Saldo inicial<input autoFocus required type="number" min="0" step="0.01" placeholder="1500,00" value={amount} onChange={e => setAmount(e.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>Salvar saldo inicial</button></div></form></div>
}

function CategoryModal({ category, onClose, onSaved }) { const [name, setName] = useState(category?.name || ''); const [error, setError] = useState(''); const save = async e => { e.preventDefault(); if (!name.trim()) { setError('Informe o nome da categoria.'); return } try { await api.updateCategory(category.id, name.trim()); onSaved() } catch (e) { setError(errorText(e)) } }; return <div className="modal-backdrop"><form className="modal" onSubmit={save}><h2>Editar categoria</h2>{error && <div className="alert error">{error}</div>}<label>Nome<input autoFocus value={name} onChange={e => setName(e.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary">Salvar</button></div></form></div> }
function ConfirmModal({ title, message, onClose, onConfirm }) { return <div className="modal-backdrop"><div className="modal"><h2>{title}</h2><p className="modal-copy">{message}</p><div className="modal-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" onClick={onConfirm}>Confirmar</button></div></div></div> }

function CommitmentFilters({ search, setSearch, filters, setFilters, categories, onClear, onEditCategory, onDeleteCategory, onCreateCategory }) {
  const [createOpen, setCreateOpen] = useState(false)
  const update = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  return <><div className="filters-panel"><input aria-label="Pesquisar compromissos" placeholder="Pesquisar por nome..." value={search} onChange={e => setSearch(e.target.value)} /><select value={filters.category} onChange={e => update('category', e.target.value)}><option value="">Todas as categorias</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select><button className="secondary" onClick={() => setCreateOpen(true)}>Nova categoria</button><select value={filters.priority} onChange={e => update('priority', e.target.value)}><option value="">Prioridade</option><option value="1">Alta</option><option value="2">Média</option><option value="3">Baixa</option></select><select value={filters.status} onChange={e => update('status', e.target.value)}><option value="">Status</option><option value="active">Ativos</option><option value="completed">Concluídos</option></select><select value={filters.coverage} onChange={e => update('coverage', e.target.value)}><option value="">Cobertura</option><option value="none">Sem reserva</option><option value="partial">Parcial</option><option value="next">Próxima parcela coberta</option><option value="full">Totalmente reservado</option></select><select value={filters.payment} onChange={e => update('payment', e.target.value)}><option value="">Pagamento</option><option value="none">Não iniciado</option><option value="progress">Em andamento</option><option value="done">Quitado</option></select><select value={filters.sort} onChange={e => update('sort', e.target.value)}><option value="priority">Ordenar: prioridade</option><option value="name">Ordenar: nome</option><option value="total">Ordenar: valor total</option><option value="remaining">Ordenar: valor restante</option><option value="next">Ordenar: próxima parcela</option><option value="progress">Ordenar: progresso</option><option value="category">Ordenar: categoria</option></select><label className="filter-check"><input type="checkbox" checked={filters.deficit} onChange={e => update('deficit', e.target.checked)} /> Com déficit</label><label className="filter-check"><input type="checkbox" checked={filters.payable} onChange={e => update('payable', e.target.checked)} /> Aptos para pagar</label><button className="secondary" onClick={onClear}>Limpar filtros</button><div className="category-tools">{categories.map(category => <span key={category.id}>{category.name}<button onClick={() => onEditCategory(category)} aria-label={`Editar ${category.name}`}>✎</button><button onClick={() => onDeleteCategory(category)} aria-label={`Excluir ${category.name}`}>×</button></span>)}</div></div>{createOpen && <CategoryCreateModal onClose={() => setCreateOpen(false)} onSaved={async name => { await onCreateCategory(name); setCreateOpen(false) }} />}</>
}

function CategoryCreateModal({ onClose, onSaved }) { const [name, setName] = useState(''); const [error, setError] = useState(''); const save = async e => { e.preventDefault(); if (!name.trim()) { setError('Informe o nome da categoria.'); return } try { await onSaved(name.trim()) } catch (e) { setError(errorText(e)) } }; return <div className="modal-backdrop"><form className="modal" onSubmit={save}><h2>Nova categoria</h2>{error && <div className="alert error">{error}</div>}<label>Nome<input autoFocus value={name} onChange={e => setName(e.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary">Criar</button></div></form></div> }

function CommitmentCard({ item, availableBalance, categories, onChange, onEdit, onDelete }) {
  const [amount, setAmount] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('')
  const coverage = item.remainingInstallments > 0 ? Math.min(100, item.allocatedAmount / item.installmentAmount * 100) : 100
  const paymentProgress = item.totalInstallments > 0 ? item.paidInstallments / item.totalInstallments * 100 : 100
  const mutate = async action => { setBusy(true); setMessage(''); try { await action(); setAmount(''); await onChange() } catch (e) { setMessage(errorText(e)) } finally { setBusy(false) } }
  const status = item.isCompleted ? ['Concluído', 'complete'] : item.isFullyCommitted ? ['Distribuição ativa', 'active'] : ['Manual', 'manual']
  return <article className="commitment-card">
    <div className="card-main"><div className="card-title"><div className="icon">{item.name.slice(0, 1).toUpperCase()}</div><div><h3>{item.name}</h3><span className={`badge ${status[1]}`}>{status[0]}</span>{item.categoryName && <span className="category-label">{item.categoryName}</span>}</div></div><div className="card-actions"><button className="icon-button" onClick={onEdit} aria-label="Editar">✎</button><button className="icon-button danger-text" onClick={onDelete} aria-label="Excluir">×</button></div></div>
    <div className="card-stats"><div><span>Valor total</span><strong>{money(item.totalAmount)}</strong><small>{money(item.installmentAmount)} / parcela</small></div><div><span>Alocado</span><strong>{money(item.allocatedAmount)}</strong></div><div><span>Prioridade</span><strong>{item.priorityLabel || ['Indefinida', 'Alta', 'Média', 'Baixa'][item.priority]}</strong></div><div><span>Parcelas pagas</span><strong>{item.paidInstallments}/{item.totalInstallments}</strong><small>{Math.round(paymentProgress)}% pagamento</small></div></div>
    <div className="progress-label"><span>Cobertura da próxima parcela</span><strong>{Math.round(coverage)}%</strong></div><div className="progress-row"><div className="progress-track"><div style={{ width: `${coverage}%` }} /></div></div><div className="total-progress"><span>Progresso total</span><strong>{item.paidInstallments}/{item.totalInstallments} parcelas • {Math.round(paymentProgress)}%</strong><div className="mini-track"><div style={{ width: `${paymentProgress}%` }} /></div></div>
    <div className="card-footer"><div className="reserve-section"><strong>Reserva</strong><span>{money(item.remainingAmount)} restantes · {money(item.missingForFullCoverage)} para cobertura</span><div className="allocation-form"><input type="number" min="0.01" step="0.01" placeholder="Valor" value={amount} onChange={e => setAmount(e.target.value)} /><button disabled={busy || !amount || item.missingForFullCoverage <= 0} onClick={() => mutate(() => api.allocate(item.id, amount))}>Alocar</button><button disabled={busy || item.missingForFullCoverage <= 0 || availableBalance <= 0} onClick={() => mutate(() => api.allocate(item.id, Math.min(item.missingForFullCoverage, availableBalance)))}>Completar reserva</button></div><button className="secondary withdraw-button" disabled={busy || !amount || item.allocatedAmount <= 0} onClick={() => mutate(() => api.deallocate(item.id, amount))}>Retirar</button></div><div className="payment-section"><strong>Próxima parcela: {money(item.installmentAmount)}</strong>{item.isCompleted ? <span>Compromisso concluído</span> : item.allocatedAmount >= item.installmentAmount ? <span className="payment-ready">Reserva suficiente para pagar</span> : <span className="payment-hint">Faltam {money(item.installmentAmount - item.allocatedAmount)} para pagar</span>}<button className="pay-button" disabled={busy || item.isCompleted || item.allocatedAmount < item.installmentAmount} onClick={() => mutate(() => api.payInstallment(item.id))}>Marcar parcela como paga</button></div></div>
    {message && <div className="inline-error">{message}</div>}
  </article>
}

function CommitmentModal({ item, categories, onClose, onSaved }) {
  const [form, setForm] = useState({ name: item.name || '', installmentAmount: item.installmentAmount || '', totalInstallments: item.totalInstallments || '', priority: item.priority || 1, categoryId: item.categoryId || '', isFullyCommitted: item.isFullyCommitted ?? true }); const [error, setError] = useState('')
  const save = async e => { e.preventDefault(); setError(''); const installmentAmount = parseAmount(form.installmentAmount); const totalInstallments = Number(form.totalInstallments); if (!form.name.trim()) return setError('Informe o nome do compromisso.'); if (!Number.isFinite(installmentAmount) || installmentAmount <= 0) return setError('Informe um valor de parcela válido, como 0,05.'); if (!Number.isInteger(totalInstallments) || totalInstallments <= 0) return setError('Informe o total de parcelas.'); const payload = { name: form.name.trim(), installmentAmount, totalInstallments, priority: Number(form.priority), isFullyCommitted: form.isFullyCommitted, categoryId: form.categoryId || null }; try { if (item.id) await api.updateCommitment(item.id, payload); else await api.createCommitment(payload); onSaved() } catch (e) { setError(errorText(e)) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">COMPROMISSO</span><h2>{item.id ? 'Editar compromisso' : 'Novo compromisso'}</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div>{error && <div className="alert error">{error}</div>}<label>Nome<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><div className="form-grid"><label>Valor da parcela<input required inputMode="decimal" placeholder="0,05" value={form.installmentAmount} onChange={e => setForm({ ...form, installmentAmount: e.target.value })} /></label><label>Total de parcelas<input required inputMode="numeric" value={form.totalInstallments} onChange={e => setForm({ ...form, totalInstallments: e.target.value.replace(/\D/g, '') })} /></label><label>Prioridade<select required value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })}><option value="1">Alta</option><option value="2">Média</option><option value="3">Baixa</option></select></label><label>Categoria<select value={form.categoryId || ''} onChange={e => setForm({ ...form, categoryId: e.target.value || null })}><option value="">Sem categoria</option>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div><label className="check"><input type="checkbox" checked={form.isFullyCommitted} onChange={e => setForm({ ...form, isFullyCommitted: e.target.checked })} /> Participa da distribuição automática</label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary">Salvar compromisso</button></div></form></div>
}

function DistributionModal({ preview, onClose, onConfirm }) { return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><span className="eyebrow">SIMULAÇÃO</span><h2>Distribuir saldo?</h2></div><button className="icon-button" onClick={onClose}>×</button></div><p className="modal-copy">O Aloca vai reservar <strong>{money(preview?.wouldAllocate)}</strong> seguindo a prioridade dos compromissos ativos.</p><div className="preview-list">{preview?.allocations?.length ? preview.allocations.map(x => <div key={x.financialCommitmentId}><span>{x.name}</span><strong>{money(x.amount)}</strong></div>) : <div className="empty small">Nenhuma nova alocação necessária.</div>}</div><div className="preview-total"><span>Saldo livre após</span><strong>{money(preview?.remainingFreeBalance)}</strong></div><div className="modal-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" onClick={onConfirm} disabled={!preview?.wouldAllocate}>Confirmar distribuição</button></div></div></div> }

createRoot(document.getElementById('root')).render(<App />)
