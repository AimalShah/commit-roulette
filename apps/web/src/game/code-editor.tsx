import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import CodeMirror, { type Extension } from '@uiw/react-codemirror'
import { useMemo } from 'react'

import { cn } from '@/lib/cn'
import type { Language } from '@commit-roulette/shared/types'

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  className,
}: {
  value: string
  onChange?: (value: string) => void
  language: Language
  readOnly?: boolean
  className?: string
}) {
  const extensions = useMemo<Extension[]>(
    () => [language === 'python' ? python() : javascript({ jsx: false })],
    [language],
  )

  return (
    <div className={cn('bg-background/40 h-full overflow-hidden', className)}>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        editable={!readOnly}
        readOnly={readOnly}
        theme="dark"
        height="100%"
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: !readOnly,
          highlightActiveLineGutter: !readOnly,
          autocompletion: !readOnly,
          bracketMatching: true,
          closeBrackets: !readOnly,
          highlightSelectionMatches: false,
        }}
      />
    </div>
  )
}
