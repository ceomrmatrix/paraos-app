import { ChatList, ChatArea, SystemLog } from './index'
import type { Chat, AppSettings, OllamaConnectionStatus } from '../types'

interface Props {
  chats: Chat[]
  currentChatId: string
  currentChat: Chat
  settings: AppSettings
  connectionStatus: OllamaConnectionStatus
  isLoading: boolean
  isConnected: boolean | null
  onChatSelect: (chatId: string) => void
  onCreateChat: () => void
  onDeleteChat: (chatId: string) => void
  onRenameChat: (chatId: string, newName: string) => void
  onSendMessage: (message: string) => void
  onEditMessage: (chatId: string, messageId: string, newContent: string) => void
  onDeleteMessage: (chatId: string, messageId: string) => void
  onStartEditMessage: (chatId: string, messageId: string) => void
  onCancelEditMessage: (chatId: string, messageId: string) => void
  onOpenSettings: () => void
}

export function Layout({
  chats,
  currentChatId,
  currentChat,
  connectionStatus,
  isLoading,
  isConnected,
  onChatSelect,
  onCreateChat,
  onDeleteChat,
  onRenameChat,
  onSendMessage,
}: Props) {
  // Only show interface when connected (doors open)
  const isVisible = isConnected === true

  return (
    <div
      className={`fixed inset-0 z-20 flex transition-all duration-1000 ${isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none translate-y-4'}`}
    >
      {/* Sleek Minimal Sidebar */}
      <div className="w-80 h-full bg-slate-950/80 backdrop-blur-2xl border-r border-white/5 flex flex-col shadow-2xl">
        {/* Profile / Site Logo */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)]">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-widest uppercase">ParaOS</h1>
          </div>

          <button
            onClick={onCreateChat}
            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-sm font-medium transition-all group flex items-center justify-center gap-2"
          >
            <span className="text-lg group-hover:rotate-90 transition-transform">+</span>
            New Session
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 custom-scrollbar">
          <ChatList
            chats={chats}
            currentChatId={currentChatId}
            onChatSelect={onChatSelect}
            onCreateChat={onCreateChat}
            onDeleteChat={onDeleteChat}
            onRenameChat={onRenameChat}
          />
        </div>

        {/* System Diagnostics Log */}
        <div className="h-48 border-t border-white/5 bg-black/40 p-4">
          <SystemLog isConnected={connectionStatus.isConnected} isThinking={isLoading} />
        </div>
      </div>

      {/* Main Conversation Area - ChatGPT Style */}
      <div className="flex-1 flex flex-col items-center relative">
        {/* Dynamic Top Bar */}
        <div className="w-full h-16 bg-transparent px-8 flex items-center justify-between border-b border-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-cyan-400 opacity-50 select-none">SESSION_ID:</span>
            <input
              type="text"
              value={currentChat.name}
              onChange={(e) => onRenameChat(currentChatId, e.target.value)}
              className="bg-transparent text-white font-medium border-none outline-none focus:ring-0 px-2 py-1 rounded hover:bg-white/5 transition-colors"
              placeholder="Unnamed Session"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
              <div className={`w-2 h-2 rounded-full ${connectionStatus.isConnected ? 'bg-green-400 shadow-[0_0_8px_#4ade80]' : 'bg-red-400 shadow-[0_0_8px_#f87171]'}`} />
              <span className="text-[10px] text-gray-400 font-mono uppercase tracking-tighter">
                {connectionStatus.isConnected ? 'Link Stable' : 'Link Offline'}
              </span>
            </div>
            <button
              onClick={() => onDeleteChat(currentChatId)}
              className="p-2 hover:bg-red-500/10 rounded-lg text-gray-500 hover:text-red-400 transition-all"
              title="Terminate Session"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chat Content Container */}
        <div className="w-full max-w-4xl flex-1 flex flex-col overflow-hidden">
          <ChatArea
            chat={currentChat}
            isLoading={isLoading}
            isOllamaConnected={connectionStatus.isConnected}
            onSendMessage={onSendMessage}
            onEditMessage={() => { }}
            onDeleteMessage={() => { }}
            onStartEditMessage={() => { }}
            onCancelEditMessage={() => { }}
          />
        </div>
      </div>
    </div>
  )
}