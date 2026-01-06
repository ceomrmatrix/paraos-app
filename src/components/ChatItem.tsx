import React, { useState } from 'react'
import type { Chat } from '../types'

interface ChatItemProps {
  chat: Chat
  isActive: boolean
  onClick: () => void
  onDelete: () => void
  onRename: (newName: string) => void
  canDelete: boolean
}

export function ChatItem({
  chat,
  isActive,
  onClick,
  onDelete,
  onRename,
  canDelete
}: ChatItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(chat.name)

  const handleRename = () => {
    if (editName.trim() && editName !== chat.name) {
      onRename(editName.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename()
    } else if (e.key === 'Escape') {
      setEditName(chat.name)
      setIsEditing(false)
    }
  }

  return (
    <div
      className={`chat-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      {isEditing ? (
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleRename}
          onKeyDown={handleKeyDown}
          autoFocus
          className="chat-name-input"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="chat-name">{chat.name}</div>
      )}
      <div className="chat-meta">
        {chat.messages.length - 1} commands • {chat.updatedAt.toLocaleDateString()}
      </div>
      <div className="chat-actions">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setEditName(chat.name)
            setIsEditing(true)
          }}
          className="action-btn edit"
                    title="Rename ParaOS session"
        >
          ✏️
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            console.log('Delete button clicked for chat:', chat.id, 'canDelete:', canDelete)
            if (confirm('Terminate ParaOS session?')) {
              console.log('Delete confirmed, calling onDelete for chat:', chat.id)
              onDelete()
            } else {
              console.log('Delete cancelled')
            }
          }}
          className="action-btn delete"
          disabled={!canDelete}
          title="Terminate ParaOS session"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}