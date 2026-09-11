import React, { useEffect, useState } from 'react'
import { Table, Badge, Button, Select, Modal, Input } from '../components/ui'
import { Plus, Copy, Terminal, Check, Trash2, Edit3 } from 'lucide-react'
import { useProductStore } from '../store/productStore'
import { useAuthStore } from '../store/authStore'
import { dbQuery, dbExecute } from '../store/dbClient'

interface ApiItem {
  id: string
  product_id: string
  name: string
  method: string
  endpoint: string
  auth_type: string
  client_id?: string
  scope?: string
  api_key_meta?: string
  given_to: string
  rate_limit?: string
  owner_id: string
  status: string
  description?: string
}

export function Apis() {
  const { products, fetchProducts } = useProductStore()
  const currentUser = useAuthStore(state => state.user)
  const [apis, setApis] = useState<ApiItem[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ApiItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Form State
  const [name, setName] = useState('')
  const [productId, setProductId] = useState('')
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ALL'>('POST')
  const [endpoint, setEndpoint] = useState('')
  const [authType, setAuthType] = useState('OAuth2')
  const [clientId, setClientId] = useState('')
  const [scope, setScope] = useState('')
  const [apiKeyMeta, setApiKeyMeta] = useState('')
  const [givenTo, setGivenTo] = useState('')
  const [rateLimit, setRateLimit] = useState('')
  const [status, setStatus] = useState('Active')
  const [description, setDescription] = useState('')

  useEffect(() => {
    fetchProducts()
    loadApis()
  }, [fetchProducts])

  const loadApis = async () => {
    try {
      const user = useAuthStore.getState().user || currentUser
      const isPO = user?.role === 'ProductOwner'
      const prodSubquery = isPO
        ? 'SELECT id FROM products'
        : 'SELECT id FROM products WHERE owner_id = ? OR owner_id = ? OR owner_id = ?'
      const prodParams = isPO ? [] : [user?.id, user?.username, user?.displayName]

      const rows = isPO
        ? await dbQuery<ApiItem>('SELECT * FROM apis ORDER BY name ASC')
        : await dbQuery<ApiItem>(
            `SELECT * FROM apis WHERE product_id IN (${prodSubquery}) ORDER BY name ASC`,
            prodParams
          )
      setApis(rows)
    } catch (err) {
      console.error('Failed to load apis:', err)
    }
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleOpenAdd = () => {
    setName('')
    setProductId(products[0]?.id || '')
    setMethod('POST')
    setEndpoint('')
    setAuthType('OAuth2')
    setClientId('')
    setScope('')
    setApiKeyMeta('')
    setGivenTo('')
    setRateLimit('')
    setStatus('Active')
    setDescription('')
    setIsAddModalOpen(true)
  }

  const handleOpenEdit = (item: ApiItem) => {
    setEditingItem(item)
    setName(item.name || '')
    setProductId(item.product_id || products[0]?.id || '')
    setMethod((item.method as any) || 'POST')
    setEndpoint(item.endpoint || '')
    setAuthType(item.auth_type || 'OAuth2')
    setClientId(item.client_id || '')
    setScope(item.scope || '')
    setApiKeyMeta(item.api_key_meta || '')
    setGivenTo(item.given_to || '')
    setRateLimit(item.rate_limit || '')
    setStatus(item.status || 'Active')
    setDescription(item.description || '')
    setIsEditModalOpen(true)
  }

  const handleCreate = async () => {
    if (!name.trim() || !endpoint.trim() || !givenTo.trim()) return
    const id = 'api-' + Date.now()
    await dbExecute(
      `INSERT INTO apis (id, product_id, name, method, endpoint, auth_type, client_id, scope, api_key_meta, given_to, rate_limit, owner_id, status, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        productId || (products[0]?.id || ''),
        name.trim(),
        method,
        endpoint.trim(),
        authType,
        clientId.trim(),
        scope.trim(),
        apiKeyMeta.trim(),
        givenTo.trim(),
        rateLimit.trim(),
        currentUser?.displayName || currentUser?.username || 'Team Member',
        status,
        description.trim()
      ]
    )
    await loadApis()
    setIsAddModalOpen(false)
  }

  const handleUpdate = async () => {
    if (!editingItem || !name.trim() || !endpoint.trim()) return
    await dbExecute(
      `UPDATE apis
       SET product_id = ?, name = ?, method = ?, endpoint = ?, auth_type = ?, client_id = ?, scope = ?, api_key_meta = ?, given_to = ?, rate_limit = ?, status = ?, description = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        productId,
        name.trim(),
        method,
        endpoint.trim(),
        authType,
        clientId.trim(),
        scope.trim(),
        apiKeyMeta.trim(),
        givenTo.trim(),
        rateLimit.trim(),
        status,
        description.trim(),
        editingItem.id
      ]
    )
    await loadApis()
    setIsEditModalOpen(false)
    setEditingItem(null)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Delete this API endpoint?')) {
      await dbExecute('DELETE FROM apis WHERE id = ?', [id])
      setApis(apis.filter(a => a.id !== id))
    }
  }

  const columns = [
    {
      key: 'method_endpoint',
      header: 'Method & Endpoint',
      render: (item: ApiItem) => (
        <div className="flex items-center gap-2 max-w-sm">
          <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] shrink-0 ${
            item.method === 'GET' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
            item.method === 'POST' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
            item.method === 'PUT' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
            item.method === 'DELETE' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
            'bg-purple-500/20 text-purple-400 border border-purple-500/30'
          }`}>
            {item.method}
          </span>
          <span className="font-mono text-xs text-gray-200 truncate">{item.endpoint}</span>
          <button 
            onClick={() => handleCopy(item.id, item.endpoint)}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1C2A54] transition-colors shrink-0"
            title="Copy Endpoint"
          >
            {copiedId === item.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
        </div>
      )
    },
    {
      key: 'name',
      header: 'API Name',
      render: (item: ApiItem) => (
        <div>
          <span className="font-bold text-white block">{item.name}</span>
          <span className="text-[11px] text-gray-400 block max-w-xs truncate">{item.description || 'No description'}</span>
        </div>
      )
    },
    {
      key: 'auth_type',
      header: 'Authentication',
      render: (item: ApiItem) => (
        <Badge variant="blue">{item.auth_type}</Badge>
      )
    },
    {
      key: 'client_id_scope',
      header: 'Client ID & Scopes',
      render: (item: ApiItem) => (
        <div className="space-y-1 max-w-[200px]">
          {item.client_id && (
            <div className="font-mono text-[11px] text-gray-300 truncate">
              <span className="text-gray-500">id:</span> {item.client_id}
            </div>
          )}
          {item.scope ? (
            <span className="inline-block px-1.5 py-0.5 rounded bg-[#15203D] text-[10px] text-cyan-300 font-mono truncate max-w-full">
              {item.scope}
            </span>
          ) : <span className="text-gray-500 text-[11px]">—</span>}
        </div>
      )
    },
    {
      key: 'given_to',
      header: 'To / For Whom Given',
      render: (item: ApiItem) => (
        <span className="text-xs text-gray-300 font-medium">{item.given_to}</span>
      )
    },
    {
      key: 'rate_limit',
      header: 'Rate Limit',
      render: (item: ApiItem) => (
        <span className="font-mono text-gray-400 text-xs">{item.rate_limit || 'Unlimited'}</span>
      )
    },
    {
      key: 'product_id',
      header: 'Linked Application',
      render: (item: ApiItem) => {
        const prod = products.find(p => p.id === item.product_id)
        return <span className="text-xs text-gray-300 font-semibold">{prod ? prod.name : item.product_id}</span>
      }
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: ApiItem) => (
        <Badge variant={item.status === 'Active' ? 'success' : item.status === 'Beta' ? 'orange' : item.status === 'Planning' ? 'blue' : 'danger'}>
          {item.status}
        </Badge>
      )
    },
    {
      key: 'actions',
      header: '',
      render: (item: ApiItem) => (
        <div className="flex items-center justify-end gap-1">
          <button 
            onClick={() => handleOpenEdit(item)}
            className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-[#15203D] transition-colors"
            title="Edit API"
          >
            <Edit3 size={14} />
          </button>
          <button 
            onClick={() => handleDelete(item.id)}
            className="text-gray-400 hover:text-red-400 p-1.5 rounded hover:bg-red-500/10 transition-colors"
            title="Delete API"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0A1024]/90 border border-[#15203D]">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Terminal className="text-cyan-400" size={22} /> API & Endpoint Catalog
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Manage endpoints, authentication schemes, client credentials, granted scopes, and target consumers (to/for whom given).
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="gap-1.5 shadow-lg shadow-[#2E5EFF]/20">
          <Plus size={15} /> Add API Endpoint
        </Button>
      </div>

      <div className="rounded-2xl bg-[#0A1024]/90 border border-[#15203D] overflow-hidden shadow-xl">
        <Table columns={columns} data={apis} emptyMessage="No APIs or endpoints cataloged yet." />
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register API Endpoint"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Save API Endpoint</Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <Input label="API Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Workflow Dispatch API" required autoFocus />

          <div className="grid grid-cols-3 gap-3">
            <Select 
              label="HTTP Method" 
              value={method} 
              onChange={e => setMethod(e.target.value as any)}
              options={[
                { label: 'POST', value: 'POST' },
                { label: 'GET', value: 'GET' },
                { label: 'PUT', value: 'PUT' },
                { label: 'PATCH', value: 'PATCH' },
                { label: 'DELETE', value: 'DELETE' },
                { label: 'ALL / GraphQL', value: 'ALL' }
              ]}
            />
            <div className="col-span-2">
              <Input label="Endpoint Path / URI" value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="e.g. /api/v2/dispatch" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Authentication Type" 
              value={authType} 
              onChange={e => setAuthType(e.target.value)}
              options={[
                { label: 'OAuth2 Bearer Token', value: 'OAuth2' },
                { label: 'API Key (Header / Query)', value: 'API Key' },
                { label: 'JWT / Bearer Token', value: 'Bearer Token' },
                { label: 'mTLS Mutual TLS', value: 'mTLS' },
                { label: 'Basic Auth', value: 'Basic' },
                { label: 'None / Public', value: 'None' }
              ]}
            />
            <Input label="Client ID / App ID" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="e.g. joc_client_svc" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Granted Scopes / Permissions" value={scope} onChange={e => setScope(e.target.value)} placeholder="e.g. jobs:write, workflows:execute" />
            <Input label="API Key Mask / Identifier" value={apiKeyMeta} onChange={e => setApiKeyMeta(e.target.value)} placeholder="e.g. ak_live_***89f2" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="To Whom / For Whom Given (Consumer)" value={givenTo} onChange={e => setGivenTo(e.target.value)} placeholder="e.g. Mobile iOS App, Partner Portal" required />
            <Input label="Rate Limit Policy" value={rateLimit} onChange={e => setRateLimit(e.target.value)} placeholder="e.g. 2,000 req/min" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Linked Application" 
              value={productId} 
              onChange={e => setProductId(e.target.value)}
              options={products.map(p => ({ label: `${p.name} (${p.type})`, value: p.id }))}
            />
            <Select 
              label="Lifecycle Status" 
              value={status} 
              onChange={e => setStatus(e.target.value)}
              options={[
                { label: 'Active', value: 'Active' },
                { label: 'Beta', value: 'Beta' },
                { label: 'Planning', value: 'Planning' },
                { label: 'Deprecated', value: 'Deprecated' }
              ]}
            />
          </div>

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Endpoint Description & Payload Spec</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              placeholder="Summary of request payload schema, headers, and expected response codes..."
              className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] min-h-[70px]"
            />
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setEditingItem(null); }}
        title={`Edit API Endpoint: ${editingItem?.name || ''}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setIsEditModalOpen(false); setEditingItem(null); }}>Cancel</Button>
            <Button onClick={handleUpdate}>Update API Endpoint</Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <Input label="API Name" value={name} onChange={e => setName(e.target.value)} required autoFocus />

          <div className="grid grid-cols-3 gap-3">
            <Select 
              label="HTTP Method" 
              value={method} 
              onChange={e => setMethod(e.target.value as any)}
              options={[
                { label: 'POST', value: 'POST' },
                { label: 'GET', value: 'GET' },
                { label: 'PUT', value: 'PUT' },
                { label: 'PATCH', value: 'PATCH' },
                { label: 'DELETE', value: 'DELETE' },
                { label: 'ALL / GraphQL', value: 'ALL' }
              ]}
            />
            <div className="col-span-2">
              <Input label="Endpoint Path / URI" value={endpoint} onChange={e => setEndpoint(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Authentication Type" 
              value={authType} 
              onChange={e => setAuthType(e.target.value)}
              options={[
                { label: 'OAuth2 Bearer Token', value: 'OAuth2' },
                { label: 'API Key (Header / Query)', value: 'API Key' },
                { label: 'JWT / Bearer Token', value: 'Bearer Token' },
                { label: 'mTLS Mutual TLS', value: 'mTLS' },
                { label: 'Basic Auth', value: 'Basic' },
                { label: 'None / Public', value: 'None' }
              ]}
            />
            <Input label="Client ID / App ID" value={clientId} onChange={e => setClientId(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Granted Scopes / Permissions" value={scope} onChange={e => setScope(e.target.value)} />
            <Input label="API Key Mask / Identifier" value={apiKeyMeta} onChange={e => setApiKeyMeta(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="To Whom / For Whom Given (Consumer)" value={givenTo} onChange={e => setGivenTo(e.target.value)} required />
            <Input label="Rate Limit Policy" value={rateLimit} onChange={e => setRateLimit(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Linked Application" 
              value={productId} 
              onChange={e => setProductId(e.target.value)}
              options={products.map(p => ({ label: `${p.name} (${p.type})`, value: p.id }))}
            />
            <Select 
              label="Lifecycle Status" 
              value={status} 
              onChange={e => setStatus(e.target.value)}
              options={[
                { label: 'Active', value: 'Active' },
                { label: 'Beta', value: 'Beta' },
                { label: 'Planning', value: 'Planning' },
                { label: 'Deprecated', value: 'Deprecated' }
              ]}
            />
          </div>

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Endpoint Description & Notes</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] min-h-[70px]"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
