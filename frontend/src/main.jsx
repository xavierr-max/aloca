import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { api } from './services/api'
import './styles.css'
import './balance.css'

const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0)
const errorText = error => error?.message || 'Não foi possível concluir a operação.'

function App() {
  const [summary, setSummary] = useState(null)
  const [commitments, setCommitments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState(null)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [balanceModal, setBalanceModal] = useState(false)

  const refresh = async () => {
    setLoading(true); setError('')
    try { const [nextSummary, nextCommitments] = await Promise.all([api.summary(), api.commitments()]); setSummary(nextSummary); setCommitments(nextCommitments) }
    catch (e) { setError(errorText(e)) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

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
          <Metric label="Déficit" value={money(summary?.allocationDeficit)} tone={summary?.allocationDeficit > 0 ? 'red' : 'soft'} caption={summary?.allocationDeficit > 0 ? 'Gasto acima do comprometido' : 'Nenhum déficit identificado'} />
        </section>
        <section className="section-heading"><div><span className="eyebrow">PLANEJAMENTO</span><h2>Compromissos financeiros</h2></div><button className="secondary" onClick={() => setEditing({})}>Novo compromisso</button></section>
        {commitments.length === 0 ? <div className="empty"><strong>Nenhum compromisso ainda</strong><span>Crie um compromisso para começar a organizar seu saldo.</span></div> : <div className="commitment-list">{commitments.map(item => <CommitmentCard key={item.id} item={item} onChange={refresh} onEdit={() => setEditing(item)} onDelete={() => run(() => api.deleteCommitment(item.id))} />)}</div>}
      </>}
    </main>
    {editing && <CommitmentModal item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); run(async () => {}) }} />}
    {balanceModal && <InitialBalanceModal value={summary?.initialBalance ?? 0} onClose={() => setBalanceModal(false)} onSaved={() => { setBalanceModal(false); refresh(); setNotice('Saldo inicial atualizado.') }} />}
    {modal && <DistributionModal preview={preview} onClose={() => setModal(false)} onConfirm={distribute} />}
  </div>
}

function Metric({ label, value, caption, tone = '', action }) { return <article className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{caption}</small>{action}</article> }

