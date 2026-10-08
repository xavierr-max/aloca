import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

export default function InfoTooltip({ title, description, placement = 'top' }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState(null)
  const tooltipId = useId()
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)
  const closeTimer = useRef(null)
  const setOpenFromPointer = value => {
    window.clearTimeout(closeTimer.current)
    if (value) setOpen(true)
    else closeTimer.current = window.setTimeout(() => setOpen(false), 120)
  }

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popoverRef.current) return undefined
    const updatePosition = () => {
      const trigger = triggerRef.current.getBoundingClientRect()
      const popover = popoverRef.current.getBoundingClientRect()
      const gap = 8
      const edge = 16
      const placements = placement === 'top' ? ['top', 'bottom', 'right', 'left'] : [placement, 'top', 'bottom', 'right', 'left']
      const fits = (side, width, height) => side === 'top' ? trigger.top >= height + gap : side === 'bottom' ? window.innerHeight - trigger.bottom >= height + gap : side === 'left' ? trigger.left >= width + gap : window.innerWidth - trigger.right >= width + gap
      const side = placements.find(candidate => fits(candidate, popover.width, popover.height)) || placements[0]
      let top = side === 'top' ? trigger.top - popover.height - gap : side === 'bottom' ? trigger.bottom + gap : trigger.top + (trigger.height - popover.height) / 2
      let left = side === 'left' ? trigger.left - popover.width - gap : side === 'right' ? trigger.right + gap : trigger.left + (trigger.width - popover.width) / 2
      left = Math.max(edge, Math.min(left, window.innerWidth - popover.width - edge))
      top = Math.max(edge, Math.min(top, window.innerHeight - popover.height - edge))
      setPosition({ top, left, side })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => { window.removeEventListener('resize', updatePosition); window.removeEventListener('scroll', updatePosition, true) }
  }, [open, placement, title, description])

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  const tooltip = open && typeof document !== 'undefined' ? createPortal(<span ref={popoverRef} id={tooltipId} className={`info-tooltip-popover ${position ? `is-positioned info-tooltip-${position.side}` : ''}`} role="tooltip" style={position ? { top: position.top, left: position.left } : undefined} onMouseEnter={() => setOpenFromPointer(true)} onMouseLeave={() => setOpenFromPointer(false)}>
    <strong>{title}</strong><span>{description}</span>
  </span>, document.body) : null

  return <span className={`info-tooltip${open ? ' is-open' : ''}`} onMouseEnter={() => setOpenFromPointer(true)} onMouseLeave={() => setOpenFromPointer(false)}>
    <button ref={triggerRef} type="button" className="info-tooltip-trigger" aria-label={`Informações: ${title}`} aria-describedby={open ? tooltipId : undefined} aria-expanded={open} onClick={() => { window.clearTimeout(closeTimer.current); setOpen(value => !value) }} onFocus={() => setOpen(true)} onBlur={() => setOpenFromPointer(false)} onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}>
      <Info size={12} strokeWidth={2} aria-hidden="true" />
    </button>
    {tooltip}
  </span>
}
