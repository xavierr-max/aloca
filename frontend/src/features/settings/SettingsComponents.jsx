import React, { useEffect, useRef, useState } from 'react'
import { Camera, ChevronRight, Info, LifeBuoy, Mail, Pencil, Plus, Settings, ShieldCheck, TriangleAlert, UserCircle, Users } from 'lucide-react'
import { api } from '../../services/api'
import { APP_VERSION } from '../../appVersion'
import ModalLayer from '../../components/ModalLayer.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { errorText } from '../../utils/financial.js'

export function AccountDialog({ mode, initialDisplayName = '', initialEmail = '', onClose, onSubmit, onForgotPassword }) {
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const title = mode === 'protect' ? 'Proteger conta' : mode === 'login' ? 'Entrar em conta protegida' : mode === 'password' ? 'Alterar senha' : 'Renomear conta'
  const submit = async event => { event.preventDefault(); setError(''); if ((mode === 'protect' || mode === 'login' || mode === 'password') && !password.trim()) return setError('Informe a senha.'); if ((mode === 'protect' || mode === 'password') && password !== confirmPassword) return setError('As senhas não conferem.'); if ((mode === 'protect' || mode === 'rename') && !displayName.trim()) return setError('Informe o nome da conta.'); if ((mode === 'login' || mode === 'protect') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Informe um e-mail válido.'); setBusy(true); try { await onSubmit(mode, { displayName, email, password, confirmPassword, currentPassword }); } catch (e) { setError(errorText(e)) } finally { setBusy(false) } }
  if (mode === 'add') return <ModalLayer onClose={onClose}><div className="modal-head"><div><span className="eyebrow">CONTAS</span><h2>Adicionar conta</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div><p className="modal-copy">Continue localmente sem cadastro ou entre em uma conta protegida existente.</p><div className="account-add-options"><button type="button" className="secondary" onClick={() => onSubmit('create-local', {})} disabled={busy}>Continuar localmente</button><button type="button" className="primary" onClick={() => onSubmit('login-form', {})} disabled={busy}>Entrar em conta protegida</button></div>{error && <div className="alert error">{error}</div>}</ModalLayer>
  return <ModalLayer onClose={onClose}><form onSubmit={submit}><div className="modal-head"><div><span className="eyebrow">CONTAS</span><h2>{title}</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div>{mode === 'login' && <p className="modal-copy">Use o e-mail e a senha da conta protegida para acessar os dados financeiros existentes.</p>}{mode === 'protect' && <p className="modal-copy">A conta atual será protegida sem criar uma nova conta nem alterar seus dados financeiros.</p>}{error && <div className="alert error">{error}</div>}{(mode === 'protect' || mode === 'rename') && <label>Nome da conta<input autoFocus value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength="80" /></label>}{(mode === 'protect' || mode === 'login') && <label>E-mail<input type="email" autoFocus={mode === 'login'} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength="254" /></label>}{mode === 'password' && <label>Senha atual<input autoFocus type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label>}{(mode === 'protect' || mode === 'login' || mode === 'password') && <label>{mode === 'password' ? 'Nova senha' : 'Senha'}<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>}{mode === 'login' && <button type="button" className="recovery-link" onClick={onForgotPassword} disabled={busy}>Esqueci minha senha</button>}{(mode === 'protect' || mode === 'password') && <label>Confirmar senha<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>}{mode === 'protect' && <small className="field-hint">Use este e-mail e senha para entrar novamente em sua conta protegida.</small>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button><button type="submit" className="primary" disabled={busy}>{busy ? 'Processando…' : mode === 'login' ? 'Entrar' : mode === 'protect' ? 'Proteger conta' : mode === 'password' ? 'Alterar senha' : 'Renomear'}</button></div></form></ModalLayer>
}

export function PasswordRecoveryPage({ initialToken = '', onBack = null }) {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState(initialToken)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(initialToken ? 'reset' : 'request')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialToken && window.location.pathname === '/reset-password')
      window.history.replaceState({}, '', '/reset-password')
  }, [initialToken])

  const returnToLogin = () => {
    if (onBack) { onBack(); return }
    window.history.pushState({}, '', '/?openLogin=1')
    window.location.reload()
  }
  const submitRequest = async event => {
    event.preventDefault()
    if (busy) return
    const normalized = email.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) { setError('Informe um e-mail válido.'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      await api.requestPasswordRecovery(normalized)
      setStatus('requested')
      setMessage('Se existir uma conta protegida para este e-mail, a solicitação de recuperação será processada.')
    } catch (e) { setError(e?.status === 429 ? 'Aguarde alguns instantes antes de tentar novamente.' : errorText(e)) } finally { setBusy(false) }
  }
  const submitReset = async event => {
    event.preventDefault()
    if (busy) return
    if (!token) { setError('O link de recuperação é inválido ou expirou.'); return }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) { setError('A senha deve ter pelo menos 8 caracteres, com letra maiúscula, minúscula e número.'); return }
    if (password !== confirmPassword) { setError('As senhas não conferem.'); return }
    setBusy(true); setError('')
    try {
      await api.resetPassword(token, password, confirmPassword)
      setToken(''); setPassword(''); setConfirmPassword(''); setStatus('reset-success')
      window.history.replaceState({}, '', '/reset-password')
    } catch (e) { setError(e?.status === 429 ? 'Aguarde alguns instantes antes de tentar novamente.' : e?.status === 400 ? 'O link de recuperação é inválido ou expirou.' : errorText(e)) } finally { setBusy(false) }
  }
  return <main className="recovery-page"><section className="recovery-card" aria-labelledby="recovery-title"><div className="recovery-brand">Aloca <span>beta</span></div>{status === 'request' && <><h1 id="recovery-title">Recuperar acesso</h1><p className="recovery-copy">Informe o e-mail da sua conta protegida. Se houver uma conta, enviaremos as instruções para recuperar o acesso.</p><form onSubmit={submitRequest} className="recovery-form"><label htmlFor="recovery-email">E-mail<input id="recovery-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} maxLength="254" autoFocus /></label>{error && <div className="alert error" role="alert">{error}</div>}<button type="submit" className="primary" disabled={busy}>{busy ? 'Processando…' : 'Solicitar recuperação'}</button></form><button type="button" className="recovery-back" onClick={returnToLogin}>Voltar ao login</button></>}{status === 'requested' && <><div className="recovery-success-icon" aria-hidden="true">✓</div><h1 id="recovery-title">Verifique seu e-mail</h1><p className="recovery-copy" role="status">{message}</p><p className="recovery-muted">Se a mensagem não chegar, confira o endereço informado e a pasta de spam.</p><button type="button" className="primary recovery-full-button" onClick={returnToLogin}>Voltar ao login</button></>}{status === 'reset' && <><h1 id="recovery-title">Criar nova senha</h1><p className="recovery-copy">Escolha uma nova senha para voltar a acessar sua conta protegida.</p><form onSubmit={submitReset} className="recovery-form"><label htmlFor="recovery-password">Nova senha<div className="password-field"><input id="recovery-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} autoFocus /><button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></div></label><label htmlFor="recovery-confirm-password">Confirmar nova senha<input id="recovery-confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label><small className="recovery-password-hint">Use pelo menos 8 caracteres, com letra maiúscula, minúscula e número.</small>{error && <div className="alert error" role="alert">{error}</div>}<button type="submit" className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Confirmar redefinição'}</button></form><button type="button" className="recovery-back" onClick={returnToLogin}>Solicitar outro link</button></>}{status === 'reset-success' && <><div className="recovery-success-icon" aria-hidden="true">✓</div><h1 id="recovery-title">Senha redefinida</h1><p className="recovery-copy" role="status">Sua senha foi alterada com sucesso. Entre novamente para acessar sua conta.</p><button type="button" className="primary recovery-full-button" onClick={returnToLogin}>Voltar ao login</button></>}</section></main>
}

