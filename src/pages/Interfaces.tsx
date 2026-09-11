import React, { useEffect, useState } from 'react'
import { Table, Badge, Button, Select, Modal, Input } from '../components/ui'
import { Plus, Copy, Network, Check, Trash2, Edit3, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { useProductStore } from '../store/productStore'
import { useAuthStore } from '../store/authStore'
import { dbQuery, dbExecute } from '../store/dbClient'

interface InterfaceItem {
  id: string
  product_id: string
  name: string
  type: string
  endpoint: string
  service_provider?: string
  target_audience?: string
  direction?: string
  connection_details?: string
  owner_id: string
  status: string
  description?: string
}

export function Interfaces() {
  const { products, fetchProducts } = useProductStore()
  const currentUser = useAuthStore(state => state.user)
  const [interfaces, setInterfaces] = useState<InterfaceItem[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InterfaceItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Form State
  const [name, setName] = useState('')
  const [productId, setProductId] = useState('')
  const [type, setType] = useState('MQ')
  const [serviceProvider, setServiceProvider] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [direction, setDirection] = useState('Provided')
  const [connectionDetails, setConnectionDetails] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [status, setStatus] = useState('Active')
  const [description, setDescription] = useState('')

  useEffect(() => {
    fetchProducts()
    loadInterfaces()
  }, [fetchProducts])

  const loadInterfaces = async () => {
    try {
      const user = useAuthStore.getState().user || currentUser
      const isPO = user?.role === 'ProductOwner'
      const prodSubquery = isPO
        ? 'SELECT id FROM products'
        : 'SELECT id FROM products WHERE owner_id = ? OR owner_id = ? OR owner_id = ?'
      const prodParams = isPO ? [] : [user?.id, user?.username, user?.displayName]

      const rows = isPO
        ? await dbQuery<InterfaceItem>('SELECT * FROM interfaces ORDER BY name ASC')
        : await dbQuery<InterfaceItem>(
            `SELECT * FROM interfaces WHERE product_id IN (${prodSubquery}) ORDER BY name ASC`,
            prodParams
          )
      setInterfaces(rows)
    } catch (err) {
      console.error('Failed to load interfaces:', err)
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
    setType('MQ')
    setServiceProvider('')
    setTargetAudience('')
    setDirection('Provided')
    setConnectionDetails('')
    setEndpoint('')
    setStatus('Active')
    setDescription('')
    setIsAddModalOpen(true)
  }

  const handleOpenEdit = (item: InterfaceItem) => {
    setEditingItem(item)
    setName(item.name || '')
    setProductId(item.product_id || products[0]?.id || '')
    setType(item.type || 'MQ')
    setServiceProvider(item.service_provider || '')
    setTargetAudience(item.target_audience || '')
    setDirection(item.direction || 'Provided')
    setConnectionDetails(item.connection_details || '')
    setEndpoint(item.endpoint || '')
    setStatus(item.status || 'Active')
    setDescription(item.description || '')
    setIsEditModalOpen(true)
  }

  const handleCreate = async () => {
    if (!name.trim() || !targetAudience.trim()) return
    const id = `iface-${Date.now()}`
    await dbExecute(
      `INSERT INTO interfaces (id, product_id, name, type, endpoint, service_provider, target_audience, direction, connection_details, owner_id, status, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        productId || (products[0]?.id || ''),
        name.trim(),
        type,
        endpoint.trim() || 'N/A',
        serviceProvider.trim(),
        targetAudience.trim(),
        direction,
        connectionDetails.trim(),
        currentUser?.displayName || currentUser?.username || 'Team Member',
        status,
        description.trim()
      ]
    )
    await loadInterfaces()
    setIsAddModalOpen(false)
  }

  const handleUpdate = async () => {
    if (!editingItem || !name.trim()) return
    await dbExecute(
      `UPDATE interfaces 
       SET product_id = ?, name = ?, type = ?, endpoint = ?, service_provider = ?, target_audience = ?, direction = ?, connection_details = ?, status = ?, description = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        productId,
        name.trim(),
        type,
        endpoint.trim() || 'N/A',
        serviceProvider.trim(),
        targetAudience.trim(),
        direction,
        connectionDetails.trim(),
        status,
        description.trim(),
        editingItem.id
      ]
    )
    await loadInterfaces()
    setIsEditModalOpen(false)
    setEditingItem(null)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Delete this service or event interface?')) {
      await dbExecute('DELETE FROM interfaces WHERE id = ?', [id])
      setInterfaces(interfaces.filter(i => i.id !== id))
    }
  }

  const columns = [
    { 
      key: 'name', 
      header: 'Interface Name', 
      render: (item: InterfaceItem) => (
        <div>
          <span className="font-bold text-white block">{item.name}</span>
          <span className="text-[11px] text-gray-400 block max-w-xs truncate">{item.description || 'No description provided'}</span>
        </div>
      ) 
    },
    { 
      key: 'type', 
      header: 'Protocol', 
      render: (item: InterfaceItem) => (
        <Badge variant={item.type === 'Kafka' ? 'orange' : item.type === 'MQ' ? 'blue' : item.type === 'Scheduler' ? 'neutral' : 'info'}>
          {item.type}
        </Badge>
      ) 
    },
    {
      key: 'service_provider',
      header: 'Service / Broker Used',
      render: (item: InterfaceItem) => (
        <span className="text-xs text-gray-200 font-medium">{item.service_provider || '—'}</span>
      )
    },
    {
      key: 'direction',
      header: 'Direction',
      render: (item: InterfaceItem) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
          item.direction === 'Consumed' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
        }`}>
          {item.direction === 'Consumed' ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
          {item.direction || 'Provided'}
        </span>
      )
    },
    {
      key: 'target_audience',
      header: 'To / For Whom Given',
      render: (item: InterfaceItem) => (
        <span className="text-xs text-gray-300 font-medium">{item.target_audience || 'Internal Services'}</span>
      )
    },
    { 
      key: 'connection_details', 
      header: 'Connection / Spec', 
      render: (item: InterfaceItem) => {
        const spec = item.connection_details || item.endpoint
        return (
          <div className="flex items-center gap-2 max-w-xs">
            <span className="truncate font-mono text-[11px] text-gray-300 bg-[#070B19] px-2 py-1 rounded border border-[#172242] flex-1">
              {spec}
            </span>
            <button 
              onClick={() => handleCopy(item.id, spec)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1C2A54] transition-colors shrink-0"
              title="Copy Spec"
            >
              {copiedId === item.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          </div>
        )
      } 
    },
    { 
      key: 'product_id', 
      header: 'Linked Application', 
      render: (item: InterfaceItem) => {
        const prod = products.find(p => p.id === item.product_id)
        return <span className="text-xs text-gray-300 font-semibold">{prod ? prod.name : item.product_id}</span>
      } 
    },
    { 
      key: 'status', 
      header: 'Status', 
      render: (item: InterfaceItem) => (
        <Badge variant={item.status === 'Active' ? 'success' : item.status === 'Planning' ? 'blue' : 'danger'}>
          {item.status}
        </Badge>
      ) 
    },
    {
      key: 'actions',
      header: '',
      render: (item: InterfaceItem) => (
        <div className="flex items-center justify-end gap-1">
          <button 
            onClick={() => handleOpenEdit(item)}
            className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-[#15203D] transition-colors"
            title="Edit Interface"
          >
            <Edit3 size={14} />
          </button>
          <button 
            onClick={() => handleDelete(item.id)}
            className="text-gray-400 hover:text-red-400 p-1.5 rounded hover:bg-red-500/10 transition-colors"
            title="Delete Interface"
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
            <Network className="text-[#2E5EFF]" size={22} /> Service & Event Interfaces
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Manage message queues (MQ), Kafka streams, batch schedulers, and service providers (which service is used and to whom given/consumed).
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="gap-1.5 shadow-lg shadow-[#2E5EFF]/20">
          <Plus size={15} /> Add Interface
        </Button>
      </div>

      <div className="rounded-2xl bg-[#0A1024]/90 border border-[#15203D] overflow-hidden shadow-xl">
        <Table columns={columns} data={interfaces} emptyMessage="No service or event interfaces cataloged yet." />
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register Service / Event Interface"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Save Interface</Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <Input label="Interface Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. JOC Inbound Task Dispatch Queue" required autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Protocol / Technology" 
              value={type} 
              onChange={e => setType(e.target.value)}
              options={[
                { label: 'Message Queue (MQ)', value: 'MQ' },
                { label: 'Kafka Topic / Stream', value: 'Kafka' },
                { label: 'Background Scheduler / Cron', value: 'Scheduler' },
                { label: 'gRPC Service', value: 'gRPC' },
                { label: 'SFTP File Gateway', value: 'SFTP' },
                { label: 'Database Link / CDC', value: 'DB Link' },
                { label: 'Other Enterprise Service', value: 'Other' }
              ]} 
            />
            <Select 
              label="Direction" 
              value={direction} 
              onChange={e => setDirection(e.target.value)}
              options={[
                { label: '↑ Provided (We provide / publish)', value: 'Provided' },
                { label: '↓ Consumed (We consume / subscribe)', value: 'Consumed' },
                { label: '⇄ Bidirectional Exchange', value: 'Bidirectional' }
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Service / Broker Used" value={serviceProvider} onChange={e => setServiceProvider(e.target.value)} placeholder="e.g. IBM MQ 9.3, AWS MSK Kafka, Control-M" />
            <Input label="To Whom / For Whom Given (Target Audience)" value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="e.g. Risk Analytics, Core Banking, Worker Pods" required />
          </div>

          <Input label="Connection Spec / Queue / Topic / Cron" value={connectionDetails} onChange={e => setConnectionDetails(e.target.value)} placeholder="e.g. topic: jta.events.v1 or 0 2 * * *" />

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
              options={[{ label: 'Active', value: 'Active' }, { label: 'Planning', value: 'Planning' }, { label: 'Deprecated', value: 'Deprecated' }]}
            />
          </div>

          <Input label="Host / Broker Endpoint URI (Optional)" value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="e.g. tcp://mq.corp.internal:61616" />

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Interface Description & Architecture Notes</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              placeholder="Detail authentication requirements, schema formats (Avro, JSON, Protobuf), or failover logic..."
              className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] min-h-[70px]"
            />
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setEditingItem(null); }}
        title={`Edit Interface: ${editingItem?.name || ''}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setIsEditModalOpen(false); setEditingItem(null); }}>Cancel</Button>
            <Button onClick={handleUpdate}>Update Interface</Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <Input label="Interface Name" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Protocol / Technology" 
              value={type} 
              onChange={e => setType(e.target.value)}
              options={[
                { label: 'Message Queue (MQ)', value: 'MQ' },
                { label: 'Kafka Topic / Stream', value: 'Kafka' },
                { label: 'Background Scheduler / Cron', value: 'Scheduler' },
                { label: 'gRPC Service', value: 'gRPC' },
                { label: 'SFTP File Gateway', value: 'SFTP' },
                { label: 'Database Link / CDC', value: 'DB Link' },
                { label: 'Other Enterprise Service', value: 'Other' }
              ]} 
            />
            <Select 
              label="Direction" 
              value={direction} 
              onChange={e => setDirection(e.target.value)}
              options={[
                { label: '↑ Provided (We provide / publish)', value: 'Provided' },
                { label: '↓ Consumed (We consume / subscribe)', value: 'Consumed' },
                { label: '⇄ Bidirectional Exchange', value: 'Bidirectional' }
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Service / Broker Used" value={serviceProvider} onChange={e => setServiceProvider(e.target.value)} />
            <Input label="To Whom / For Whom Given" value={targetAudience} onChange={e => setTargetAudience(e.target.value)} required />
          </div>

          <Input label="Connection Spec / Queue / Topic / Cron" value={connectionDetails} onChange={e => setConnectionDetails(e.target.value)} />

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
              options={[{ label: 'Active', value: 'Active' }, { label: 'Planning', value: 'Planning' }, { label: 'Deprecated', value: 'Deprecated' }]}
            />
          </div>

          <Input label="Host / Broker Endpoint URI" value={endpoint} onChange={e => setEndpoint(e.target.value)} />

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Description & Architecture Notes</label>
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
