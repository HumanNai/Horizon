import { create } from 'zustand'
import { Release } from '../types'
import { dbQuery, dbExecute, queueLocalMutation } from './dbClient'
import { useAuthStore } from './authStore'

interface ReleaseState {
  releases: Release[]
  loading: boolean
  error: string | null
  fetchReleases: (productId?: string) => Promise<void>
  createRelease: (data: Partial<Release>) => Promise<void>
  updateRelease: (id: string, data: Partial<Release>) => Promise<void>
  updateReleaseStatus: (id: string, status: string) => Promise<void>
  signOffRelease: (id: string, notes: string) => Promise<void>
  deleteRelease: (id: string) => Promise<void>
}

export const useReleaseStore = create<ReleaseState>((set, get) => ({
  releases: [],
  loading: false,
  error: null,

  fetchReleases: async (productId) => {
    set({ loading: true, error: null })
    try {
      const user = useAuthStore.getState().user
      const isPO = user?.role === 'ProductOwner'
      let sql = ''
      let params: any[] = []

      if (productId) {
        sql = 'SELECT * FROM releases WHERE product_id = ? ORDER BY target_date ASC'
        params = [productId]
      } else if (!user || isPO) {
        sql = 'SELECT * FROM releases ORDER BY target_date ASC'
      } else {
        sql = `SELECT * FROM releases 
               WHERE product_id IN (SELECT id FROM products WHERE owner_id = ? OR owner_id = ? OR owner_id = ?)
               ORDER BY target_date ASC`
        params = [user.id, user.username, user.displayName]
      }
      const rows = await dbQuery<any>(sql, params)

      const releases: Release[] = rows.map(r => {
        let features: string[] = []
        try {
          features = JSON.parse(r.features_json || '[]')
        } catch {
          features = []
        }
        return {
          id: r.id,
          productId: r.product_id,
          version: r.version,
          name: r.name,
          status: r.status,
          targetDate: r.target_date,
          releasedDate: r.released_date || undefined,
          description: r.description || '',
          features,
          serverUpgrades: r.server_upgrades || undefined,
          spItemId: r.sp_item_id || undefined,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }
      })

      set({ releases, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  createRelease: async (data) => {
    try {
      const id = data.id || `rel-${Date.now()}`
      const productId = data.productId || ''
      const version = data.version || 'v1.0.0'
      const name = data.name || version
      const status = data.status || 'Planning'
      const targetDate = data.targetDate || new Date(Date.now() + 86400000 * 14).toISOString()
      const description = data.description || ''
      const featuresJson = JSON.stringify(data.features || [])
      const serverUpgrades = data.serverUpgrades || ''

      await dbExecute(
        `INSERT INTO releases (id, product_id, version, name, status, target_date, description, features_json, server_upgrades, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, productId, version, name, status, targetDate, description, featuresJson, serverUpgrades]
      )

      try {
        await dbExecute(
          `INSERT OR REPLACE INTO schedule_events (id, title, type, start_date, end_date, linked_id, linked_type, notify_at, notified, created_by, created_at, updated_at)
           VALUES (?, ?, 'Release', ?, ?, ?, 'Release', ?, 0, 'User', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [`ev-${id}`, `${name} (${version}) Cutover`, targetDate, targetDate, id, targetDate]
        )
      } catch {}

      await queueLocalMutation('Releases', 'CREATE', { id, productId, version, name, status, targetDate, description })

      const newRelease: Release = {
        id,
        productId,
        version,
        name,
        status: status as any,
        targetDate,
        description,
        features: data.features || [],
        serverUpgrades,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      set({ releases: [...get().releases, newRelease] })
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  updateRelease: async (id, data) => {
    try {
      const current = get().releases.find(r => r.id === id)
      if (!current) return

      const version = data.version !== undefined ? data.version : current.version
      const name = data.name !== undefined ? data.name : current.name
      const status = data.status !== undefined ? data.status : current.status
      const targetDate = data.targetDate !== undefined ? data.targetDate : current.targetDate
      const description = data.description !== undefined ? data.description : current.description
      const features = data.features !== undefined ? data.features : current.features
      const serverUpgrades = data.serverUpgrades !== undefined ? data.serverUpgrades : (current.serverUpgrades || '')

      await dbExecute(
        `UPDATE releases SET version = ?, name = ?, status = ?, target_date = ?, description = ?, features_json = ?, server_upgrades = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [version, name, status, targetDate, description, JSON.stringify(features), serverUpgrades, id]
      )

      try {
        await dbExecute(
          `INSERT OR REPLACE INTO schedule_events (id, title, type, start_date, end_date, linked_id, linked_type, notify_at, notified, created_by, created_at, updated_at)
           VALUES (?, ?, 'Release', ?, ?, ?, 'Release', ?, 0, 'User', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [`ev-${id}`, `${name} (${version}) Cutover`, targetDate, targetDate, id, targetDate]
        )
      } catch {}

      await queueLocalMutation('Releases', 'UPDATE', { id, version, name, status, targetDate }, current.spItemId || null)

      set({
        releases: get().releases.map(r => r.id === id ? {
          ...r,
          version,
          name,
          status,
          targetDate,
          description,
          features,
          serverUpgrades,
          updatedAt: new Date().toISOString()
        } : r)
      })
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  updateReleaseStatus: async (id, status) => {
    try {
      await dbExecute(`UPDATE releases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, id])
      set({
        releases: get().releases.map(r => r.id === id ? { ...r, status: status as any, updatedAt: new Date().toISOString() } : r)
      })
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  signOffRelease: async (id, notes) => {
    try {
      const now = new Date().toISOString()
      await dbExecute(
        `UPDATE releases SET status = 'SignOff', released_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [now, id]
      )
      await dbExecute(
        `INSERT INTO release_signoffs (release_id, signed_off_by, signed_off_at, notes)
         VALUES (?, 'Product Owner', CURRENT_TIMESTAMP, ?)`,
        [id, notes]
      )
      await queueLocalMutation('Releases', 'UPDATE', { id, status: 'SignOff', notes })
      set({
        releases: get().releases.map(r => r.id === id ? { ...r, status: 'SignOff', releasedDate: now, updatedAt: now } : r)
      })
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  deleteRelease: async (id) => {
    try {
      await dbExecute('DELETE FROM releases WHERE id = ?', [id])
      try {
        await dbExecute('DELETE FROM schedule_events WHERE linked_id = ?', [id])
      } catch {}
      set({ releases: get().releases.filter(r => r.id !== id) })
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  }
}))
