import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Input, Modal, Badge, Select } from '../components/ui'
import { Lock, Unlock, Eye, EyeOff, Copy, RefreshCw, Trash2, Plus, ShieldCheck, ShieldAlert, Key, Check, KeyRound, Search, Filter, RotateCcw, X } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { getSessionToken } from '../store/dbClient'

interface SecretMetaItem {
  id: string
  name: string
  category: string
  description?: string
  last_rotated_at: string
  last_accessed_at?: string
  last_accessed_by?: string
  source?: 'local' | 'azure-keyvault'
  vaultUrl?: string
  enabled?: boolean
}

export function Secrets() {
  const currentUser = useAuthStore(state => state.user)
  const [unlocked, setUnlocked] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [localSecrets, setLocalSecrets] = useState<SecretMetaItem[]>([])
  const [azureSecrets, setAzureSecrets] = useState<SecretMetaItem[]>([])
  const [loadingAzure, setLoadingAzure] = useState(false)
  const [revealedValue, setRevealedValue] = useState<{ id: string; value: string } | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [secTargetVault, setSecTargetVault] = useState<'azure' | 'local'>('azure')
  const [addModalPassphrase, setAddModalPassphrase] = useState('')
  const [addModalError, setAddModalError] = useState('')
  const [isSavingSecret, setIsSavingSecret] = useState(false)

  // Master Passphrase & Vault Status State
  const [vaultStatus, setVaultStatus] = useState<{ isInitialized: boolean; isUnlocked: boolean; lastRotatedAt: string | null } | null>(null)
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false)
  const [setupPass, setSetupPass] = useState('')
  const [setupConfirm, setSetupConfirm] = useState('')
  const [setupError, setSetupError] = useState('')
  const [isSettingUp, setIsSettingUp] = useState(false)

  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false)
  const [curPass, setCurPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [newConfirm, setNewConfirm] = useState('')
  const [changeError, setChangeError] = useState('')
  const [isChanging, setIsChanging] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Filters & Remote Status
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [sourceFilter, setSourceFilter] = useState<'All' | 'local' | 'azure-keyvault'>('All')
  const [akvStatus, setAkvStatus] = useState<{ connected: boolean; status?: string; connectedAs?: string | null; error?: string | null } | null>(null)

  if (currentUser?.role === 'TeamMember' || currentUser?.role === 'Management') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center max-w-sm mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
          <Lock size={28} />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Access Restricted</h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          The Secrets Vault is restricted. Team Members and Upper Management do not have access to cryptographic credentials.
        </p>
      </div>
    )
  }

  // Form State
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Database')
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')

  const loadSecrets = async () => {
    try {
      const token = getSessionToken()
      const list = await (window as any).horizon.secrets.list(token)
      setLocalSecrets(list || [])
    } catch (err) {
      console.error(err)
    }
  }

  const loadAzureSecrets = async () => {
    try {
      const token = getSessionToken()
      if ((window as any).horizon?.secrets?.listAzure && token) {
        setLoadingAzure(true)
        const list = await (window as any).horizon.secrets.listAzure(token)
        const formatted: SecretMetaItem[] = (list || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          category: s.category || 'Cloud Secret',
          description: s.description || (akvStatus?.connectedAs ? `Azure Key Vault (${akvStatus.connectedAs})` : 'Azure Key Vault Secret'),
          last_rotated_at: s.updated_at,
          source: 'azure-keyvault',
          vaultUrl: s.vaultUrl,
          enabled: s.enabled
        }))
        setAzureSecrets(formatted)
      }
    } catch (err) {
      console.warn('Failed to load Azure secrets:', err)
    } finally {
      setLoadingAzure(false)
    }
  }

  const loadAkvStatus = async () => {
    try {
      if ((window as any).horizon?.secrets?.getAzureStatus) {
        const status = await (window as any).horizon.secrets.getAzureStatus()
        setAkvStatus(status)
        if (status?.connected) {
          loadAzureSecrets()
        }
      }
    } catch (err) {
      console.warn('Failed to load Azure Key Vault status:', err)
    }
  }

  const loadVaultStatus = async () => {
    try {
      const token = getSessionToken()
      if (token && (window as any).horizon?.secrets?.getStatus) {
        const res = await (window as any).horizon.secrets.getStatus(token)
        setVaultStatus(res)
        if (res?.isUnlocked) {
          setUnlocked(true)
          await loadSecrets()
        }
      }
    } catch (err) {
      console.warn('Failed to load vault status:', err)
    }
  }

  useEffect(() => {
    loadAkvStatus()
    loadVaultStatus()
  }, [])

  const handleSetupPassphrase = async (e: React.FormEvent) => {
    e.preventDefault()
    setSetupError('')
    if (setupPass.length < 6) {
      setSetupError('Master passphrase must be at least 6 characters long.')
      return
    }
    if (setupPass !== setupConfirm) {
      setSetupError('Passphrases do not match. Please verify.')
      return
    }
    try {
      setIsSettingUp(true)
      const token = getSessionToken()
      await (window as any).horizon.secrets.setupPassphrase(token, setupPass)
      setSuccessMsg('Master vault passphrase created successfully! Vault is now initialized and unlocked.')
      setTimeout(() => setSuccessMsg(null), 5000)
      setIsSetupModalOpen(false)
      setSetupPass('')
      setSetupConfirm('')
      setUnlocked(true)
      await loadSecrets()
      await loadVaultStatus()
    } catch (err: any) {
      setSetupError(err.message || 'Failed to initialize master vault passphrase.')
    } finally {
      setIsSettingUp(false)
    }
  }

  const handleChangePassphrase = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangeError('')
    if (!curPass.trim()) {
      setChangeError('Current master passphrase is required.')
      return
    }
    if (newPass.length < 6) {
      setChangeError('New master passphrase must be at least 6 characters long.')
      return
    }
    if (newPass !== newConfirm) {
      setChangeError('New passphrases do not match. Please verify.')
      return
    }
    try {
      setIsChanging(true)
      const token = getSessionToken()
      await (window as any).horizon.secrets.changePassphrase(token, curPass, newPass)
      setSuccessMsg('Master vault passphrase rotated and all local credentials re-encrypted successfully!')
      setTimeout(() => setSuccessMsg(null), 5000)
      setIsChangeModalOpen(false)
      setCurPass('')
      setNewPass('')
      setNewConfirm('')
      await loadSecrets()
      await loadVaultStatus()
    } catch (err: any) {
      setChangeError(err.message || 'Failed to change vault passphrase.')
    } finally {
      setIsChanging(false)
    }
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passphrase.trim()) {
      setError('Please enter your vault passphrase')
      return
    }
    try {
      const token = getSessionToken()
      const ok = await (window as any).horizon.secrets.unlock(token, passphrase)
      if (ok) {
        setUnlocked(true)
        setError('')
        await loadSecrets()
        await loadAkvStatus()
        await loadVaultStatus()
      } else {
        setError('Invalid passphrase')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to unlock vault')
    }
  }

  const handleLock = async () => {
    try {
      const token = getSessionToken()
      await (window as any).horizon.secrets.lock(token)
      setUnlocked(false)
      setPassphrase('')
      setRevealedValue(null)
      setLocalSecrets([])
      await loadVaultStatus()
    } catch (err) {
      console.error(err)
    }
  }

  const handleReveal = async (s: SecretMetaItem) => {
    if (revealedValue?.id === s.id) {
      setRevealedValue(null)
      return
    }
    try {
      const token = getSessionToken()
      let plain: string
      if (s.source === 'azure-keyvault' || s.id.includes('.vault.azure.net') || s.id.startsWith('https://')) {
        const secretName = s.id.includes('/secrets/') ? (s.id.split('/secrets/')[1]?.split('/')[0] || s.name) : s.name
        plain = await (window as any).horizon.secrets.revealAzure(token, secretName)
      } else {
        plain = await (window as any).horizon.secrets.reveal(token, s.id)
      }
      setRevealedValue({ id: s.id, value: plain })
      // Auto-hide after 30 seconds
      setTimeout(() => {
        setRevealedValue(prev => prev?.id === s.id ? null : prev)
      }, 30000)
    } catch (err: any) {
      alert(err.message || 'Failed to decrypt secret')
    }
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleAddSecret = async () => {
    setAddModalError('')
    if (!name.trim()) {
      setAddModalError('Secret name is required')
      return
    }
    if (!value.trim()) {
      setAddModalError('Secret plaintext value is required')
      return
    }

    setIsSavingSecret(true)
    try {
      const token = getSessionToken()
      if (secTargetVault === 'azure' && akvStatus?.connected) {
        await (window as any).horizon.secrets.addAzure(token, name.trim(), value.trim(), category)
        await loadAzureSecrets()
      } else {
        if (!unlocked) {
          if (!addModalPassphrase.trim()) {
            setAddModalError('Please enter your master passphrase to unlock & encrypt this secret')
            setIsSavingSecret(false)
            return
          }
          const ok = await (window as any).horizon.secrets.unlock(token, addModalPassphrase)
          if (!ok) {
            setAddModalError('Invalid master passphrase')
            setIsSavingSecret(false)
            return
          }
          setUnlocked(true)
          setError('')
        }

        await (window as any).horizon.secrets.add(token, name.trim(), category, value.trim(), description)
        await loadSecrets()
      }
      setIsAddModalOpen(false)
      setName('')
      setValue('')
      setDescription('')
      setAddModalPassphrase('')
      setAddModalError('')
    } catch (err: any) {
      setAddModalError(err.message || 'Failed to encrypt and store secret')
    } finally {
      setIsSavingSecret(false)
    }
  }

  const handleDelete = async (s: SecretMetaItem) => {
    if (confirm(`Permanently delete secret "${s.name}"?`)) {
      try {
        const token = getSessionToken()
        if (s.source === 'azure-keyvault') {
          alert('Azure Key Vault secret deletion is managed in Azure Portal or CLI.')
        } else {
          await (window as any).horizon.secrets.delete(token, s.id)
          setLocalSecrets(prev => prev.filter(item => item.id !== s.id))
        }
      } catch (err: any) {
        alert(err.message || 'Failed to delete secret')
      }
    }
  }

  const allAvailableSecrets: SecretMetaItem[] = [
    ...azureSecrets,
    ...(unlocked ? localSecrets : [])
  ]

  const filteredSecrets = (Array.isArray(allAvailableSecrets) ? allAvailableSecrets : []).filter(s => {
    if (!s) return false
    const q = searchQuery.toLowerCase().trim()
    const matchesQuery = !q || (s.name && s.name.toLowerCase().includes(q)) || (s.description && s.description.toLowerCase().includes(q))
    const matchesCategory = categoryFilter === 'All' || s.category === categoryFilter
    const matchesSource = sourceFilter === 'All' || (s.source || 'local') === sourceFilter
    return matchesQuery && matchesCategory && matchesSource
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0A1024]/90 border border-[#15203D]">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
            unlocked ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-[#2E5EFF]/10 border border-[#2E5EFF]/20 text-[#2E5EFF]'
          }`}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              {unlocked ? 'Secrets Vault (All Unlocked)' : akvStatus?.connected ? 'Secrets Vault (Azure Key Vault Active)' : 'Secrets Vault'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {unlocked 
                ? 'Local AES-256 vault unlocked & Azure Key Vault integrated.' 
                : akvStatus?.connected 
                  ? 'Azure Key Vault cloud secrets accessible. Local SQLite vault is locked.' 
                  : 'Manage encrypted application credentials and Azure Key Vault secrets.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {akvStatus?.connected && (
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={loadAzureSecrets} 
              loading={loadingAzure}
              className="text-xs gap-1.5 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
            >
              <RefreshCw size={13} className={loadingAzure ? 'animate-spin' : ''} /> Refresh Key Vault
            </Button>
          )}
          {unlocked && (
            <>
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => { setChangeError(''); setIsChangeModalOpen(true); }} 
                className="text-xs gap-1.5 shadow-sm"
              >
                <RotateCcw size={13} /> Change Passphrase
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLock} className="text-gray-400 hover:text-white">
                <Lock size={15} className="mr-1.5" /> Lock Vault
              </Button>
            </>
          )}
          {!vaultStatus?.isInitialized && (
            <Button 
              size="sm" 
              onClick={() => { setSetupError(''); setIsSetupModalOpen(true); }} 
              className="gap-1.5 bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20"
            >
              <Key size={14} /> Create Vault Password
            </Button>
          )}
          <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="gap-1.5 shadow-lg shadow-[#2E5EFF]/20">
            <Plus size={15} /> Add Secret
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <Check size={15} /> {successMsg}
        </div>
      )}

      {/* Azure Key Vault Remote Status Banner */}
      {akvStatus?.connected ? (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs shadow-xl">
          <div className="flex items-center gap-2.5 text-indigo-300">
            <KeyRound size={18} className="text-indigo-400 shrink-0" />
            <div>
              <span className="font-bold text-white">Azure Key Vault Connected: </span>
              <span className="font-mono text-indigo-200">{akvStatus.connectedAs || 'Active Vault'}</span>
              <span className="text-gray-400 ml-2 hidden sm:inline">(Enterprise HSM credentials seamlessly mapped & accessible)</span>
            </div>
          </div>
          <Badge variant="blue">Azure KV Online</Badge>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-900/40 border border-gray-800 text-xs">
          <div className="flex items-center gap-2 text-gray-400">
            <KeyRound size={16} className="text-gray-500 shrink-0" />
            <span>Azure Key Vault plugin is not connected. Connect it in the <strong>Plugins</strong> page to view cloud credentials.</span>
          </div>
          <a href="#/plugins" className="text-xs text-[#2E5EFF] hover:underline font-semibold shrink-0">Configure Plugin &rarr;</a>
        </div>
      )}

      {/* Local Vault Banner */}
      {!vaultStatus?.isInitialized ? (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs shadow-lg space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shrink-0">
                <KeyRound size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-sm">Master Vault Passphrase Not Set</h4>
                  <Badge variant="warning">Initial Setup Required</Badge>
                </div>
                <p className="text-gray-400 mt-0.5">
                  To prevent credential leaks, create your master cryptographic password before storing local secrets.
                </p>
              </div>
            </div>
            <Button 
              onClick={() => { setSetupError(''); setIsSetupModalOpen(true); }} 
              size="sm" 
              className="shrink-0 gap-1.5 bg-amber-600 hover:bg-amber-500 text-white shadow-md"
            >
              <Key size={14} /> Create Vault Password
            </Button>
          </div>
        </div>
      ) : !unlocked ? (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs shadow-lg space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shrink-0">
                <Lock size={18} />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Local SQLite Vault Locked</h4>
                <p className="text-gray-400">Enter master passphrase to decrypt and view local AES-256 credentials alongside Azure Key Vault secrets.</p>
              </div>
            </div>
            <form onSubmit={handleUnlock} className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="password"
                placeholder="Master passphrase..."
                value={passphrase}
                onChange={e => { setPassphrase(e.target.value); setError(''); }}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/50 focus:border-[#2E5EFF] rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors w-full sm:w-52"
              />
              <Button type="submit" size="sm" className="shrink-0 gap-1.5 shadow-md">
                <Unlock size={13} /> Unlock Local
              </Button>
            </form>
          </div>
          {error && <div className="text-xs text-red-400 font-medium pl-12">{error}</div>}
        </div>
      ) : null}

      {/* Secrets Filter Toolbar */}
      <div className="bg-[#0B1229]/90 border border-[#172347] p-3.5 sm:p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search secrets by name or description..."
              className="w-full bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/50 focus:border-[#2E5EFF] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-medium flex items-center gap-1"><Filter size={12} className="text-[#2E5EFF]" /> Category:</span>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
            >
              <option value="All">All Categories ({allAvailableSecrets.length})</option>
              <option value="Database">Database</option>
              <option value="Cloud">Cloud</option>
              <option value="Kafka">Kafka</option>
              <option value="OAuth">OAuth</option>
              <option value="Token">Token</option>
              <option value="Certificate">Certificate</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-medium">Source:</span>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value as any)}
              className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
            >
              <option value="All">All Sources</option>
              <option value="local">Local Vault</option>
              <option value="azure-keyvault">Azure Key Vault</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono text-xs text-gray-400 bg-[#070B19] px-3 py-1.5 rounded-xl border border-[#15203D]">
            Showing <strong className="text-white">{filteredSecrets.length}</strong> of {allAvailableSecrets.length}
          </span>
          {(searchQuery || categoryFilter !== 'All' || sourceFilter !== 'All') && (
            <button
              onClick={() => { setSearchQuery(''); setCategoryFilter('All'); setSourceFilter('All'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#15203D] hover:bg-[#1E2D52] text-xs text-gray-300 hover:text-white transition-colors border border-[#23335D]"
              title="Reset filters"
            >
              <RotateCcw size={12} /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-[#0A1024]/90 border border-[#15203D] overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#15203D] bg-[#0D1429] text-gray-400 uppercase tracking-wider font-semibold">
              <th className="p-4">Secret Name</th>
              <th className="p-4">Source</th>
              <th className="p-4">Category</th>
              <th className="p-4">Decrypted Plaintext</th>
              <th className="p-4">Last Rotated</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#15203D]">
            {filteredSecrets.map(s => {
              const isRevealed = revealedValue?.id === s?.id
              return (
                <tr key={s?.id || Math.random()} className="hover:bg-[#0E1736] transition-colors">
                  <td className="p-4">
                    <span className="font-bold text-white block">{s?.name || 'Unnamed Secret'}</span>
                    <span className="text-[11px] text-gray-400">{s?.description || 'No description'}</span>
                  </td>
                  <td className="p-4">
                    {s?.source === 'azure-keyvault' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        <KeyRound size={10} /> Azure KV
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-500/15 text-gray-300 border border-gray-500/30">
                        Local
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <Badge variant="blue">{s?.category || 'General'}</Badge>
                  </td>
                  <td className="p-4 font-mono">
                    {isRevealed ? (
                      <span className="bg-emerald-500/10 text-emerald-300 px-2 py-1 rounded border border-emerald-500/30">
                        {revealedValue?.value}
                      </span>
                    ) : (
                      <span className="text-gray-500 tracking-widest">••••••••••••••••</span>
                    )}
                  </td>
                  <td className="p-4 text-gray-400 font-mono">
                    {s?.last_rotated_at ? (() => {
                      try {
                        const d = new Date(s.last_rotated_at)
                        return isNaN(d.getTime()) ? '-' : d.toLocaleDateString()
                      } catch {
                        return '-'
                      }
                    })() : '-'}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button 
                        onClick={() => handleReveal(s)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1C2A54] transition-colors"
                        title={isRevealed ? 'Hide Secret' : 'Reveal Secret (30s)'}
                      >
                        {isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      {isRevealed && revealedValue && (
                        <button 
                          onClick={() => handleCopy(s.id, revealedValue.value)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1C2A54] transition-colors"
                          title="Copy Plaintext"
                        >
                          {copiedId === s.id ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(s)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete Secret"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filteredSecrets.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  {allAvailableSecrets.length === 0 
                    ? (akvStatus?.connected 
                        ? 'No secrets stored in vault. Click "Add Secret" to store a credential.' 
                        : 'No secrets available. Connect Azure Key Vault or unlock the local vault to view credentials.') 
                    : 'No secrets match your search or filter criteria.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false)
          setAddModalError('')
          setAddModalPassphrase('')
        }}
        title="Store Encrypted Secret"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => {
              setIsAddModalOpen(false)
              setAddModalError('')
              setAddModalPassphrase('')
            }}>Cancel</Button>
            <Button 
              onClick={handleAddSecret}
              loading={isSavingSecret}
              className={secTargetVault === 'azure' && akvStatus?.connected ? 'bg-indigo-600 hover:bg-indigo-500' : ''}
            >
              {secTargetVault === 'azure' && akvStatus?.connected ? 'Save to Azure Key Vault' : 'Encrypt & Save Locally'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {addModalError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <ShieldCheck size={16} className="shrink-0 text-red-400" />
              <span>{addModalError}</span>
            </div>
          )}

          {akvStatus?.connected && (
            <div className="space-y-1">
              <label className="font-semibold text-gray-300 text-xs">Target Vault Destination</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSecTargetVault('azure')}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 text-left transition-all cursor-pointer ${
                    secTargetVault === 'azure'
                      ? 'bg-indigo-500/15 border-indigo-500 text-white font-bold'
                      : 'bg-[#070B19] border-[#1E2D52] text-gray-400 hover:text-white'
                  }`}
                >
                  <KeyRound size={16} className={secTargetVault === 'azure' ? 'text-indigo-400' : 'text-gray-500'} />
                  <div>
                    <div className="text-xs">Azure Key Vault</div>
                    <div className="text-[10px] text-gray-400 font-normal">Cloud HSM Hardware Vault</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSecTargetVault('local')}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 text-left transition-all cursor-pointer ${
                    secTargetVault === 'local'
                      ? 'bg-[#2E5EFF]/15 border-[#2E5EFF] text-white font-bold'
                      : 'bg-[#070B19] border-[#1E2D52] text-gray-400 hover:text-white'
                  }`}
                >
                  <Lock size={16} className={secTargetVault === 'local' ? 'text-[#2E5EFF]' : 'text-gray-500'} />
                  <div>
                    <div className="text-xs">Local Encrypted</div>
                    <div className="text-[10px] text-gray-400 font-normal">Client AES-256 Storage</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* If saving to local vault and local vault is locked, prompt for master passphrase */}
          {(secTargetVault === 'local' || !akvStatus?.connected) && !unlocked && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                <Lock size={14} />
                <span>Local SQLite Vault is Locked</span>
              </div>
              <p className="text-[11px] text-gray-400">
                Enter your master passphrase to unlock the local vault and encrypt this secret:
              </p>
              <Input
                label="Master Passphrase"
                type="password"
                value={addModalPassphrase}
                onChange={e => setAddModalPassphrase(e.target.value)}
                placeholder="Enter master passphrase..."
                required
              />
            </div>
          )}

          <Input label="Secret Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Staging DB Master Credentials" required />
          <Select 
            label="Category" 
            value={category} 
            onChange={e => setCategory(e.target.value)}
            options={[
              { label: 'Database Credentials', value: 'Database' },
              { label: 'Cloud API Keys', value: 'Cloud' },
              { label: 'Kafka / SASL Certificates', value: 'Kafka' },
              { label: 'OAuth Client Secrets', value: 'OAuth' },
              { label: 'Tokens & Webhooks', value: 'Token' },
              { label: 'Certificates & Keys', value: 'Certificate' },
              { label: 'General / Other', value: 'Other' }
            ]}
          />
          <Input 
            label="Secret Value (Plaintext)" 
            type="password"
            value={value} 
            onChange={e => setValue(e.target.value)} 
            placeholder="Enter private value to store..." 
            required 
          />
          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Description / Usage Context</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Read-write access for payment reconciliation worker..."
              className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] min-h-[60px]"
            />
          </div>
        </div>
      </Modal>

      {/* ── Set Up Master Passphrase Modal ───────────────────────────────── */}
      <Modal
        isOpen={isSetupModalOpen}
        onClose={() => { if (!isSettingUp) setIsSetupModalOpen(false) }}
        title="Set Up Secrets Vault Master Password"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setIsSetupModalOpen(false)} disabled={isSettingUp}>Cancel</Button>
            <Button onClick={handleSetupPassphrase} loading={isSettingUp} className="bg-amber-600 hover:bg-amber-500 text-white">
              Initialize Master Password
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSetupPassphrase} className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-gray-300 space-y-1">
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <ShieldAlert size={15} /> Cryptographic Master Key Notice
            </div>
            <p className="text-[11px] leading-relaxed">
              This master passphrase derives the <strong>AES-256-GCM</strong> encryption key used to protect all local credentials. It is never stored on disk or in the database. Please record it safely.
            </p>
          </div>

          {setupError && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium">
              {setupError}
            </div>
          )}

          <Input
            label="Create Master Passphrase (min 6 characters)"
            type="password"
            value={setupPass}
            onChange={e => setSetupPass(e.target.value)}
            placeholder="Enter secure master passphrase..."
            required
            autoFocus
          />

          <Input
            label="Confirm Master Passphrase"
            type="password"
            value={setupConfirm}
            onChange={e => setSetupConfirm(e.target.value)}
            placeholder="Re-enter master passphrase to confirm..."
            required
          />
        </form>
      </Modal>

      {/* ── Change / Rotate Master Passphrase Modal ──────────────────────── */}
      <Modal
        isOpen={isChangeModalOpen}
        onClose={() => { if (!isChanging) setIsChangeModalOpen(false) }}
        title="Change Secrets Vault Master Password"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setIsChangeModalOpen(false)} disabled={isChanging}>Cancel</Button>
            <Button onClick={handleChangePassphrase} loading={isChanging}>
              Rotate & Re-encrypt Vault
            </Button>
          </div>
        }
      >
        <form onSubmit={handleChangePassphrase} className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-[#080D1F] border border-[#172347] text-gray-300 space-y-1">
            <div className="font-bold text-white flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-emerald-400" /> Automatic Zero-Downtime Re-encryption
            </div>
            <p className="text-[11px] leading-relaxed text-gray-400">
              When rotated, Horizon will automatically decrypt and re-encrypt all existing local secrets with a new salt and AES-256 key, guaranteeing seamless continuity.
            </p>
          </div>

          {changeError && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium">
              {changeError}
            </div>
          )}

          <Input
            label="Current Master Passphrase"
            type="password"
            value={curPass}
            onChange={e => setCurPass(e.target.value)}
            placeholder="Enter current master passphrase..."
            required
            autoFocus
          />

          <Input
            label="New Master Passphrase (min 6 characters)"
            type="password"
            value={newPass}
            onChange={e => setNewPass(e.target.value)}
            placeholder="Enter new master passphrase..."
            required
          />

          <Input
            label="Confirm New Master Passphrase"
            type="password"
            value={newConfirm}
            onChange={e => setNewConfirm(e.target.value)}
            placeholder="Re-enter new master passphrase..."
            required
          />
        </form>
      </Modal>
    </div>
  )
}