export function AccountDeleteModal({ displayName, isLocal, onClose, onConfirm }) {
  const [confirmation, setConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const expected = isLocal ? 'APAGAR MINHA CONTA' : displayName
  const submit = async event => { event.preventDefault(); if (busy) return; setError(''); if (confirmation.trim() !== expected) return setError(`Digite exatamente ${expected} para confirmar.`); if (!isLocal && !password) return setError('Informe a senha atual da conta.'); setBusy(true); try { await onConfirm({ confirmation, password: isLocal ? undefined : password }) } catch (e) { setError(errorText(e)); setBusy(false) } }
  return <ModalLayer onClose={() => { if (!busy) onClose() }}><form onSubmit={submit}><div className="modal-head"><div><span className="eyebrow">AÇÃO DESTRUTIVA</span><h2>Excluir conta</h2></div><button type="button" className="icon-button" onClick={onClose} disabled={busy}>×</button></div><p className="modal-copy">Excluir esta conta apagará todos os dados financeiros associados. Esta ação não pode ser desfeita.</p>{!isLocal && <p className="modal-copy">Por segurança, confirme o nome da conta e informe a senha atual.</p>}{error && <div className="alert error">{error}</div>}<label>Digite “{expected}” para confirmar<input autoFocus value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} /></label>{!isLocal && <label>Senha atual<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button><button type="submit" className="danger-button" disabled={busy}>{busy ? 'Excluindo…' : 'Excluir conta'}</button></div></form></ModalLayer>
}

export function AccountAvatar({ account, size = 'default', className = '', decorative = true }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [account?.avatarUrl])
  const initial = (account?.displayName || 'M').slice(0, 1).toUpperCase()
  return <span className={`account-avatar-view account-avatar-view-${size} ${className}`.trim()} aria-hidden={decorative ? 'true' : undefined}>
    {account?.avatarUrl && !failed ? <img src={account.avatarUrl} alt={decorative ? '' : 'Pré-visualização da foto de perfil'} onError={() => setFailed(true)} /> : initial}
  </span>
}

