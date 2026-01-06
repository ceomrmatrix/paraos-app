import { useState, useCallback, useEffect } from 'react'
import type { AppSettings } from '../types'

const STORAGE_KEY = 'paraos-settings'

const defaultSettings: AppSettings = {
  theme: 'cyberpunk',
  gpuAcceleration: true,
  particleDensity: 30,
  matrixRain: true,
  animations: true,
  autoScroll: true,
  soundEffects: false,
  sidebarAlwaysVisible: true,
  // Entity settings
  entityPersonality: 'friendly',
  entityActivityLevel: 50,
  entitySpeed: 50,
  entityScale: 100,
  showEntity: true,
  // Display settings
  chatFontSize: 16,
  containmentAlertIntensity: 70,
  dangerMode: false,
  reduceMotion: false,
  // AI settings
  aiTemperature: 50,
  // System settings
  skipBootup: false,
  debugMode: false
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings
  })

  // Save to localStorage whenever settings change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }, [])

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings)
  }, [])

  const toggleSetting = useCallback((key: keyof Pick<AppSettings, 'gpuAcceleration' | 'matrixRain' | 'animations' | 'autoScroll' | 'soundEffects' | 'sidebarAlwaysVisible'>) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return {
    settings,
    updateSettings,
    resetSettings,
    toggleSetting
  }
}