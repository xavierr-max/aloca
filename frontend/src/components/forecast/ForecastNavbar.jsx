import { Bell, Search } from 'lucide-react'
import { Link } from './ForecastNavbarLink.jsx'

export default function ForecastNavbar({ account }) {
  const displayName = account?.displayName || 'Sua conta'
  return <header className="forecast-navbar"><a className="forecast-brand" href="#previsoes"><span className="forecast-brand-mark">◔</span><strong>Aloca</strong><b>BETA</b></a><nav aria-label="Navegação principal" className="forecast-nav-links"><Link href="#dashboard">Visão geral</Link><Link href="#movimentacoes">Movimentações</Link><Link href="#compromissos">Compromissos</Link><Link href="#grupos">Grupos</Link></nav><div className="forecast-navbar-actions"><label className="forecast-search"><Search size={17} /><input aria-label="Buscar transação" placeholder="Buscar transação..." /></label><button type="button" className="forecast-notification" aria-label="Notificações"><Bell size={18} /></button><a className="forecast-account" href="#perfil"><span>{displayName.slice(0, 1).toUpperCase()}</span><div><strong>{displayName}</strong><small>{account?.isLocal ? 'Conta local' : 'Conta protegida'}</small></div><b>⌄</b></a></div></header>
}