export function ProfileImageDialog({ account, busy, onClose, onSave, onRemove }) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])
  const choose = event => {
    const next = event.target.files?.[0]
    event.target.value = ''
    if (!next) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) return setError('Use uma imagem JPEG, PNG ou WebP.')
    if (next.size > 5 * 1024 * 1024) return setError('A foto deve ter no máximo 5 MB.')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setError(''); setFile(next); setPreviewUrl(URL.createObjectURL(next))
  }
  const save = async () => { if (!file || busy) return; setError(''); try { await onSave(file) } catch (e) { setError(errorText(e)) } }
  const remove = async () => { if (busy) return; setError(''); try { await onRemove() } catch (e) { setError(errorText(e)) } }
  return <ModalLayer onClose={() => { if (!busy) onClose() }}><div className="modal-head"><div><span className="eyebrow">PERFIL</span><h2>Alterar foto de perfil</h2></div><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Fechar">×</button></div><div className="profile-image-dialog-content"><AccountAvatar account={file ? { ...account, avatarUrl: previewUrl } : account} size="preview" decorative={false} /><p>{file?.name || (account.avatarUrl ? 'Foto atual' : 'Nenhuma foto selecionada')}</p></div>{error && <div className="alert error" role="alert">{error}</div>}<input id="profile-image-file" type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={choose} /><div className="profile-image-dialog-actions"><label className="secondary" htmlFor="profile-image-file">Escolher imagem</label>{account.avatarUrl && <button type="button" className="secondary" onClick={remove} disabled={busy}>{busy ? 'Salvando…' : 'Remover foto'}</button>}<button type="button" className="primary" onClick={save} disabled={!file || busy}>{busy ? 'Salvando…' : 'Salvar foto'}</button></div></ModalLayer>
}

