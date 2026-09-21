import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const TutorialContext = createContext(null)

const tutorialDefinitions = {
  dashboard: [
    { selector: '[data-tour="dashboard-balance"]', title: 'Veja seu saldo', description: 'Aqui você acompanha o saldo real, o que já está reservado e quanto continua disponível para novas decisões.' },
    { selector: '[data-tour="initial-balance"]', title: 'Saldo inicial', description: 'Informe ou ajuste o valor que você já tinha antes de registrar novas movimentações. Isso não cria uma transação.' },
    { selector: '[data-tour="allocation-action"]', title: 'Alocar saldo', description: 'Veja seus compromissos e faça a alocação diretamente por lá.' },
    { selector: '[data-tour="dashboard-objective"]', title: 'Defina uma direção', description: 'Escolha uma sugestão ou escreva o objetivo que orienta como você quer usar o saldo reservado.' },
    { selector: '[data-tour="dashboard-details"]', title: 'Explore o mês', description: 'Abra esta área para consultar o resumo mensal, a projeção, as movimentações recentes e os próximos compromissos.' },
    { selector: '[data-tour="dashboard-summary"]', title: 'Leia o mês', description: 'Consulte entradas, saídas, resultado, cobertura dos compromissos e saldo estimado do mês selecionado.' },
    { selector: '[data-tour="dashboard-projection"]', title: 'Projete seu saldo', description: 'A projeção mostra entradas, saídas e saldo esperado. Escolha o período e clique em um mês para ver sua composição.' },
    { selector: '[data-tour="dashboard-movements"]', title: 'Registre movimentações', description: 'Nesta seção você consulta lançamentos recentes e pode registrar uma nova entrada ou saída.' },
  ],
  incomes: [
    { selector: '[data-tour="movements-page"]', title: 'Organize movimentações', description: 'Consulte entradas, saídas e entradas recorrentes já registradas nesta página.' },
    { selector: '[data-tour="movement-create"]', title: 'Crie um lançamento', description: 'Use Novo para registrar uma entrada, uma saída ou uma entrada recorrente. Os dados salvos afetam o saldo conforme o tipo.' },
    { selector: '[data-tour="movement-tabs"]', title: 'Escolha uma visão', description: 'Alterne entre todas as movimentações, apenas entradas, apenas saídas ou entradas recorrentes.' },
    { selector: '[data-tour="movement-filters"]', title: 'Filtre e ordene', description: 'Pesquise pela descrição, grupo ou mês e ordene os resultados por data ou valor.' },
    { selector: '[data-tour="movement-results"]', title: 'Gerencie lançamentos', description: 'Saídas podem ser editadas ou excluídas. Entradas podem ser excluídas e entradas recorrentes abrem detalhes em um drawer.' },
    { selector: '[data-tour="recurring-tab"]', title: 'Acompanhe entradas recorrentes', description: 'Na aba Entradas recorrentes você pesquisa, pausa, retoma, edita e acompanha as próximas ocorrências.' },
  ],
  commitments: [
    { selector: '[data-tour="commitments-page"]', title: 'Planeje compromissos', description: 'Organize compromissos parcelados, acompanhe a cobertura e decida quando reservar ou pagar cada parcela.' },
    { selector: '[data-tour="create-commitment"]', title: 'Cadastre um compromisso', description: 'Crie um compromisso informando parcela, quantidade, vencimento, prioridade e grupo. Você também pode marcá-lo como urgente.' },
    { selector: '[data-tour="commitment-search"]', title: 'Encontre rapidamente', description: 'Pesquise compromissos pelo nome e use os grupos para restringir a lista.' },
    { selector: '[data-tour="commitment-filters"]', title: 'Refine a lista', description: 'Filtre por prioridade, status, cobertura e pagamento; também é possível ordenar e mostrar apenas itens com déficit ou aptos para pagar.' },
    { selector: '[data-tour="commitment-card"]', title: 'Leia a cobertura', description: 'Cada card mostra o progresso geral, o valor reservado, o que falta e a situação da próxima parcela.' },
    { selector: '[data-tour="commitment-card-menu"]', title: 'Ações do compromisso', description: 'O menu reúne atalhos para abrir detalhes, editar ou excluir o compromisso.' },
    {
      selector: '[data-tour="commitment-primary-action"]:not([data-tour-action="completed"])',
      title: 'Ação da próxima parcela',
      description: 'Use o botão destacado para avançar a próxima parcela.',
      getContent: target => target?.dataset.tourAction === 'pay'
        ? { title: 'Marque a parcela como paga', description: 'A reserva da próxima parcela está completa. Use este botão para marcar exatamente essa parcela como paga.' }
        : { title: 'Complete a parcela', description: 'Use este botão para completar a reserva da próxima parcela do compromisso.' },
    },
  ],
}

