import { useEffect, useRef, useCallback } from 'react'

export function useScrollToBottom(dependency: unknown[], enabled = true) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    if (enabled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [enabled])

  useEffect(() => {
    scrollToBottom()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependency, enabled])

  return messagesEndRef
}