import { useState, useEffect } from 'react'
import {
  Layout,
  SettingsPanel,
  ParticleBackground,
  SystemBootSequence,
  ParaOSEntity
} from './components'
import {
  useChats,
  useSettings,
  useOllamaConnection,
  useChatApi
} from './hooks'
import { initializeTheme } from './utils/themeManager'
import type { Message } from './types'

function App() {
  const { settings, updateSettings, resetSettings } = useSettings()
  const { connectionStatus } = useOllamaConnection()
  const { isLoading, sendMessage: sendApiMessage } = useChatApi()
  const {
    chats,
    currentChatId,
    setCurrentChatId,
    getCurrentChat,
    createNewChat,
    deleteChat,
    renameChat,
    addMessage,
    updateMessages,
    editMessage,
    deleteMessage,
    startEditingMessage,
    cancelEditingMessage
  } = useChats()

  const [showSettings, setShowSettings] = useState(false)
  const [isBooting, setIsBooting] = useState(true)

  const currentChat = getCurrentChat()
  const isConnected = connectionStatus.isConnected

  useEffect(() => {
    initializeTheme(settings.theme)
  }, [settings.theme])

  const handleBootComplete = () => setIsBooting(false)

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date()
    }

    addMessage(currentChatId, userMessage)

    const typingMessage: Message = {
      id: 'streaming',
      content: '',
      role: 'assistant',
      timestamp: new Date(),
      isTyping: true
    }
    addMessage(currentChatId, typingMessage)

    const allMessages = [
      ...currentChat.messages.filter(m => m.id !== 'streaming'),
      userMessage,
      typingMessage
    ]

    if (currentChat.messages.length === 0) {
      setTimeout(() => {
        const title = content.split(' ').slice(0, 4).join(' ') + '...'
        renameChat(currentChatId, title.toUpperCase())
      }, 2000)
    }

    await sendApiMessage(
      content,
      (message: Message) => {
        const updated = allMessages.map(m => m.id === 'streaming' ? message : m)
        updateMessages(currentChatId, updated)
      },
      (finalMessage: Message) => {
        const updated = allMessages.map(m => m.id === 'streaming' ? finalMessage : m)
        updateMessages(currentChatId, updated)
      },
      () => {
        const errorMsgs = allMessages.filter(m => m.id !== 'streaming')
        updateMessages(currentChatId, errorMsgs)
      }
    )
  }

  const handleEditMessage = (messageId: string, newContent: string) => {
    editMessage(currentChatId, messageId, newContent)
  }

  const handleDeleteMessage = (messageId: string) => {
    deleteMessage(currentChatId, messageId)
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {/* Boot Sequence - covers everything */}
      {isBooting && <SystemBootSequence onComplete={handleBootComplete} />}

      {/* Only show everything AFTER boot completes */}
      {!isBooting && (
        <>
          {/* Background */}
          <ParticleBackground
            density={settings.particleDensity}
            enabled={settings.animations}
          />

          {/* Entity & Containment */}
          <ParaOSEntity
            isConnected={isConnected}
            isThinking={isLoading}
          />

          {/* Chat Interface */}
          <Layout
            chats={chats}
            currentChatId={currentChatId}
            currentChat={currentChat}
            settings={settings}
            connectionStatus={connectionStatus}
            isLoading={isLoading}
            isConnected={isConnected}
            onChatSelect={setCurrentChatId}
            onCreateChat={createNewChat}
            onDeleteChat={deleteChat}
            onRenameChat={renameChat}
            onSendMessage={handleSendMessage}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onStartEditMessage={startEditingMessage}
            onCancelEditMessage={cancelEditingMessage}
            onOpenSettings={() => setShowSettings(true)}
          />
        </>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onSettingsChange={updateSettings}
          onReset={resetSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

export default App