function InitialBalanceModal({ value, onClose, onSaved }) {
  const [amount, setAmount] = useState(String(value ?? 0)); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const save = async e => { e.preventDefault(); const numeric = Number(amount); if (!Number.isFinite(numeric) || numeric < 0) { setError('Informe um valor válido maior ou igual a zero.'); return } setSaving(true); setError(''); try { await api.updateSettings(numeric); onSaved() } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">CONFIGURAÇÃO FINANCEIRA</span><h2>{value > 0 ? 'Editar saldo inicial' : 'Informar saldo inicial'}</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div><p className="modal-copy">Informe quanto você já possui antes de registrar novas movimentações. Isso não cria uma transação.</p>{error && <div className="alert error">{error}</div>}<label>Saldo inicial<input autoFocus required type="number" min="0" step="0.01" placeholder="1500,00" value={amount} onChange={e => setAmount(e.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>Salvar saldo inicial</button></div></form></div>
}

function CommitmentCard({ item, onChange, onEdit, onDelete }) {
  const [amount, setAmount] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('')
  const progress = item.remainingAmount + item.allocatedAmount > 0 ? Math.min(100, item.allocatedAmount / (item.remainingAmount + item.allocatedAmount) * 100) : 100
  const mutate = async action => { setBusy(true); setMessage(''); try { await action(); setAmount(''); await onChange() } catch (e) { setMessage(errorText(e)) } finally { setBusy(false) } }
  const status = item.isCompleted ? ['Concluído', 'complete'] : item.isFullyCommitted ? ['Distribuição ativa', 'active'] : ['Manual', 'manual']
  return <article className="commitment-card">
    <div className="card-main"><div className="card-title"><div className="icon">{item.name.slice(0, 1).toUpperCase()}</div><div><h3>{item.name}</h3><span className={`badge ${status[1]}`}>{status[0]}</span></div></div><div className="card-actions"><button className="icon-button" onClick={onEdit} aria-label="Editar">✎</button><button className="icon-button danger-text" onClick={onDelete} aria-label="Excluir">×</button></div></div>
    <div className="card-stats"><div><span>Valor total</span><strong>{money(item.totalAmount)}</strong></div><div><span>Alocado</span><strong>{money(item.allocatedAmount)}</strong></div><div><span>Prioridade</span><strong>#{item.priority}</strong></div><div><span>Parcelas</span><strong>{item.paidInstallments}/{item.totalInstallments}</strong></div></div>
    <div className="progress-row"><div className="progress-track"><div style={{ width: `${progress}%` }} /></div><strong>{Math.round(progress)}%</strong></div>
    <div className="card-footer"><span>{item.isCompleted ? 'Compromisso concluído' : `${money(item.missingForFullCoverage)} para cobertura total`}</span><div className="allocation-form"><input type="number" min="0.01" step="0.01" placeholder="Valor" value={amount} onChange={e => setAmount(e.target.value)} /><button disabled={busy || !amount} onClick={() => mutate(() => api.allocate(item.id, amount))}>Alocar</button><button className="secondary" disabled={busy || !amount} onClick={() => mutate(() => api.deallocate(item.id, amount))}>Retirar</button></div></div>
    {message && <div className="inline-error">{message}</div>}
  </article>
}

function CommitmentModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({ name: item.name || '', installmentAmount: item.installmentAmount || '', totalInstallments: item.totalInstallments || '', priority: item.priority || 1, isFullyCommitted: item.isFullyCommitted ?? true }); const [error, setError] = useState('')
  const save = async e => { e.preventDefault(); setError(''); try { if (item.id) await api.updateCommitment(item.id, form); else await api.createCommitment(form); onSaved() } catch (e) { setError(errorText(e)) } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><span className="eyebrow">COMPROMISSO</span><h2>{item.id ? 'Editar compromisso' : 'Novo compromisso'}</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div>{error && <div className="alert error">{error}</div>}<label>Nome<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><div className="form-grid"><label>Valor da parcela<input required type="number" min="0.01" step="0.01" value={form.installmentAmount} onChange={e => setForm({ ...form, installmentAmount: Number(e.target.value) })} /></label><label>Total de parcelas<input required type="number" min="1" value={form.totalInstallments} onChange={e => setForm({ ...form, totalInstallments: Number(e.target.value) })} /></label><label>Prioridade<input required type="number" min="1" value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} /></label></div><label className="check"><input type="checkbox" checked={form.isFullyCommitted} onChange={e => setForm({ ...form, isFullyCommitted: e.target.checked })} /> Participa da distribuição automática</label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary">Salvar compromisso</button></div></form></div>
}

function DistributionModal({ preview, onClose, onConfirm }) { return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><span className="eyebrow">SIMULAÇÃO</span><h2>Distribuir saldo?</h2></div><button className="icon-button" onClick={onClose}>×</button></div><p className="modal-copy">O Aloca vai reservar <strong>{money(preview?.wouldAllocate)}</strong> seguindo a prioridade dos compromissos ativos.</p><div className="preview-list">{preview?.allocations?.length ? preview.allocations.map(x => <div key={x.financialCommitmentId}><span>{x.name}</span><strong>{money(x.amount)}</strong></div>) : <div className="empty small">Nenhuma nova alocação necessária.</div>}</div><div className="preview-total"><span>Saldo livre após</span><strong>{money(preview?.remainingFreeBalance)}</strong></div><div className="modal-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" onClick={onConfirm} disabled={!preview?.wouldAllocate}>Confirmar distribuição</button></div></div></div> }

createRoot(document.getElementById('root')).render(<App />)
