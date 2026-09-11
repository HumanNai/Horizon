import React, { useEffect, useState } from 'react'
import { 
  Settings as SettingsIcon, 
  Clock, 
  Layers, 
  Bell, 
  Plus, 
  Trash2, 
  Edit3, 
  RotateCcw, 
  Check, 
  Sliders, 
  Save, 
  ShieldCheck, 
  ShieldAlert,
  KeyRound,
  Lock,
  Unlock,
  Key,
  RefreshCw,
  AlertCircle,
  Calendar 
} from 'lucide-react'
import { Card, Button, Badge, Modal, Input, Select } from '../components/ui'
import { useSettingsStore, ApplicationScope, DEFAULT_APPLICATION_SCOPES } from '../store/settingsStore'
import { useAuthStore } from '../store/authStore'

const BADGE_COLOR_OPTIONS: { label: string; value: ApplicationScope['badge'] }[] = [
  { label: 'Blue (Corporate / Core)', value: 'blue' },
  { label: 'Orange (External / Partner)', value: 'orange' },
  { label: 'Green / Success (Production / Live)', value: 'success' },
  { label: 'Yellow / Warning (Staging / Advisory)', value: 'warning' },
  { label: 'Red / Danger (Critical / Regulatory)', value: 'danger' },
  { label: 'Neutral / Gray (General)', value: 'neutral' }
]

