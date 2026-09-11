import React from 'react'
import { useSync } from '../hooks/useSync'
import { RefreshCw, CheckCircle, XCircle, CloudOff } from 'lucide-react'

export function SyncStatusBar() {
  const { syncState, triggerSync } = useSync()

  const icons = {
    idle: <CheckCircle className="w-4 h-4 text-green-400" />,
    syncing: <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />,
    error: <XCircle className="w-4 h-4 text-red-400" />,
    offline: <CloudOff className="w-4 h-4 text-gray-400" />
  }

  const texts = {
    idle: 'Synced',
    syncing: 'Syncing...',
    error: 'Sync Error',
    offline: 'Offline'
  }

  return (
    <div 
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111d3c] border border-[#1e2d52] hover:bg-[#162040] cursor-pointer transition-colors text-xs text-gray-300 shadow-sm"
      onClick={() => triggerSync()}
      title="Click to sync manually"
    >
      {icons[syncState.status]}
      <span>{texts[syncState.status]}</span>
      {syncState.lastSyncAt && syncState.status !== 'syncing' && (
        <span className="text-gray-500 border-l border-[#1e2d52] pl-2 ml-1">
          {new Date(syncState.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  )
}
