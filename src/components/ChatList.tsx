import type { Chat } from '../types'
import { ChatItem } from './ChatItem'

interface ChatListProps {
  chats: Chat[]
  currentChatId: string
  onChatSelect: (chatId: string) => void
  onCreateChat: () => void
  onDeleteChat: (chatId: string) => void
  onRenameChat: (chatId: string, newName: string) => void
}

export function ChatList({
  chats,
  currentChatId,
  onChatSelect,
  onCreateChat,
  onDeleteChat,
  onRenameChat
}: ChatListProps) {
  return (
    <div className="chat-list">
      <button onClick={onCreateChat} className="new-chat-btn">
        ➕ New ParaOS Session
      </button>
      {chats.map((chat) => (
        <ChatItem
          key={chat.id}
          chat={chat}
          isActive={chat.id === currentChatId}
          onClick={() => onChatSelect(chat.id)}
          onDelete={() => onDeleteChat(chat.id)}
          onRename={(newName) => onRenameChat(chat.id, newName)}
          canDelete={true}
        />
      ))}
    </div>
  )
}