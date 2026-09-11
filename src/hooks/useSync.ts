import { useEffect } from 'react'
import { useSyncStore } from '../store/syncStore'

export function useSync() {
  const { state, triggerSync, listenToSyncStatus } = useSyncStore()

  useEffect(() => {
    listenToSyncStatus()
  }, [listenToSyncStatus])

  return { syncState: state, triggerSync }
}
