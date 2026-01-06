import { useState, useCallback, useEffect, useRef } from 'react'
import axios from 'axios'
import type { OllamaConnectionStatus, ApiError } from '../types'

export function useOllamaConnection() {
  const [connectionStatus, setConnectionStatus] = useState<OllamaConnectionStatus>({
    isConnected: null,
    lastChecked: new Date()
  })
  const [error, setError] = useState<ApiError | null>(null)
  const mountedRef = useRef(true)

  const checkConnection = useCallback(async () => {
    try {
      // LM Studio OpenAI-compatible endpoint (via Vite proxy)
      const response = await axios.get('/v1/models', { timeout: 2000 })
      if (mountedRef.current) {
        setConnectionStatus({
          isConnected: response.status === 200,
          lastChecked: new Date()
        })
        setError(null)
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        setConnectionStatus({
          isConnected: false,
          lastChecked: new Date()
        })
        setError({
          message: err instanceof Error ? err.message : 'Connection failed',
          code: err instanceof Error && 'code' in (err as any) ? (err as any).code : undefined,
          status: err instanceof Error && 'response' in (err as any) && (err as any).response ? (err as any).response.status : undefined
        })
      }
    }
  }, [])

  // Check connection on mount and periodically
  useEffect(() => {
    mountedRef.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkConnection()

    const interval = setInterval(() => {
      if (mountedRef.current) {
        checkConnection()
      }
    }, 5000) // Check every 5 seconds

    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [checkConnection])

  return {
    connectionStatus,
    error,
    checkConnection
  }
}