export function AccountPopover({ accountState, busy, onClose, onProfile, onProtect, onSwitch, onAdd, onRemove }) {
  const popoverRef = useRef(null)
  const current = accountState?.current
  const accounts = accountState?.accounts || []
  const atLimit = accounts.length >= (accountState?.limit || 4)
  useEffect(() => {
    const close = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.type === 'mousedown' && !popoverRef.current?.contains(event.target) && !event.target.closest('.app-account-button')) onClose()
    }
    document.addEventListener('keydown', close)
    document.addEventListener('mousedown', close)
    const first = popoverRef.current?.querySelector('button')
    first?.focus()
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('mousedown', close) }
  }, [onClose])
  if (!current) return null
  const run = action => { if (!busy) action() }
  return <div ref={popoverRef} className="account-popover account-card-popover" role="dialog" aria-label="Gerenciamento da conta">
    <div className="account-popover-identity"><AccountAvatar account={current} /><span><strong>{current.displayName || 'Minha conta'}</strong><small>{current.isLocal ? 'Conta local' : 'Conta protegida'}</small></span></div>
    {current.isLocal ? <section className="account-protection-card"><div className="account-protection-copy"><span className="account-protection-icon"><ShieldCheck size={16} /></span><div><div className="account-protection-title-row"><strong>Proteja sua conta</strong></div><p>Use e-mail e senha para acessar esta mesma conta com segurança em outros contextos.</p></div></div><button type="button" className="account-protection-cta" onClick={() => run(onProtect)} disabled={busy}>Proteger conta</button></section> : <div className="account-protected-state"><ShieldCheck size={15} /> Conta protegida{current.email ? ` · ${current.email}` : ''}</div>}
    <div className="account-popover-divider" />
    <div className="account-actions account-management">
      <button type="button" onClick={() => run(onProfile)} disabled={busy}><Settings size={17} /> Perfil e Segurança <ChevronRight size={15} /></button>
      <button type="button" onClick={() => run(onSwitch)} disabled={busy}><Users size={17} /> Trocar conta <ChevronRight size={15} /></button>
      <button type="button" onClick={() => run(onAdd)} disabled={busy || atLimit}><Plus size={17} /> Adicionar conta <Plus size={15} /></button>
    </div>
    {atLimit && <p className="account-limit-message">Limite de 4 contas atingido. Remova uma conta protegida deste dispositivo para liberar espaço.</p>}
    {!current.isLocal && <button type="button" className="account-remove-device" onClick={() => run(onRemove)} disabled={busy}>Remover deste dispositivo</button>}
    <div className="account-popover-footer" aria-label={`Versão ${APP_VERSION}`}><strong>Aloca</strong><span>{APP_VERSION}</span></div>
  </div>
}


export function SupportPage({ account }) {
  return <section className="account-page support-page"><div className="page-heading"><PageHeader eyebrow="AJUDA" title="Suporte" description="Entre em contato para tirar dúvidas, relatar problemas ou enviar sugestões." /><LifeBuoy size={34} aria-hidden="true" /></div><article className="account-card support-card"><div className="account-card-icon"><Mail size={20} /></div><div><span className="eyebrow">CANAL DE CONTATO</span><h3>alocafinance.app@gmail.com</h3><p>Responderemos pelo e-mail informado assim que possível.</p><a className="primary support-contact-button" href="mailto:alocafinance.app@gmail.com"><Mail size={17} />Entrar em contato</a></div></article></section>
}

