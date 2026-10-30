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

  const loadSession = async () => {
    setLoading(true); setError('')
    try { const account = await api.account(); setAccountState(account); if (account.current) setSummary(await api.summary()) }
    catch (cause) { setError(cause.message) } finally { setLoading(false) }
  }
  useEffect(() => { loadSession() }, [])
  const runAccountAction = async action => { setBusy(true); setError(''); try { await action(); markAccountContextChanged(); await loadSession() } catch (cause) { setError(cause.message) } finally { setBusy(false) } }

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
      <div className="panel checklist"><span className="eyebrow">PRÓXIMAS VALIDAÇÕES</span><h3>Núcleo financeiro preparado</h3><p>Use esta base para validar grupos, movimentações, recorrências, compromissos e pagamentos conforme os contratos da API.</p><ul><li>Sessão e isolamento por conta</li><li>Resumo financeiro e saldo atual</li><li>Próxima tela: grupos e transações</li></ul></div>
    </section>}
  </main>
}
const formatMoney = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
export default App
