import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Input, Button, Card, Alert, Modal, Select } from '../components/ui'
import { Minus, Square, X, Server, Database, CheckCircle2, AlertCircle, RefreshCw, Cloud, HardDrive, Globe, Unplug, ShieldCheck, Info } from 'lucide-react'
import { useWindowMaximize, RestoreIcon } from '../hooks/useWindowMaximize'
import appIcon from '../assets/app_icon.png'

function WindowControls() {
  const { isMaximized, toggleMaximize } = useWindowMaximize()

  const handle = (action: 'minimize' | 'close') => {
    (window as any).horizon?.window?.[action]?.()
  }

  return (
    <div className="fixed top-0 right-0 flex items-center gap-0 z-50 app-region-no-drag">
      <button
        onClick={() => handle('minimize')}
        className="w-11 h-9 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        title="Minimize"
      >
        <Minus size={14} />
      </button>
      <button
        onClick={toggleMaximize}
        className="w-11 h-9 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        title={isMaximized ? "Restore" : "Maximize"}
      >
        {isMaximized ? <RestoreIcon size={12} /> : <Square size={12} />}
      </button>
      <button
        onClick={() => handle('close')}
        className="w-11 h-9 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-600 transition-colors"
        title="Close"
      >
        <X size={16} />
      </button>
    </div>
  )
}

