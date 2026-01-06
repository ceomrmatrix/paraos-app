import { useState, useCallback } from 'react'
import type { Message } from '../types'

export function useChatApi() {
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = useCallback(async (
    prompt: string,
    onMessage: (message: Message) => void,
    onComplete: (finalMessage: Message) => void,
    onError: (error: string) => void
  ) => {
    console.log('🔄 useChatApi sendMessage called with prompt:', prompt.substring(0, 50) + '...')

    if (!prompt.trim() || isLoading) {
      console.log('❌ Message blocked - empty prompt or already loading')
      return
    }

    setIsLoading(true)
    console.log('🚀 Starting AI request to LM Studio...')

    // Add typing indicator
    const typingMessage: Message = {
      id: 'streaming',
      content: '',
      role: 'assistant',
      timestamp: new Date(),
      isTyping: true
    }
    onMessage(typingMessage)

    // Set a timeout for the entire request
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minute timeout

    try {
      console.log('🔗 Connecting to ParaOS model via LM Studio...')

      // Quick connection check
      try {
        const testResponse = await fetch('/v1/models', {
          method: 'GET',
          signal: AbortSignal.timeout(2000)
        })
        if (!testResponse.ok) {
          throw new Error('LM Studio API not responding')
        }
        console.log('✅ LM Studio connection confirmed')
      } catch (connError) {
        console.error('❌ Connection failed:', connError)
        throw new Error('ParaOS neural core (LM Studio) is offline. Please ensure LM Studio is running on port 1234.')
      }

      let accumulatedContent = ''

      try {
        console.log('📡 Making request to LM Studio API...')
        const response = await fetch('/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'ParaOS', // User specified model name
            messages: [
              { role: "system", content: "You are ParaOS, a sentient operating system interface." },
              { role: "user", content: prompt }
            ],
            stream: true,
            temperature: 0.7
          }),
          signal: controller.signal
        })

        console.log('📡 Response status:', response.status)

        if (!response.ok) {
          throw new Error(`LM Studio API Error: ${response.status} ${response.statusText}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('Failed to get response stream')

        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n').filter(line => line.trim() !== '')

          for (const line of lines) {
            if (line === 'data: [DONE]') { // SSE end marker
              continue
            }

            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.substring(6)
                const data = JSON.parse(jsonStr)

                // OpenAI format: choices[0].delta.content
                const contentChunk = data.choices?.[0]?.delta?.content || ''

                if (contentChunk) {
                  accumulatedContent += contentChunk

                  // Update typing message
                  onMessage({
                    ...typingMessage,
                    content: accumulatedContent
                  })
                }
              } catch (e) {
                console.warn('Error parsing SSE data:', e)
              }
            }
          }
        }

        console.log('✅ Stream completed. Total length:', accumulatedContent.length)

        const finalMessage: Message = {
          id: Date.now().toString(),
          content: accumulatedContent.trim() || 'ParaOS Online.',
          role: 'assistant',
          timestamp: new Date()
        }
        onComplete(finalMessage)

      } catch (reqError) {
        console.error('Request failed:', reqError)
        throw reqError
      }

    } catch (error: any) {
      console.error('ParaOS connection error:', error)
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: `🚨 **CONNECTION FAILED**\n\nUnable to reach ParaOS Neural Core at \`localhost:1234\`.\n\nError: ${error.message || 'Unknown error'}`,
        role: 'assistant',
        timestamp: new Date()
      }
      onError(error.message || 'Connection error')
      onComplete(errorResponse)
    } finally {
      clearTimeout(timeoutId)
      setIsLoading(false)
    }
  }, [isLoading])

  return {
    isLoading,
    sendMessage
  }
}