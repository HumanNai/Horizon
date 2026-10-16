/**
 * Web Bridge for Horizon PM
 * Shims `window.horizon` when running in a standard web browser instead of Electron.
 * All operations map cleanly to the Express REST API backend (`/api/*`).
 */

export function setupWebBridge(): void {
  if (typeof window === 'undefined' || (window as any).horizon) return;

  const getAuthHeader = (): Record<string, string> => {
    const token = sessionStorage.getItem('horizon_session_token') || '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...(options.headers as Record<string, string> || {})
    };

    const res = await fetch(`/api${endpoint}`, {
      ...options,
      headers
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
    }
    return data;
  };

  const webHorizon = {
    platform: 'web',

    auth: {
      login: (req: any) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(req) }),
      logout: (token: string) => apiRequest('/auth/logout', { method: 'POST', body: JSON.stringify({ token }) }),
      getSession: (token: string) => apiRequest(`/auth/session?token=${encodeURIComponent(token)}`),
      changePassword: (token: string, newPassword: string) => 
        apiRequest('/auth/change-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
      listUsers: (token: string) => apiRequest(`/auth/users?token=${encodeURIComponent(token)}`),
      createUser: (token: string, user: any) => 
        apiRequest('/auth/users', { method: 'POST', body: JSON.stringify({ token, ...user }) }),
      updateUser: (token: string, userId: string, updates: any) => 
        apiRequest(`/auth/users/${userId}`, { method: 'PUT', body: JSON.stringify({ token, ...updates }) }),
      deleteUser: (token: string, userId: string) => 
        apiRequest(`/auth/users/${userId}`, { method: 'DELETE', body: JSON.stringify({ token }) })
    },

    db: {
      query: (token: string, sql: string, params: any[] = []) => 
        apiRequest('/db/query', { method: 'POST', body: JSON.stringify({ token, sql, params }) }),
      execute: (token: string, sql: string, params: any[] = []) => 
        apiRequest('/db/execute', { method: 'POST', body: JSON.stringify({ token, sql, params }) })
    },

    secrets: {
      unlock: (token: string, passphrase: string) => 
        apiRequest('/secrets/unlock', { method: 'POST', body: JSON.stringify({ token, passphrase }) }),
      lock: (token: string) => 
        apiRequest('/secrets/lock', { method: 'POST', body: JSON.stringify({ token }) }),
      list: (token: string) => 
        apiRequest(`/secrets/list?token=${encodeURIComponent(token)}`),
      add: (token: string, name: string, category: string, value: string, description: string) => 
        apiRequest('/secrets/add', { method: 'POST', body: JSON.stringify({ token, name, category, value, description }) }),
      reveal: (token: string, id: string) => 
        apiRequest(`/secrets/reveal/${id}?token=${encodeURIComponent(token)}`),
      rotate: (token: string, id: string, newValue: string) => 
        apiRequest(`/secrets/rotate/${id}`, { method: 'POST', body: JSON.stringify({ token, newValue }) }),
      delete: (token: string, id: string) => 
        apiRequest(`/secrets/${id}`, { method: 'DELETE', body: JSON.stringify({ token }) }),
      getAzureStatus: () => apiRequest('/secrets/azure/status'),
      listAzure: (token: string) => apiRequest(`/secrets/azure/list?token=${encodeURIComponent(token)}`),
      revealAzure: (token: string, secretName: string) => 
        apiRequest(`/secrets/azure/reveal/${secretName}?token=${encodeURIComponent(token)}`),
      addAzure: (token: string, name: string, value: string, category?: string) => 
        apiRequest('/secrets/azure/add', { method: 'POST', body: JSON.stringify({ token, name, value, category }) }),
      getStatus: (token: string) => apiRequest(`/secrets/status?token=${encodeURIComponent(token)}`),
      setupPassphrase: (token: string, passphrase: string) => 
        apiRequest('/secrets/setup-passphrase', { method: 'POST', body: JSON.stringify({ token, passphrase }) }),
      changePassphrase: (token: string, currentPassphrase: string, newPassphrase: string) => 
        apiRequest('/secrets/change-passphrase', { method: 'POST', body: JSON.stringify({ token, currentPassphrase, newPassphrase }) })
    },

    graph: {
      queryList: (token: string, list: string, filter?: string, select?: string, orderby?: string) => 
        apiRequest('/graph/query', { method: 'POST', body: JSON.stringify({ token, list, filter, select, orderby }) }),
      createItem: (token: string, list: string, fields: any) => 
        apiRequest('/graph/item', { method: 'POST', body: JSON.stringify({ token, list, fields }) }),
      updateItem: (token: string, list: string, itemId: string, fields: any) => 
        apiRequest(`/graph/item/${itemId}`, { method: 'PUT', body: JSON.stringify({ token, list, fields }) }),
      deleteItem: (token: string, list: string, itemId: string) => 
        apiRequest(`/graph/item/${itemId}`, { method: 'DELETE', body: JSON.stringify({ token, list }) }),
      listDocuments: (token: string, library: string, folderId?: string) => 
        apiRequest(`/graph/documents?token=${encodeURIComponent(token)}&library=${encodeURIComponent(library)}&folderId=${folderId || ''}`),
      uploadDocument: (token: string, library: string, fileName: string, content: any, metadata?: any) => 
        apiRequest('/graph/documents/upload', { method: 'POST', body: JSON.stringify({ token, library, fileName, content, metadata }) })
    },

    sync: {
      trigger: () => apiRequest('/sync/trigger', { method: 'POST' }),
      getState: () => apiRequest('/sync/state'),
      onStatus: (_callback: (status: any) => void) => {
        // In web mode, periodically poll sync status
        const interval = setInterval(async () => {
          try {
            const state = await apiRequest('/sync/state');
            _callback(state);
          } catch (_) {}
        }, 30000);
        return () => clearInterval(interval);
      }
    },

    notify: {
      schedule: (token: string, event: any) => 
        apiRequest('/notify/schedule', { method: 'POST', body: JSON.stringify({ token, event }) }),
      cancel: (token: string, id: string) => 
        apiRequest(`/notify/cancel/${id}`, { method: 'DELETE', body: JSON.stringify({ token }) }),
      send: (payload: { title: string; body?: string }) => {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(payload.title, { body: payload.body });
        }
        return Promise.resolve(true);
      }
    },

    plugins: {
      list: () => apiRequest('/plugins/list'),
      saveConfig: (pluginId: string, settings: any) => 
        apiRequest(`/plugins/${pluginId}/config`, { method: 'POST', body: JSON.stringify({ settings }) }),
      connect: (pluginId: string) => 
        apiRequest(`/plugins/${pluginId}/connect`, { method: 'POST' }),
      disconnect: (pluginId: string) => 
        apiRequest(`/plugins/${pluginId}/disconnect`, { method: 'POST' }),
      getStatus: (pluginId: string) => apiRequest(`/plugins/${pluginId}/status`),
      getActiveBackend: () => apiRequest('/plugins/active-backend'),
      setActiveBackend: (providerId: string) => 
        apiRequest('/plugins/active-backend', { method: 'POST', body: JSON.stringify({ providerId }) }),
      testConnection: (pluginId?: string, overrideSettings?: any) => 
        apiRequest('/plugins/test-connection', { method: 'POST', body: JSON.stringify({ pluginId, overrideSettings }) }),
      seedBackend: (pluginId?: string) => 
        apiRequest('/plugins/seed-backend', { method: 'POST', body: JSON.stringify({ pluginId }) }),
      testMongo: (uri?: string, dbName?: string) => 
        apiRequest('/plugins/test-mongo', { method: 'POST', body: JSON.stringify({ uri, dbName }) }),
      syncMongoSeed: () => apiRequest('/plugins/sync-mongo-seed', { method: 'POST' }),
      getLogs: () => apiRequest('/plugins/logs'),
      deleteCloudRecord: (entity: string, recordId: string) => 
        apiRequest('/plugins/cloud-record', { method: 'DELETE', body: JSON.stringify({ entity, recordId }) }),
      getAppSetting: (key: string) => apiRequest(`/plugins/settings/${key}`),
      setAppSetting: (key: string, value: string) => 
        apiRequest(`/plugins/settings/${key}`, { method: 'POST', body: JSON.stringify({ value }) }),
      onLog: (_callback: (log: any) => void) => {
        // Polling logs in web mode
      }
    },

    integrationMapping: {
      listMaps: (token: string, productId: string) => 
        apiRequest(`/integration/maps?productId=${encodeURIComponent(productId)}&token=${encodeURIComponent(token)}`),
      createMap: (token: string, data: { productId: string; name: string; description?: string }) => 
        apiRequest('/integration/maps', { method: 'POST', body: JSON.stringify({ token, ...data }) }),
      deleteMap: (token: string, mapId: string) => 
        apiRequest(`/integration/maps/${mapId}`, { method: 'DELETE', body: JSON.stringify({ token }) }),
      getMapData: (token: string, mapId: string) => 
        apiRequest(`/integration/maps/${mapId}/data?token=${encodeURIComponent(token)}`),
      importExcel: (token: string, payload: { mapId: string; nodes: any[]; edges: any[]; groups?: any[] }) => 
        apiRequest('/integration/import', { method: 'POST', body: JSON.stringify({ token, ...payload }) }),
      savePositions: (token: string, positions: Array<{ id?: string; nodeKey?: string; posX: number; posY: number; mapId: string }>) => 
        apiRequest('/integration/positions', { method: 'POST', body: JSON.stringify({ token, positions }) })
    },

    window: {
      minimize: () => Promise.resolve(),
      maximize: () => {
        if (!document.fullscreenElement) {
          return document.documentElement.requestFullscreen().then(() => true).catch(() => false);
        } else {
          return document.exitFullscreen().then(() => false).catch(() => false);
        }
      },
      close: () => Promise.resolve(),
      isMaximized: () => Promise.resolve(Boolean(document.fullscreenElement)),
      onMaximizeChange: (callback: (isMax: boolean) => void) => {
        const handler = () => callback(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
      }
    }
  };

  (window as any).horizon = webHorizon;
  console.log('Horizon Web Bridge initialized — running in Hosted Web Mode.');
}
