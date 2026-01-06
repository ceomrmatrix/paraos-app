import { useState, useCallback, useEffect } from 'react'
import type { Chat, Message } from '../types'

const STORAGE_KEY = 'paraos-chats'

export function useChats() {
  const [chats, setChats] = useState<Chat[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return parsed.map((chat: any) => {
          // Cleanup legacy welcome message if found
          const messages = chat.messages.map((msg: any) => {
            if (msg.id === '1' && msg.content.includes('Welcome to ParaOS v3.2.1')) {
              return { ...msg, content: 'System initialized. Waiting for input...', timestamp: new Date(msg.timestamp) }
            }
            return { ...msg, timestamp: new Date(msg.timestamp) }
          })

          return {
            ...chat,
            createdAt: new Date(chat.createdAt),
            updatedAt: new Date(chat.updatedAt),
            messages
          }
        })
      } catch (e) {
        console.error('Failed to load chats from localStorage:', e)
      }
    }
    return [createInitialChat()]
  })

  const [currentChatId, setCurrentChatId] = useState<string>(chats[0]?.id || 'default')

  // Function to generate AI chat name
  const generateChatName = useCallback(async (_chatId: string, messages: Message[]): Promise<string> => {
    try {
      // Get the first user message as context
      const userMessages = messages.filter(m => m.role === 'user')
      if (userMessages.length === 0) return 'New ParaOS Session'

      const firstMessage = userMessages[0].content.slice(0, 100) // First 100 chars

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'ParaOSAssistant:latest',
          prompt: `Based on this conversation starter: "${firstMessage}", generate a very short, concise title (3-6 words max) for this chat session. Respond with ONLY the title, no quotes or explanation.`,
          stream: false
        })
      })

      if (response.ok) {
        const data = await response.json()
        const title = data.response?.trim()
        if (title && title.length > 0 && title.length <= 30) {
          return title
        }
      }
    } catch (error) {
      console.warn('Failed to generate chat name:', error)
    }

    // Fallback names if AI generation fails
    const fallbacks = [
      'ParaOS Discussion', 'AI Conversation', 'System Chat', 'ParaOS Session',
      'Technical Talk', 'AI Assistance', 'ParaOS Interface', 'Smart Chat'
    ]
    return fallbacks[Math.floor(Math.random() * fallbacks.length)]
  }, [])


  // Save to localStorage whenever chats change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
  }, [chats])

  const getCurrentChat = useCallback(() => {
    return chats.find(chat => chat.id === currentChatId) || chats[0]
  }, [chats, currentChatId])

  const createNewChat = useCallback(() => {
    const newChat: Chat = {
      id: Date.now().toString(),
      name: 'New ParaOS Session',
      messages: [
        {
          id: '1',
          content: `**ParaOS Session Initialized**\n*New ParaOS Session*\n\nSystem online and ready for operation.\nNeural pathways established.\n\n*Awaiting your commands...*`,
          role: 'assistant',
          timestamp: new Date()
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    setChats(prev => [newChat, ...prev])
    setCurrentChatId(newChat.id)
    return newChat
  }, [])

  const deleteChat = useCallback((chatId: string) => {
    console.log('Deleting chat:', chatId, 'Total chats:', chats.length)

    if (chats.length === 1) {
      console.log('Last chat being deleted, creating new one')
      // Create a new chat if this is the last one
      const newChat: Chat = createInitialChat()
      setChats([newChat])
      setCurrentChatId(newChat.id)
      console.log('New chat created:', newChat.id)
      return
    }

    console.log('Deleting chat, keeping others')
    setChats(prevChats => {
      const updatedChats = prevChats.filter(chat => chat.id !== chatId)
      console.log('Chats after deletion:', updatedChats.length)

      // Switch to another chat if we deleted the current one
      if (currentChatId === chatId && updatedChats.length > 0) {
        const nextChatId = updatedChats[0].id
        console.log('Switching to chat:', nextChatId)
        setCurrentChatId(nextChatId)
      }

      return updatedChats
    })
  }, [chats.length, currentChatId])

  const renameChat = useCallback((chatId: string, newName: string) => {
    setChats(prev => prev.map(chat =>
      chat.id === chatId
        ? { ...chat, name: newName, updatedAt: new Date() }
        : chat
    ))
  }, [])

  // Function to auto-rename chat after some messages
  const autoRenameChat = useCallback(async (chatId: string) => {
    const chat = chats.find(c => c.id === chatId)
    if (!chat) return

    // Only rename if it's still the default name and has some conversation
    const shouldRename = chat.name === 'New ParaOS Session' ||
      chat.name.startsWith('ParaOS Session') ||
      chat.name === 'ParaOS Terminal'

    if (shouldRename && chat.messages.filter(m => m.role === 'user').length >= 2) {
      const newName = await generateChatName(chatId, chat.messages)
      renameChat(chatId, newName)
    }
  }, [chats, generateChatName, renameChat])

  const addMessage = useCallback((chatId: string, message: Message) => {
    setChats(prev => prev.map(chat =>
      chat.id === chatId
        ? {
          ...chat,
          messages: [...chat.messages, message],
          updatedAt: new Date()
        }
        : chat
    ))

    // Auto-rename chat after adding assistant messages
    if (message.role === 'assistant') {
      setTimeout(() => autoRenameChat(chatId), 1000) // Small delay to allow UI updates
    }
  }, [autoRenameChat])

  const updateMessages = useCallback((chatId: string, messages: Message[]) => {
    setChats(prev => prev.map(chat =>
      chat.id === chatId
        ? { ...chat, messages, updatedAt: new Date() }
        : chat
    ))
  }, [])

  const editMessage = useCallback((chatId: string, messageId: string, newContent: string) => {
    setChats(prev => prev.map(chat =>
      chat.id === chatId
        ? {
          ...chat,
          messages: chat.messages.map(msg =>
            msg.id === messageId
              ? { ...msg, content: newContent, isEditing: false }
              : msg
          ),
          updatedAt: new Date()
        }
        : chat
    ))
  }, [])

  const deleteMessage = useCallback((chatId: string, messageId: string) => {
    setChats(prev => prev.map(chat =>
      chat.id === chatId
        ? {
          ...chat,
          messages: chat.messages.filter(msg => msg.id !== messageId),
          updatedAt: new Date()
        }
        : chat
    ))
  }, [])

  const startEditingMessage = useCallback((chatId: string, messageId: string) => {
    setChats(prev => prev.map(chat =>
      chat.id === chatId
        ? {
          ...chat,
          messages: chat.messages.map(msg =>
            msg.id === messageId
              ? { ...msg, isEditing: true, originalContent: msg.content }
              : msg
          ),
          updatedAt: new Date()
        }
        : chat
    ))
  }, [])

  const cancelEditingMessage = useCallback((chatId: string, messageId: string) => {
    setChats(prev => prev.map(chat =>
      chat.id === chatId
        ? {
          ...chat,
          messages: chat.messages.map(msg =>
            msg.id === messageId
              ? { ...msg, isEditing: false, content: msg.originalContent || msg.content }
              : msg
          ),
          updatedAt: new Date()
        }
        : chat
    ))
  }, [])

  return {
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
    cancelEditingMessage,
    generateChatName,
    autoRenameChat
  }
}

function createInitialChat(): Chat {
  return {
    id: 'default',
    name: 'ParaOS Terminal',
    messages: [
      {
        id: '1',
        content: 'System initialized. Waiting for input...',
        role: 'assistant',
        timestamp: new Date()
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  }
}