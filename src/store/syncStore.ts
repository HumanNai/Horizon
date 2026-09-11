import { create } from 'zustand'
import { SyncState } from '../types'

interface SyncStoreState {
  state: SyncState
  triggerSync: () => Promise<void>
  listenToSyncStatus: () => void
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  state: { status: 'idle', pendingChanges: 0 },
  triggerSync: async () => {
    await (window as any).horizon.sync.trigger()
  },
  listenToSyncStatus: () => {
    (window as any).horizon.sync.onStatus((newState: SyncState) => {
      set({ state: newState })
    })
  }
}))
