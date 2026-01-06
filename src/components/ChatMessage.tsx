import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'
import type { Message } from '../types'

interface ChatMessageProps {
  message: Message
  onEdit?: (messageId: string, newContent: string) => void
  onDelete?: (messageId: string) => void
  onStartEdit?: (messageId: string) => void
  onCancelEdit?: (messageId: string) => void
}

export function ChatMessage({
  message,
  onEdit,
  onDelete,
  onStartEdit,
  onCancelEdit
}: ChatMessageProps) {
  const [editContent, setEditContent] = useState(message.content)

  const handleEdit = () => {
    onEdit?.(message.id, editContent)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEdit()
    } else if (e.key === 'Escape') {
      onCancelEdit?.(message.id)
    }
  }

  return (
    <div className={`message ${message.role}`}>
      <div className="message-content">
        <div className="message-header">
          <div className="header-decoration"></div>
          <span className="message-author">
            {message.role === 'user' ? '>> USER_INPUT' : '>> SYSTEM_RESPONSE'}
          </span>
          <span className="message-time">
            T-{message.timestamp.toLocaleTimeString()}
          </span>
          {!message.isTyping && message.role === 'user' && message.id !== 'streaming' && (
            <div className="message-actions">
              <button
                onClick={() => onStartEdit?.(message.id)}
                className="message-action-btn"
                title="Edit neural input"
              >
                [EDIT]
              </button>
              <button
                onClick={() => onDelete?.(message.id)}
                className="message-action-btn delete"
                title="Delete synapse"
              >
                [DEL]
              </button>
            </div>
          )}
        </div>

        <div className="message-body">
          {message.isTyping ? (
            <div className="typing-indicator">
              <span className="blink">_</span> PROCESSING_NEURAL_STREAM
            </div>
          ) : message.isEditing ? (
            <div className="edit-mode">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="edit-textarea"
                autoFocus
              />
              <div className="edit-actions">
                <button onClick={handleEdit} className="edit-btn save">[SAVE_DATA]</button>
                <button onClick={() => onCancelEdit?.(message.id)} className="edit-btn cancel">[ABORT]</button>
              </div>
            </div>
          ) : (
            <>
              <MessageContent content={message.content} />
              {message.id === 'streaming' && (
                <span className="terminal-cursor">_</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function MessageContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code(props) {
          const { className, children, ...rest } = props
          const match = /language-(\w+)/.exec(className || '')
          const hasNewlines = String(children).includes('\n')
          const isInline = !match && !hasNewlines

          return !isInline ? (
            <div className="code-block">
              <div className="code-header">
                {match ? match[1] : 'neural-code'}
              </div>
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match ? match[1] : 'text'}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  background: 'rgba(0, 255, 255, 0.05)',
                  fontSize: '13px'
                }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          ) : (
            <code className="inline-code" {...rest}>
              {children}
            </code>
          )
        },
        p({ children }) {
          return <p style={{ margin: '6px 0', lineHeight: '1.5' }}>{children}</p>
        },
        ul({ children }) {
          return <ul style={{ margin: '6px 0', paddingLeft: '20px' }}>{children}</ul>
        },
        ol({ children }) {
          return <ol style={{ margin: '6px 0', paddingLeft: '20px' }}>{children}</ol>
        },
        li({ children }) {
          return <li style={{ margin: '3px 0' }}>{children}</li>
        },
        blockquote({ children }) {
          return (
            <blockquote style={{
              borderLeft: '3px solid var(--neon-cyan)',
              paddingLeft: '12px',
              margin: '8px 0',
              fontStyle: 'italic',
              color: 'var(--text-secondary)'
            }}>
              {children}
            </blockquote>
          )
        },
        strong({ children }) {
          return <strong style={{
            color: 'var(--neon-magenta)',
            fontWeight: '700'
          }}>{children}</strong>
        },
        em({ children }) {
          return <em style={{
            color: 'var(--neon-green)',
            fontStyle: 'italic'
          }}>{children}</em>
        }
      }}
    >
      {content}
    </ReactMarkdown>
  )
}