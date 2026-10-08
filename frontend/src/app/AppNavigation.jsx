import { Menu } from 'lucide-react'

const iconProps = { size: 18, strokeWidth: 1.8, 'aria-hidden': true, focusable: false }
const Icon = ({ icon: Glyph, size }) => <Glyph {...iconProps} size={size ?? iconProps.size} />

const isActive = (item, view) => item.view === view

function NavItem({ href, label, icon: Glyph, active }) {
  return <a className={`app-nav-item${active ? ' is-active' : ''}`} href={href} aria-label={label} aria-current={active ? 'page' : undefined} data-tooltip={label}>
    <Icon icon={Glyph} size={22} />
  </a>
}

export function AppSidebar({ items, view }) {
  return <aside className="app-sidebar" aria-label="Navegação principal">
    <nav className="app-sidebar-primary">
      {items.map(item => <NavItem key={item.id} href={item.href} label={item.desktopLabel} icon={item.icon} active={isActive(item, view)} />)}
    </nav>
  </aside>
}

export function MobileNavigation({ items, view, onClose }) {
  return <div className="mobile-navigation-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <aside id="mobile-navigation" className="mobile-navigation" role="dialog" aria-modal="true" aria-label="Navegação">
      <div className="mobile-navigation-header"><span className="eyebrow">ALOCA</span><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar navegação">×</button></div>
      <nav>{items.map(item => <a key={item.id} href={item.href} className={isActive(item, view) ? 'is-active' : ''} aria-current={isActive(item, view) ? 'page' : undefined} onClick={onClose}><item.icon size={19} /><span>{item.desktopLabel}</span></a>)}</nav>
    </aside>
  </div>
}

export function MobileBottomNavigation({ items, view }) {
  return <nav className="mobile-bottom-navigation" aria-label="Navegação mobile">
    <div className="mobile-bottom-navigation-scroll">
      {items.map(item => {
        const active = isActive(item, view)
        const Glyph = item.icon
        return <a key={item.id} href={item.href} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined}>
          <Glyph size={19} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
          <span>{item.mobileLabel}</span>
        </a>
      })}
    </div>
  </nav>
}
