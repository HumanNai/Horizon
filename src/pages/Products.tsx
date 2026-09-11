import React, { useEffect, useState } from 'react'
import { useProductStore } from '../store/productStore'
import { useAuthStore } from '../store/authStore'
import { Card, Button, Badge, Modal, Input, Select } from '../components/ui'
import { Product, ProductType, ProductStatus } from '../types'
import { Plus, Search, Layers, ExternalLink, Trash2, Edit3, Sparkles, User, ShieldCheck, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { IconPicker, isImageIcon } from '../components/IconPicker'
import { useSettingsStore } from '../store/settingsStore'
import { dbQuery } from '../store/dbClient'

export function Products() {
  const currentUser = useAuthStore(state => state.user)
  const isPO = currentUser?.role === 'ProductOwner'
  const { products, fetchProducts, createProduct, updateProduct, deleteProduct, loading } = useProductStore()
  const { applicationScopes, fetchSettings } = useSettingsStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [usersList, setUsersList] = useState<{ id: string; name: string }[]>([])
  const navigate = useNavigate()
  
  // Form state
  const [name, setName] = useState('')
  const [type, setType] = useState<ProductType>('Internal')
  const [status, setStatus] = useState<ProductStatus>('Active')
  const [owner, setOwner] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('')

  useEffect(() => {
    fetchProducts()
    fetchSettings()
    dbQuery<any>('SELECT id, display_name, username FROM users WHERE active = 1 ORDER BY display_name ASC')
      .then(rows => setUsersList(rows.map(r => ({ id: r.id, name: r.display_name || r.username }))))
      .catch(() => {})
  }, [fetchProducts, fetchSettings])

  const handleOpenModal = (p?: Product) => {
    if (p) {
      setEditingProduct(p)
      setName(p.name)
      setType(p.type || 'Internal')
      setStatus(p.status)
      setOwner(p.owner)
      setDescription(p.description || '')
      setIcon(p.icon || '')
    } else {
      setEditingProduct(null)
      setName('')
      setType('Internal')
      setStatus('Active')
      setOwner(currentUser?.displayName || currentUser?.username || 'Product Owner')
      setDescription('')
      setIcon('')
    }
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    const finalOwner = isPO ? (owner.trim() || currentUser?.displayName || 'Product Owner') : (currentUser?.displayName || currentUser?.username || 'Team Member')
    const data = { name: name.trim(), type, status, owner: finalOwner, description, icon }
    if (editingProduct) {
      await updateProduct(editingProduct.id, data)
    } else {
      await createProduct(data)
    }
    await fetchProducts()
    setIsModalOpen(false)
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this product?')) {
      await deleteProduct(id)
    }
  }

  const filtered = products.filter(p => {
    if (!isPO && currentUser) {
      const isOwner = p.owner === currentUser.displayName || p.owner === currentUser.username || p.owner === currentUser.id
      if (!isOwner) return false
    }
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesType = !filterType || p.type === filterType
    const matchesStatus = !filterStatus || p.status === filterStatus
    return matchesSearch && matchesType && matchesStatus
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Layers className="text-[#2E5EFF]" size={24} /> Product Portfolio
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Manage enterprise portfolio applications (Internal & External) and track linked releases.
          </p>
        </div>
        <Button onClick={() => handleOpenModal()} className="shadow-lg shadow-[#2E5EFF]/25 gap-2">
          <Plus size={16} /> Add Product
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-2xl bg-[#0A1024]/80 border border-[#15203D] backdrop-blur-md">
        <div className="relative flex-1 min-w-[180px] sm:min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search products by title or description..." 
            className="w-full bg-[#0D1429] border border-[#19264A] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] focus:ring-1 focus:ring-[#2E5EFF]"
          />
        </div>

        {/* Application Type Filter */}
        <div className="relative w-full sm:w-56">
          <select 
            value={filterType} 
            onChange={e => setFilterType(e.target.value)}
            className="w-full appearance-none bg-[#0D1429] border border-[#19264A] hover:border-[#2E5EFF]/40 focus:border-[#2E5EFF] focus:ring-1 focus:ring-[#2E5EFF] rounded-xl pl-3.5 pr-9 py-2 text-xs text-white focus:outline-none transition-colors cursor-pointer"
          >
            <option value="" className="bg-[#0A1024] text-gray-300">All Application Types</option> 
            {applicationScopes.map(s => (
              <option key={s.id} value={s.id} className="bg-[#0A1024] text-white">{s.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        {/* Lifecycle Status Filter */}
        <div className="relative w-full sm:w-44">
          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full appearance-none bg-[#0D1429] border border-[#19264A] hover:border-[#2E5EFF]/40 focus:border-[#2E5EFF] focus:ring-1 focus:ring-[#2E5EFF] rounded-xl pl-3.5 pr-9 py-2 text-xs text-white focus:outline-none transition-colors cursor-pointer"
          >
            <option value="" className="bg-[#0A1024] text-gray-300">All Lifecycles</option> 
            <option value="Active" className="bg-[#0A1024] text-emerald-400">Active</option> 
            <option value="Planning" className="bg-[#0A1024] text-blue-400">Planning</option> 
            <option value="OnHold" className="bg-[#0A1024] text-amber-400">On Hold</option> 
            <option value="Deprecated" className="bg-[#0A1024] text-red-400">Deprecated</option> 
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-5">
        {filtered.map(p => (
          <div 
            key={p.id} 
            onClick={() => navigate(`/products/${p.id}`)}
            className="group relative flex flex-col justify-between rounded-2xl bg-[#0D1429]/90 hover:bg-[#111B38] border border-[#172347] hover:border-[#2E5EFF]/50 p-4 sm:p-5 cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(46,94,255,0.15)] hover:-translate-y-1"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#2E5EFF]/10 border border-[#2E5EFF]/20 flex items-center justify-center text-[#2E5EFF] font-bold text-xs overflow-hidden shrink-0">
                  {p.icon ? (
                    isImageIcon(p.icon) ? (
                      <img src={p.icon} alt={p.name} className="w-full h-full object-contain p-1 rounded-xl" />
                    ) : (
                      <span className="text-xl select-none">{p.icon}</span>
                    )
                  ) : (
                    (() => {
                      const scope = applicationScopes.find(s => s.id === p.type)
                      return scope?.shortCode || (p.type === 'External' ? 'EXT' : 'INT')
                    })()
                  )}
                </div>
                {(() => {
                  const canModify = isPO || (currentUser && (p.owner === currentUser.displayName || p.owner === currentUser.username || p.owner === currentUser.id))
                  if (!canModify) return null
                  return (
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(p) }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1C2B54] transition-colors"
                        title="Edit Product"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(p.id, e)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete Product"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })()}
              </div>

              <h3 className="text-base font-bold text-white mb-1.5 truncate group-hover:text-[#6087FF] transition-colors" title={p.name}>
                {p.name}
              </h3>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[11px] text-gray-400 flex items-center gap-1 truncate max-w-[180px]">
                  <User size={12} className="text-[#2E5EFF] shrink-0" /> {p.owner || 'Product Owner'}
                </span>
                {currentUser && (p.owner === currentUser.displayName || p.owner === currentUser.username || p.owner === currentUser.id) && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#2E5EFF]/15 text-[#6087FF] border border-[#2E5EFF]/30 shrink-0">
                    You
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 line-clamp-2 h-8 leading-relaxed mb-4">
                {p.description || 'No system description configured.'}
              </p>
            </div>

            <div className="pt-3 border-t border-[#172242] flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                {(() => {
                  const scope = applicationScopes.find(s => s.id === p.type)
                  return (
                    <Badge variant={scope?.badge || (p.type === 'External' ? 'orange' : 'blue')}>
                      {scope?.label ? scope.id : (p.type || 'Internal')}
                    </Badge>
                  )
                })()}
                <Badge variant={p.status === 'Active' ? 'success' : p.status === 'OnHold' ? 'warning' : p.status === 'Planning' ? 'blue' : 'danger'}>
                  {p.status}
                </Badge>
              </div>
              <span className="text-[11px] text-[#6087FF] font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Open Workspace →
              </span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-16 rounded-2xl bg-[#0A1024]/50 border border-dashed border-[#15203D]">
          <Sparkles size={32} className="mx-auto text-gray-600 mb-3" />
          <h3 className="text-base font-bold text-gray-300">No applications found</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {isPO 
              ? 'Create a new product to start tracking releases and tasks under Horizon.' 
              : 'You have not created any applications yet. Click below to add your first application.'}
          </p>
          <Button onClick={() => handleOpenModal()} size="sm" className="mt-4">
            <Plus size={14} className="mr-1.5" /> Create Application
          </Button>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? 'Edit Application Configuration' : 'Create New Application'}
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingProduct ? 'Save Changes' : 'Create Application'}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input 
            label="Application Name" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="e.g. Core Billing Engine, Partner API Portal" 
            required 
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Application Scope" 
              value={type} 
              onChange={e => setType(e.target.value as ProductType)} 
              options={applicationScopes.map(s => ({ label: s.label, value: s.id }))} 
            />

            <Select 
              label="Lifecycle Status" 
              value={status} 
              onChange={e => setStatus(e.target.value as ProductStatus)} 
              options={[
                { label: 'Active', value: 'Active' }, 
                { label: 'Planning', value: 'Planning' }, 
                { label: 'On Hold', value: 'OnHold' }, 
                { label: 'Deprecated', value: 'Deprecated' }
              ]} 
            />
          </div>

          {isPO ? (
            usersList.length > 0 ? (
              <Select 
                label="Application Owner"
                value={owner}
                onChange={e => setOwner(e.target.value)}
                options={usersList.map(u => ({ label: u.name, value: u.name }))}
              />
            ) : (
              <Input 
                label="Application Owner" 
                value={owner} 
                onChange={e => setOwner(e.target.value)} 
                placeholder="e.g. Product Owner"
              />
            )
          ) : (
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold text-gray-300">Application Owner</label>
              <div className="bg-[#070B19] border border-[#19264A] rounded-xl px-4 py-2.5 text-xs text-gray-300 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="font-semibold text-white">{currentUser?.displayName || currentUser?.username}</span>
                  <span className="text-gray-400">(You)</span>
                </span>
                <span className="text-[10px] text-gray-400">Private to your account</span>
              </div>
            </div>
          )}

          <IconPicker 
            value={icon} 
            onChange={setIcon} 
            label="Product Icon / Logo (Optional)" 
          />

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">System Description & Purpose</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the architectural function and business impact of this product..."
              className="w-full bg-[#070B19] border border-[#19264A] focus:border-[#2E5EFF] focus:ring-1 focus:ring-[#2E5EFF] rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors min-h-[90px]"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