const routeFromHash = () => {
  if (typeof window === 'undefined') return 'dashboard'
  return window.location.hash === '#movimentacoes' ? 'incomes' : window.location.hash === '#compromissos' ? 'commitments' : 'dashboard'
}

const findAvailableSteps = route => tutorialDefinitions[route].filter(step => document.querySelector(step.selector))

const openDetailsFor = target => {
  const details = []
  let current = target
  while (current) {
    if (current.tagName === 'DETAILS' && !current.open) details.push(current)
    current = current.parentElement
  }
  return details
}

function TutorialProvider({ children }) {
  const [route, setRoute] = useState(routeFromHash)
  const [open, setOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [availableSteps, setAvailableSteps] = useState([])
  const openerRef = useRef(null)
  const openedDetailsRef = useRef(new Set())

  useEffect(() => {
    const onHashChange = () => {
      const nextRoute = routeFromHash()
      setRoute(nextRoute)
      if (open) {
        openedDetailsRef.current.forEach(details => { details.open = false })
        openedDetailsRef.current.clear()
        setOpen(false)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [open])

  const restoreDetails = useCallback(() => {
    openedDetailsRef.current.forEach(details => { details.open = false })
    openedDetailsRef.current.clear()
  }, [])

  const finish = useCallback((completed = false) => {
    restoreDetails()
    setOpen(false)
    if (completed) window.localStorage.setItem(`tutorial.${route}.completed`, 'true')
    window.requestAnimationFrame(() => {
      if (openerRef.current instanceof HTMLElement && document.contains(openerRef.current)) openerRef.current.focus()
    })
  }, [restoreDetails, route])

  const start = useCallback(() => {
    const steps = findAvailableSteps(route)
    openerRef.current = document.activeElement
    setAvailableSteps(steps)
    setStepIndex(0)
    setOpen(steps.length > 0)
  }, [route])

  const rememberOpenedDetails = useCallback(details => openedDetailsRef.current.add(details), [])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        finish()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, finish])

  const value = useMemo(() => ({ start, finish, open }), [finish, open, start])
  return <TutorialContext.Provider value={value}>{children}{open && <TutorialOverlay steps={availableSteps} stepIndex={stepIndex} setStepIndex={setStepIndex} finish={finish} rememberOpenedDetails={rememberOpenedDetails} />}</TutorialContext.Provider>
}

const useTutorial = () => useContext(TutorialContext)

function TutorialOverlay({ steps, stepIndex, setStepIndex, finish, rememberOpenedDetails }) {
  const tooltipRef = useRef(null)
  const [targetRect, setTargetRect] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 24, left: 24 })
  const step = steps[stepIndex]
  const stepTarget = step && typeof document !== 'undefined' ? document.querySelector(step.selector) : null
  const stepContent = step?.getContent && stepTarget ? { ...step, ...step.getContent(stepTarget) } : step

  const position = useCallback(() => {
    if (!step) return
    const target = document.querySelector(step.selector)
    if (!target) {
      if (stepIndex < steps.length - 1) setStepIndex(index => index + 1)
      else finish()
      return
    }
    openDetailsFor(target).forEach(details => { rememberOpenedDetails(details); details.open = true })
    const rect = target.getBoundingClientRect()
    setTargetRect(rect)
    const tooltip = tooltipRef.current
    if (!tooltip) return
    const gap = 16
    const margin = 12
    const tooltipRect = tooltip.getBoundingClientRect()
    const placements = [
      { top: rect.bottom + gap, left: rect.left + (rect.width - tooltipRect.width) / 2 },
      { top: rect.top - tooltipRect.height - gap, left: rect.left + (rect.width - tooltipRect.width) / 2 },
      { top: rect.top + (rect.height - tooltipRect.height) / 2, left: rect.right + gap },
      { top: rect.top + (rect.height - tooltipRect.height) / 2, left: rect.left - tooltipRect.width - gap },
    ]
    const valid = placements.find(candidate => candidate.top >= margin && candidate.left >= margin && candidate.top + tooltipRect.height <= window.innerHeight - margin && candidate.left + tooltipRect.width <= window.innerWidth - margin)
    const selected = valid || { top: Math.max(margin, Math.min(window.innerHeight - tooltipRect.height - margin, rect.bottom + gap)), left: Math.max(margin, Math.min(window.innerWidth - tooltipRect.width - margin, rect.left)) }
    setTooltipPosition(selected)
  }, [finish, rememberOpenedDetails, setStepIndex, step, stepIndex, steps.length])

  useEffect(() => {
    if (!step) return undefined
    setTargetRect(null)
    const target = document.querySelector(step.selector)
    if (!target) {
      position()
      return undefined
    }
    openDetailsFor(target).forEach(details => {
      rememberOpenedDetails(details)
      details.open = true
    })
    target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' })
    const frame = window.requestAnimationFrame(() => window.requestAnimationFrame(position))
    const onResize = () => position()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [position, rememberOpenedDetails, step])

  useEffect(() => {
    if (!targetRect) return undefined
    const frame = window.requestAnimationFrame(position)
    return () => window.cancelAnimationFrame(frame)
  }, [position, Boolean(targetRect)])

  useEffect(() => {
    tooltipRef.current?.focus()
  }, [stepIndex])

  useEffect(() => {
    const tooltip = tooltipRef.current
    if (!tooltip) return undefined
    const onKeyDown = event => {
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (stepIndex < steps.length - 1) setStepIndex(index => index + 1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setStepIndex(index => Math.max(0, index - 1))
      } else if (event.key === 'Tab') {
        const focusable = [...tooltip.querySelectorAll('button:not([disabled])')]
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    tooltip.addEventListener('keydown', onKeyDown)
    return () => tooltip.removeEventListener('keydown', onKeyDown)
  }, [setStepIndex, stepIndex, steps.length])

  if (!step || !targetRect) return createPortal(<div className="tutorial-loading" aria-live="polite">Preparando tutorial…</div>, document.body)

  const isLast = stepIndex === steps.length - 1
  const next = () => isLast ? finish(true) : setStepIndex(index => index + 1)
  const previous = () => setStepIndex(index => Math.max(0, index - 1))

  return createPortal(<div className="tutorial-layer" aria-label="Tutorial guiado">
    <div className="tutorial-spotlight" style={{ '--tour-top': `${targetRect.top}px`, '--tour-left': `${targetRect.left}px`, '--tour-width': `${targetRect.width}px`, '--tour-height': `${targetRect.height}px` }} aria-hidden="true" />
    <section ref={tooltipRef} className="tutorial-tooltip" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-description" tabIndex="-1" style={{ top: tooltipPosition.top, left: tooltipPosition.left }}>
      <div className="tutorial-tooltip-header"><span className="eyebrow">GUIA DA PÁGINA</span><button className="tutorial-close" type="button" onClick={() => finish()} aria-label="Fechar tutorial">×</button></div>
      <div className="tutorial-progress" aria-label={`Etapa ${stepIndex + 1} de ${steps.length}`}><span>Etapa {stepIndex + 1} de {steps.length}</span><span className="tutorial-progress-track"><span style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} /></span></div>
      <h2 id="tutorial-title">{stepContent.title}</h2>
      <p id="tutorial-description">{stepContent.description}</p>
      <footer className="tutorial-actions"><button type="button" className="tutorial-skip" onClick={() => finish()}>Pular tutorial</button><div><button type="button" className="secondary" onClick={previous} disabled={stepIndex === 0}>Voltar</button><button type="button" className="primary" onClick={next}>{isLast ? 'Concluir' : 'Próximo'}</button></div></footer>
    </section>
  </div>, document.body)
}

export { TutorialProvider, useTutorial }
