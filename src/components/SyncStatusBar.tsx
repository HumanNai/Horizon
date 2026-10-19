import React from 'react'
import { useSync } from '../hooks/useSync'
import { RefreshCw, CheckCircle, XCircle, CloudOff } from 'lucide-react'

export function SyncStatusBar() {
  const { syncState, triggerSync } = useSync()

  const status: 'idle' | 'syncing' | 'error' | 'offline' = 
    (syncState && ['idle', 'syncing', 'error', 'offline'].includes(syncState.status))
      ? (syncState.status as any)
      : 'idle'

  const icons = {
    idle: <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
    syncing: <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />,
    error: <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />,
    offline: <CloudOff className="w-3.5 h-3.5 text-gray-400 shrink-0" />
  }

  const texts = {
    idle: 'Synced',
    syncing: 'Syncing...',
    error: 'Sync Error',
    offline: 'Offline'
  }

  const lastSyncFormatted = React.useMemo(() => {
    if (!syncState?.lastSyncAt || status === 'syncing') return null
    try {
      const d = new Date(syncState.lastSyncAt)
      if (isNaN(d.getTime())) return null
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return null
    }
  }, [syncState?.lastSyncAt, status])

  return (
    <button 
      type="button"
      className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#111d3c] border border-[#1e2d52] hover:bg-[#162040] hover:border-[#2E5EFF]/50 cursor-pointer transition-colors text-xs text-gray-200 shadow-sm shrink-0 select-none focus:outline-none focus:ring-1 focus:ring-[#2E5EFF]/40"
      onClick={() => triggerSync()}
      title="Click to sync manually"
    >
      {icons[status]}
      <span className="font-medium whitespace-nowrap">{texts[status]}</span>
      {lastSyncFormatted && (
        <span className="hidden md:inline text-gray-400 border-l border-[#1e2d52] pl-2 ml-0.5 text-[11px] whitespace-nowrap">
          {lastSyncFormatted}
        </span>
      )}
    </button>
  )
}