export function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Cloud DB Modal & Status
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [isCloudLocked, setIsCloudLocked] = useState(false)
  const [cloudStatus, setCloudStatus] = useState<{
    connected: boolean;
    provider: string;
    details?: string;
  }>({ connected: false, provider: 'offline', details: 'Local Database' })
  
  const [cloudTab, setCloudTab] = useState<'mongodb' | 'sharepoint' | 'onedrive' | 'gdrive'>('mongodb')
  const [activeBackendId, setActiveBackendId] = useState<string>('local')
  
  // MongoDB states
  const [mongoUri, setMongoUri] = useState('')
  const [mongoDbName, setMongoDbName] = useState('horizon_pm')
  const [isMongoConnected, setIsMongoConnected] = useState(false)
  
  // SharePoint states
  const [spTenantId, setSpTenantId] = useState('')
  const [spSiteUrl, setSpSiteUrl] = useState('')
  const [spClientId, setSpClientId] = useState('')
  const [spClientSecret, setSpClientSecret] = useState('')
  const [spScope, setSpScope] = useState('Sites.ReadWrite.All')
  const [isSpConnected, setIsSpConnected] = useState(false)

  // OneDrive states
  const [odTenantId, setOdTenantId] = useState('')
  const [odClientId, setOdClientId] = useState('')
  const [odDriveType, setOdDriveType] = useState('business')
  const [odFolderPath, setOdFolderPath] = useState('/HorizonPM/Documents')
  const [isOdConnected, setIsOdConnected] = useState(false)

  // Google Drive states
  const [gdriveClientId, setGdriveClientId] = useState('')
  const [gdriveClientSecret, setGdriveClientSecret] = useState('')
  const [gdriveFolderPath, setGdriveFolderPath] = useState('/HorizonPM')
  const [isGdriveConnected, setIsGdriveConnected] = useState(false)

  const [testLoading, setTestLoading] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
    pingMs?: number;
    collections?: string[];
  } | null>(null)

  const login = useAuthStore(state => state.login)
  const navigate = useNavigate()

  useEffect(() => {
    checkCloudStatus()
  }, [])

  const checkCloudStatus = async () => {
    try {
      // 1. Check if cloud settings should be locked on login
      let locked = false
      try {
        const lockedSetting = await (window as any).horizon?.plugins?.getAppSetting?.('cloud_settings_locked_login')
        if (lockedSetting === 'true') {
          locked = true
        } else {
          localStorage.removeItem('horizon_cloud_setup_locked')
          locked = false
        }
      } catch (_) {
        locked = false
      }
      setIsCloudLocked(locked)

      // 2. Active backend
      const active = await (window as any).horizon?.plugins?.getActiveBackend?.()
      const currentActive = active === 'none' ? 'local' : (active || 'local')
      setActiveBackendId(currentActive)

      // 3. MongoDB status
      const mongoConfig = await (window as any).horizon?.plugins?.getStatus?.('mongodb-core')
      if (mongoConfig?.settings?.connectionUri) {
        setMongoUri(mongoConfig.settings.connectionUri)
      }
      if (mongoConfig?.settings?.databaseName) {
        setMongoDbName(mongoConfig.settings.databaseName)
      }
      const mongoOk = mongoConfig?.status === 'connected'
      setIsMongoConnected(mongoOk)

      // 4. SharePoint status
      const spConfig = await (window as any).horizon?.plugins?.getStatus?.('sharepoint-core')
      if (spConfig?.settings) {
        setSpTenantId(spConfig.settings.tenantId || '')
        setSpSiteUrl(spConfig.settings.siteUrl || '')
        setSpClientId(spConfig.settings.clientId || '')
        setSpClientSecret(spConfig.settings.clientSecret || '')
        setSpScope(spConfig.settings.permissionScope || 'Sites.ReadWrite.All')
      }
      const spOk = spConfig?.status === 'connected'
      setIsSpConnected(spOk)

      // 5. OneDrive status
      const odConfig = await (window as any).horizon?.plugins?.getStatus?.('onedrive-core')
      if (odConfig?.settings) {
        setOdTenantId(odConfig.settings.tenantId || '')
        setOdClientId(odConfig.settings.clientId || '')
        setOdDriveType(odConfig.settings.driveType || 'business')
        setOdFolderPath(odConfig.settings.folderPath || '/HorizonPM/Documents')
      }
      const odOk = odConfig?.status === 'connected'
      setIsOdConnected(odOk)

      // 6. Google Drive status
      const gdriveConfig = await (window as any).horizon?.plugins?.getStatus?.('google-drive-core')
      if (gdriveConfig?.settings) {
        setGdriveClientId(gdriveConfig.settings.clientId || '')
        setGdriveClientSecret(gdriveConfig.settings.clientSecret || '')
        setGdriveFolderPath(gdriveConfig.settings.folderPath || '/HorizonPM')
      }
      const gdriveOk = gdriveConfig?.status === 'connected'
      setIsGdriveConnected(gdriveOk)

      // Determine active display
      if (currentActive === 'mongodb-core' && mongoOk) {
        setCloudStatus({
          connected: true,
          provider: 'MongoDB',
          details: mongoConfig.connectedAs || 'Connected to MongoDB'
        })
        setCloudTab('mongodb')
      } else if (currentActive === 'sharepoint-core' && spOk) {
        setCloudStatus({
          connected: true,
          provider: 'SharePoint',
          details: spConfig.connectedAs || 'Connected to SharePoint'
        })
        setCloudTab('sharepoint')
      } else if (currentActive === 'onedrive-core' && odOk) {
        setCloudStatus({
          connected: true,
          provider: 'OneDrive',
          details: odConfig.connectedAs || 'Connected to OneDrive'
        })
        setCloudTab('onedrive')
      } else if (currentActive === 'google-drive-core' && gdriveOk) {
        setCloudStatus({
          connected: true,
          provider: 'Google Drive',
          details: gdriveConfig.connectedAs || 'Connected to Google Drive'
        })
        setCloudTab('gdrive')
      } else if (mongoOk) {
        setCloudStatus({
          connected: true,
          provider: 'MongoDB (Standby)',
          details: mongoConfig.connectedAs || 'Connected'
        })
      } else if (spOk) {
        setCloudStatus({
          connected: true,
          provider: 'SharePoint (Standby)',
          details: spConfig.connectedAs || 'Connected'
        })
      } else if (odOk) {
        setCloudStatus({
          connected: true,
          provider: 'OneDrive (Standby)',
          details: odConfig.connectedAs || 'Connected'
        })
      } else if (gdriveOk) {
        setCloudStatus({
          connected: true,
          provider: 'Google Drive (Standby)',
          details: gdriveConfig.connectedAs || 'Connected'
        })
      } else {
        setCloudStatus({
          connected: false,
          provider: 'offline',
          details: 'Local Database (Offline)'
        })
      }
    } catch (_) {}
  }

  const handleConnectMongo = async () => {
    if (!mongoUri.trim()) {
      setTestResult({ success: false, message: 'Please enter a valid MongoDB connection string URI.' })
      return
    }
    setTestLoading(true)
    setTestResult(null)
    try {
      const test = await (window as any).horizon?.plugins?.testMongo?.(mongoUri.trim(), mongoDbName.trim() || 'horizon_pm')
      if (!test?.success) {
        setTestResult({
          success: false,
          message: test?.error || 'Failed to connect to MongoDB cluster'
        })
        return
      }

      await (window as any).horizon?.plugins?.saveConfig?.('mongodb-core', {
        connectionUri: mongoUri.trim(),
        databaseName: mongoDbName.trim() || 'horizon_pm'
      })

      await (window as any).horizon?.plugins?.connect?.('mongodb-core')
      await (window as any).horizon?.plugins?.setActiveBackend?.('mongodb-core')

      try {
        await (window as any).horizon?.sync?.trigger?.()
      } catch (_) {}

      setTestResult({
        success: true,
        pingMs: test.pingMs,
        collections: test.collections,
        message: `Connected successfully (${test.pingMs}ms latency)! Users and database records are synchronized.`
      })

      await checkCloudStatus()
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed'
      })
    } finally {
      setTestLoading(false)
    }
  }

  const handleConnectSp = async () => {
    if (!spClientId.trim()) {
      setTestResult({ success: false, message: 'Azure AD Client ID is required for SharePoint.' })
      return
    }
    setTestLoading(true)
    setTestResult(null)
    try {
      const test = await (window as any).horizon?.plugins?.testConnection?.('sharepoint-core', {
        tenantId: spTenantId.trim(),
        siteUrl: spSiteUrl.trim(),
        clientId: spClientId.trim(),
        clientSecret: spClientSecret.trim(),
        permissionScope: spScope
      })

      if (test && !test.success) {
        setTestResult({
          success: false,
          message: test.error || 'Failed to connect to SharePoint site.'
        })
        return
      }

      await (window as any).horizon?.plugins?.saveConfig?.('sharepoint-core', {
        tenantId: spTenantId.trim(),
        siteUrl: spSiteUrl.trim(),
        clientId: spClientId.trim(),
        clientSecret: spClientSecret.trim(),
        permissionScope: spScope
      })

      await (window as any).horizon?.plugins?.connect?.('sharepoint-core')
      await (window as any).horizon?.plugins?.setActiveBackend?.('sharepoint-core')

      try {
        await (window as any).horizon?.sync?.trigger?.()
      } catch (_) {}

      setTestResult({
        success: true,
        pingMs: test?.pingMs || 100,
        message: 'Connected to Microsoft SharePoint successfully! Users and lists synchronized.'
      })

      await checkCloudStatus()
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'SharePoint connection failed.'
      })
    } finally {
      setTestLoading(false)
    }
  }

  const handleConnectOd = async () => {
    if (!odClientId.trim()) {
      setTestResult({ success: false, message: 'Azure AD Client ID is required for OneDrive.' })
      return
    }
    setTestLoading(true)
    setTestResult(null)
    try {
      const test = await (window as any).horizon?.plugins?.testConnection?.('onedrive-core', {
        tenantId: odTenantId.trim() || 'organizations',
        clientId: odClientId.trim(),
        driveType: odDriveType,
        folderPath: odFolderPath.trim() || '/HorizonPM/Documents'
      })

      if (test && !test.success) {
        setTestResult({
          success: false,
          message: test.error || 'Failed to connect to OneDrive.'
        })
        return
      }

      await (window as any).horizon?.plugins?.saveConfig?.('onedrive-core', {
        tenantId: odTenantId.trim() || 'organizations',
        clientId: odClientId.trim(),
        driveType: odDriveType,
        folderPath: odFolderPath.trim() || '/HorizonPM/Documents'
      })

      await (window as any).horizon?.plugins?.connect?.('onedrive-core')
      await (window as any).horizon?.plugins?.setActiveBackend?.('onedrive-core')

      try {
        await (window as any).horizon?.sync?.trigger?.()
      } catch (_) {}

      setTestResult({
        success: true,
        pingMs: test?.pingMs || 120,
        message: 'Connected to Microsoft OneDrive successfully! Folder hierarchy and document vault synchronized.'
      })

      await checkCloudStatus()
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'OneDrive connection failed.'
      })
    } finally {
      setTestLoading(false)
    }
  }

  const handleConnectGdrive = async () => {
    if (!gdriveClientId.trim()) {
      setTestResult({ success: false, message: 'Google Cloud Client ID is required.' })
      return
    }
    if (!gdriveClientSecret.trim()) {
      setTestResult({ success: false, message: 'Google Cloud Client Secret is required.' })
      return
    }
    setTestLoading(true)
    setTestResult(null)
    try {
      await (window as any).horizon?.plugins?.saveConfig?.('google-drive-core', {
        clientId: gdriveClientId.trim(),
        clientSecret: gdriveClientSecret.trim(),
        folderPath: gdriveFolderPath.trim() || '/HorizonPM'
      })

      const res = await (window as any).horizon?.plugins?.connect?.('google-drive-core')
      await (window as any).horizon?.plugins?.setActiveBackend?.('google-drive-core')

      try {
        await (window as any).horizon?.sync?.trigger?.()
      } catch (_) {}

      setTestResult({
        success: true,
        message: `Connected to Google Drive successfully! Authenticated as ${res?.connectedAs || 'Google Account'}. Workspace folder synchronized.`
      })

      await checkCloudStatus()
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Google Drive connection failed.'
      })
    } finally {
      setTestLoading(false)
    }
  }

  const handleDisconnect = async (pluginId: string) => {
    setIsDisconnecting(true)
    try {
      await (window as any).horizon?.plugins?.disconnect?.(pluginId)
      const providerLabel = 
        pluginId === 'mongodb-core' ? 'MongoDB' : 
        pluginId === 'sharepoint-core' ? 'SharePoint' : 
        pluginId === 'onedrive-core' ? 'OneDrive' : 'Google Drive'
      setTestResult({
        success: true,
        message: `Successfully disconnected ${providerLabel}. System is now operating in local offline mode.`
      })
      await checkCloudStatus()
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to disconnect.'
      })
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username.trim()) {
      setError('Username is required')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      await login(username.trim(), password)

      // Once the user has configured cloud settings and logged in,
      // lock cloud settings on the login page for all subsequent logins
      // so credentials and connection strings cannot be accessed without logging in
      try {
        await (window as any).horizon?.plugins?.setAppSetting?.('cloud_settings_locked_login', 'true')
        localStorage.setItem('horizon_cloud_setup_locked', 'true')
      } catch (_) {}

      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen max-h-screen overflow-y-auto bg-[#0B1229] flex flex-col items-center justify-center p-3 sm:p-4 py-6 select-none custom-scrollbar"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Window controls — always visible since there's no OS titlebar */}
      <WindowControls />

      <div
        className="w-full max-w-md my-auto"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Logo + branding */}
        <div className="flex flex-col items-center mb-4 sm:mb-6">
          <div className="relative mb-2 sm:mb-3 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-r from-[#2E5EFF]/30 to-[#F5A623]/30 rounded-3xl blur-2xl" />
            <img 
              src={appIcon} 
              alt="Horizon Logo" 
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-2xl relative z-10 shadow-2xl drop-shadow-[0_12px_24px_rgba(46,94,255,0.35)] hover:scale-105 transition-transform" 
            />
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold mb-1 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-100 to-gray-300">
            Horizon
          </h1>
          <p className="text-gray-400 text-xs font-medium tracking-wider uppercase">
            Product management. Clarity to impact.
          </p>
        </div>

        {/* Login card */}
        <Card className="shadow-2xl border border-[#1e2d52]">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="error" onDismiss={() => setError('')}>
                {error}
              </Alert>
            )}

            <div className="space-y-4">
              <Input
                label="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                disabled={loading}
                autoFocus
              />

              <Input
                label="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={loading}
            >
              Sign In
            </Button>

            {/* Cloud Database Status Bar */}
            <div className="pt-3 border-t border-[#1e2d52]/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-gray-400 truncate max-w-[220px]">
                <div className={`w-2 h-2 rounded-full shrink-0 ${cloudStatus.connected ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="truncate">
                  {cloudStatus.connected ? (
                    <span className="text-gray-300 font-medium">Cloud: <span className="text-green-400">{cloudStatus.provider}</span></span>
                  ) : (
                    <span className="text-gray-400">Cloud: <span className="text-amber-400">Offline / Local</span></span>
                  )}
                </span>
              </div>

              {/* Show Cloud Settings button ONLY if not locked yet */}
              {!isCloudLocked ? (
                <button
                  type="button"
                  onClick={() => { setShowConfigModal(true); setTestResult(null); }}
                  className="text-[#2E5EFF] hover:text-[#4d75ff] flex items-center gap-1 font-medium transition-colors cursor-pointer shrink-0"
                >
                  <Server size={12} />
                  <span>Cloud Settings</span>
                </button>
              ) : (
                <div 
                  className="flex items-center gap-1.5 text-gray-400 text-[11px] shrink-0 select-none"
                  title="Cloud credentials are locked and protected. Manage storage backends in Plugins inside Horizon after sign-in."
                >
                  <ShieldCheck size={13} className="text-emerald-400" />
                  <span>Configured & Secured</span>
                </div>
              )}
            </div>
          </form>
        </Card>

        <p className="text-center text-xs text-gray-600 mt-6">
          Horizon PM · v1.0.0
        </p>
      </div>

      {/* Cloud Multi-Provider Connection Modal (Accessible only before initial login lock) */}
      <Modal
        isOpen={showConfigModal && !isCloudLocked}
        onClose={() => setShowConfigModal(false)}
        title="Cloud Backend & Storage Settings"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-gray-400 truncate max-w-[180px] sm:max-w-[240px]">
              {cloudStatus.connected ? (
                <span className="text-emerald-400 flex items-center gap-1 truncate">
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span className="truncate">Active: {cloudStatus.provider}</span>
                </span>
              ) : (
                <span className="text-amber-400">Local Offline Mode</span>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowConfigModal(false)}
              >
                Close
              </Button>
              {cloudTab === 'mongodb' && (
                <Button
                  variant="primary"
                  size="sm"
                  loading={testLoading}
                  onClick={handleConnectMongo}
                >
                  <RefreshCw size={13} className={testLoading ? 'animate-spin mr-1' : 'mr-1'} />
                  {isMongoConnected && activeBackendId === 'mongodb-core' ? 'Re-Sync MongoDB' : 'Connect & Activate'}
                </Button>
              )}
              {cloudTab === 'sharepoint' && (
                <Button
                  variant="primary"
                  size="sm"
                  loading={testLoading}
                  onClick={handleConnectSp}
                >
                  <RefreshCw size={13} className={testLoading ? 'animate-spin mr-1' : 'mr-1'} />
                  {isSpConnected && activeBackendId === 'sharepoint-core' ? 'Re-Sync SharePoint' : 'Connect & Activate'}
                </Button>
              )}
              {cloudTab === 'onedrive' && (
                <Button
                  variant="primary"
                  size="sm"
                  loading={testLoading}
                  onClick={handleConnectOd}
                >
                  <RefreshCw size={13} className={testLoading ? 'animate-spin mr-1' : 'mr-1'} />
                  {isOdConnected && activeBackendId === 'onedrive-core' ? 'Re-Sync OneDrive' : 'Connect & Activate'}
                </Button>
              )}
              {cloudTab === 'gdrive' && (
                <Button
                  variant="primary"
                  size="sm"
                  loading={testLoading}
                  onClick={handleConnectGdrive}
                >
                  <Globe size={13} className={testLoading ? 'animate-spin mr-1' : 'mr-1'} />
                  {isGdriveConnected && activeBackendId === 'google-drive-core' ? 'Re-Sync Google Drive' : 'Sign In with Google'}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-300 leading-relaxed">
            Select and configure your cloud backend. Only one provider is designated as the <strong>Active Backend</strong> for synchronization and storage.
          </p>

          {/* Provider Selection Tabs (All 4 available backend storage options) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-xl bg-[#070B19] p-1 border border-[#1E2D52]">
            {/* Tab 1: MongoDB */}
            <button
              type="button"
              onClick={() => { setCloudTab('mongodb'); setTestResult(null); }}
              className={`py-2 px-1 rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                cloudTab === 'mongodb' 
                  ? 'bg-[#15203D] text-white shadow-md border border-[#2E5EFF]/40' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-1">
                <Database size={13} className={isMongoConnected ? 'text-emerald-400' : 'text-gray-400'} />
                <span>MongoDB</span>
              </div>
              {activeBackendId === 'mongodb-core' && isMongoConnected && (
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">Active</span>
              )}
            </button>

            {/* Tab 2: SharePoint */}
            <button
              type="button"
              onClick={() => { setCloudTab('sharepoint'); setTestResult(null); }}
              className={`py-2 px-1 rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                cloudTab === 'sharepoint' 
                  ? 'bg-[#15203D] text-white shadow-md border border-[#2E5EFF]/40' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-1">
                <Cloud size={13} className={isSpConnected ? 'text-blue-400' : 'text-gray-400'} />
                <span>SharePoint</span>
              </div>
              {activeBackendId === 'sharepoint-core' && isSpConnected && (
                <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[9px] font-bold">Active</span>
              )}
            </button>

            {/* Tab 3: OneDrive */}
            <button
              type="button"
              onClick={() => { setCloudTab('onedrive'); setTestResult(null); }}
              className={`py-2 px-1 rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                cloudTab === 'onedrive' 
                  ? 'bg-[#15203D] text-white shadow-md border border-[#2E5EFF]/40' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-1">
                <HardDrive size={13} className={isOdConnected ? 'text-sky-400' : 'text-gray-400'} />
                <span>OneDrive</span>
              </div>
              {activeBackendId === 'onedrive-core' && isOdConnected && (
                <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[9px] font-bold">Active</span>
              )}
            </button>

            {/* Tab 4: Google Drive */}
            <button
              type="button"
              onClick={() => { setCloudTab('gdrive'); setTestResult(null); }}
              className={`py-2 px-1 rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                cloudTab === 'gdrive' 
                  ? 'bg-[#15203D] text-white shadow-md border border-[#2E5EFF]/40' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-1">
                <Globe size={13} className={isGdriveConnected ? 'text-amber-400' : 'text-gray-400'} />
                <span>Google Drive</span>
              </div>
              {activeBackendId === 'google-drive-core' && isGdriveConnected && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">Active</span>
              )}
            </button>
          </div>

          {/* Tab 1: MongoDB Settings */}
          {cloudTab === 'mongodb' && (
            <div className="space-y-3 bg-[#0B1229]/60 p-4 rounded-xl border border-[#1e2d52]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Database size={16} className="text-[#00ED64]" />
                  <span>MongoDB Atlas / Enterprise Cluster</span>
                </div>
                {isMongoConnected && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={isDisconnecting}
                    onClick={() => handleDisconnect('mongodb-core')}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1 py-1 h-7"
                  >
                    <Unplug size={12} /> Disconnect
                  </Button>
                )}
              </div>

              <Input
                label="MongoDB Connection URI"
                value={mongoUri}
                onChange={e => setMongoUri(e.target.value)}
                placeholder="mongodb+srv://user:pass@cluster.mongodb.net/horizon_pm"
              />

              <Input
                label="Database Name"
                value={mongoDbName}
                onChange={e => setMongoDbName(e.target.value)}
                placeholder="horizon_pm"
              />
            </div>
          )}

          {/* Tab 2: SharePoint Settings */}
          {cloudTab === 'sharepoint' && (
            <div className="space-y-3 bg-[#0B1229]/60 p-4 rounded-xl border border-[#1e2d52]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Cloud size={16} className="text-[#2E5EFF]" />
                  <span>Microsoft SharePoint Core</span>
                </div>
                {isSpConnected && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={isDisconnecting}
                    onClick={() => handleDisconnect('sharepoint-core')}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1 py-1 h-7"
                  >
                    <Unplug size={12} /> Disconnect
                  </Button>
                )}
              </div>

              <Input
                label="Azure AD Tenant ID"
                value={spTenantId}
                onChange={e => setSpTenantId(e.target.value)}
                placeholder="e.g. common, organizations, or your directory ID"
              />

              <Input
                label="SharePoint Site URL or Path"
                value={spSiteUrl}
                onChange={e => setSpSiteUrl(e.target.value)}
                placeholder="https://company.sharepoint.com/sites/HorizonPM"
              />

              <Input
                label="Azure AD App Client ID"
                value={spClientId}
                onChange={e => setSpClientId(e.target.value)}
                placeholder="e.g. e4a5b6c7-d8e9-4f0a-1b2c-3d4e5f6a7b8c"
              />

              <Input
                label="Client Secret (Optional - for Enterprise Apps)"
                type="password"
                value={spClientSecret}
                onChange={e => setSpClientSecret(e.target.value)}
                placeholder="Leave empty for interactive sign-in"
              />

              <div className="p-2.5 rounded-lg bg-[#090E20] border border-[#1e2d52] text-[11px] space-y-1 mt-2">
                <div className="flex items-center gap-1.5 text-[#6087FF] font-semibold text-xs">
                  <Info size={13} className="shrink-0" />
                  <span>Azure Portal Setup Tip:</span>
                </div>
                <p className="text-gray-300 leading-relaxed">
                  Under <em>Authentication</em> &rarr; <em>Add a platform</em> &rarr; select <strong>Mobile and desktop applications</strong> &rarr; check <code className="text-amber-300 bg-amber-500/10 px-1 py-0.5 rounded">http://localhost</code>.
                </p>
              </div>
            </div>
          )}

          {/* Tab 3: OneDrive Settings */}
          {cloudTab === 'onedrive' && (
            <div className="space-y-3 bg-[#0B1229]/60 p-4 rounded-xl border border-[#1e2d52]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <HardDrive size={16} className="text-[#0078D4]" />
                  <span>Microsoft OneDrive for Business</span>
                </div>
                {isOdConnected && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={isDisconnecting}
                    onClick={() => handleDisconnect('onedrive-core')}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1 py-1 h-7"
                  >
                    <Unplug size={12} /> Disconnect
                  </Button>
                )}
              </div>

              <Input
                label="Azure AD Tenant ID"
                value={odTenantId}
                onChange={e => setOdTenantId(e.target.value)}
                placeholder="organizations or your directory tenant ID"
              />

              <Input
                label="Azure AD App Client ID"
                value={odClientId}
                onChange={e => setOdClientId(e.target.value)}
                placeholder="e.g. 1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d"
              />

              <Input
                label="Target Cloud Folder Path"
                value={odFolderPath}
                onChange={e => setOdFolderPath(e.target.value)}
                placeholder="/HorizonPM/Documents"
              />

              <div className="p-2.5 rounded-lg bg-[#090E20] border border-[#1e2d52] text-[11px] space-y-1 mt-2">
                <div className="flex items-center gap-1.5 text-sky-400 font-semibold text-xs">
                  <Info size={13} className="shrink-0" />
                  <span>Azure Portal OneDrive Setup:</span>
                </div>
                <p className="text-gray-300 leading-relaxed">
                  Requires <strong>Files.ReadWrite.All</strong> delegated permission in your Azure AD enterprise directory with <code className="text-sky-300 bg-sky-500/10 px-1 py-0.5 rounded">http://localhost</code> desktop redirect.
                </p>
              </div>
            </div>
          )}

          {/* Tab 4: Google Drive Settings */}
          {cloudTab === 'gdrive' && (
            <div className="space-y-3 bg-[#0B1229]/60 p-4 rounded-xl border border-[#1e2d52]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Globe size={16} className="text-[#F5A623]" />
                  <span>Google Drive (Personal & Enterprise)</span>
                </div>
                {isGdriveConnected && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={isDisconnecting}
                    onClick={() => handleDisconnect('google-drive-core')}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1 py-1 h-7"
                  >
                    <Unplug size={12} /> Disconnect
                  </Button>
                )}
              </div>

              <Input
                label="Google Cloud OAuth Client ID"
                value={gdriveClientId}
                onChange={e => setGdriveClientId(e.target.value)}
                placeholder="e.g. 123456789-xyz.apps.googleusercontent.com"
              />

              <Input
                label="Google Cloud OAuth Client Secret"
                type="password"
                value={gdriveClientSecret}
                onChange={e => setGdriveClientSecret(e.target.value)}
                placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
              />

              <Input
                label="Target Google Drive Folder"
                value={gdriveFolderPath}
                onChange={e => setGdriveFolderPath(e.target.value)}
                placeholder="/HorizonPM"
              />

              <div className="p-2.5 rounded-lg bg-[#090E20] border border-[#1e2d52] text-[11px] space-y-1.5 mt-2">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                  <Info size={13} className="shrink-0" />
                  <span>Google Cloud Console Requirements:</span>
                </div>
                <p className="text-gray-300 leading-relaxed">
                  1. In <strong>Credentials</strong> &rarr; create <strong>OAuth client ID</strong> of Application type <strong>Desktop app</strong>.
                </p>
                <p className="text-amber-300/90 leading-relaxed">
                  2. <strong>Crucial:</strong> Enable <strong>Google Drive API</strong> under <em>Enabled APIs & Services</em> in your Google Cloud project (or visit <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noreferrer" className="underline font-bold text-amber-200">Google Drive API Library</a>). Otherwise, Google rejects sync requests with 403 Forbidden.
                </p>
              </div>
            </div>
          )}

          {/* Diagnostic Result Box */}
          {testResult && (
            <div className={`p-3 rounded-lg border text-xs animate-fadeIn ${
              testResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              <div className="flex items-start gap-2">
                {testResult.success ? (
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{testResult.success ? 'Success' : 'Connection Failed'}</p>
                  <p className="mt-1 leading-relaxed">{testResult.message}</p>
                  {testResult.collections && testResult.collections.length > 0 && (
                    <p className="mt-1 text-gray-400 text-[11px]">
                      Collections found: {testResult.collections.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

