import { create } from 'zustand'
import { Task, TaskStatus } from '../types'
import { dbQuery, dbExecute, queueLocalMutation, triggerAssignmentNotification } from './dbClient'
import { useAuthStore } from './authStore'

interface TaskState {
  tasks: Task[]
  loading: boolean
  error: string | null
  fetchTasks: (productId?: string) => Promise<void>
  createTask: (data: Partial<Task>) => Promise<void>
  updateTask: (id: string, data: Partial<Task>) => Promise<void>
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>
  deleteTask: (id: string) => Promise<void>
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,

  fetchTasks: async (productId) => {
    set({ loading: true, error: null })
    try {
      const user = useAuthStore.getState().user
      const isPO = user?.role === 'ProductOwner'
      let sql = ''
      let params: any[] = []

      if (productId) {
        sql = 'SELECT * FROM tasks WHERE product_id = ? ORDER BY created_at DESC'
        params = [productId]
      } else if (!user || isPO) {
        sql = 'SELECT * FROM tasks ORDER BY created_at DESC'
      } else {
        sql = `SELECT * FROM tasks 
               WHERE product_id IN (SELECT id FROM products WHERE owner_id = ? OR owner_id = ? OR owner_id = ?)
                  OR assignee_id = ? OR assignee_id = ? OR assignee_id = ?
               ORDER BY created_at DESC`
        params = [user.id, user.username, user.displayName, user.id, user.username, user.displayName]
      }
      const rows = await dbQuery<any>(sql, params)

      const tasks: Task[] = rows.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description || '',
        status: t.status as TaskStatus,
        priority: t.priority,
        assigneeId: t.assignee_id,
        productId: t.product_id || undefined,
        releaseId: t.release_id || undefined,
        dueDate: t.due_date || undefined,
        spItemId: t.sp_item_id || undefined,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }))

      set({ tasks, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  createTask: async (data) => {
    try {
      const id = data.id || `task-${Date.now()}`
      const title = data.title || 'Untitled Task'
      const description = data.description || ''
      const status = data.status || 'Todo'
      const priority = data.priority || 'Medium'
      const assigneeId = data.assigneeId || 'PO'
      const productId = data.productId || null
      const releaseId = data.releaseId || null
      const dueDate = data.dueDate || null

      await dbExecute(
        `INSERT INTO tasks (id, title, description, status, priority, assignee_id, product_id, release_id, due_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, title, description, status, priority, assigneeId, productId, releaseId, dueDate]
      )

      await queueLocalMutation('Tasks', 'CREATE', { id, title, description, status, priority, assigneeId, productId, releaseId, dueDate })

      if (assigneeId && assigneeId !== 'Unassigned') {
        triggerAssignmentNotification({
          targetAssignee: assigneeId,
          title: `Task Assigned: ${title}`,
          message: `You have been assigned task: "${title}".`,
          entityType: 'Task',
          entityId: id
        })
      }

      const newTask: Task = {
        id,
        title,
        description,
        status: status as TaskStatus,
        priority,
        assigneeId,
        productId: productId || undefined,
        releaseId: releaseId || undefined,
        dueDate: dueDate || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      set({ tasks: [newTask, ...get().tasks] })
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  updateTask: async (id, data) => {
    try {
      const current = get().tasks.find(t => t.id === id)
      if (!current) return

      const title = data.title !== undefined ? data.title : current.title
      const description = data.description !== undefined ? data.description : current.description
      const status = data.status !== undefined ? data.status : current.status
      const priority = data.priority !== undefined ? data.priority : current.priority
      const assigneeId = data.assigneeId !== undefined ? data.assigneeId : current.assigneeId
      const productId = data.productId !== undefined ? data.productId : (current.productId || null)
      const releaseId = data.releaseId !== undefined ? data.releaseId : (current.releaseId || null)
      const dueDate = data.dueDate !== undefined ? data.dueDate : (current.dueDate || null)

      await dbExecute(
        `UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, assignee_id = ?, product_id = ?, release_id = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [title, description, status, priority, assigneeId, productId, releaseId, dueDate, id]
      )

      await queueLocalMutation('Tasks', 'UPDATE', { id, title, description, status, priority, assigneeId }, current.spItemId || null)

      if (assigneeId && assigneeId !== current.assigneeId && assigneeId !== 'Unassigned') {
        triggerAssignmentNotification({
          targetAssignee: assigneeId,
          title: `Task Assigned: ${title}`,
          message: `You have been assigned task: "${title}".`,
          entityType: 'Task',
          entityId: id
        })
      }

      set({
        tasks: get().tasks.map(t => t.id === id ? {
          ...t,
          title,
          description,
          status: status as TaskStatus,
          priority,
          assigneeId,
          productId: productId || undefined,
          releaseId: releaseId || undefined,
          dueDate: dueDate || undefined,
          updatedAt: new Date().toISOString()
        } : t)
      })
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  updateTaskStatus: async (id, status) => {
    try {
      await dbExecute(`UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, id])
      await queueLocalMutation('Tasks', 'UPDATE', { id, status })
      set({
        tasks: get().tasks.map(t => t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t)
      })
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  deleteTask: async (id) => {
    try {
      await dbExecute('DELETE FROM tasks WHERE id = ?', [id])
      set({ tasks: get().tasks.filter(t => t.id !== id) })
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  }
}))
