import { useState, useRef, type KeyboardEvent } from 'react'

interface Props {
  onSendMessage: (message: string) => void
  disabled?: boolean
  isLoading?: boolean
}

export function MessageInput({ onSendMessage, disabled = false, isLoading = false }: Props) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    if (!input.trim() || disabled || isLoading) return
    onSendMessage(input.trim())
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="relative group w-full">
      {/* High-tech border glow effect */}
      <div className="absolute -inset-[1px] bg-gradient-to-r from-cyan-600 via-blue-500 to-cyan-600 rounded-2xl opacity-10 group-focus-within:opacity-40 blur-[2px] transition-all duration-500" />

      <div className="relative flex items-end gap-3 bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-3 transition-all duration-300 group-focus-within:bg-slate-900/60 group-focus-within:border-white/20">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Neural link disconnected...' : 'Message ParaOS...'}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-white placeholder-gray-500 border-none outline-none focus:ring-0 resize-none py-2 px-3 text-[15px] leading-relaxed max-h-[200px]"
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = 'auto'
            target.style.height = Math.min(target.scrollHeight, 200) + 'px'
          }}
        />

        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading || disabled}
          className={`flex-shrink-0 p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center ${!input.trim() || isLoading || disabled
              ? 'text-gray-600'
              : 'text-cyan-400 hover:bg-cyan-400/10 active:scale-90 shadow-[0_0_15px_rgba(34,211,238,0.1)] hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]'
            }`}
        >
          {isLoading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg
              className={`w-6 h-6 transition-transform duration-300 ${input.trim() ? 'translate-x-[2px]' : ''}`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}