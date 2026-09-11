import { create } from 'zustand'
import { Product } from '../types'
import { dbQuery, dbExecute, queueLocalMutation } from './dbClient'
import { useAuthStore } from './authStore'

interface ProductState {
  products: Product[]
  loading: boolean
  error: string | null
  fetchProducts: () => Promise<void>
  createProduct: (data: Partial<Product>) => Promise<void>
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  loading: false,
  error: null,

  fetchProducts: async () => {
    set({ loading: true, error: null })
    try {
      const user = useAuthStore.getState().user
      const isPO = user?.role === 'ProductOwner'
      let rows: any[] = []
      if (!user || isPO) {
        rows = await dbQuery<any>('SELECT * FROM products ORDER BY name ASC')
      } else {
        rows = await dbQuery<any>(
          'SELECT * FROM products WHERE owner_id = ? OR owner_id = ? OR owner_id = ? ORDER BY name ASC',
          [user.id, user.username, user.displayName]
        )
      }
      const products: Product[] = rows.map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        status: r.status,
        owner: r.owner_id,
        description: r.description || '',
        icon: r.icon || undefined,
        spItemId: r.sp_item_id || undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }))
      set({ products, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  createProduct: async (data) => {
    try {
      const user = useAuthStore.getState().user
      const isPO = user?.role === 'ProductOwner'
      const id = data.id || `prod-${Date.now()}`
      const name = data.name || 'Untitled Product'
      const type = data.type || 'Other'
      const status = data.status || 'Active'
      
      // If team member, force owner to current user so it is strictly linked to their account
      let owner = data.owner
      if (!isPO && user) {
        owner = user.displayName || user.username || 'Team Member'
      } else if (!owner) {
        owner = user?.displayName || 'Product Owner'
      }
      const description = data.description || ''
      const icon = data.icon || ''

      await dbExecute(
        `INSERT INTO products (id, name, type, status, owner_id, description, icon, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, name, type, status, owner, description, icon]
      )

      await queueLocalMutation('Products', 'CREATE', { id, name, type, status, owner, description, icon })

      const newProduct: Product = {
        id,
        name,
        type,
        status,
        owner,
        description,
        icon,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      set({ products: [...get().products, newProduct] })
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  updateProduct: async (id, data) => {
    try {
      const user = useAuthStore.getState().user
      const isPO = user?.role === 'ProductOwner'
      const current = get().products.find(p => p.id === id)
      if (!current) return

      // Permission check: if TeamMember, they can only modify their own products
      if (!isPO && user) {
        const isOwner = current.owner === user.displayName || current.owner === user.username || current.owner === user.id
        if (!isOwner) throw new Error('Unauthorized: You can only modify your own products')
      }

      const name = data.name !== undefined ? data.name : current.name
      const type = data.type !== undefined ? data.type : current.type
      const status = data.status !== undefined ? data.status : current.status
      // Only PO can reassign product owner; team members retain ownership
      const owner = (isPO && data.owner !== undefined) ? data.owner : current.owner
      const description = data.description !== undefined ? data.description : current.description
      const icon = data.icon !== undefined ? data.icon : (current.icon || '')

      await dbExecute(
        `UPDATE products SET name = ?, type = ?, status = ?, owner_id = ?, description = ?, icon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [name, type, status, owner, description, icon, id]
      )

      await queueLocalMutation('Products', 'UPDATE', { id, name, type, status, owner, description, icon }, current.spItemId || null)

      const updated = get().products.map(p => p.id === id ? {
        ...p,
        name,
        type,
        status,
        owner,
        description,
        icon,
        updatedAt: new Date().toISOString()
      } : p)

      set({ products: updated })
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  deleteProduct: async (id) => {
    try {
      const user = useAuthStore.getState().user
      const isPO = user?.role === 'ProductOwner'
      const target = get().products.find(p => p.id === id)
      if (!target) return

      // Permission check: if TeamMember, they can only delete their own products
      if (!isPO && user) {
        const isOwner = target.owner === user.displayName || target.owner === user.username || target.owner === user.id
        if (!isOwner) throw new Error('Unauthorized: You can only delete your own products')
      }

      // Cascade delete all child records tied to this product
      await dbExecute('DELETE FROM uat_cases WHERE release_id IN (SELECT id FROM releases WHERE product_id = ?)', [id])
      await dbExecute('DELETE FROM tasks WHERE product_id = ? OR release_id IN (SELECT id FROM releases WHERE product_id = ?)', [id, id])
      await dbExecute('DELETE FROM schedule_events WHERE linked_id = ? OR linked_id IN (SELECT id FROM releases WHERE product_id = ?)', [id, id])
      await dbExecute('DELETE FROM interfaces WHERE product_id = ?', [id])
      await dbExecute('DELETE FROM documents_meta WHERE product_id = ?', [id])
      await dbExecute('DELETE FROM product_custom_sections WHERE product_id = ?', [id])
      await dbExecute('DELETE FROM releases WHERE product_id = ?', [id])
      await dbExecute('DELETE FROM products WHERE id = ?', [id])

      if (target) {
        await queueLocalMutation('Products', 'DELETE', { id }, target.spItemId || null)
      }
      set({ products: get().products.filter(p => p.id !== id) })
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  }
}))
