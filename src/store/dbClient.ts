import { useAuthStore } from './authStore'

const TOKEN_KEY = 'horizon_session_token'

export function getSessionToken(): string {
  const storeToken = useAuthStore.getState().sessionToken
  if (storeToken) return storeToken
  return sessionStorage.getItem(TOKEN_KEY) || ''
}

export async function dbQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const token = getSessionToken()
  return (window as any).horizon.db.query(token, sql, params)
}

export async function dbExecute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
  const token = getSessionToken()
  return (window as any).horizon.db.execute(token, sql, params)
}

export async function queueLocalMutation(entity: string, operation: 'CREATE' | 'UPDATE' | 'DELETE', payload: any, spItemId: string | null = null) {
  const token = getSessionToken()
  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
  await (window as any).horizon.db.execute(
    token,
    `INSERT INTO local_mutations (id, entity, sp_item_id, operation, payload_json, created_at, synced)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 0)`,
    [id, entity, spItemId, operation, JSON.stringify(payload)]
  )
}

export async function triggerAssignmentNotification(params: {
  targetAssignee: string
  title: string
  message: string
  entityType: string
  entityId: string
  productName?: string
}) {
  try {
    if (!params.targetAssignee || params.targetAssignee.trim() === '') return
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    
    // Find matching user id or fallback to string identifier
    const matchedUsers = await dbQuery<any>(
      'SELECT id, username, display_name FROM users WHERE id = ? OR username = ? OR display_name = ?',
      [params.targetAssignee, params.targetAssignee, params.targetAssignee]
    )
    const targetUserId = matchedUsers[0]?.id || params.targetAssignee

    await dbExecute(
      `INSERT INTO user_notifications (id, user_id, title, message, type, entity_type, entity_id, read, created_at)
       VALUES (?, ?, ?, ?, 'Assignment', ?, ?, 0, CURRENT_TIMESTAMP)`,
      [id, targetUserId, params.title, params.message, params.entityType, params.entityId]
    )

    // Trigger native desktop notification
    if ((window as any).horizon?.notify?.send) {
      await (window as any).horizon.notify.send({
        title: params.title,
        body: params.message
      })
    }
  } catch (e) {
    console.warn('Assignment notification error:', e)
  }
}

