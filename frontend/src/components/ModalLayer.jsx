import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function ModalLayer({ children, onClose, className = '', backdropClassName = '' }) {
  const openerRef = useRef(typeof document !== 'undefined' ? document.activeElement : null)
  const contentRef = useRef(null)
  const backdropRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const content = contentRef.current
    const focusable = () => [...content?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') || []]
    const focusInitial = () => { const target = content?.querySelector('[autofocus]') || focusable()[0]; target?.focus() }
    const frame = window.requestAnimationFrame(focusInitial)
    const isTopLayer = () => {
      const layers = [...document.querySelectorAll('[data-modal-layer]')]
      return layers[layers.length - 1] === backdropRef.current
    }
    const onKeyDown = event => {
      if (!isTopLayer()) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current?.()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (openerRef.current instanceof HTMLElement && document.contains(openerRef.current)) openerRef.current.focus()
    }
  }, [])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div ref={backdropRef} className={`modal-backdrop ${backdropClassName}`.trim()} data-modal-layer onMouseDown={event => { if (event.target === event.currentTarget) onCloseRef.current?.() }}>
      <div ref={contentRef} className={`modal ${className}`.trim()} role="dialog" aria-modal="true">{children}</div>
    </div>,
    document.body,
  )
}
