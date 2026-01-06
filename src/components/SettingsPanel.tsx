import type { AppSettings } from '../types'

interface SettingsPanelProps {
  settings: AppSettings
  onSettingsChange: (settings: Partial<AppSettings>) => void
  onReset: () => void
  onClose: () => void
}

export function SettingsPanel({
  settings,
  onSettingsChange,
  onReset,
  onClose
}: SettingsPanelProps) {
  const handleThemeChange = (theme: AppSettings['theme']) => {
    onSettingsChange({ theme })
  }

  const handleToggle = (key: keyof Pick<AppSettings, 'gpuAcceleration' | 'matrixRain' | 'animations' | 'autoScroll' | 'soundEffects' | 'sidebarAlwaysVisible'>) => {
    onSettingsChange({ [key]: !settings[key] })
  }

  const handleSliderChange = (key: 'particleDensity', value: number) => {
    onSettingsChange({ [key]: value })
  }

  return (
    <>
      <div className="settings-overlay" onClick={onClose} />
      <div className="settings-panel">
        <div className="panel-header">
          <div className="panel-title">ParaOS Configuration</div>
        </div>
        <div className="settings-content">
          <div className="setting-group">
            <label className="setting-label">ParaOS Theme Matrix</label>
            <select
              value={settings.theme}
              onChange={(e) => handleThemeChange(e.target.value as AppSettings['theme'])}
              className="setting-select"
            >
              <option value="cyberpunk">💜 Cyberpunk - Neural Pink</option>
              <option value="neon-city">🏙️ Neon City - Urban Green</option>
              <option value="matrix">🟢 Matrix - Terminal Green</option>
              <option value="futuristic-dark">🚀 Futuristic Dark - Blue Matrix</option>
              <option value="aurora">🌌 Aurora - Cosmic Blue</option>
            </select>
          </div>

          <div className="setting-group">
            <label className="setting-label">ParaOS Processing: {settings.gpuAcceleration ? 'ENABLED' : 'DISABLED'}</label>
            <ToggleSwitch
              checked={settings.gpuAcceleration}
              onChange={() => handleToggle('gpuAcceleration')}
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">ParaOS Effects: {settings.particleDensity}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.particleDensity}
              onChange={(e) => handleSliderChange('particleDensity', parseInt(e.target.value))}
              className="setting-slider"
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">ParaOS Rain Effect</label>
            <ToggleSwitch
              checked={settings.matrixRain}
              onChange={() => handleToggle('matrixRain')}
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">Animation Matrix</label>
            <ToggleSwitch
              checked={settings.animations}
              onChange={() => handleToggle('animations')}
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">Auto-Scroll Synapses</label>
            <ToggleSwitch
              checked={settings.autoScroll}
              onChange={() => handleToggle('autoScroll')}
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">Sound Effects</label>
            <ToggleSwitch
              checked={settings.soundEffects}
              onChange={() => handleToggle('soundEffects')}
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">Always Show Sidebar</label>
            <ToggleSwitch
              checked={settings.sidebarAlwaysVisible}
              onChange={() => handleToggle('sidebarAlwaysVisible')}
            />
          </div>

          {/* DIVIDER - New Enhanced Settings */}
          <div className="settings-divider">
            <span>ENTITY CONFIGURATION</span>
          </div>

          <div className="setting-group">
            <label className="setting-label">Entity Personality</label>
            <select
              value={settings.entityPersonality}
              onChange={(e) => onSettingsChange({ entityPersonality: e.target.value as AppSettings['entityPersonality'] })}
              className="setting-select"
            >
              <option value="friendly">😊 Friendly - Helpful & Warm</option>
              <option value="mischievous">😈 Mischievous - Playful & Chaotic</option>
              <option value="professional">🤖 Professional - Formal & Precise</option>
              <option value="chaotic">🌀 Chaotic - Unpredictable & Wild</option>
            </select>
          </div>

          <div className="setting-group">
            <label className="setting-label">Entity Activity: {settings.entityActivityLevel}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.entityActivityLevel}
              onChange={(e) => onSettingsChange({ entityActivityLevel: parseInt(e.target.value) })}
              className="setting-slider"
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">Show Entity</label>
            <ToggleSwitch
              checked={settings.showEntity}
              onChange={() => onSettingsChange({ showEntity: !settings.showEntity })}
            />
          </div>

          {/* DIVIDER - Display Settings */}
          <div className="settings-divider">
            <span>DISPLAY SETTINGS</span>
          </div>

          <div className="setting-group">
            <label className="setting-label">Chat Font Size: {settings.chatFontSize}px</label>
            <input
              type="range"
              min="12"
              max="24"
              value={settings.chatFontSize}
              onChange={(e) => onSettingsChange({ chatFontSize: parseInt(e.target.value) })}
              className="setting-slider"
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">Containment Alert Intensity: {settings.containmentAlertIntensity}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.containmentAlertIntensity}
              onChange={(e) => onSettingsChange({ containmentAlertIntensity: parseInt(e.target.value) })}
              className="setting-slider"
            />
          </div>

          <div className="setting-group danger-setting">
            <label className="setting-label">⚠️ Danger Mode</label>
            <ToggleSwitch
              checked={settings.dangerMode}
              onChange={() => onSettingsChange({ dangerMode: !settings.dangerMode })}
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">🦽 Reduce Motion (Accessibility)</label>
            <ToggleSwitch
              checked={settings.reduceMotion}
              onChange={() => onSettingsChange({ reduceMotion: !settings.reduceMotion })}
            />
          </div>

          {/* DIVIDER - AI Settings */}
          <div className="settings-divider">
            <span>AI CONFIGURATION</span>
          </div>

          <div className="setting-group">
            <label className="setting-label">AI Creativity: {settings.aiTemperature}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.aiTemperature}
              onChange={(e) => onSettingsChange({ aiTemperature: parseInt(e.target.value) })}
              className="setting-slider"
            />
          </div>

          {/* DIVIDER - Advanced Settings */}
          <div className="settings-divider">
            <span>ADVANCED / SYSTEM</span>
          </div>

          <div className="setting-group">
            <label className="setting-label">Entity Speed: {settings.entitySpeed}%</label>
            <input
              type="range"
              min="10"
              max="100"
              value={settings.entitySpeed}
              onChange={(e) => onSettingsChange({ entitySpeed: parseInt(e.target.value) })}
              className="setting-slider"
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">Entity Scale: {settings.entityScale}%</label>
            <input
              type="range"
              min="50"
              max="150"
              value={settings.entityScale}
              onChange={(e) => onSettingsChange({ entityScale: parseInt(e.target.value) })}
              className="setting-slider"
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">🚀 Skip Bootup Animation</label>
            <ToggleSwitch
              checked={settings.skipBootup}
              onChange={() => onSettingsChange({ skipBootup: !settings.skipBootup })}
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">🐛 Debug Mode</label>
            <ToggleSwitch
              checked={settings.debugMode}
              onChange={() => onSettingsChange({ debugMode: !settings.debugMode })}
            />
          </div>

          <div className="settings-actions">
            <button onClick={onClose} className="settings-btn primary">
              [APPLY PARAOS CHANGES]
            </button>
            <button onClick={onReset} className="settings-btn secondary">
              [PARAOS RESET]
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

interface ToggleSwitchProps {
  checked: boolean
  onChange: () => void
}

function ToggleSwitch({ checked, onChange }: ToggleSwitchProps) {
  return (
    <label className="toggle-switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
      <span className="toggle-slider"></span>
    </label>
  )
}