export function Settings() {
  const {
    deadlineLeadDays,
    applicationScopes,
    notifyReleases,
    notifyTasks,
    fetchSettings,
    setDeadlineLeadDays,
    addApplicationScope,
    updateApplicationScope,
    deleteApplicationScope,
    setNotifyReleases,
    setNotifyTasks,
    resetScopesToDefault
  } = useSettingsStore()

  const [leadDaysInput, setLeadDaysInput] = useState(deadlineLeadDays)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Scope Modal State
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false)
  const [editingScopeId, setEditingScopeId] = useState<string | null>(null)
  const [scopeId, setScopeId] = useState('')
  const [scopeLabel, setScopeLabel] = useState('')
  const [scopeShortCode, setScopeShortCode] = useState('')
  const [scopeBadge, setScopeBadge] = useState<ApplicationScope['badge']>('blue')
  const [scopeDescription, setScopeDescription] = useState('')
  const [scopeError, setScopeError] = useState('')

  // Vault Security State
  const [vaultStatus, setVaultStatus] = useState<{ isInitialized: boolean; isUnlocked: boolean; lastRotatedAt: string | null } | null>(null)
  const [loadingVaultStatus, setLoadingVaultStatus] = useState(false)
  const [vaultSuccessMessage, setVaultSuccessMessage] = useState<string | null>(null)

  // Setup Master Passphrase Modal
  const [isSetupVaultModalOpen, setIsSetupVaultModalOpen] = useState(false)
  const [setupPassphrase, setSetupPassphrase] = useState('')
  const [setupConfirmPassphrase, setSetupConfirmPassphrase] = useState('')
  const [setupVaultError, setSetupVaultError] = useState('')
  const [isSettingUpVault, setIsSettingUpVault] = useState(false)

  // Change Master Passphrase Modal
  const [isChangeVaultModalOpen, setIsChangeVaultModalOpen] = useState(false)
  const [currentVaultPassphrase, setCurrentVaultPassphrase] = useState('')
  const [newVaultPassphrase, setNewVaultPassphrase] = useState('')
  const [newConfirmPassphrase, setNewConfirmPassphrase] = useState('')
  const [changeVaultError, setChangeVaultError] = useState('')
  const [isChangingVault, setIsChangingVault] = useState(false)

  useEffect(() => {
    fetchSettings()
    fetchVaultStatus()
  }, [fetchSettings])

  const fetchVaultStatus = async () => {
    try {
      setLoadingVaultStatus(true)
      const token = useAuthStore.getState().sessionToken
      if (token && (window as any).horizon?.secrets?.getStatus) {
        const res = await (window as any).horizon.secrets.getStatus(token)
        setVaultStatus(res)
      }
    } catch (e: any) {
      console.warn('Failed to fetch vault status:', e.message)
    } finally {
      setLoadingVaultStatus(false)
    }
  }

  const handleSetupVault = async (e: React.FormEvent) => {
    e.preventDefault()
    setSetupVaultError('')
    if (setupPassphrase.length < 6) {
      setSetupVaultError('Master passphrase must be at least 6 characters long.')
      return
    }
    if (setupPassphrase !== setupConfirmPassphrase) {
      setSetupVaultError('Passphrases do not match. Please verify.')
      return
    }
    try {
      setIsSettingUpVault(true)
      const token = useAuthStore.getState().sessionToken
      await (window as any).horizon.secrets.setupPassphrase(token, setupPassphrase)
      setVaultSuccessMessage('Cryptographic master vault passphrase created successfully! Vault is now initialized and unlocked.')
      setTimeout(() => setVaultSuccessMessage(null), 5000)
      setIsSetupVaultModalOpen(false)
      setSetupPassphrase('')
      setSetupConfirmPassphrase('')
      await fetchVaultStatus()
    } catch (err: any) {
      setSetupVaultError(err.message || 'Failed to initialize master vault passphrase.')
    } finally {
      setIsSettingUpVault(false)
    }
  }

  const handleChangeVault = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangeVaultError('')
    if (!currentVaultPassphrase.trim()) {
      setChangeVaultError('Current master passphrase is required.')
      return
    }
    if (newVaultPassphrase.length < 6) {
      setChangeVaultError('New master passphrase must be at least 6 characters long.')
      return
    }
    if (newVaultPassphrase !== newConfirmPassphrase) {
      setChangeVaultError('New passphrases do not match. Please verify.')
      return
    }
    try {
      setIsChangingVault(true)
      const token = useAuthStore.getState().sessionToken
      await (window as any).horizon.secrets.changePassphrase(token, currentVaultPassphrase, newVaultPassphrase)
      setVaultSuccessMessage('Master vault passphrase rotated and all local credentials re-encrypted successfully!')
      setTimeout(() => setVaultSuccessMessage(null), 5000)
      setIsChangeVaultModalOpen(false)
      setCurrentVaultPassphrase('')
      setNewVaultPassphrase('')
      setNewConfirmPassphrase('')
      await fetchVaultStatus()
    } catch (err: any) {
      setChangeVaultError(err.message || 'Failed to update vault passphrase.')
    } finally {
      setIsChangingVault(false)
    }
  }

  const handleLockVault = async () => {
    try {
      const token = useAuthStore.getState().sessionToken
      await (window as any).horizon.secrets.lock(token)
      await fetchVaultStatus()
    } catch (e: any) {
      console.error(e)
    }
  }

  useEffect(() => {
    setLeadDaysInput(deadlineLeadDays)
  }, [deadlineLeadDays])

  const handleSaveLeadTime = async (days: number) => {
    await setDeadlineLeadDays(days)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2500)
  }

  const handleOpenAddScope = () => {
    setEditingScopeId(null)
    setScopeId('')
    setScopeLabel('')
    setScopeShortCode('')
    setScopeBadge('blue')
    setScopeDescription('')
    setScopeError('')
    setIsScopeModalOpen(true)
  }

  const handleOpenEditScope = (s: ApplicationScope) => {
    setEditingScopeId(s.id)
    setScopeId(s.id)
    setScopeLabel(s.label)
    setScopeShortCode(s.shortCode)
    setScopeBadge(s.badge)
    setScopeDescription(s.description || '')
    setScopeError('')
    setIsScopeModalOpen(true)
  }

  const handleSaveScope = async () => {
    if (!scopeLabel.trim()) {
      setScopeError('Please provide a scope display name.')
      return
    }

    const id = (scopeId.trim() || scopeLabel.trim().replace(/[^a-zA-Z0-9]/g, ''))
    const shortCode = (scopeShortCode.trim() || id.slice(0, 3).toUpperCase())

    try {
      if (editingScopeId) {
        await updateApplicationScope(editingScopeId, {
          label: scopeLabel.trim(),
          shortCode,
          badge: scopeBadge,
          description: scopeDescription.trim()
        })
      } else {
        await addApplicationScope({
          id,
          label: scopeLabel.trim(),
          shortCode,
          badge: scopeBadge,
          description: scopeDescription.trim()
        })
      }
      setIsScopeModalOpen(false)
    } catch (err: any) {
      setScopeError(err.message || 'Failed to save application scope.')
    }
  }

  const handleDeleteScope = async (id: string) => {
    if (confirm(`Remove the "${id}" application scope option?`)) {
      try {
        await deleteApplicationScope(id)
      } catch (err: any) {
        alert(err.message)
      }
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#172347] pb-6">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <SettingsIcon className="text-[#2E5EFF]" size={26} /> Global System & Notification Settings
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Configure deadline lookahead lead times, dynamic application scope definitions, and alert triggers.
          </p>
        </div>
      </div>

      {/* ── SECTION 0: Cryptographic Secrets Vault Master Password ────── */}
      <Card className="p-6 border-[#1A284F] bg-[#0A1024]/90 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <KeyRound size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white">Secrets Vault Master Password</h2>
                {vaultStatus?.isInitialized ? (
                  <Badge variant="success">Vault Initialized (AES-256-GCM)</Badge>
                ) : (
                  <Badge variant="warning">Setup Required</Badge>
                )}
                {vaultStatus?.isUnlocked ? (
                  <Badge variant="blue">Unlocked</Badge>
                ) : (
                  <Badge variant="neutral">Locked</Badge>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Configure, manage, or rotate the master encryption passphrase used to secure confidential secrets, database credentials, and API keys.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchVaultStatus}
              loading={loadingVaultStatus}
              className="text-xs gap-1.5"
            >
              <RefreshCw size={13} className={loadingVaultStatus ? 'animate-spin' : ''} /> Check Status
            </Button>

            {!vaultStatus?.isInitialized ? (
              <Button
                size="sm"
                onClick={() => { setSetupVaultError(''); setIsSetupVaultModalOpen(true); }}
                className="gap-1.5 bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20"
              >
                <Key size={14} /> Create Vault Password
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => { setChangeVaultError(''); setIsChangeVaultModalOpen(true); }}
                  className="gap-1.5 shadow-lg shadow-[#2E5EFF]/20"
                >
                  <RotateCcw size={14} /> Change Vault Password
                </Button>
                {vaultStatus?.isUnlocked && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleLockVault}
                    className="text-gray-400 hover:text-white"
                  >
                    <Lock size={14} className="mr-1" /> Lock Vault
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {vaultSuccessMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <Check size={14} /> {vaultSuccessMessage}
          </div>
        )}

        {/* Informational Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-1">
          <div className="p-4 rounded-xl bg-[#080D1F] border border-[#172347] space-y-1">
            <div className="text-gray-400 font-medium">Encryption Standard</div>
            <div className="text-white font-semibold flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" /> AES-256-GCM / PBKDF2
            </div>
            <div className="text-[11px] text-gray-500">210,000 SHA-256 derivation rounds</div>
          </div>

          <div className="p-4 rounded-xl bg-[#080D1F] border border-[#172347] space-y-1">
            <div className="text-gray-400 font-medium">Master Passphrase Status</div>
            <div className="text-white font-semibold">
              {vaultStatus?.isInitialized ? 'Configured & Active' : 'Not Yet Created'}
            </div>
            <div className="text-[11px] text-gray-500">
              {vaultStatus?.lastRotatedAt ? `Last rotated: ${new Date(vaultStatus.lastRotatedAt).toLocaleDateString()}` : 'Never stored in database or disk'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#080D1F] border border-[#172347] space-y-1">
            <div className="text-gray-400 font-medium">Credential Leak Protection</div>
            <div className="text-white font-semibold flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-cyan-400" /> Decoupled from Account Passwords
            </div>
            <div className="text-[11px] text-gray-500">Changing account passwords never leaks vault keys</div>
          </div>
        </div>
      </Card>

      {/* ── SECTION 1: Notification & Deadline Lookahead Logic ────────── */}
      <Card className="p-6 border-[#1A284F] bg-[#0A1024]/90 shadow-xl space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2E5EFF]/15 border border-[#2E5EFF]/30 flex items-center justify-center text-[#2E5EFF]">
              <Clock size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Upcoming Deadline & Notification Lookahead Window</h2>
              <p className="text-xs text-gray-400">
                Define how far in advance upcoming release cutovers and task deadlines are surfaced on the Dashboard and in the top notification bell.
              </p>
            </div>
          </div>
          {saveSuccess && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium animate-in fade-in">
              <Check size={14} /> Saved
            </div>
          )}
        </div>

        <div className="space-y-4 pt-2">
          <label className="text-xs font-semibold text-gray-300 block">
            Show deadlines and trigger alerts for items due within:
          </label>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {[1, 2, 3, 5, 7, 14, 30].map(days => (
              <button
                key={days}
                type="button"
                onClick={() => {
                  setLeadDaysInput(days)
                  handleSaveLeadTime(days)
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  deadlineLeadDays === days
                    ? 'bg-[#2E5EFF] text-white border-[#2E5EFF] shadow-lg shadow-[#2E5EFF]/30 scale-105'
                    : 'bg-[#0E1736] text-gray-300 border-[#1E2D52] hover:border-gray-500 hover:text-white'
                }`}
              >
                {days === 1 ? '1 Day (Tomorrow)' : `${days} Days`}
              </button>
            ))}
          </div>

          {/* Custom Input */}
          <div className="flex items-center gap-3 max-w-sm pt-2">
            <div className="relative flex-1">
              <input
                type="number"
                min="1"
                max="90"
                value={leadDaysInput}
                onChange={e => setLeadDaysInput(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[#0D1429] border border-[#1E2D52] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF]"
                placeholder="Custom days..."
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">Days</span>
            </div>
            <Button
              size="sm"
              onClick={() => handleSaveLeadTime(leadDaysInput)}
              className="gap-1.5"
            >
              <Save size={14} /> Apply Window
            </Button>
          </div>

          {/* Notification Alert Toggles */}
          <div className="border-t border-[#15203D] pt-4 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#080D1F] border border-[#19264A] cursor-pointer hover:border-[#2E5EFF]/40 transition-colors">
              <input
                type="checkbox"
                checked={notifyReleases}
                onChange={e => setNotifyReleases(e.target.checked)}
                className="w-4 h-4 rounded text-[#2E5EFF] focus:ring-0 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-white block">Release Cutover Alerts</span>
                <span className="text-[11px] text-gray-400">Notify when release target cutovers are within the lookahead window</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#080D1F] border border-[#19264A] cursor-pointer hover:border-[#2E5EFF]/40 transition-colors">
              <input
                type="checkbox"
                checked={notifyTasks}
                onChange={e => setNotifyTasks(e.target.checked)}
                className="w-4 h-4 rounded text-[#2E5EFF] focus:ring-0 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-white block">Task Due Date Alerts</span>
                <span className="text-[11px] text-gray-400">Notify when sprint tasks with due dates enter the lookahead window</span>
              </div>
            </label>
          </div>
        </div>
      </Card>

      {/* ── SECTION 2: Application Scope Dropdown Definitions ─────────── */}
      <Card className="p-6 border-[#1A284F] bg-[#0A1024]/90 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#172347] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F5A623]/15 border border-[#F5A623]/30 flex items-center justify-center text-[#F5A623]">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Application Scope Dropdown Definitions</h2>
              <p className="text-xs text-gray-400">
                Configure the classification scopes available in the "Application Scope" dropdown when creating and configuring applications.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (confirm('Reset application scopes to default (Internal & External)?')) {
                  resetScopesToDefault()
                }
              }}
              className="gap-1.5 text-xs text-gray-400 hover:text-white"
            >
              <RotateCcw size={13} /> Reset Defaults
            </Button>
            <Button size="sm" onClick={handleOpenAddScope} className="gap-1.5 shadow-md shadow-[#2E5EFF]/20">
              <Plus size={14} /> Add Scope Option
            </Button>
          </div>
        </div>

        {/* Scopes List */}
        <div className="space-y-3">
          {applicationScopes.map((scope) => (
            <div
              key={scope.id}
              className="flex items-center justify-between p-4 rounded-2xl bg-[#080D1F] border border-[#19264A] hover:border-[#2E5EFF]/40 transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#0D1429] border border-[#23335F] flex items-center justify-center text-xs font-mono font-bold text-gray-300 shrink-0">
                  {scope.shortCode || scope.id.slice(0, 3).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-bold text-sm text-white">{scope.label}</span>
                    <Badge variant={scope.badge}>{scope.id}</Badge>
                    <span className="text-[11px] font-mono text-gray-500">ID: {scope.id}</span>
                  </div>
                  {scope.description && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xl">{scope.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleOpenEditScope(scope)}
                  className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#15203D] transition-colors"
                  title="Edit Scope"
                >
                  <Edit3 size={15} />
                </button>
                <button
                  onClick={() => handleDeleteScope(scope.id)}
                  disabled={applicationScopes.length <= 1}
                  className="p-2 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:hover:text-gray-500"
                  title="Delete Scope"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Add / Edit Scope Modal ──────────────────────────────────────── */}
      <Modal
        isOpen={isScopeModalOpen}
        onClose={() => setIsScopeModalOpen(false)}
        title={editingScopeId ? `Edit Scope: ${editingScopeId}` : 'Add Application Scope Option'}
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setIsScopeModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveScope}>
              {editingScopeId ? 'Save Changes' : 'Create Scope'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {scopeError && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium">
              {scopeError}
            </div>
          )}

          {!editingScopeId && (
            <Input
              label="Scope ID / Value (No spaces, e.g. Internal, External, PartnerSaaS)"
              value={scopeId}
              onChange={e => setScopeId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
              placeholder="e.g. PartnerAPI"
              required
            />
          )}

          <Input
            label="Dropdown Display Label"
            value={scopeLabel}
            onChange={e => setScopeLabel(e.target.value)}
            placeholder="e.g. Partner API & Ecosystem Integration"
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Short Code (2-4 chars, e.g. INT, EXT, API)"
              value={scopeShortCode}
              onChange={e => setScopeShortCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="e.g. API"
              maxLength={4}
            />

            <Select
              label="Badge Theme Color"
              value={scopeBadge}
              onChange={e => setScopeBadge(e.target.value as any)}
              options={BADGE_COLOR_OPTIONS}
            />
          </div>

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Description (Optional)</label>
            <textarea
              value={scopeDescription}
              onChange={e => setScopeDescription(e.target.value)}
              placeholder="Describe the category of applications classified under this scope..."
              className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] min-h-[70px]"
            />
          </div>
        </div>
      </Modal>

      {/* ── Set Up Master Passphrase Modal ───────────────────────────────── */}
      <Modal
        isOpen={isSetupVaultModalOpen}
        onClose={() => { if (!isSettingUpVault) setIsSetupVaultModalOpen(false) }}
        title="Set Up Secrets Vault Master Password"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setIsSetupVaultModalOpen(false)} disabled={isSettingUpVault}>Cancel</Button>
            <Button onClick={handleSetupVault} loading={isSettingUpVault} className="bg-amber-600 hover:bg-amber-500 text-white">
              Initialize Master Password
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSetupVault} className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-gray-300 space-y-1">
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <ShieldAlert size={15} /> Cryptographic Master Key Notice
            </div>
            <p className="text-[11px] leading-relaxed">
              This master passphrase derives the <strong>AES-256-GCM</strong> encryption key used to encrypt all local secrets. It is never written to disk or database. Make sure to record it in your password manager.
            </p>
          </div>

          {setupVaultError && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium">
              {setupVaultError}
            </div>
          )}

          <Input
            label="Create Master Passphrase (min 6 characters)"
            type="password"
            value={setupPassphrase}
            onChange={e => setSetupPassphrase(e.target.value)}
            placeholder="Enter secure master passphrase..."
            required
            autoFocus
          />

          <Input
            label="Confirm Master Passphrase"
            type="password"
            value={setupConfirmPassphrase}
            onChange={e => setSetupConfirmPassphrase(e.target.value)}
            placeholder="Re-enter master passphrase to confirm..."
            required
          />
        </form>
      </Modal>

      {/* ── Change / Rotate Master Passphrase Modal ──────────────────────── */}
      <Modal
        isOpen={isChangeVaultModalOpen}
        onClose={() => { if (!isChangingVault) setIsChangeVaultModalOpen(false) }}
        title="Change Secrets Vault Master Password"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setIsChangeVaultModalOpen(false)} disabled={isChangingVault}>Cancel</Button>
            <Button onClick={handleChangeVault} loading={isChangingVault}>
              Rotate & Re-encrypt Vault
            </Button>
          </div>
        }
      >
        <form onSubmit={handleChangeVault} className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-[#080D1F] border border-[#172347] text-gray-300 space-y-1">
            <div className="font-bold text-white flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-emerald-400" /> Automatic Zero-Downtime Re-encryption
            </div>
            <p className="text-[11px] leading-relaxed text-gray-400">
              When you change the master password, Horizon will automatically decrypt and re-encrypt all existing local secrets with a new salt and AES-256 key, ensuring no credentials are lost.
            </p>
          </div>

          {changeVaultError && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium">
              {changeVaultError}
            </div>
          )}

          <Input
            label="Current Master Passphrase"
            type="password"
            value={currentVaultPassphrase}
            onChange={e => setCurrentVaultPassphrase(e.target.value)}
            placeholder="Enter current master passphrase..."
            required
            autoFocus
          />

          <Input
            label="New Master Passphrase (min 6 characters)"
            type="password"
            value={newVaultPassphrase}
            onChange={e => setNewVaultPassphrase(e.target.value)}
            placeholder="Enter new master passphrase..."
            required
          />

          <Input
            label="Confirm New Master Passphrase"
            type="password"
            value={newConfirmPassphrase}
            onChange={e => setNewConfirmPassphrase(e.target.value)}
            placeholder="Re-enter new master passphrase..."
            required
          />
        </form>
      </Modal>
    </div>
  )
}

