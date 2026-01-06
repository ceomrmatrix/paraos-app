export interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  isTyping?: boolean
  isEditing?: boolean
  originalContent?: string
}

export interface Chat {
  id: string
  title?: string
  name: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
  model?: string
}

export type ChatSession = Chat

export interface AppSettings {
  theme: 'cyberpunk' | 'neon-city' | 'matrix' | 'futuristic-dark' | 'aurora'
  gpuAcceleration: boolean
  particleDensity: number
  matrixRain: boolean
  animations: boolean
  autoScroll: boolean
  soundEffects: boolean
  sidebarAlwaysVisible: boolean
  // Entity settings
  entityPersonality: 'friendly' | 'mischievous' | 'professional' | 'chaotic'
  entityActivityLevel: number  // 0-100
  entitySpeed: number  // 0-100 (how fast entity moves)
  entityScale: number  // 50-150 (entity size percentage)
  showEntity: boolean
  // Display settings
  chatFontSize: number  // 12-24
  containmentAlertIntensity: number  // 0-100
  dangerMode: boolean
  reduceMotion: boolean
  // AI settings
  aiTemperature: number  // 0-100 (mapped to 0-2)
  // System settings
  skipBootup: boolean
  debugMode: boolean
}

export interface OllamaConnectionStatus {
  isConnected: boolean | null
  lastChecked: Date
}

export interface ApiError {
  message: string
  code?: string
  status?: number
}

export type ThemeVariant = AppSettings['theme']

export interface ChatAction {
  type: 'CREATE_CHAT' | 'DELETE_CHAT' | 'RENAME_CHAT' | 'ADD_MESSAGE' | 'EDIT_MESSAGE' | 'DELETE_MESSAGE'
  payload?: unknown
}