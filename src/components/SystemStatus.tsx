import type { AppSettings, OllamaConnectionStatus } from '../types'

interface SystemStatusProps {
  connectionStatus: OllamaConnectionStatus
  settings: AppSettings
  chatCount: number
  messageCount: number
  isLoading: boolean
  onOpenSettings: () => void
  simpleMode?: boolean
}

export function SystemStatus({
  connectionStatus,
  settings,
  chatCount,
  messageCount,
  isLoading,
  onOpenSettings,
  simpleMode = false
}: SystemStatusProps) {
  if (simpleMode) {
    return (
      <div className="system-status-simple">
        <div className={`status-value ${connectionStatus.isConnected ? 'online' : 'offline'}`} style={{ marginBottom: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px' }}>{connectionStatus.isConnected ? '🟢' : '🔴'}</span>
          {connectionStatus.isConnected ? 'ParaOS Online' : 'ParaOS Offline'}
        </div>
        <button onClick={onOpenSettings} className="settings-trigger" style={{ padding: '8px', fontSize: '12px' }}>
          ⚙ CONFIGURATION
        </button>
      </div>
    )
  }

  return (
    <div className="system-status">
      <div className="panel-header">
        <div className="panel-title">ParaOS Status</div>
        <div className="panel-subtitle">System Diagnostics</div>
      </div>

      <div className="status-content">
        <div className="status-item">
          <div className="status-label">ParaOS Neural Core</div>
          <div className={`status-value ${connectionStatus.isConnected ? 'online' : 'offline'}`}>
            {connectionStatus.isConnected === null && '⟳ Initializing neural pathways...'}
            {connectionStatus.isConnected === true && '🟢 Online - Neural processing active'}
            {connectionStatus.isConnected === false && '🔴 Offline - Neural core disconnected'}
          </div>
        </div>

        <div className="status-item">
          <div className="status-label">Current Session</div>
          <div className="status-value">
            ParaOS Sessions: {chatCount}<br />
            Active Commands: {messageCount}<br />
            Processing Mode: {isLoading ? 'Active' : 'Standby'}
          </div>
        </div>

        <div className="status-item">
          <div className="status-label">Quantum Stats</div>
          <div className="status-value">
            Theme Matrix: {settings.theme}<br />
            GPU Acceleration: {settings.gpuAcceleration ? 'Enabled' : 'Disabled'}<br />
            Particle Density: {settings.particleDensity}%
          </div>
        </div>

        <button onClick={onOpenSettings} className="settings-trigger">
          [PARAOS CONFIG]
        </button>
      </div>
    </div>
  )
}