export function ProfileSecurityPage({ account, onUpdateProfile, onSecurity, onDelete, onSaveAvatar, onRemoveAvatar, accountMutationBusy }) {
  const [displayName, setDisplayName] = useState(account.displayName || '')
  const [email, setEmail] = useState(account.email || '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false)
  useEffect(() => { setDisplayName(account.displayName || ''); setEmail(account.email || '') }, [account.id, account.displayName, account.email])
  const save = async event => { event.preventDefault(); setError(''); setSaved(false); if (!displayName.trim()) return setError('Informe o nome da conta.'); if (!account.isLocal && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Informe um e-mail válido.'); setSaving(true); try { await onUpdateProfile(account.isLocal ? { displayName } : { displayName, email }); setSaved(true) } catch (e) { setError(errorText(e)) } finally { setSaving(false) } }
  const accountType = account.isLocal ? 'Local neste dispositivo' : 'Protegida por senha'
  const securityLabel = account.isLocal ? 'Ainda não protegida' : 'Protegida'
  const focusProfile = () => { const input = document.querySelector('#profile-name'); input?.scrollIntoView({ behavior: 'smooth', block: 'center' }); input?.focus() }
  return <section className="account-page profile-page"><div className="page-heading"><PageHeader eyebrow="CONFIGURAÇÕES" title="Perfil e Segurança" description="Gerencie suas informações e mantenha sua conta protegida." /></div><header className="profile-hero"><div className="profile-hero-banner" aria-hidden="true"><span>ALOCA <small>BETA</small></span></div><div className="profile-hero-content"><button type="button" className="profile-avatar-button" onClick={() => setAvatarDialogOpen(true)} disabled={accountMutationBusy} aria-label="Alterar foto de perfil" title="Alterar foto de perfil"><AccountAvatar account={account} size="hero" /><span className="profile-avatar-edit" aria-hidden="true"><Camera size={13} /></span></button><div className="profile-hero-copy"><h3>{account.displayName || 'Sua conta'}</h3><p>{account.isLocal ? 'Conta local' : 'Conta protegida'}</p><span className={`account-status ${account.isLocal ? 'is-local' : ''}`}><ShieldCheck size={15} />{securityLabel}</span></div><button type="button" className="profile-edit-link" onClick={focusProfile}><Pencil size={15} />Editar perfil</button></div></header><div className="account-summary" aria-label="Resumo da conta"><div><div className="summary-label"><UserCircle size={14} aria-hidden="true" /><span>Conta ativa</span></div><strong>{accountType}</strong></div><div><div className="summary-label"><ShieldCheck size={14} aria-hidden="true" /><span>Segurança</span></div><strong className={account.isLocal ? 'summary-muted' : 'summary-success'}>{securityLabel}</strong></div><div><div className="summary-label"><Info size={14} aria-hidden="true" /><span>Contexto</span></div><strong>{account.isLocal ? 'Seus dados ficam neste dispositivo.' : 'Acesso por e-mail e senha.'}</strong></div></div><div className="account-page-grid"><section className="account-card account-profile-card"><div className="account-card-heading"><div><span className="eyebrow">PERFIL</span><h3>Perfil</h3><p>Gerencie suas informações básicas.</p></div><Pencil size={18} aria-hidden="true" /></div><form onSubmit={save} className="account-form">{error && <div className="alert error" role="alert" aria-live="assertive">{error}</div>}<label>Nome da conta<input id="profile-name" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength="80" /></label>{!account.isLocal && <label>E-mail<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength="254" /><small className="field-hint">Seu e-mail é privado e usado para acessar sua conta.</small></label>}<div className="account-form-actions"><button className="primary" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button>{saved && <span className="form-success" role="status">Alterações salvas</span>}</div></form></section><section className={`account-card account-security-card ${account.isLocal ? 'is-unprotected' : 'is-protected'}`}><div className="account-card-heading"><div><span className="eyebrow">SEGURANÇA</span><h3>Segurança da conta</h3><p>{account.isLocal ? 'Mantenha seus dados protegidos e acessíveis.' : 'Gerencie o acesso seguro à sua conta.'}</p></div><ShieldCheck size={18} aria-hidden="true" /></div>{account.isLocal ? <><div className="security-local-callout"><strong>Conta local</strong><span>Esta conta usa apenas um nome neste dispositivo. Seus dados ficam salvos localmente.</span></div><div className="security-protect-copy"><strong>Proteja sua conta</strong><p>Crie uma conta com e-mail e senha para manter seus dados seguros e acessíveis em outros dispositivos.</p></div><button className="primary" type="button" onClick={() => onSecurity('protect')}>Configurar conta segura</button></> : <><div className="security-state"><span className="security-state-icon" aria-hidden="true">✓</span><strong>Conta protegida</strong></div><dl className="security-details"><div><dt>E-mail</dt><dd>{account.email}</dd></div></dl><button className="secondary" type="button" onClick={() => onSecurity('password')}>Alterar senha</button></>}</section><section className="account-card danger-zone"><div className="danger-copy"><div className="account-card-heading"><div><span className="eyebrow">ZONA DE PERIGO</span><h3>Excluir conta</h3></div><TriangleAlert size={18} aria-hidden="true" /></div><p>Estas ações são permanentes e não podem ser desfeitas.</p><small>Exclui permanentemente a conta e todos os seus dados.</small></div><button className="danger-button" type="button" onClick={onDelete}>Excluir conta</button></section></div>{avatarDialogOpen && <ProfileImageDialog account={account} busy={accountMutationBusy} onClose={() => setAvatarDialogOpen(false)} onSave={async file => { await onSaveAvatar(file); setAvatarDialogOpen(false) }} onRemove={async () => { await onRemoveAvatar(); setAvatarDialogOpen(false) }} />}</section>
}



export function SettingsPage({ account, profileProps, groupsProps }) {
  return <section className="settings-page" aria-labelledby="settings-title"><PageHeader eyebrow="CONFIGURAÇÕES" title="Configurações" description="Perfil, contas e preferências da aplicação." titleId="settings-title" /><ProfileSecurityPage account={account} {...profileProps} /><GroupManagement {...groupsProps} /><SupportPage account={account} /></section>
}

function CategoryCreateModal({ onClose, onSaved }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const save = async event => { event.preventDefault(); if (!name.trim()) return setError('Informe o nome do grupo.'); try { await onSaved(name.trim()) } catch (e) { setError(errorText(e)) } }
  return <ModalLayer onClose={onClose}><form onSubmit={save}><div className="modal-head"><div><span className="eyebrow">GRUPOS</span><h2>Novo grupo</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>{error && <div className="alert error" role="alert">{error}</div>}<label htmlFor="new-category-name">Nome<input id="new-category-name" autoFocus value={name} onChange={event => setName(event.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary">Criar</button></div></form></ModalLayer>
}

function GroupManagement({ categories, onCreate, onEdit, onDelete }) {
  const [createOpen, setCreateOpen] = useState(false)
  return <section className="groups-page"><div className="page-heading"><PageHeader eyebrow="ORGANIZAÇÃO" title="Grupos" description="Organize compromissos, entradas e outros registros financeiros." /><button className="primary" type="button" onClick={() => setCreateOpen(true)}><Plus size={17} aria-hidden="true" /> Novo grupo</button></div><div className="group-manager"><div className="group-manager-heading"><strong>Gerenciar grupos</strong><span>{categories.length} cadastrados</span></div>{categories.length ? <div className="group-manager-list">{categories.map(category => <div className="group-manager-row" key={category.id}><strong>{category.name}</strong><span><button className="secondary" type="button" onClick={() => onEdit(category)}>Editar</button><button className="icon-button danger-text" type="button" onClick={() => onDelete(category)} aria-label={`Excluir ${category.name}`}>×</button></span></div>)}</div> : <div className="empty"><strong>Nenhum grupo criado</strong><span>Crie um grupo para reutilizá-lo em toda a aplicação.</span></div>}</div>{createOpen && <CategoryCreateModal onClose={() => setCreateOpen(false)} onSaved={async name => { await onCreate(name); setCreateOpen(false) }} />}</section>
}
