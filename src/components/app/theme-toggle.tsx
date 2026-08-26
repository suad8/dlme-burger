'use client'

import { useSyncExternalStore, useCallback } from 'react'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const THEME_STORAGE_KEY = 'itqan-theme'
const THEME_EVENT = 'itqan:themechange'

/**
 * مبدّل الوضع الفاتح/الداكن.
 *
 * الوضع الفاتح هو الافتراضي كما تقتضي الهوية.
 *
 * الحالة تُقرأ من الـDOM لا من حالة React: السكربت المضمَّن في الجذر يضبط
 * الصنف قبل أول رسم (فلا وميض)، و`useSyncExternalStore` يقرأ تلك الحقيقة
 * الخارجية مباشرة — وهو النمط الصحيح بدل مزامنتها داخل useEffect.
 *
 * التخزين ملفوف بـtry/catch لأن الوصول إليه يرمي في بعض السياقات (تصفح خاص،
 * حجب بيانات المواقع) — والصفحة يجب أن تعمل حينها لا أن تنكسر.
 */

function subscribe(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(THEME_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function getSnapshot(): boolean {
  return document.documentElement.classList.contains('dark')
}

/** على الخادم لا DOM — الافتراضي فاتح، وهو ما يطابق أول رسم. */
function getServerSnapshot(): boolean {
  return false
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light')
    } catch {
      /* لا يمنع التبديل داخل الجلسة الحالية */
    }
    window.dispatchEvent(new Event(THEME_EVENT))
  }, [])

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
      title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
    >
      {isDark ? (
        <Sun className="size-5" aria-hidden />
      ) : (
        <Moon className="size-5" aria-hidden />
      )}
    </Button>
  )
}

/**
 * سكربت يُحقن في الجذر ويعمل قبل أول رسم، فيمنع وميض الوضع الفاتح لمن اختار
 * الداكن. مكتوب كنص لأنه يجب أن ينفّذ قبل تحميل أي حزمة JavaScript.
 */
export const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem('${THEME_STORAGE_KEY}');
  if (t === 'dark') document.documentElement.classList.add('dark');
} catch (e) {}
`.trim()
