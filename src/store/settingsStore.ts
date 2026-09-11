import { create } from 'zustand'
import { dbQuery, dbExecute } from './dbClient'

export interface ApplicationScope {
  id: string
  label: string
  badge: 'blue' | 'orange' | 'success' | 'warning' | 'danger' | 'neutral'
  shortCode: string
  description?: string
}

export const DEFAULT_APPLICATION_SCOPES: ApplicationScope[] = [
  {
    id: 'Internal',
    label: 'Internal Application (In-House / Core)',
    badge: 'blue',
    shortCode: 'INT',
    description: 'Internal operational platforms, backend workers, and company systems'
  },
  {
    id: 'External',
    label: 'External Application (Customer / Partner)',
    badge: 'orange',
    shortCode: 'EXT',
    description: 'Customer-facing web portals, client SDKs, and partner APIs'
  }
]

export const DEFAULT_DEADLINE_LEAD_DAYS = 7

interface SettingsState {
  deadlineLeadDays: number
  applicationScopes: ApplicationScope[]
  notifyReleases: boolean
  notifyTasks: boolean
  loading: boolean
  fetchSettings: () => Promise<void>
  setDeadlineLeadDays: (days: number) => Promise<void>
  setApplicationScopes: (scopes: ApplicationScope[]) => Promise<void>
  addApplicationScope: (scope: ApplicationScope) => Promise<void>
  updateApplicationScope: (id: string, scope: Partial<ApplicationScope>) => Promise<void>
  deleteApplicationScope: (id: string) => Promise<void>
  setNotifyReleases: (val: boolean) => Promise<void>
  setNotifyTasks: (val: boolean) => Promise<void>
  resetScopesToDefault: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  deadlineLeadDays: DEFAULT_DEADLINE_LEAD_DAYS,
  applicationScopes: DEFAULT_APPLICATION_SCOPES,
  notifyReleases: true,
  notifyTasks: true,
  loading: false,

  fetchSettings: async () => {
    set({ loading: true })
    try {
      await dbExecute(`CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`)

      const rows = await dbQuery<any>('SELECT key, value FROM app_settings')
      const settingsMap: Record<string, string> = {}
      rows.forEach(r => {
        settingsMap[r.key] = r.value
      })

      let leadDays = DEFAULT_DEADLINE_LEAD_DAYS
      if (settingsMap['deadline_lead_days']) {
        const parsed = parseInt(settingsMap['deadline_lead_days'], 10)
        if (!isNaN(parsed) && parsed > 0) leadDays = parsed
      }

      let scopes = DEFAULT_APPLICATION_SCOPES
      if (settingsMap['application_scopes']) {
        try {
          const parsedScopes = JSON.parse(settingsMap['application_scopes'])
          if (Array.isArray(parsedScopes) && parsedScopes.length > 0) {
            scopes = parsedScopes
          }
        } catch {}
      }

      const notifyRel = settingsMap['notify_releases'] !== 'false'
      const notifyTsk = settingsMap['notify_tasks'] !== 'false'

      set({
        deadlineLeadDays: leadDays,
        applicationScopes: scopes,
        notifyReleases: notifyRel,
        notifyTasks: notifyTsk,
        loading: false
      })
    } catch (e) {
      console.warn('Failed to fetch settings from SQLite:', e)
      set({ loading: false })
    }
  },

  setDeadlineLeadDays: async (days: number) => {
    const validDays = Math.max(1, days)
    set({ deadlineLeadDays: validDays })
    try {
      await dbExecute(
        'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        ['deadline_lead_days', validDays.toString()]
      )
    } catch (err) {
      console.error(err)
    }
  },

  setApplicationScopes: async (scopes: ApplicationScope[]) => {
    set({ applicationScopes: scopes })
    try {
      await dbExecute(
        'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        ['application_scopes', JSON.stringify(scopes)]
      )
    } catch (err) {
      console.error(err)
    }
  },

  addApplicationScope: async (scope: ApplicationScope) => {
    const current = get().applicationScopes
    if (current.some(s => s.id.toLowerCase() === scope.id.toLowerCase())) {
      throw new Error(`A scope with ID "${scope.id}" already exists.`)
    }
    const updated = [...current, scope]
    await get().setApplicationScopes(updated)
  },

  updateApplicationScope: async (id: string, partial: Partial<ApplicationScope>) => {
    const updated = get().applicationScopes.map(s => s.id === id ? { ...s, ...partial } : s)
    await get().setApplicationScopes(updated)
  },

  deleteApplicationScope: async (id: string) => {
    const current = get().applicationScopes
    if (current.length <= 1) {
      throw new Error('At least one application scope must remain configured.')
    }
    const updated = current.filter(s => s.id !== id)
    await get().setApplicationScopes(updated)
  },

  setNotifyReleases: async (val: boolean) => {
    set({ notifyReleases: val })
    try {
      await dbExecute(
        'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        ['notify_releases', val ? 'true' : 'false']
      )
    } catch (err) {
      console.error(err)
    }
  },

  setNotifyTasks: async (val: boolean) => {
    set({ notifyTasks: val })
    try {
      await dbExecute(
        'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        ['notify_tasks', val ? 'true' : 'false']
      )
    } catch (err) {
      console.error(err)
    }
  },

  resetScopesToDefault: async () => {
    await get().setApplicationScopes(DEFAULT_APPLICATION_SCOPES)
  }
}))

