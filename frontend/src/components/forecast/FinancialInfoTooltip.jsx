import { Info } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, useState } from 'react'

export default function FinancialInfoTooltip({ title, description }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState(null)
  const triggerRef = useRef(null)
  const tooltipId = useId()

  useEffect(() => {
    if (!open) return undefined
    const close = event => { if (!event.target.closest?.(`[data-financial-tooltip="${tooltipId}"]`)) setOpen(false) }
    const escape = event => { if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus() } }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [open, tooltipId])

  useEffect(() => {
    if (!open || !triggerRef.current) return undefined
    const update = () => {
      const rect = triggerRef.current.getBoundingClientRect()
      const width = Math.min(280, window.innerWidth - 24)
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2))
      const top = Math.max(12, Math.min(window.innerHeight - 92, rect.bottom + 8))
      setPosition({ left, top })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [open])

  const tooltip = open && position && typeof document !== 'undefined'
    ? createPortal(<div id={tooltipId} className="forecast-info-tooltip" role="tooltip" style={position}><strong>{title}</strong><span>{description}</span></div>, document.body)
    : null

  return <span className={`forecast-info-tooltip-wrap${open ? ' is-open' : ''}`} data-financial-tooltip={tooltipId}>
    <button ref={triggerRef} type="button" className="forecast-info-tooltip-trigger" aria-label={`Informações: ${title}`} aria-describedby={open ? tooltipId : undefined} aria-expanded={open} onMouseEnter={() => setOpen(true)} onMouseLeave={() => { if (document.activeElement !== triggerRef.current) setOpen(false) }} onFocus={() => setOpen(true)} onBlur={() => { if (!triggerRef.current?.matches(':focus-visible')) setOpen(false) }} onClick={() => setOpen(value => !value)}>
      <Info size={14} strokeWidth={2} aria-hidden="true" />
    </button>
    {tooltip}
  </span>
}
