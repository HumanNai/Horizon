import React, { useEffect, useState } from 'react'
import { Card, Button, Badge, Modal, Input, Select } from '../components/ui'
import { 
  Settings, 
  ExternalLink, 
  CheckCircle2, 
  ShieldCheck, 
  RefreshCw, 
  Key, 
  Globe, 
  Cloud, 
  HardDrive, 
  Layers, 
  AlertCircle,
  Database,
  ArrowRight,
  Server,
  Zap,
  Check,
  HelpCircle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Copy,
  Info,
  Terminal,
  Activity,
  Wifi,
  Trash2,
  Play,
  UploadCloud,
  ShieldAlert,
  KeyRound,
  Lock
} from 'lucide-react'
import { PluginConfig, SyncState, DiagnosticLog, BackendDiagnosticResult } from '../types'
import { useAuthStore } from '../store/authStore'

export function Plugins() {
  const currentUser = useAuthStore(state => state.user)
  const [plugins, setPlugins] = useState<PluginConfig[]>([])
  const [activeBackend, setActiveBackend] = useState<string>('local')
  const [isLoginCloudLocked, setIsLoginCloudLocked] = useState(false)
  const [pluginCategory, setPluginCategory] = useState<'all' | 'storage' | 'security' | 'diagnostics'>('all')
  const [syncState, setSyncState] = useState<SyncState>({ status: 'offline', pendingChanges: 0 })
  const [isSyncing, setIsSyncing] = useState(false)
  const [loading, setLoading] = useState(true)

  if (currentUser?.role !== 'ProductOwner') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center max-w-sm mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
          <ShieldAlert size={28} />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Access Restricted</h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          Cloud backend and plugin infrastructure configuration is reserved exclusively for the Product Owner role.
        </p>
      </div>
    )
  }

  // Expandable Guide Toggles per card
  const [showSpGuide, setShowSpGuide] = useState(false)
  const [showOdGuide, setShowOdGuide] = useState(false)
  const [showGdriveGuide, setShowGdriveGuide] = useState(false)
  const [showMongoGuide, setShowMongoGuide] = useState(false)
  const [showAkvGuide, setShowAkvGuide] = useState(false)

  // SharePoint Modal State
  const [isSpModalOpen, setIsSpModalOpen] = useState(false)
  const [spTenantId, setSpTenantId] = useState('')
  const [spSiteUrl, setSpSiteUrl] = useState('')
  const [spClientId, setSpClientId] = useState('')
  const [spClientSecret, setSpClientSecret] = useState('')
  const [showSpSecret, setShowSpSecret] = useState(false)
  const [spScope, setSpScope] = useState('Sites.ReadWrite.All')
  const [isConnectingSp, setIsConnectingSp] = useState(false)
  const [spError, setSpError] = useState<string | null>(null)
  const [showModalSpGuide, setShowModalSpGuide] = useState(false)

  // OneDrive Modal State
  const [isOdModalOpen, setIsOdModalOpen] = useState(false)
  const [odTenantId, setOdTenantId] = useState('')
  const [odClientId, setOdClientId] = useState('')
  const [odDriveType, setOdDriveType] = useState('personal')
  const [odFolderPath, setOdFolderPath] = useState('/HorizonPM/Documents')
  const [isConnectingOd, setIsConnectingOd] = useState(false)
  const [odError, setOdError] = useState<string | null>(null)
  const [showModalOdGuide, setShowModalOdGuide] = useState(false)

  // Google Drive Modal State
  const [isGdriveModalOpen, setIsGdriveModalOpen] = useState(false)
  const [gdriveClientId, setGdriveClientId] = useState('')
  const [gdriveClientSecret, setGdriveClientSecret] = useState('')
  const [showGdriveSecret, setShowGdriveSecret] = useState(false)
  const [gdriveFolderPath, setGdriveFolderPath] = useState('/HorizonPM')
  const [isConnectingGdrive, setIsConnectingGdrive] = useState(false)
  const [gdriveError, setGdriveError] = useState<string | null>(null)
  const [showModalGdriveGuide, setShowModalGdriveGuide] = useState(false)

  // MongoDB Modal State
  const [isMongoModalOpen, setIsMongoModalOpen] = useState(false)
  const [mongoUri, setMongoUri] = useState('')
  const [mongoDbName, setMongoDbName] = useState('horizon_pm')
  const [isConnectingMongo, setIsConnectingMongo] = useState(false)
  const [mongoError, setMongoError] = useState<string | null>(null)
  const [showModalMongoGuide, setShowModalMongoGuide] = useState(false)

  // Azure Key Vault Modal State
  const [isAkvModalOpen, setIsAkvModalOpen] = useState(false)
  const [akvVaultUrl, setAkvVaultUrl] = useState('')
  const [akvTenantId, setAkvTenantId] = useState('')
  const [akvClientId, setAkvClientId] = useState('')
  const [akvClientSecret, setAkvClientSecret] = useState('')
  const [akvAuthType, setAkvAuthType] = useState('client_secret')
  const [showAkvSecret, setShowAkvSecret] = useState(false)
  const [isConnectingAkv, setIsConnectingAkv] = useState(false)
  const [akvError, setAkvError] = useState<string | null>(null)
  const [showModalAkvGuide, setShowModalAkvGuide] = useState(false)

  const [copiedText, setCopiedText] = useState<string | null>(null)

  // Diagnostic Console & Unified Multi-Plugin Tooling State
  const [logs, setLogs] = useState<DiagnosticLog[]>([])
  const [logFilter, setLogFilter] = useState<'all' | 'sharepoint' | 'onedrive' | 'gdrive' | 'mongodb' | 'keyvault' | 'sync' | 'error'>('all')
  const [selectedDiagTarget, setSelectedDiagTarget] = useState<string>('active')
  const [isTestingBackend, setIsTestingBackend] = useState(false)
  const [diagTestResult, setDiagTestResult] = useState<BackendDiagnosticResult | null>(null)
  const [isSeedingBackend, setIsSeedingBackend] = useState(false)
  const [seedSuccessMsg, setSeedSuccessMsg] = useState<string | null>(null)

  // Per-Modal Test State
  const [spModalTestResult, setSpModalTestResult] = useState<BackendDiagnosticResult | null>(null)
  const [isSpModalTesting, setIsSpModalTesting] = useState(false)
  const [odModalTestResult, setOdModalTestResult] = useState<BackendDiagnosticResult | null>(null)
  const [isOdModalTesting, setIsOdModalTesting] = useState(false)
  const [gdriveModalTestResult, setGdriveModalTestResult] = useState<BackendDiagnosticResult | null>(null)
  const [isGdriveModalTesting, setIsGdriveModalTesting] = useState(false)
  const [mongoModalTestResult, setMongoModalTestResult] = useState<BackendDiagnosticResult | null>(null)
  const [isMongoModalTesting, setIsMongoModalTesting] = useState(false)
  const [akvModalTestResult, setAkvModalTestResult] = useState<BackendDiagnosticResult | null>(null)
  const [isAkvModalTesting, setIsAkvModalTesting] = useState(false)
  const consoleBottomRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadAll()

    if ((window as any).horizon?.sync?.onStatus) {
      (window as any).horizon.sync.onStatus((status: SyncState) => {
        setSyncState(status)
      })
    }

    if ((window as any).horizon?.plugins?.getLogs) {
      (window as any).horizon.plugins.getLogs().then((initialLogs: DiagnosticLog[]) => {
        if (Array.isArray(initialLogs)) setLogs(initialLogs)
      }).catch(() => {})
    }

    if ((window as any).horizon?.plugins?.onLog) {
      (window as any).horizon.plugins.onLog((entry: DiagnosticLog) => {
        setLogs(prev => [...prev.slice(-200), entry])
      })
    }
  }, [])

  useEffect(() => {
    consoleBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const loadAll = async () => {
    setLoading(true)
    try {
      if ((window as any).horizon?.plugins?.getAppSetting) {
        const locked = await (window as any).horizon.plugins.getAppSetting('cloud_settings_locked_login')
        setIsLoginCloudLocked(locked === 'true' || localStorage.getItem('horizon_cloud_setup_locked') === 'true')
      } else {
        setIsLoginCloudLocked(localStorage.getItem('horizon_cloud_setup_locked') === 'true')
      }

      if ((window as any).horizon?.plugins?.getActiveBackend) {
        const active = await (window as any).horizon.plugins.getActiveBackend()
        setActiveBackend(active === 'none' ? 'local' : (active || 'local'))
      }

      if ((window as any).horizon?.plugins?.list) {
        const list: PluginConfig[] = await (window as any).horizon.plugins.list()
        setPlugins(list)

        const sp = list.find(p => p.pluginId === 'sharepoint-core')
        if (sp && sp.settings) {
          setSpTenantId(sp.settings.tenantId || '')
          setSpSiteUrl(sp.settings.siteUrl || '')
          setSpClientId(sp.settings.clientId || '')
          setSpClientSecret(sp.settings.clientSecret || '')
          setSpScope(sp.settings.permissionScope || 'Sites.ReadWrite.All')
        }

        const od = list.find(p => p.pluginId === 'onedrive-core')
        if (od && od.settings) {
          setOdTenantId(od.settings.tenantId || '')
          setOdClientId(od.settings.clientId || '')
          setOdDriveType(od.settings.driveType || 'personal')
          setOdFolderPath(od.settings.folderPath || '/HorizonPM/Documents')
        }

        const gdrive = list.find(p => p.pluginId === 'google-drive-core')
        if (gdrive && gdrive.settings) {
          setGdriveClientId(gdrive.settings.clientId || '')
          setGdriveClientSecret(gdrive.settings.clientSecret || '')
          setGdriveFolderPath(gdrive.settings.folderPath || '/HorizonPM')
        }

        const mongo = list.find(p => p.pluginId === 'mongodb-core')
        if (mongo && mongo.settings) {
          setMongoUri(mongo.settings.connectionUri || '')
          setMongoDbName(mongo.settings.databaseName || 'horizon_pm')
        }

        const akv = list.find(p => p.pluginId === 'azure-keyvault')
        if (akv && akv.settings) {
          setAkvVaultUrl(akv.settings.vaultUrl || '')
          setAkvTenantId(akv.settings.tenantId || '')
          setAkvClientId(akv.settings.clientId || '')
          setAkvClientSecret(akv.settings.clientSecret || '')
          setAkvAuthType(akv.settings.authType || (akv.settings.clientSecret ? 'client_secret' : 'interactive'))
        }
      }

      if ((window as any).horizon?.sync?.getState) {
        const state = await (window as any).horizon.sync.getState()
        setSyncState(state)
      }
    } catch (err) {
      console.error('Failed to load plugin configuration:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(label)
    setTimeout(() => setCopiedText(null), 2000)
  }

  const handleSelectActiveBackend = async (backendId: string) => {
    try {
      if ((window as any).horizon?.plugins?.setActiveBackend) {
        await (window as any).horizon.plugins.setActiveBackend(backendId)
        setActiveBackend(backendId)
      }
      handleTriggerSync()
    } catch (err) {
      console.error('Failed to switch active backend:', err)
    }
  }

  const handleTriggerSync = async () => {
    setIsSyncing(true)
    try {
      if ((window as any).horizon?.sync?.trigger) {
        await (window as any).horizon.sync.trigger()
      }
      if ((window as any).horizon?.sync?.getState) {
        const state = await (window as any).horizon.sync.getState()
        setSyncState(state)
      }
    } catch (err) {
      console.error('Manual sync failed:', err)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleToggleLoginLock = async () => {
    const nextState = !isLoginCloudLocked
    try {
      if ((window as any).horizon?.plugins?.setAppSetting) {
        await (window as any).horizon.plugins.setAppSetting('cloud_settings_locked_login', nextState ? 'true' : 'false')
      }
      localStorage.setItem('horizon_cloud_setup_locked', nextState ? 'true' : 'false')
      setIsLoginCloudLocked(nextState)
    } catch (err) {
      console.error('Failed to toggle login lock:', err)
    }
  }

  // Azure Key Vault Actions
  const handleSaveAndConnectAkv = async () => {
    setIsConnectingAkv(true)
    setAkvError(null)
    try {
      await (window as any).horizon.plugins.saveConfig('azure-keyvault', {
        vaultUrl: akvVaultUrl.trim(),
        tenantId: akvTenantId.trim(),
        clientId: akvClientId.trim(),
        clientSecret: akvClientSecret.trim(),
        authType: akvAuthType
      })
      await (window as any).horizon.plugins.connect('azure-keyvault')
      await loadAll()
      setIsAkvModalOpen(false)
    } catch (err: any) {
      setAkvError(err.message || 'Failed to authenticate with Azure Key Vault')
    } finally {
      setIsConnectingAkv(false)
    }
  }

  const handleDisconnectAkv = async () => {
    try {
      await (window as any).horizon.plugins.disconnect('azure-keyvault')
      await loadAll()
    } catch (err) {
      console.error('Failed to disconnect Azure Key Vault:', err)
    }
  }

  // SharePoint Actions
  const handleSaveAndConnectSp = async () => {
    setIsConnectingSp(true)
    setSpError(null)
    try {
      await (window as any).horizon.plugins.saveConfig('sharepoint-core', {
        tenantId: spTenantId.trim(),
        siteUrl: spSiteUrl.trim(),
        clientId: spClientId.trim(),
        clientSecret: spClientSecret.trim(),
        permissionScope: spScope
      })
      await (window as any).horizon.plugins.connect('sharepoint-core')
      await (window as any).horizon.plugins.setActiveBackend('sharepoint-core')
      setActiveBackend('sharepoint-core')
      await loadAll()
      setIsSpModalOpen(false)
      handleTriggerSync()
    } catch (err: any) {
      setSpError(err.message || 'Failed to authenticate with SharePoint')
    } finally {
      setIsConnectingSp(false)
    }
  }

  const handleDisconnectSp = async () => {
    try {
      await (window as any).horizon.plugins.disconnect('sharepoint-core')
      await loadAll()
    } catch (err) {
      console.error('Failed to disconnect SharePoint:', err)
    }
  }

  // OneDrive Actions
  const handleSaveAndConnectOd = async () => {
    setIsConnectingOd(true)
    setOdError(null)
    try {
      await (window as any).horizon.plugins.saveConfig('onedrive-core', {
        tenantId: odTenantId.trim(),
        clientId: odClientId.trim(),
        driveType: odDriveType,
        folderPath: odFolderPath.trim()
      })
      await (window as any).horizon.plugins.connect('onedrive-core')
      await (window as any).horizon.plugins.setActiveBackend('onedrive-core')
      setActiveBackend('onedrive-core')
      await loadAll()
      setIsOdModalOpen(false)
      handleTriggerSync()
    } catch (err: any) {
      setOdError(err.message || 'Failed to authenticate with OneDrive')
    } finally {
      setIsConnectingOd(false)
    }
  }

  const handleDisconnectOd = async () => {
    try {
      await (window as any).horizon.plugins.disconnect('onedrive-core')
      await loadAll()
    } catch (err) {
      console.error('Failed to disconnect OneDrive:', err)
    }
  }

  // Google Drive Actions
  const handleSaveAndConnectGdrive = async () => {
    setIsConnectingGdrive(true)
    setGdriveError(null)
    try {
      await (window as any).horizon.plugins.saveConfig('google-drive-core', {
        clientId: gdriveClientId.trim(),
        clientSecret: gdriveClientSecret.trim(),
        folderPath: gdriveFolderPath.trim() || '/HorizonPM'
      })
      await (window as any).horizon.plugins.connect('google-drive-core')
      await (window as any).horizon.plugins.setActiveBackend('google-drive-core')
      setActiveBackend('google-drive-core')
      await loadAll()
      setIsGdriveModalOpen(false)
      handleTriggerSync()
    } catch (err: any) {
      setGdriveError(err.message || 'Failed to connect to Google Drive')
    } finally {
      setIsConnectingGdrive(false)
    }
  }

  const handleDisconnectGdrive = async () => {
    try {
      await (window as any).horizon.plugins.disconnect('google-drive-core')
      await loadAll()
    } catch (err) {
      console.error('Failed to disconnect Google Drive:', err)
    }
  }

  // MongoDB Actions
  const handleSaveAndConnectMongo = async () => {
    setIsConnectingMongo(true)
    setMongoError(null)
    try {
      await (window as any).horizon.plugins.saveConfig('mongodb-core', {
        connectionUri: mongoUri.trim(),
        databaseName: mongoDbName.trim()
      })
      await (window as any).horizon.plugins.connect('mongodb-core')
      await (window as any).horizon.plugins.setActiveBackend('mongodb-core')
      setActiveBackend('mongodb-core')
      await loadAll()
      setIsMongoModalOpen(false)
      handleTriggerSync()
    } catch (err: any) {
      setMongoError(err.message || 'Failed to connect to MongoDB')
    } finally {
      setIsConnectingMongo(false)
    }
  }

  const handleDisconnectMongo = async () => {
    try {
      await (window as any).horizon.plugins.disconnect('mongodb-core')
      await loadAll()
    } catch (err) {
      console.error('Failed to disconnect MongoDB:', err)
    }
  }

  const handleTestBackend = async (pluginId?: string, overrideSettings?: any, targetModal?: 'sp' | 'od' | 'gdrive' | 'mongo' | 'akv') => {
    if (targetModal === 'sp') {
      setIsSpModalTesting(true)
      setSpModalTestResult(null)
    } else if (targetModal === 'od') {
      setIsOdModalTesting(true)
      setOdModalTestResult(null)
    } else if (targetModal === 'gdrive') {
      setIsGdriveModalTesting(true)
      setGdriveModalTestResult(null)
    } else if (targetModal === 'mongo') {
      setIsMongoModalTesting(true)
      setMongoModalTestResult(null)
    } else if (targetModal === 'akv') {
      setIsAkvModalTesting(true)
      setAkvModalTestResult(null)
    } else {
      setIsTestingBackend(true)
      setDiagTestResult(null)
    }

    try {
      const target = pluginId === 'active' ? undefined : pluginId
      const res = await (window as any).horizon.plugins.testConnection(target, overrideSettings)
      if (targetModal === 'sp') setSpModalTestResult(res)
      else if (targetModal === 'od') setOdModalTestResult(res)
      else if (targetModal === 'gdrive') setGdriveModalTestResult(res)
      else if (targetModal === 'mongo') setMongoModalTestResult(res)
      else if (targetModal === 'akv') setAkvModalTestResult(res)
      else setDiagTestResult(res)
    } catch (err: any) {
      const errObj: BackendDiagnosticResult = {
        success: false,
        pingMs: 0,
        providerId: pluginId || activeBackend,
        providerName: pluginId || activeBackend,
        clusterInfo: 'Error',
        databaseOrPath: 'N/A',
        collectionsOrLists: [],
        error: err.message || 'Connection test failed'
      }
      if (targetModal === 'sp') setSpModalTestResult(errObj)
      else if (targetModal === 'od') setOdModalTestResult(errObj)
      else if (targetModal === 'gdrive') setGdriveModalTestResult(errObj)
      else if (targetModal === 'mongo') setMongoModalTestResult(errObj)
      else if (targetModal === 'akv') setAkvModalTestResult(errObj)
      else setDiagTestResult(errObj)
    } finally {
      if (targetModal === 'sp') setIsSpModalTesting(false)
      else if (targetModal === 'od') setIsOdModalTesting(false)
      else if (targetModal === 'gdrive') setIsGdriveModalTesting(false)
      else if (targetModal === 'mongo') setIsMongoModalTesting(false)
      else if (targetModal === 'akv') setIsAkvModalTesting(false)
      else setIsTestingBackend(false)
    }
  }

  const handleSeedBackend = async (pluginId?: string) => {
    setIsSeedingBackend(true)
    setSeedSuccessMsg(null)
    try {
      const target = pluginId === 'active' ? undefined : pluginId
      const res = await (window as any).horizon.plugins.seedBackend(target)
      setSeedSuccessMsg(`Successfully synchronized ${res.total} total records to [${res.providerId}] across ${Object.keys(res.pushed || {}).length} lists/collections!`)
      await loadAll()
    } catch (err: any) {
      alert(`Seeding failed: ${err.message}`)
    } finally {
      setIsSeedingBackend(false)
    }
  }

  const handleClearLogs = () => {
    setLogs([])
  }

  const handleCopyLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.source}] [${l.level.toUpperCase()}] ${l.message} ${l.details ? `\nDetails: ${l.details}` : ''}`).join('\n')
    navigator.clipboard.writeText(text)
    setCopiedText('logs')
    setTimeout(() => setCopiedText(null), 2000)
  }

  const spConfig = plugins.find(p => p.pluginId === 'sharepoint-core')
  const odConfig = plugins.find(p => p.pluginId === 'onedrive-core')
  const gdriveConfig = plugins.find(p => p.pluginId === 'google-drive-core')
  const mongoConfig = plugins.find(p => p.pluginId === 'mongodb-core')
  const akvConfig = plugins.find(p => p.pluginId === 'azure-keyvault')

  const getActiveBackendLabel = () => {
    if (activeBackend === 'sharepoint-core' && spConfig?.status === 'connected') return 'Microsoft SharePoint (Cloud Sync Active)'
    if (activeBackend === 'onedrive-core' && odConfig?.status === 'connected') return 'Microsoft OneDrive (Cloud Storage Active)'
    if (activeBackend === 'google-drive-core' && gdriveConfig?.status === 'connected') return 'Google Drive (Cloud Storage & Sync Active)'
    if ((activeBackend === 'mongodb-core' || activeBackend === 'mongodb') && mongoConfig?.status === 'connected') return 'MongoDB Enterprise (GridFS Active)'
    return 'Local SQLite & Filesystem (Offline First Engine)'
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Banner & Active Backend Selector */}
      <div className="p-6 rounded-2xl bg-[#0A1024]/95 border border-[#15203D] shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Settings className="text-[#2E5EFF]" size={22} />
              <h2 className="text-xl font-black text-white tracking-tight">Plugins & Integrations Hub</h2>
            </div>
            <p className="text-xs text-gray-400 mt-1 max-w-3xl leading-relaxed">
              Horizon operates with an offline-first architecture. All core functions run locally with zero latency, and can synchronize with Microsoft SharePoint, OneDrive, Google Drive, MongoDB, or Azure Key Vault whenever cloud integration is desired.
            </p>
          </div>

          {/* Sync Status Badge & Button */}
          <div className="flex items-center gap-3 bg-[#070B19] border border-[#19264A] p-3 rounded-xl shrink-0">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                syncState.status === 'syncing' ? 'bg-amber-400 animate-ping' :
                syncState.status === 'idle' ? 'bg-emerald-400' :
                syncState.status === 'error' ? 'bg-rose-500' : 'bg-blue-400'
              }`} />
              <div>
                <div className="text-[11px] font-bold text-white capitalize">
                  {syncState.status === 'syncing' ? 'Synchronizing...' :
                   syncState.status === 'idle' ? 'In Sync' :
                   syncState.status === 'error' ? 'Sync Error' : 'Local SQLite Active'}
                </div>
                <div className="text-[10px] text-gray-400 font-mono">
                  {syncState.pendingChanges > 0 ? `${syncState.pendingChanges} pending mutations` : '0 pending'}
                </div>
              </div>
            </div>

            <Button 
              size="sm" 
              variant="secondary" 
              onClick={handleTriggerSync} 
              loading={isSyncing}
              className="text-xs ml-2 h-8 px-3 gap-1.5 border-[#2E5EFF]/30 hover:border-[#2E5EFF]"
            >
              <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} /> Sync Now
            </Button>
          </div>
        </div>

        {/* Active Backend Selector Bar */}
        <div className="p-3.5 rounded-xl bg-[#070B19] border border-[#1E2D52] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-amber-400" />
            <span className="text-gray-400">Current Primary Backend:</span>
            <span className="font-bold text-white px-2.5 py-0.5 rounded-full bg-[#111C3D] border border-[#2E5EFF]/40 text-[#8FA7FF] font-mono">
              {getActiveBackendLabel()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400">Switch Primary Backend:</span>
            <select
              value={activeBackend === 'none' ? 'local' : activeBackend}
              onChange={e => handleSelectActiveBackend(e.target.value)}
              className="bg-[#0A1024] border border-[#19264A] rounded-lg px-3 py-1 text-xs text-white focus:outline-none focus:border-[#2E5EFF]"
            >
              <option value="local">Local SQLite & Filesystem (Default)</option>
              <option value="sharepoint-core" disabled={spConfig?.status !== 'connected'}>
                SharePoint {spConfig?.status === 'connected' ? '(Ready)' : '(Not Connected)'}
              </option>
              <option value="onedrive-core" disabled={odConfig?.status !== 'connected'}>
                OneDrive {odConfig?.status === 'connected' ? '(Ready)' : '(Not Connected)'}
              </option>
              <option value="google-drive-core" disabled={gdriveConfig?.status !== 'connected'}>
                Google Drive {gdriveConfig?.status === 'connected' ? '(Ready)' : '(Not Connected)'}
              </option>
              <option value="mongodb-core" disabled={mongoConfig?.status !== 'connected'}>
                MongoDB {mongoConfig?.status === 'connected' ? '(Ready)' : '(Not Connected)'}
              </option>
            </select>
          </div>
        </div>

        {/* Login Screen Credential Protection Bar */}
        <div className="p-3.5 rounded-xl bg-[#070B19] border border-[#1E2D52] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className={isLoginCloudLocked ? "text-emerald-400" : "text-amber-400"} />
            <span className="text-gray-400">Login Screen Cloud Settings:</span>
            <span className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
              isLoginCloudLocked 
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" 
                : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
            }`}>
              {isLoginCloudLocked ? 'Locked (Credentials Hidden from Login Screen)' : 'Unlocked (Configurable on Login Screen)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-[11px] hidden sm:inline">
              {isLoginCloudLocked ? 'Protects credentials from unauthenticated viewers' : 'Allows initial cloud setup before sign-in'}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleToggleLoginLock}
              className="text-xs h-7 px-3 border-[#1E2D52] hover:border-[#2E5EFF]"
            >
              {isLoginCloudLocked ? 'Unlock on Login Screen' : 'Lock on Login Screen'}
            </Button>
          </div>
        </div>

        {/* Multi-Connection Explanation Card */}
        <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/20 text-xs text-blue-200 flex items-start gap-2">
          <Info size={16} className="text-[#2E5EFF] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Pluggable Architecture:</strong> Configure only what your team needs. Local SQLite runs 100% offline out-of-the-box. Connecting Azure Key Vault provides HSM secrets management, while SharePoint, OneDrive, Google Drive, or MongoDB enable cloud synchronization for team collaboration.
          </div>
        </div>
      </div>

      {/* Plugin Categories Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#0B1229]/90 border border-[#172347] rounded-2xl">
        <button
          onClick={() => setPluginCategory('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            pluginCategory === 'all'
              ? 'bg-[#2E5EFF] text-white shadow-lg shadow-[#2E5EFF]/20'
              : 'text-gray-400 hover:text-white hover:bg-[#15203D]'
          }`}
        >
          All Integrations (6)
        </button>
        <button
          onClick={() => setPluginCategory('storage')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            pluginCategory === 'storage'
              ? 'bg-[#2E5EFF] text-white shadow-lg shadow-[#2E5EFF]/20'
              : 'text-gray-400 hover:text-white hover:bg-[#15203D]'
          }`}
        >
          <Database size={14} /> Storage & Cloud Backends (5)
        </button>
        <button
          onClick={() => setPluginCategory('security')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            pluginCategory === 'security'
              ? 'bg-[#2E5EFF] text-white shadow-lg shadow-[#2E5EFF]/20'
              : 'text-gray-400 hover:text-white hover:bg-[#15203D]'
          }`}
        >
          <KeyRound size={14} /> Security & HSM Vaults (1)
        </button>
        <button
          onClick={() => setPluginCategory('diagnostics')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            pluginCategory === 'diagnostics'
              ? 'bg-[#2E5EFF] text-white shadow-lg shadow-[#2E5EFF]/20'
              : 'text-gray-400 hover:text-white hover:bg-[#15203D]'
          }`}
        >
          <Activity size={14} /> Diagnostic Console
        </button>
      </div>

      {/* Backend Providers & Security Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Provider 0: Local SQLite & Filesystem */}
        {(pluginCategory === 'all' || pluginCategory === 'storage') && (
          <div className={`rounded-2xl bg-[#0A1024]/95 border transition-all p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden ${
            activeBackend === 'local' || activeBackend === 'none' ? 'border-[#2E5EFF] ring-1 ring-[#2E5EFF]' : 'border-[#15203D] hover:border-[#2E5EFF]/40'
          }`}>
            {(activeBackend === 'local' || activeBackend === 'none') && (
              <div className="absolute top-0 right-0 bg-[#2E5EFF] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl flex items-center gap-1 shadow-lg">
                <Check size={12} /> Active Backend
              </div>
            )}

            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <HardDrive size={24} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-gray-400 bg-[#15203D] px-2 py-0.5 rounded-md">Local Storage</span>
                  <Badge variant="success">Connected</Badge>
                </div>
              </div>

              <h3 className="text-lg font-bold text-white mb-1">Local SQLite & Storage</h3>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">
                Ultra-fast, zero-latency local relational engine with Write-Ahead Logging (WAL) and client filesystem storage. 100% offline functionality.
              </p>

              <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl mb-3 font-mono truncate">
                ✓ Engine: SQLite 3.45 (WAL) • &lt;1ms
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-[#15203D]">
              {activeBackend === 'local' || activeBackend === 'none' ? (
                <div className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-[#2E5EFF]/10 text-[#8FA7FF] text-xs font-semibold border border-[#2E5EFF]/20">
                  <CheckCircle2 size={14} /> Currently Active Default
                </div>
              ) : (
                <Button size="sm" onClick={() => handleSelectActiveBackend('local')} className="w-full">
                  Switch to Local SQLite
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Provider 1: Microsoft SharePoint */}
        {(pluginCategory === 'all' || pluginCategory === 'storage') && (
        <div className={`rounded-2xl bg-[#0A1024]/95 border transition-all p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden ${
          activeBackend === 'sharepoint-core' && spConfig?.status === 'connected' ? 'border-[#2E5EFF] ring-1 ring-[#2E5EFF]' : 'border-[#15203D] hover:border-[#2E5EFF]/40'
        }`}>
          {activeBackend === 'sharepoint-core' && spConfig?.status === 'connected' && (
            <div className="absolute top-0 right-0 bg-[#2E5EFF] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl flex items-center gap-1 shadow-lg">
              <Check size={12} /> Active Backend
            </div>
          )}

          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#0E152E] border border-[#1A264D] flex items-center justify-center text-[#2E5EFF]">
                <Database size={24} />
              </div>
              <Badge variant={spConfig?.status === 'connected' ? 'success' : spConfig?.status === 'error' ? 'danger' : 'neutral'}>
                {spConfig?.status === 'connected' ? 'Connected' : spConfig?.status === 'error' ? 'Error' : 'Disconnected'}
              </Badge>
            </div>

            <h3 className="text-lg font-bold text-white mb-1">Microsoft SharePoint</h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Handles <strong className="text-gray-200">100% of operations</strong> via your SharePoint site: structured lists for data sync and Shared Documents library for files.
            </p>

            {spConfig?.connectedAs && (
              <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl mb-3 font-mono truncate">
                ✓ Account: {spConfig.connectedAs}
              </div>
            )}

            {spConfig?.status === 'error' && spConfig.error && (
              <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl mb-3 font-mono truncate">
                ⚠ {spConfig.error}
              </div>
            )}

            {/* Expandable Step-by-Step Connection Guide */}
            <div className="mb-4">
              <button
                onClick={() => setShowSpGuide(!showSpGuide)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#070B19] hover:bg-[#0D152E] border border-[#19264A] text-xs font-semibold text-gray-300 transition-colors text-left"
              >
                <span className="flex items-center gap-1.5 text-[#8FA7FF]">
                  <BookOpen size={14} /> How to get details & connect
                </span>
                {showSpGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showSpGuide && (
                <div className="mt-2.5 p-3 rounded-xl bg-[#070B19] border border-[#19264A] text-[11px] text-gray-300 space-y-2.5 animate-fadeIn max-h-72 overflow-y-auto custom-scrollbar overflow-x-hidden">
                  <div className="font-bold text-[#8FA7FF] border-b border-[#1E2D52] pb-1">
                    Azure Portal & Existing App Registration Guide:
                  </div>

                  <div className="p-2 rounded-lg bg-blue-950/40 border border-blue-500/20 text-[10px] text-blue-200">
                    💡 <strong>Using an existing Azure App?</strong> Yes! In Azure AD, App Registrations are tenant-wide and can access <em>any</em> SharePoint site in your tenant as long as permissions are granted.
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-[#2E5EFF]/20 text-[#2E5EFF] font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <div className="min-w-0 flex-1 break-words">
                        <span>Log in to </span>
                        <a href="https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps" target="_blank" rel="noreferrer" className="text-[#2E5EFF] underline inline-flex items-center gap-0.5">
                          Azure Portal <ExternalLink size={10} />
                        </a>
                        <span> &rarr; <strong>App registrations</strong> &rarr; Select your existing app (or create a new one).</span>
                      </div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-[#2E5EFF]/20 text-[#2E5EFF] font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <div className="min-w-0 flex-1 break-words">
                        In <strong>API permissions</strong> &rarr; Add <strong>Microsoft Graph</strong>:
                        <ul className="list-disc list-inside mt-0.5 text-gray-400 text-[10px]">
                          <li><code className="text-white">Sites.ReadWrite.All</code> (or Sites.Selected)</li>
                          <li><code className="text-white">Files.ReadWrite.All</code></li>
                          <li><code className="text-white">User.Read</code></li>
                        </ul>
                        Click <strong>Grant admin consent</strong>.
                      </div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-[#2E5EFF]/20 text-[#2E5EFF] font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <div className="min-w-0 flex-1 break-words">
                        <strong>Connection Method:</strong>
                        <div className="text-[10px] text-gray-400 mt-0.5 space-y-0.5">
                          <div>• <em>Client Secret (Recommended)</em>: Under <strong>Certificates & secrets</strong>, create a secret and paste it in Horizon. <em>(Zero reply address needed!)</em></div>
                          <div>• <em>Interactive Login</em>: Under <strong>Authentication</strong> &rarr; Add a platform &rarr; select <strong>Mobile and desktop applications</strong> (not Web) &rarr; check <code className="text-amber-300">http://localhost</code>.</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-[#2E5EFF]/20 text-[#2E5EFF] font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                      <div className="min-w-0 flex-1 break-words">From <strong>Overview</strong>, copy <strong>Application (client) ID</strong> and <strong>Directory (tenant) ID</strong>.</div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-[#2E5EFF]/20 text-[#2E5EFF] font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">5</span>
                      <div className="min-w-0 flex-1 break-words">Enter your target SharePoint Site URL (e.g. <code className="text-gray-300">https://company.sharepoint.com/sites/HorizonPM</code>) and click Connect.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1 text-xs text-gray-400 mb-4">
              <div className="flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                <span>Structured Records: 11 SharePoint Lists</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                <span>Files: SharePoint Shared Documents</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#15203D] flex flex-col gap-2">
            {spConfig?.status === 'connected' ? (
              <>
                {activeBackend !== 'sharepoint-core' ? (
                  <Button size="sm" onClick={() => handleSelectActiveBackend('sharepoint-core')} className="w-full">
                    Set as Active Backend
                  </Button>
                ) : (
                  <div className="text-center py-1 text-xs text-emerald-400 font-bold bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    Currently Handling Everything
                  </div>
                )}
                <div className="flex items-center justify-between mt-1">
                  <Button variant="ghost" size="sm" onClick={handleDisconnectSp} className="text-red-400 hover:text-red-300 text-xs">
                    Disconnect
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setIsSpModalOpen(true)} className="text-xs">
                    Reconfigure
                  </Button>
                </div>
              </>
            ) : (
              <Button size="sm" onClick={() => setIsSpModalOpen(true)} className="w-full gap-2">
                Connect SharePoint <ArrowRight size={14} />
              </Button>
            )}
          </div>
        </div>
        )}

        {/* Provider 2: Microsoft OneDrive */}
        {(pluginCategory === 'all' || pluginCategory === 'storage') && (
        <div className={`rounded-2xl bg-[#0A1024]/95 border transition-all p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden ${
          activeBackend === 'onedrive-core' ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-[#15203D] hover:border-emerald-500/40'
        }`}>
          {activeBackend === 'onedrive-core' && (
            <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl flex items-center gap-1 shadow-lg">
              <Check size={12} /> Active Backend
            </div>
          )}

          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#0E152E] border border-[#1A264D] flex items-center justify-center text-[#10B981]">
                <HardDrive size={24} />
              </div>
              <Badge variant={odConfig?.status === 'connected' ? 'success' : odConfig?.status === 'error' ? 'danger' : 'neutral'}>
                {odConfig?.status === 'connected' ? 'Connected' : odConfig?.status === 'error' ? 'Error' : 'Disconnected'}
              </Badge>
            </div>

            <h3 className="text-lg font-bold text-white mb-1">Microsoft OneDrive</h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Handles <strong className="text-gray-200">100% of operations</strong> via your OneDrive drive: cloud JSON datasets for records and drive storage for files.
            </p>

            {odConfig?.connectedAs && (
              <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl mb-3 font-mono truncate">
                ✓ Account: {odConfig.connectedAs}
              </div>
            )}

            {odConfig?.status === 'error' && odConfig.error && (
              <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl mb-3 font-mono truncate">
                ⚠ {odConfig.error}
              </div>
            )}

            {/* Expandable Step-by-Step Connection Guide */}
            <div className="mb-4">
              <button
                onClick={() => setShowOdGuide(!showOdGuide)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#070B19] hover:bg-[#0D152E] border border-[#19264A] text-xs font-semibold text-gray-300 transition-colors text-left"
              >
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <BookOpen size={14} /> How to get details & connect
                </span>
                {showOdGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showOdGuide && (
                <div className="mt-2.5 p-3 rounded-xl bg-[#070B19] border border-[#19264A] text-[11px] text-gray-300 space-y-2.5 animate-fadeIn max-h-72 overflow-y-auto custom-scrollbar overflow-x-hidden">
                  <div className="font-bold text-emerald-400 border-b border-[#1E2D52] pb-1">
                    Step-by-Step OneDrive Setup Guide:
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <div className="min-w-0 flex-1 break-words">
                        <span>Open </span>
                        <a href="https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps" target="_blank" rel="noreferrer" className="text-emerald-400 underline inline-flex items-center gap-0.5">
                          Azure Portal &rarr; App registrations <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <div className="min-w-0 flex-1 break-words">Create a New Registration. In <strong>Supported account types</strong>, select <strong>Accounts in this organizational directory only (Single tenant)</strong> or <strong>Multitenant</strong> (requires an active work/school Microsoft 365 or Entra ID tenant). <em>Note: Standalone personal account registrations outside an organization directory have been deprecated by Microsoft.</em></div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <div className="min-w-0 flex-1 break-words">
                        In <strong>Authentication</strong>, add platform &rarr; <strong>Mobile and desktop applications</strong> &rarr; Add <code className="text-white">http://localhost</code>.
                      </div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                      <div className="min-w-0 flex-1 break-words">
                        In <strong>API permissions</strong>, add <strong>Microsoft Graph</strong> (Delegated): <code className="text-white">Files.ReadWrite.All</code>, <code className="text-white">User.Read</code>, <code className="text-white">offline_access</code>.
                      </div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">5</span>
                      <div className="min-w-0 flex-1 break-words">
                        Copy <strong>Application (client) ID</strong> and <strong>Directory (tenant) ID</strong> from the app Overview page.
                      </div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">6</span>
                      <div className="min-w-0 flex-1 break-words">Set cloud folder path (default: <code className="text-white">/HorizonPM/Documents</code>) and click Connect.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1 text-xs text-gray-400 mb-4">
              <div className="flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                <span>Structured Records: /HorizonPM/Data/</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                <span>Files: /HorizonPM/Documents/</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#15203D] flex flex-col gap-2">
            {odConfig?.status === 'connected' ? (
              <>
                {activeBackend !== 'onedrive-core' ? (
                  <Button size="sm" onClick={() => handleSelectActiveBackend('onedrive-core')} className="w-full bg-emerald-600 hover:bg-emerald-500">
                    Set as Active Backend
                  </Button>
                ) : (
                  <div className="text-center py-1 text-xs text-emerald-400 font-bold bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    Currently Handling Everything
                  </div>
                )}
                <div className="flex items-center justify-between mt-1">
                  <Button variant="ghost" size="sm" onClick={handleDisconnectOd} className="text-red-400 hover:text-red-300 text-xs">
                    Disconnect
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setIsOdModalOpen(true)} className="text-xs">
                    Reconfigure
                  </Button>
                </div>
              </>
            ) : (
              <Button size="sm" onClick={() => setIsOdModalOpen(true)} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500">
                Connect OneDrive <ArrowRight size={14} />
              </Button>
            )}
          </div>
        </div>
        )}

        {/* Provider 3: Google Drive Core */}
        {(pluginCategory === 'all' || pluginCategory === 'storage') && (
        <div className={`rounded-2xl bg-[#0A1024]/95 border transition-all p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden ${
          activeBackend === 'google-drive-core' ? 'border-amber-500 ring-1 ring-amber-500' : 'border-[#15203D] hover:border-amber-500/40'
        }`}>
          {activeBackend === 'google-drive-core' && (
            <div className="absolute top-0 right-0 bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl flex items-center gap-1 shadow-lg">
              <Check size={12} /> Active Backend
            </div>
          )}

          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#0E152E] border border-[#1A264D] flex items-center justify-center text-amber-400">
                <Cloud size={24} />
              </div>
              <Badge variant={gdriveConfig?.status === 'connected' ? 'success' : gdriveConfig?.status === 'error' ? 'danger' : 'neutral'}>
                {gdriveConfig?.status === 'connected' ? 'Connected' : gdriveConfig?.status === 'error' ? 'Error' : 'Disconnected'}
              </Badge>
            </div>

            <h3 className="text-lg font-bold text-white mb-1">Google Drive Core</h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Connect your <strong className="text-gray-200">personal (@gmail.com)</strong> or <strong className="text-gray-200">Google Workspace</strong> account. Syncs specifications, attachments, and cloud datasets.
            </p>

            {gdriveConfig?.connectedAs && (
              <div className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl mb-3 font-mono truncate">
                ✓ Account: {gdriveConfig.connectedAs}
              </div>
            )}

            {gdriveConfig?.status === 'error' && gdriveConfig.error && (
              <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl mb-3 space-y-1.5">
                <div className="font-semibold leading-relaxed">⚠ {gdriveConfig.error}</div>
                {(gdriveConfig.error.includes('403') || gdriveConfig.error.toLowerCase().includes('disabled') || gdriveConfig.error.toLowerCase().includes('not been used')) && (
                  <a
                    href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-amber-300 underline font-bold hover:text-amber-200"
                  >
                    Enable Google Drive API in Google Cloud Console <ExternalLink size={11} />
                  </a>
                )}
              </div>
            )}

            {/* Expandable Step-by-Step Connection Guide */}
            <div className="mb-4">
              <button
                onClick={() => setShowGdriveGuide(!showGdriveGuide)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#070B19] hover:bg-[#0D152E] border border-[#19264A] text-xs font-semibold text-gray-300 transition-colors text-left"
              >
                <span className="flex items-center gap-1.5 text-amber-400">
                  <BookOpen size={14} /> How to get details & connect
                </span>
                {showGdriveGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showGdriveGuide && (
                <div className="mt-2.5 p-3 rounded-xl bg-[#070B19] border border-[#19264A] text-[11px] text-gray-300 space-y-2.5 animate-fadeIn max-h-72 overflow-y-auto custom-scrollbar overflow-x-hidden">
                  <div className="font-bold text-amber-400 border-b border-[#1E2D52] pb-1">
                    Google Drive Free Setup Steps:
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <div className="min-w-0 flex-1 break-words">
                        <span>Open </span>
                        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-amber-400 underline inline-flex items-center gap-0.5">
                          Google Cloud Console &rarr; Credentials <ExternalLink size={10} />
                        </a>
                        <span>. Create a free project with your personal or workspace account.</span>
                      </div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <div className="min-w-0 flex-1 break-words">In <strong>Enabled APIs & Services</strong> &rarr; Click <strong>+ Enable APIs</strong> &rarr; Search and enable <strong>Google Drive API</strong>.</div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <div className="min-w-0 flex-1 break-words">In <strong>OAuth consent screen</strong>, choose <strong>External</strong>, name your app (e.g. <em>Horizon PM</em>), and enter your email address.</div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                      <div className="min-w-0 flex-1 break-words">
                        In <strong>Credentials</strong> &rarr; Click <strong>+ Create Credentials</strong> &rarr; <strong>OAuth client ID</strong> &rarr; Application type: <strong>Desktop app</strong>.
                      </div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">5</span>
                      <div className="min-w-0 flex-1 break-words">
                        Copy the generated <strong>Client ID</strong> (ends in <code className="text-amber-300 break-all">.apps.googleusercontent.com</code>) and <strong>Client Secret</strong>.
                      </div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">6</span>
                      <div className="min-w-0 flex-1 break-words">Paste your Client ID into Horizon and click Connect. Sign in and approve access in your browser.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1 text-xs text-gray-400 mb-4">
              <div className="flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 size={13} className="text-amber-400 shrink-0" />
                <span>Structured Records: /HorizonPM/Data/</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 size={13} className="text-amber-400 shrink-0" />
                <span>Files: /HorizonPM/Documents/</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#15203D] flex flex-col gap-2">
            {gdriveConfig?.status === 'connected' ? (
              <>
                {activeBackend !== 'google-drive-core' ? (
                  <Button size="sm" onClick={() => handleSelectActiveBackend('google-drive-core')} className="w-full bg-amber-600 hover:bg-amber-500">
                    Set as Active Backend
                  </Button>
                ) : (
                  <div className="text-center py-1 text-xs text-amber-400 font-bold bg-amber-500/10 rounded-xl border border-amber-500/20">
                    Currently Handling Everything
                  </div>
                )}
                <div className="flex items-center justify-between mt-1">
                  <Button variant="ghost" size="sm" onClick={handleDisconnectGdrive} className="text-red-400 hover:text-red-300 text-xs">
                    Disconnect
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setIsGdriveModalOpen(true)} className="text-xs">
                    Reconfigure
                  </Button>
                </div>
              </>
            ) : (
              <Button size="sm" onClick={() => setIsGdriveModalOpen(true)} className="w-full gap-2 bg-amber-600 hover:bg-amber-500">
                Connect Google Drive <ArrowRight size={14} />
              </Button>
            )}
          </div>
        </div>
        )}

        {/* Provider 4: MongoDB Enterprise (Active!) */}
        {(pluginCategory === 'all' || pluginCategory === 'storage') && (
        <div className={`rounded-2xl bg-[#0A1024]/95 border transition-all p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden ${
          activeBackend === 'mongodb-core' ? 'border-cyan-500 ring-1 ring-cyan-500' : 'border-[#15203D] hover:border-cyan-500/40'
        }`}>
          {activeBackend === 'mongodb-core' && (
            <div className="absolute top-0 right-0 bg-cyan-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl flex items-center gap-1 shadow-lg">
              <Check size={12} /> Active Backend
            </div>
          )}

          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#0E152E] border border-[#1A264D] flex items-center justify-center text-cyan-400">
                <Server size={24} />
              </div>
              <Badge variant={mongoConfig?.status === 'connected' ? 'success' : mongoConfig?.status === 'error' ? 'danger' : 'neutral'}>
                {mongoConfig?.status === 'connected' ? 'Connected' : mongoConfig?.status === 'error' ? 'Error' : 'Disconnected'}
              </Badge>
            </div>

            <h3 className="text-lg font-bold text-white mb-1">MongoDB Enterprise</h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Connect a MongoDB Atlas or self-hosted cluster. Manages <strong className="text-gray-200">100% of data via NoSQL collections & GridFS</strong>.
            </p>

            {mongoConfig?.connectedAs && (
              <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl mb-3 font-mono truncate">
                ✓ Cluster: {mongoConfig.connectedAs}
              </div>
            )}

            {mongoConfig?.status === 'error' && mongoConfig.error && (
              <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl mb-3 font-mono truncate">
                ⚠ {mongoConfig.error}
              </div>
            )}

            {/* Expandable Step-by-Step Connection Guide */}
            <div className="mb-4">
              <button
                onClick={() => setShowMongoGuide(!showMongoGuide)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#070B19] hover:bg-[#0D152E] border border-[#19264A] text-xs font-semibold text-gray-300 transition-colors text-left"
              >
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <BookOpen size={14} /> How to get details & connect
                </span>
                {showMongoGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showMongoGuide && (
                <div className="mt-2.5 p-3 rounded-xl bg-[#070B19] border border-[#19264A] text-[11px] text-gray-300 space-y-2.5 animate-fadeIn max-h-72 overflow-y-auto custom-scrollbar overflow-x-hidden">
                  <div className="font-bold text-cyan-400 border-b border-[#1E2D52] pb-1">
                    MongoDB Setup Steps:
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <div className="min-w-0 flex-1 break-words">
                        <span>Log in to </span>
                        <a href="https://cloud.mongodb.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline inline-flex items-center gap-0.5">
                          MongoDB Atlas <ExternalLink size={10} />
                        </a>
                        <span> or launch your self-hosted instance.</span>
                      </div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <div className="min-w-0 flex-1 break-words">In <strong>Database Access</strong>, create a user with <code className="text-white">readWriteAnyDatabase</code> or access to <code className="text-amber-300">horizon_pm</code>.</div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <div className="min-w-0 flex-1 break-words">In <strong>Network Access</strong>, ensure your IP address or VPN is whitelisted (or configure VPC Peering).</div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                      <div className="min-w-0 flex-1 break-words">
                        Click <strong>Connect</strong> &rarr; <em>Drivers</em> &rarr; Copy connection URI:
                        <div className="flex items-center gap-1.5 mt-1 bg-[#0A1024] p-1.5 rounded font-mono text-[10px] text-gray-300 border border-[#15203D] w-full min-w-0 overflow-hidden">
                          <span className="truncate flex-1 min-w-0 text-cyan-300" title="mongodb+srv://<username>:<password>@cluster.mongodb.net/horizon_pm">
                            mongodb+srv://&lt;user&gt;:***@cluster.mongodb.net/horizon_pm
                          </span>
                          <button onClick={() => handleCopy('mongodb+srv://<username>:<password>@cluster.mongodb.net/horizon_pm', 'mongo_sample')} className="ml-auto text-cyan-400 hover:text-white shrink-0 p-0.5" title="Copy sample URI">
                            {copiedText === 'mongo_sample' ? '✓' : <Copy size={11} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">5</span>
                      <div className="min-w-0 flex-1 break-words">Paste the connection string and database name into the setup form and click Connect.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1 text-xs text-gray-400 mb-4">
              <div className="flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                <span>Structured Records: MongoDB Collections</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                <span>Files: GridFS Binary Bucket</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#15203D] flex flex-col gap-2">
            {mongoConfig?.status === 'connected' ? (
              <>
                {activeBackend !== 'mongodb-core' ? (
                  <Button size="sm" onClick={() => handleSelectActiveBackend('mongodb-core')} className="w-full bg-cyan-600 hover:bg-cyan-500">
                    Set as Active Backend
                  </Button>
                ) : (
                  <div className="text-center py-1 text-xs text-emerald-400 font-bold bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    Currently Handling Everything
                  </div>
                )}
                <div className="flex items-center justify-between mt-1">
                  <Button variant="ghost" size="sm" onClick={handleDisconnectMongo} className="text-red-400 hover:text-red-300 text-xs">
                    Disconnect
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setIsMongoModalOpen(true)} className="text-xs">
                    Reconfigure
                  </Button>
                </div>
              </>
            ) : (
              <Button size="sm" onClick={() => setIsMongoModalOpen(true)} className="w-full gap-2 bg-cyan-600 hover:bg-cyan-500">
                Connect MongoDB <ArrowRight size={14} />
              </Button>
            )}
          </div>
        </div>
        )}

        {/* Provider 4: Azure Key Vault */}
        {(pluginCategory === 'all' || pluginCategory === 'security') && (
        <div className="rounded-2xl bg-[#0A1024]/95 border border-[#15203D] hover:border-indigo-500/40 transition-all p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <KeyRound size={24} />
              </div>
              <Badge variant={akvConfig?.status === 'connected' ? 'success' : akvConfig?.status === 'error' ? 'danger' : 'neutral'}>
                {akvConfig?.status === 'connected' ? 'Connected' : akvConfig?.status === 'error' ? 'Error' : 'Disconnected'}
              </Badge>
            </div>

            <h3 className="text-lg font-bold text-white mb-1">Azure Key Vault</h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Hardware-backed cloud secrets management. Securely query, reveal, and manage enterprise credentials directly within the <strong className="text-gray-200">Secrets Vault</strong>.
            </p>

            {akvConfig?.connectedAs && (
              <div className="text-[11px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 p-2.5 rounded-xl mb-3 font-mono truncate">
                ✓ Vault: {akvConfig.connectedAs}
              </div>
            )}

            {akvConfig?.status === 'error' && akvConfig.error && (
              <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl mb-3 font-mono truncate">
                ⚠ {akvConfig.error}
              </div>
            )}

            {/* Expandable Step-by-Step Connection Guide */}
            <div className="mb-4">
              <button
                onClick={() => setShowAkvGuide(!showAkvGuide)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#070B19] hover:bg-[#0D152E] border border-[#19264A] text-xs font-semibold text-gray-300 transition-colors text-left"
              >
                <span className="flex items-center gap-1.5 text-indigo-400">
                  <BookOpen size={14} /> How to get details & connect
                </span>
                {showAkvGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showAkvGuide && (
                <div className="mt-2.5 p-3 rounded-xl bg-[#070B19] border border-[#19264A] text-[11px] text-gray-300 space-y-2.5 animate-fadeIn max-h-72 overflow-y-auto custom-scrollbar overflow-x-hidden">
                  <div className="font-bold text-indigo-400 border-b border-[#1E2D52] pb-1">
                    Azure Key Vault Setup Steps:
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <div className="min-w-0 flex-1 break-words">
                        <span>Open </span>
                        <a href="https://portal.azure.com/#view/HubsExtension/BrowseResource/resourceType/Microsoft.KeyVault%2Fvaults" target="_blank" rel="noreferrer" className="text-indigo-400 underline inline-flex items-center gap-0.5">
                          Azure Portal &rarr; Key Vaults <ExternalLink size={10} />
                        </a>
                        <span>. Copy your <strong>Vault URI</strong> (e.g. <code className="text-gray-300 break-all">https://my-vault.vault.azure.net</code>).</span>
                      </div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <div className="min-w-0 flex-1 break-words">
                        In <strong>Azure Entra ID &rarr; App registrations</strong>, register an App. Copy <strong>Application (client) ID</strong> and <strong>Directory (tenant) ID</strong>.
                      </div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <div className="min-w-0 flex-1 break-words">
                        Under <strong>Certificates & secrets</strong>, create a new <strong>Client Secret</strong> and copy the generated <em>Value</em>.
                      </div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                      <div className="min-w-0 flex-1 break-words">
                        In your <strong>Key Vault &rarr; Access configuration</strong>:
                        <div className="text-[10px] text-gray-400 mt-0.5 break-words">
                          • If RBAC: In <strong>Access control (IAM)</strong>, assign <strong>Key Vault Secrets User</strong> (or Officer) to your App.<br/>
                          • If Vault access policy: In <strong>Access policies</strong>, grant <strong>Get</strong> and <strong>List</strong> secret permissions to your App.
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 items-start min-w-0">
                      <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">5</span>
                      <div className="min-w-0 flex-1 break-words">Enter the details in the Horizon wizard and click Connect.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1 text-xs text-gray-400 mb-4">
              <div className="flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                <span>Secrets Protocol: Azure REST API v7.4</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                <span>Identity: OAuth2 / Confidential Client</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#15203D] flex flex-col gap-2">
            {akvConfig?.status === 'connected' ? (
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={handleDisconnectAkv} className="text-red-400 hover:text-red-300 text-xs">
                  Disconnect
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setIsAkvModalOpen(true)} className="text-xs">
                  Reconfigure
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setIsAkvModalOpen(true)} className="w-full gap-2 bg-indigo-600 hover:bg-indigo-500">
                Connect Azure Key Vault <ArrowRight size={14} />
              </Button>
            )}
          </div>
        </div>
        )}
      </div>

      {/* System Diagnostics & Live Connection Console */}
      {(pluginCategory === 'all' || pluginCategory === 'diagnostics') && (
      <div className="rounded-2xl bg-[#0A1024]/95 border border-[#15203D] shadow-2xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#15203D] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Terminal size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Live Diagnostics & Synchronization Console</h3>
                <Badge variant={syncState.status === 'syncing' ? 'warning' : syncState.status === 'idle' ? 'success' : 'neutral'}>
                  {syncState.status === 'syncing' ? 'Syncing...' : syncState.status === 'idle' ? 'Live Telemetry' : 'Standby'}
                </Badge>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Inspect real-time telemetry, connection latency, remote queries, synchronization mutations, and errors across all backend providers.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#070B19] px-2 py-1 rounded-xl border border-[#19264D]">
              <span className="text-[11px] text-gray-400">Target:</span>
              <select
                value={selectedDiagTarget}
                onChange={e => setSelectedDiagTarget(e.target.value)}
                className="bg-transparent text-xs text-cyan-300 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="active" className="bg-[#0A1024] text-white">Active Backend</option>
                <option value="sharepoint-core" className="bg-[#0A1024] text-white">Microsoft SharePoint</option>
                <option value="onedrive-core" className="bg-[#0A1024] text-white">Microsoft OneDrive</option>
                <option value="google-drive-core" className="bg-[#0A1024] text-white">Google Drive</option>
                <option value="mongodb-core" className="bg-[#0A1024] text-white">MongoDB Enterprise</option>
                <option value="azure-keyvault" className="bg-[#0A1024] text-white">Azure Key Vault (Secrets)</option>
              </select>
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleTestBackend(selectedDiagTarget)}
              loading={isTestingBackend}
              className="text-xs gap-1.5 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
            >
              <Wifi size={13} /> Test Connection & Ping
            </Button>

            <Button
              size="sm"
              onClick={() => handleSeedBackend(selectedDiagTarget)}
              loading={isSeedingBackend}
              className="text-xs gap-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white"
            >
              <UploadCloud size={13} /> Push All Local Data to Cloud
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopyLogs}
              className="text-xs gap-1 text-gray-400 hover:text-white"
            >
              <Copy size={13} /> {copiedText === 'logs' ? 'Copied!' : 'Copy Logs'}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearLogs}
              className="text-xs gap-1 text-gray-400 hover:text-rose-400"
            >
              <Trash2 size={13} /> Clear
            </Button>
          </div>
        </div>

        {/* Status Indicators & Test Results Banner */}
        {diagTestResult && (
          <div className={`p-3.5 rounded-xl border text-xs flex items-start justify-between gap-3 animate-fadeIn ${
            diagTestResult.success 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <div className="flex items-start gap-2.5">
              {diagTestResult.success ? <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" /> : <AlertCircle size={16} className="text-rose-400 mt-0.5 shrink-0" />}
              <div>
                <div className="font-bold">
                  {diagTestResult.success ? `[${diagTestResult.providerName}] Connection & Health Check Verified` : `[${diagTestResult.providerName}] Connection Test Failed`}
                </div>
                <div className="text-[11px] mt-0.5 opacity-90">
                  {diagTestResult.success 
                    ? `Ping Latency: ${diagTestResult.pingMs}ms | Infrastructure: ${diagTestResult.clusterInfo} | Target: ${diagTestResult.databaseOrPath} (${diagTestResult.collectionsOrLists?.length || 0} tracked collections/lists)`
                    : diagTestResult.error}
                </div>
              </div>
            </div>
            <button onClick={() => setDiagTestResult(null)} className="text-gray-400 hover:text-white text-xs">&times;</button>
          </div>
        )}

        {seedSuccessMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} />
              <span>{seedSuccessMsg}</span>
            </div>
            <button onClick={() => setSeedSuccessMsg(null)} className="text-gray-400 hover:text-white">&times;</button>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="flex items-center justify-between gap-2 pt-1 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px] mr-1">Filter:</span>
            {(['all', 'sharepoint', 'onedrive', 'gdrive', 'mongodb', 'sync', 'error'] as const).map(f => (
              <button
                key={f}
                onClick={() => setLogFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  logFilter === f
                    ? 'bg-[#1E2D52] text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#111A35]'
                }`}
              >
                {f === 'all' ? `All (${logs.length})` :
                 f === 'sharepoint' ? 'SharePoint' :
                 f === 'onedrive' ? 'OneDrive' :
                 f === 'gdrive' ? 'Google Drive' :
                 f === 'mongodb' ? 'MongoDB' :
                 f === 'sync' ? 'Sync Agent' : 'Errors'}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-gray-400 font-mono">
            {logs.length} events logged
          </span>
        </div>

        {/* Terminal Window */}
        <div className="rounded-xl bg-[#050814] border border-[#15203D] p-3 font-mono text-[11px] h-72 overflow-y-auto space-y-1.5 custom-scrollbar select-text shadow-inner">
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10 space-y-1">
              <Terminal size={24} className="opacity-40" />
              <div>Diagnostic console ready. No events yet.</div>
              <div className="text-[10px] text-gray-400">Click &quot;Test Connection & Ping&quot; or &quot;Push All Local Data to Cloud&quot; to inspect activity across any provider.</div>
            </div>
          ) : (
            logs
              .filter(l => {
                if (logFilter === 'sharepoint') return l.source.toLowerCase().includes('sharepoint');
                if (logFilter === 'onedrive') return l.source.toLowerCase().includes('onedrive');
                if (logFilter === 'gdrive') return l.source.toLowerCase().includes('google') || l.source.toLowerCase().includes('gdrive');
                if (logFilter === 'mongodb') return l.source.toLowerCase().includes('mongo');
                if (logFilter === 'sync') return l.source.toLowerCase().includes('sync') || l.message.toLowerCase().includes('sync');
                if (logFilter === 'error') return l.level === 'error';
                return true;
              })
              .map(l => (
                <div key={l.id} className="flex items-start gap-2 leading-relaxed hover:bg-white/[0.02] p-1 rounded transition-colors">
                  <span className="text-gray-400 shrink-0 select-none">
                    {l.timestamp.split('T')[1]?.slice(0, 8) || l.timestamp}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 select-none ${
                    l.level === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    l.level === 'error' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                    l.level === 'warn' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  }`}>
                    {l.level}
                  </span>
                  <span className="text-gray-400 font-semibold shrink-0">[{l.source}]</span>
                  <div className="text-gray-200 break-all flex-1">
                    <span>{l.message}</span>
                    {l.details && (
                      <pre className="mt-1 text-[10px] text-gray-400 bg-black/40 p-1.5 rounded border border-[#15203D] overflow-x-auto whitespace-pre-wrap">
                        {l.details}
                      </pre>
                    )}
                  </div>
                </div>
              ))
          )}
          <div ref={consoleBottomRef} />
        </div>
      </div>
      )}

      {/* Modal 1: SharePoint Setup Wizard */}
      <Modal
        isOpen={isSpModalOpen}
        onClose={() => {
          setIsSpModalOpen(false)
          setSpModalTestResult(null)
        }}
        title="Microsoft SharePoint All-In-One Setup"
        footer={
          <div className="flex justify-between items-center w-full">
            <Button 
              type="button" 
              variant="secondary" 
              size="sm" 
              onClick={() => handleTestBackend('sharepoint-core', { tenantId: spTenantId, siteUrl: spSiteUrl, clientId: spClientId, clientSecret: spClientSecret, permissionScope: spScope }, 'sp')} 
              loading={isSpModalTesting} 
              className="border-[#2E5EFF]/40 text-[#8FA7FF] hover:bg-[#2E5EFF]/10 text-xs gap-1.5"
            >
              <Wifi size={13} /> Test Connection
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => {
                setIsSpModalOpen(false)
                setSpModalTestResult(null)
              }}>
                Cancel
              </Button>
              <Button onClick={handleSaveAndConnectSp} loading={isConnectingSp}>
                Connect SharePoint
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#2E5EFF]/10 border border-[#2E5EFF]/20 text-xs text-[#8FA7FF]">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-[#2E5EFF] shrink-0" />
              <span>Using an existing Azure App or need setup help?</span>
            </div>
            <button
              onClick={() => setShowModalSpGuide(!showModalSpGuide)}
              className="text-white font-bold underline hover:text-[#8FA7FF] shrink-0"
            >
              {showModalSpGuide ? 'Hide Guide' : 'View Instructions'}
            </button>
          </div>

          {showModalSpGuide && (
            <div className="p-3.5 rounded-xl bg-[#070B19] border border-[#1E2D52] text-xs text-gray-300 space-y-2.5 animate-fadeIn">
              <div className="font-bold text-white">Azure App & SharePoint Integration:</div>
              <div className="p-2 rounded bg-blue-950/50 border border-blue-500/30 text-[11px] text-blue-200">
                <strong>Can I use an existing Azure App?</strong> Yes! In Azure AD, App Registrations are tenant-wide and can access <em>any</em> SharePoint site in your tenant, even if the App was originally created for another purpose.
              </div>
              <div className="text-[11px] font-semibold text-gray-200">Choose your connection mode:</div>
              <div className="space-y-2 text-[11px]">
                <div className="p-2.5 rounded bg-[#0A1024] border border-[#15203D]">
                  <strong className="text-emerald-400">Mode 1: Client Secret (Recommended for background & corporate apps)</strong>
                  <div className="text-[10px] text-gray-400 mt-1 space-y-1">
                    <div>1. In Azure Portal &rarr; <strong>App registrations</strong> &rarr; your app &rarr; <strong>Certificates & secrets</strong> &rarr; create a <strong>Client secret</strong>.</div>
                    <div>2. Under <strong>API permissions</strong>, add <strong>Microsoft Graph &rarr; Application permissions</strong>: <code className="text-white">Sites.ReadWrite.All</code> and <code className="text-white">Files.ReadWrite.All</code>, then click <strong>Grant admin consent</strong>.</div>
                    <div>3. Paste the secret into the <em>Client Secret</em> field below. No browser popups required!</div>
                  </div>
                </div>
                <div className="p-2.5 rounded bg-[#0A1024] border border-[#15203D]">
                  <strong className="text-cyan-400">Mode 2: Interactive Browser Login (Public client)</strong>
                  <div className="text-[10px] text-gray-400 mt-1 space-y-1">
                    <div>1. Leave the <em>Client Secret</em> field empty below.</div>
                    <div>2. In your Azure App &rarr; <strong>Authentication</strong> &rarr; Add platform &rarr; <strong>Mobile and desktop applications</strong> &rarr; Add <code className="text-amber-300">http://localhost</code>.</div>
                    <div>3. Under <strong>API permissions</strong> &rarr; Delegated permissions: <code className="text-white">Sites.ReadWrite.All</code>, <code className="text-white">Files.ReadWrite.All</code>, <code className="text-white">User.Read</code> &rarr; <strong>Grant admin consent</strong>.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {spModalTestResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-fadeIn ${
              spModalTestResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {spModalTestResult.success ? <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" /> : <AlertCircle size={16} className="text-rose-400 mt-0.5 shrink-0" />}
              <div>
                <div className="font-bold">
                  {spModalTestResult.success ? '✓ SharePoint Verified & Online' : 'SharePoint Connection Test Failed'}
                </div>
                <div className="text-[11px] mt-0.5 opacity-90 leading-relaxed">
                  {spModalTestResult.success 
                    ? `Ping: ${spModalTestResult.pingMs}ms | ${spModalTestResult.clusterInfo} | Target: ${spModalTestResult.databaseOrPath}`
                    : spModalTestResult.error}
                </div>
              </div>
            </div>
          )}

          {spError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              {spError}
            </div>
          )}

          <Input 
            label="Azure AD Tenant ID" 
            value={spTenantId} 
            onChange={e => setSpTenantId(e.target.value)} 
            placeholder="e.g. common or 72f988bf-86f1-41af-91ab-2d7cd011db47" 
            autoFocus 
          />

          <Input 
            label="SharePoint Site URL or Path" 
            value={spSiteUrl} 
            onChange={e => setSpSiteUrl(e.target.value)} 
            placeholder="e.g. https://tenant.sharepoint.com/sites/HorizonPM or /sites/HorizonPM" 
          />

          <Input 
            label="Azure AD App Client ID" 
            value={spClientId} 
            onChange={e => setSpClientId(e.target.value)} 
            placeholder="e.g. e4a5b6c7-d8e9-4f0a-1b2c-3d4e5f6a7b8c" 
          />

          <div className="relative">
            <Input 
              label="Azure AD Client Secret (Optional - for background / enterprise apps)" 
              type={showSpSecret ? "text" : "password"}
              value={spClientSecret} 
              onChange={e => setSpClientSecret(e.target.value)} 
              placeholder="Leave empty for browser sign-in, or paste client secret" 
            />
            {spClientSecret && (
              <button
                type="button"
                onClick={() => setShowSpSecret(!showSpSecret)}
                className="absolute right-3 top-8 text-[11px] text-[#8FA7FF] hover:text-white"
              >
                {showSpSecret ? "Hide" : "Show"}
              </button>
            )}
          </div>

          <Select
            label="Permissions Scope"
            value={spScope}
            onChange={e => setSpScope(e.target.value)}
            options={[
              { label: 'Read & write all sites (Sites.ReadWrite.All)', value: 'Sites.ReadWrite.All' },
              { label: 'Read & write selected sites (Sites.Selected)', value: 'Sites.Selected' }
            ]}
          />
        </div>
      </Modal>

      {/* Modal 2: OneDrive Setup Wizard */}
      <Modal
        isOpen={isOdModalOpen}
        onClose={() => {
          setIsOdModalOpen(false)
          setOdModalTestResult(null)
        }}
        title="Microsoft OneDrive All-In-One Setup"
        footer={
          <div className="flex justify-between items-center w-full">
            <Button 
              type="button" 
              variant="secondary" 
              size="sm" 
              onClick={() => handleTestBackend('onedrive-core', { tenantId: odTenantId, clientId: odClientId, driveType: odDriveType, folderPath: odFolderPath }, 'od')} 
              loading={isOdModalTesting} 
              className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-xs gap-1.5"
            >
              <Wifi size={13} /> Test Connection
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => {
                setIsOdModalOpen(false)
                setOdModalTestResult(null)
              }}>
                Cancel
              </Button>
              <Button onClick={handleSaveAndConnectOd} loading={isConnectingOd} className="bg-emerald-600 hover:bg-emerald-500">
                Connect OneDrive
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-emerald-400 shrink-0" />
              <span>Need help locating OneDrive Client ID or Tenant ID?</span>
            </div>
            <button
              onClick={() => setShowModalOdGuide(!showModalOdGuide)}
              className="text-white font-bold underline hover:text-emerald-300 shrink-0"
            >
              {showModalOdGuide ? 'Hide Guide' : 'View Instructions'}
            </button>
          </div>

          {showModalOdGuide && (
            <div className="p-3.5 rounded-xl bg-[#070B19] border border-[#1E2D52] text-xs text-gray-300 space-y-2 animate-fadeIn">
              <div className="font-bold text-white mb-1">Quick OneDrive Setup Steps:</div>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-gray-300">
                <li>Go to <a href="https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps" target="_blank" rel="noreferrer" className="text-emerald-400 underline">Azure Portal &rarr; App registrations</a>.</li>
                <li>Select your App Registration (or register a new one).</li>
                <li>In <strong>Authentication</strong>, add platform &rarr; <strong>Mobile and desktop applications</strong> &rarr; Add <code className="text-amber-300">http://localhost</code>.</li>
                <li>In <strong>API permissions</strong>, add <strong>Microsoft Graph</strong>: <code className="text-white">Files.ReadWrite.All</code>, <code className="text-white">User.Read</code>, <code className="text-white">offline_access</code>.</li>
                <li>Copy <strong>Application (client) ID</strong> below. For Tenant ID, you can use your tenant or enter <code className="text-emerald-300">common</code>.</li>
              </ol>
            </div>
          )}

          {odModalTestResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-fadeIn ${
              odModalTestResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {odModalTestResult.success ? <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" /> : <AlertCircle size={16} className="text-rose-400 mt-0.5 shrink-0" />}
              <div>
                <div className="font-bold">
                  {odModalTestResult.success ? '✓ OneDrive Verified & Online' : 'OneDrive Connection Test Failed'}
                </div>
                <div className="text-[11px] mt-0.5 opacity-90 leading-relaxed">
                  {odModalTestResult.success 
                    ? `Ping: ${odModalTestResult.pingMs}ms | ${odModalTestResult.clusterInfo} | Target Folder: ${odModalTestResult.databaseOrPath}`
                    : odModalTestResult.error}
                </div>
              </div>
            </div>
          )}

          {odError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              {odError}
            </div>
          )}

          <Input 
            label="Azure AD Tenant ID" 
            value={odTenantId} 
            onChange={e => setOdTenantId(e.target.value)} 
            placeholder="e.g. common or 72f988bf-86f1-41af-91ab-2d7cd011db47" 
            autoFocus 
          />

          <Input 
            label="Azure AD App Client ID" 
            value={odClientId} 
            onChange={e => setOdClientId(e.target.value)} 
            placeholder="e.g. e4a5b6c7-d8e9-4f0a-1b2c-3d4e5f6a7b8c" 
          />

          <Select
            label="Drive Destination"
            value={odDriveType}
            onChange={e => setOdDriveType(e.target.value)}
            options={[
              { label: 'Organization / Enterprise OneDrive (/me/drive)', value: 'personal' },
              { label: 'Shared Document Library', value: 'business' }
            ]}
          />

          <Input 
            label="Target Cloud Folder Path" 
            value={odFolderPath} 
            onChange={e => setOdFolderPath(e.target.value)} 
            placeholder="/HorizonPM/Documents" 
          />
        </div>
      </Modal>

      {/* Modal 3: Google Drive Setup Wizard */}
      <Modal
        isOpen={isGdriveModalOpen}
        onClose={() => {
          setIsGdriveModalOpen(false)
          setGdriveModalTestResult(null)
        }}
        title="Google Drive Cloud Setup (Personal & Workspace)"
        footer={
          <div className="flex justify-between items-center w-full">
            <Button 
              type="button" 
              variant="secondary" 
              size="sm" 
              onClick={() => handleTestBackend('google-drive-core', { clientId: gdriveClientId, clientSecret: gdriveClientSecret, folderPath: gdriveFolderPath }, 'gdrive')} 
              loading={isGdriveModalTesting} 
              className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs gap-1.5"
            >
              <Wifi size={13} /> Test Connection
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => {
                setIsGdriveModalOpen(false)
                setGdriveModalTestResult(null)
              }}>
                Cancel
              </Button>
              <Button onClick={handleSaveAndConnectGdrive} loading={isConnectingGdrive} className="bg-amber-600 hover:bg-amber-500">
                Connect with Google
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-amber-400 shrink-0" />
              <span>Need help creating Google Cloud OAuth Credentials?</span>
            </div>
            <button
              onClick={() => setShowModalGdriveGuide(!showModalGdriveGuide)}
              className="text-white font-bold underline hover:text-amber-300 shrink-0"
            >
              {showModalGdriveGuide ? 'Hide Guide' : 'View Instructions'}
            </button>
          </div>

          {showModalGdriveGuide && (
            <div className="p-3.5 rounded-xl bg-[#070B19] border border-[#1E2D52] text-xs text-gray-300 space-y-2 animate-fadeIn">
              <div className="font-bold text-white mb-1">Quick Google Drive Setup (Free, No Credit Card):</div>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-gray-300">
                <li>Visit <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-amber-400 underline">Google Cloud Console</a> with your personal or workspace account.</li>
                <li>Under <strong>Enabled APIs</strong>, enable <strong>Google Drive API</strong>.</li>
                <li>In <strong>OAuth consent screen</strong>, select <strong>External</strong> and enter your app name & email.</li>
                <li>In <strong>Credentials</strong>, click <strong>+ Create Credentials</strong> &rarr; <strong>OAuth client ID</strong> &rarr; Type: <strong>Desktop app</strong>.</li>
                <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> into the fields below.</li>
                <li>Click <strong>Connect with Google</strong>. Sign in in your browser to authorize access.</li>
              </ol>
            </div>
          )}

          {/* Crucial Notice: Google Drive API Must Be Enabled */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
            <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Crucial Step:</strong> Make sure the <strong>Google Drive API</strong> is enabled in your Google Cloud project. If disabled, Google returns a <em>403 Forbidden</em> during sync.{' '}
              <a
                href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                target="_blank"
                rel="noreferrer"
                className="underline font-bold text-amber-200 hover:text-white inline-flex items-center gap-1"
              >
                Enable Google Drive API here <ExternalLink size={11} />
              </a>.
            </div>
          </div>

          {gdriveModalTestResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-fadeIn ${
              gdriveModalTestResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {gdriveModalTestResult.success ? <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" /> : <AlertCircle size={16} className="text-rose-400 mt-0.5 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="font-bold">
                  {gdriveModalTestResult.success ? '✓ Google Drive Verified & Online' : 'Google Drive Connection Test Failed'}
                </div>
                <div className="text-[11px] mt-0.5 opacity-90 leading-relaxed break-words">
                  {gdriveModalTestResult.success 
                    ? `Ping: ${gdriveModalTestResult.pingMs}ms | ${gdriveModalTestResult.clusterInfo} | Target Folder: ${gdriveModalTestResult.databaseOrPath}`
                    : gdriveModalTestResult.error}
                </div>
                {gdriveModalTestResult.error && (gdriveModalTestResult.error.includes('403') || gdriveModalTestResult.error.includes('disabled') || gdriveModalTestResult.error.includes('not been used')) && (
                  <div className="mt-2">
                    <a
                      href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 underline hover:text-amber-200"
                    >
                      Click here to enable Google Drive API in your project <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {gdriveError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-1.5">
              <div className="leading-relaxed break-words">{gdriveError}</div>
              {(gdriveError.includes('403') || gdriveError.includes('disabled') || gdriveError.includes('not been used')) && (
                <div>
                  <a
                    href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 underline hover:text-amber-200"
                  >
                    Click here to enable Google Drive API in your project <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          )}

          <Input 
            label="Google OAuth 2.0 Client ID" 
            value={gdriveClientId} 
            onChange={e => setGdriveClientId(e.target.value)} 
            placeholder="e.g. 1234567890-abc123def456.apps.googleusercontent.com" 
            autoFocus 
          />

          <div className="relative">
            <Input 
              label="Google OAuth 2.0 Client Secret (Optional / Recommended)" 
              type={showGdriveSecret ? 'text' : 'password'}
              value={gdriveClientSecret} 
              onChange={e => setGdriveClientSecret(e.target.value)} 
              placeholder="e.g. GOCSPX-abc123xyz456" 
            />
            <button
              type="button"
              onClick={() => setShowGdriveSecret(!showGdriveSecret)}
              className="absolute right-3 top-8 text-gray-400 hover:text-white text-xs"
            >
              {showGdriveSecret ? 'Hide' : 'Show'}
            </button>
          </div>

          <Input 
            label="Target Cloud Folder Path" 
            value={gdriveFolderPath} 
            onChange={e => setGdriveFolderPath(e.target.value)} 
            placeholder="/HorizonPM" 
          />
        </div>
      </Modal>

      {/* Modal 4: MongoDB Setup Wizard */}
      <Modal
        isOpen={isMongoModalOpen}
        onClose={() => {
          setIsMongoModalOpen(false)
          setMongoModalTestResult(null)
        }}
        title="MongoDB Enterprise All-In-One Setup"
        footer={
          <div className="flex justify-between items-center w-full">
            <Button 
              type="button" 
              variant="secondary" 
              size="sm" 
              onClick={() => handleTestBackend('mongodb-core', { connectionUri: mongoUri, databaseName: mongoDbName }, 'mongo')} 
              loading={isMongoModalTesting} 
              className="border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 text-xs gap-1.5"
            >
              <Wifi size={13} /> Test Connection
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => {
                setIsMongoModalOpen(false)
                setMongoModalTestResult(null)
              }}>
                Cancel
              </Button>
              <Button onClick={handleSaveAndConnectMongo} loading={isConnectingMongo} className="bg-cyan-600 hover:bg-cyan-500">
                Connect MongoDB
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-cyan-400 shrink-0" />
              <span>Need help obtaining your MongoDB Connection String?</span>
            </div>
            <button
              onClick={() => setShowModalMongoGuide(!showModalMongoGuide)}
              className="text-white font-bold underline hover:text-cyan-300 shrink-0"
            >
              {showModalMongoGuide ? 'Hide Guide' : 'View Instructions'}
            </button>
          </div>

          {showModalMongoGuide && (
            <div className="p-3.5 rounded-xl bg-[#070B19] border border-[#1E2D52] text-xs text-gray-300 space-y-2 animate-fadeIn">
              <div className="font-bold text-white mb-1">Quick MongoDB Connection Steps:</div>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-gray-300">
                <li>Log in to <a href="https://cloud.mongodb.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline">MongoDB Atlas</a> or your local MongoDB.</li>
                <li>In <strong>Database Access</strong>, create a user with read/write permissions.</li>
                <li>In <strong>Network Access</strong>, ensure your IP address is whitelisted (or add <code className="text-amber-300">0.0.0.0/0</code> for temporary access).</li>
                <li>Click <strong>Connect</strong> &rarr; <em>Drivers</em> &rarr; Copy standard connection URI.</li>
                <li>Paste into the Connection String URI field below.</li>
              </ol>
            </div>
          )}

          {mongoModalTestResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-fadeIn ${
              mongoModalTestResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {mongoModalTestResult.success ? <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" /> : <AlertCircle size={16} className="text-rose-400 mt-0.5 shrink-0" />}
              <div>
                <div className="font-bold">
                  {mongoModalTestResult.success ? '✓ Connection Verified & Cluster Responding' : 'Connection Test Failed'}
                </div>
                <div className="text-[11px] mt-0.5 opacity-90 leading-relaxed">
                  {mongoModalTestResult.success 
                    ? `Ping: ${mongoModalTestResult.pingMs}ms | Engine: ${mongoModalTestResult.clusterInfo} | Target: ${mongoModalTestResult.databaseOrPath} (${mongoModalTestResult.collectionsOrLists?.length || 0} collections)`
                    : mongoModalTestResult.error}
                </div>
              </div>
            </div>
          )}

          {mongoError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              {mongoError}
            </div>
          )}

          <Input 
            label="MongoDB Connection String URI" 
            value={mongoUri} 
            onChange={e => setMongoUri(e.target.value)} 
            placeholder="mongodb+srv://<username>:<password>@cluster.mongodb.net/horizon_pm" 
            autoFocus 
          />

          <Input 
            label="Database Name" 
            value={mongoDbName} 
            onChange={e => setMongoDbName(e.target.value)} 
            placeholder="horizon_pm" 
          />
        </div>
      </Modal>

      {/* Modal 4: Azure Key Vault Setup Wizard */}
      <Modal
        isOpen={isAkvModalOpen}
        onClose={() => {
          setIsAkvModalOpen(false)
          setAkvModalTestResult(null)
          setAkvError(null)
        }}
        title="Connect Azure Key Vault"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button 
              variant="secondary" 
              onClick={() => handleTestBackend('azure-keyvault', {
                vaultUrl: akvVaultUrl.trim(),
                tenantId: akvTenantId.trim(),
                clientId: akvClientId.trim(),
                clientSecret: akvClientSecret.trim(),
                authType: akvAuthType
              }, 'akv')} 
              loading={isAkvModalTesting} 
              className="border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 text-xs gap-1.5"
            >
              <Wifi size={13} /> Test Connection
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => {
                setIsAkvModalOpen(false)
                setAkvModalTestResult(null)
                setAkvError(null)
              }}>
                Cancel
              </Button>
              <Button onClick={handleSaveAndConnectAkv} loading={isConnectingAkv} className="bg-indigo-600 hover:bg-indigo-500">
                Connect Azure Key Vault
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-indigo-400 shrink-0" />
              <span>Need help setting up Azure Key Vault & App Registration?</span>
            </div>
            <button
              onClick={() => setShowModalAkvGuide(!showModalAkvGuide)}
              className="text-white font-bold underline hover:text-indigo-300 shrink-0"
            >
              {showModalAkvGuide ? 'Hide Guide' : 'View Instructions'}
            </button>
          </div>

          {showModalAkvGuide && (
            <div className="p-3.5 rounded-xl bg-[#070B19] border border-[#1E2D52] text-xs text-gray-300 space-y-2 animate-fadeIn">
              <div className="font-bold text-white mb-1">Quick Azure Key Vault Setup Steps:</div>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-gray-300">
                <li>Create or select your Key Vault in <a href="https://portal.azure.com" target="_blank" rel="noreferrer" className="text-indigo-400 underline">Azure Portal</a> and copy the <strong>Vault URI</strong> (e.g. <code className="text-gray-200">https://my-vault.vault.azure.net</code>).</li>
                <li>In <strong>Azure Entra ID &rarr; App registrations</strong>, register an application for Horizon.</li>
                <li>Copy the <strong>Directory (tenant) ID</strong> and <strong>Application (client) ID</strong>.</li>
                <li>Under <strong>Certificates & secrets</strong>, generate a new Client Secret and copy its <strong>Value</strong>.</li>
                <li>In your Key Vault, grant permission to the App:
                  <ul className="list-disc list-inside ml-4 mt-0.5 text-gray-400">
                    <li>If using <strong>Azure RBAC</strong>: assign role <strong>Key Vault Secrets User</strong> (or Officer).</li>
                    <li>If using <strong>Vault access policy</strong>: add access policy with <strong>Get</strong> and <strong>List</strong> under Secret permissions.</li>
                  </ul>
                </li>
              </ol>
            </div>
          )}

          {akvModalTestResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-fadeIn ${
              akvModalTestResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {akvModalTestResult.success ? <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" /> : <AlertCircle size={16} className="text-rose-400 mt-0.5 shrink-0" />}
              <div>
                <div className="font-bold">
                  {akvModalTestResult.success ? '✓ Azure Key Vault Verified & Online' : 'Key Vault Connection Test Failed'}
                </div>
                <div className="text-[11px] mt-0.5 opacity-90 leading-relaxed">
                  {akvModalTestResult.success 
                    ? `Ping: ${akvModalTestResult.pingMs}ms | Vault: ${akvModalTestResult.databaseOrPath} | Connected Secrets: ${akvModalTestResult.collectionsOrLists?.length || 0} discovered`
                    : akvModalTestResult.error}
                </div>
              </div>
            </div>
          )}

          {akvError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              {akvError}
            </div>
          )}

          <Input 
            label="Vault URL (Vault URI)" 
            value={akvVaultUrl} 
            onChange={e => setAkvVaultUrl(e.target.value)} 
            placeholder="https://<vault-name>.vault.azure.net" 
            autoFocus 
          />

          <Input 
            label="Directory (Tenant) ID" 
            value={akvTenantId} 
            onChange={e => setAkvTenantId(e.target.value)} 
            placeholder="e.g. 00000000-0000-0000-0000-000000000000" 
          />

          <Input 
            label="Application (Client) ID" 
            value={akvClientId} 
            onChange={e => setAkvClientId(e.target.value)} 
            placeholder="e.g. 11111111-1111-1111-1111-111111111111" 
          />

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-300">Client Secret (Value)</label>
              <button
                type="button"
                onClick={() => setShowAkvSecret(!showAkvSecret)}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
              >
                {showAkvSecret ? 'Hide Secret' : 'Show Secret'}
              </button>
            </div>
            <Input 
              type={showAkvSecret ? 'text' : 'password'}
              value={akvClientSecret} 
              onChange={e => setAkvClientSecret(e.target.value)} 
              placeholder="Paste Client Secret Value from Certificates & secrets" 
            />
            <p className="text-[11px] text-gray-500">
              Used for confidential client machine-to-machine authentication against Azure Key Vault REST API.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
