import { useEffect, useState } from 'react'
import { api, markAccountContextChanged } from './services/api'
import './App.css'

function App() {
  const [accountState, setAccountState] = useState(null)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [groups, setGroups] = useState([])
  const [transactions, setTransactions] = useState([])
  const [groupName, setGroupName] = useState('')
  const [transaction, setTransaction] = useState({ description: '', amount: '', type: 'Expense', date: new Date().toISOString().slice(0, 10), categoryId: '' })

  const loadSession = async () => {
    setLoading(true); setError('')
    try {
      const account = await api.account(); setAccountState(account)
      if (account.current) {
        const [nextSummary, nextGroups, nextIncome, nextExpense] = await Promise.all([api.summary(), api.categories(), api.incomes(), api.expenses()])
        setSummary(nextSummary); setGroups(nextGroups); setTransactions([...(nextIncome.items || []), ...(nextExpense.items || [])].sort((a, b) => String(b.date).localeCompare(String(a.date))))
      }
    }
    catch (cause) { setError(cause.message) } finally { setLoading(false) }
  }
  useEffect(() => { loadSession() }, [])
  const runAccountAction = async action => { setBusy(true); setError(''); try { await action(); markAccountContextChanged(); await loadSession() } catch (cause) { setError(cause.message) } finally { setBusy(false) } }
  const refreshFinance = async () => { const [nextSummary, nextGroups, nextIncome, nextExpense] = await Promise.all([api.summary(), api.categories(), api.incomes(), api.expenses()]); setSummary(nextSummary); setGroups(nextGroups); setTransactions([...(nextIncome.items || []), ...(nextExpense.items || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)))) }
  const createGroup = async event => { event.preventDefault(); setBusy(true); setError(''); try { await api.createCategory(groupName); setGroupName(''); await refreshFinance() } catch (cause) { setError(cause.message) } finally { setBusy(false) } }
  const createTransaction = async event => { event.preventDefault(); setBusy(true); setError(''); try { const body = { ...transaction, amount: Number(String(transaction.amount).replace(',', '.')), categoryId: transaction.categoryId || null }; transaction.type === 'Income' ? await api.createIncome(body) : await api.createExpense(body); setTransaction({ ...transaction, description: '', amount: '' }); await refreshFinance() } catch (cause) { setError(cause.message) } finally { setBusy(false) } }

  if (loading) return <main className="shell"><div className="state">Carregando sua sessão...</div></main>
  return <main className="shell">
    <header className="topbar"><div><span className="eyebrow">VALIDAÇÃO DO PRODUTO</span><h1>Aloca</h1></div>{accountState?.current && <span className="account-pill">{accountState.current.displayName}</span>}</header>
    {error && <div className="alert" role="alert">{error.includes('conectar') ? 'A API está indisponível. Verifique se o backend está em execução.' : error}</div>}
    {!accountState?.current ? <section className="panel welcome">
      <span className="eyebrow">PRIMEIRO ACESSO</span><h2>Vamos validar sua conta</h2><p>Esta interface é temporária e serve para confirmar os fluxos de negócio antes do frontend definitivo.</p>
      <button disabled={busy} onClick={() => runAccountAction(() => api.continueLocal())}>Continuar com conta local</button>
      <div className="divider"><span>ou entre com uma conta protegida</span></div>
      <form onSubmit={event => { event.preventDefault(); runAccountAction(() => api.login(email, password)) }}><label>E-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label><label>Senha<input type="password" value={password} onChange={event => setPassword(event.target.value)} required /></label><button className="secondary" disabled={busy}>Entrar</button></form>
    </section> : <section>
      <div className="intro"><div><span className="eyebrow">VISÃO GERAL</span><h2>Olá, {accountState.current.displayName}</h2></div><button className="secondary" disabled={busy} onClick={loadSession}>Atualizar sessão</button></div>
      <div className="metrics"><article className="metric"><span>Saldo atual</span><strong>{formatMoney(summary?.currentBalance)}</strong><small>Saldo contábil confirmado</small></article><article className="metric"><span>Entradas</span><strong>{formatMoney(summary?.totalIncome)}</strong><small>Movimentações registradas</small></article><article className="metric"><span>Despesas</span><strong>{formatMoney(summary?.totalExpense)}</strong><small>Saídas registradas</small></article></div>
      <div className="workspace"><div className="panel"><span className="eyebrow">GRUPOS</span><h3>Categorias da conta</h3><form onSubmit={createGroup} className="inline-form"><input value={groupName} onChange={event => setGroupName(event.target.value)} placeholder="Ex.: Moradia" required /><button disabled={busy}>Adicionar</button></form><div className="chips">{groups.map(group => <span className="chip" key={group.id}>{group.name}</span>)}</div></div>
      <div className="panel"><span className="eyebrow">MOVIMENTAÇÃO</span><h3>Registrar entrada ou saída</h3><form onSubmit={createTransaction}><input value={transaction.description} onChange={event => setTransaction({ ...transaction, description: event.target.value })} placeholder="Descrição" required /><div className="form-row"><input value={transaction.amount} onChange={event => setTransaction({ ...transaction, amount: event.target.value })} placeholder="Valor" inputMode="decimal" required /><select value={transaction.type} onChange={event => setTransaction({ ...transaction, type: event.target.value })}><option value="Expense">Saída</option><option value="Income">Entrada</option></select></div><div className="form-row"><input type="date" value={transaction.date} onChange={event => setTransaction({ ...transaction, date: event.target.value })} /><select value={transaction.categoryId} onChange={event => setTransaction({ ...transaction, categoryId: event.target.value })}><option value="">Sem grupo</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div><button disabled={busy}>Salvar movimentação</button></form></div></div>
      <div className="panel transactions"><span className="eyebrow">HISTÓRICO</span><h3>Últimas movimentações</h3>{transactions.length === 0 ? <p>Nenhuma movimentação registrada.</p> : <div className="transaction-list">{transactions.slice(0, 10).map(item => <div className="transaction" key={item.id}><div><strong>{item.description}</strong><small>{item.date} · {item.categoryName || 'Sem grupo'}</small></div><strong className={item.type === 'Income' ? 'income' : 'expense'}>{item.type === 'Income' ? '+' : '-'} {formatMoney(item.amount)}</strong></div>)}</div>}</div>
    </section>}
  </main>
}
const formatMoney = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
export default App
