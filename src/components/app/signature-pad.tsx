'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { PenLine, Eraser } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * لوحة توقيع تعمل باللمس والفأرة.
 *
 * تُخرج PNG كـdata URL. الحجم مضبوط عمدًا (٢x فقط لا أكثر) لأن التوقيع يُرفع
 * من الجوال غالبًا عبر شبكة ميدانية بطيئة.
 */
export function SignaturePad({
  value,
  onChange,
}: {
  value: string | null
  onChange: (dataUrl: string | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const [hasInk, setHasInk] = useState(Boolean(value))

  const setup = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1a2e24'

    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height)
      img.src = value
    }
  }, [value])

  useEffect(() => {
    setup()
  }, [setup])

  function pointFrom(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const p = pointFrom(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    drawingRef.current = true
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const p = pointFrom(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    setHasInk(true)
  }

  function end() {
    if (!drawingRef.current) return
    drawingRef.current = false
    const canvas = canvasRef.current
    if (!canvas) return
    onChange(canvas.toDataURL('image/png'))
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
    onChange(null)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        // touch-none يمنع تمرير الصفحة أثناء التوقيع بالإصبع
        className="h-40 w-full touch-none rounded-[var(--radius-md)] border border-dashed border-border bg-surface"
        aria-label="منطقة التوقيع — وقّع بإصبعك أو بالفأرة"
        role="img"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <PenLine className="size-3.5" aria-hidden />
          {hasInk ? 'تم التوقيع' : 'وقّع داخل الإطار'}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          <Eraser className="size-4" aria-hidden />
          مسح
        </Button>
      </div>
    </div>
  )
}
