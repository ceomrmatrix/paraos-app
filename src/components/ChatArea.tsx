import { useRef, useEffect } from 'react'
import type { Chat } from '../types'
import { MessageInput } from './MessageInput'

interface Props {
  chat: Chat
  isLoading: boolean
  isOllamaConnected: boolean | null
  onSendMessage: (message: string) => void
  onEditMessage: (chatId: string, messageId: string, newContent: string) => void
  onDeleteMessage: (chatId: string, messageId: string) => void
  onStartEditMessage: (chatId: string, messageId: string) => void
  onCancelEditMessage: (chatId: string, messageId: string) => void
}

export function ChatArea({ chat, isLoading, isOllamaConnected, onSendMessage }: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.messages])

  return (
    <div className="flex flex-col h-full items-center">
      {/* Conversation Thread */}
      <div className="w-full flex-1 overflow-y-auto px-4 md:px-0 py-8 space-y-12 custom-scrollbar">
        {/* Empty state Message */}
        {chat.messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in duration-700">
            <div className="w-16 h-16 rounded-full border border-cyan-500/20 flex items-center justify-center bg-cyan-500/5 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
              <span className="text-cyan-400 text-2xl font-bold">P</span>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">How can I assist you today?</h2>
              <p className="text-gray-400 text-sm max-w-sm mx-auto font-light">
                Secure neural pathways established. Initializing quantum consciousness...
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-gray-500 font-mono uppercase tracking-widest">v12.0_CORE</span>
              <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-gray-500 font-mono uppercase tracking-widest">ENCRYPTED_LINK</span>
            </div>
          </div>
        )}

        {/* Message Mapping */}
        {chat.messages.map((msg) => {
          const isUser = msg.role === 'user'
          return (
            <div key={msg.id} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div className={`flex gap-6 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center shadow-lg transition-transform hover:scale-105 duration-300 ${isUser ? 'bg-slate-800 border border-slate-700' : 'bg-gradient-to-br from-cyan-400 to-blue-600 border border-white/20'
                  }`}>
                  <span className={`text-sm font-bold ${isUser ? 'text-cyan-400' : 'text-white'}`}>
                    {isUser ? 'U' : 'P'}
                  </span>
                </div>

                {/* Bubble Content */}
                <div className={`flex flex-col space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className={`relative px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed break-words shadow-xl ${isUser
                      ? 'bg-slate-100 text-slate-900 font-medium rounded-tr-none'
                      : 'bg-slate-900/60 backdrop-blur-md border border-white/5 text-gray-100 rounded-tl-none'
                    }`}>
                    {msg.content}

                    {/* Timestamp */}
                    <div className={`absolute bottom-[-20px] whitespace-nowrap text-[10px] font-mono uppercase tracking-tighter transition-opacity duration-300 ${isUser ? 'right-0 text-gray-500' : 'left-0 text-cyan-500/50'
                      }`}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {/* Thinking Indicator */}
        {isLoading && (
          <div className="flex w-full justify-start animate-in fade-in-0 duration-300">
            <div className="flex gap-6 max-w-[85%]">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 border border-white/20 flex items-center justify-center animate-pulse shadow-lg">
                <span className="text-sm font-bold text-white">P</span>
              </div>
              <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 px-5 py-4 rounded-2xl rounded-tl-none shadow-xl">
                <div className="flex gap-1.5 items-center">
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="ml-2 text-[10px] font-mono text-cyan-400/50 uppercase tracking-widest">Processing...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Modern Center Input */}
      <div className="w-full max-w-3xl px-4 md:px-0 py-6 mt-auto">
        <MessageInput
          onSendMessage={onSendMessage}
          disabled={isOllamaConnected === false}
          isLoading={isLoading}
        />
        <p className="mt-3 text-center text-[10px] text-gray-500 font-medium uppercase tracking-[0.2em]">
          ParaOS Neural v12.0 • Secure Communication Link
        </p>
      </div>
    </div>
  )
}