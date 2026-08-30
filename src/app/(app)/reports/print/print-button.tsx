'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * زر الطباعة نفسه لا يُطبع — `print:hidden` يخفيه في نسخة الورق.
 */
export function PrintButton() {
  return (
    <div className="print:hidden mb-6 flex justify-end">
      <Button onClick={() => window.print()}>
        <Printer className="size-4" aria-hidden />
        طباعة أو حفظ PDF
      </Button>
    </div>
  )
}
