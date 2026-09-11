import React, { useEffect, useState, useRef } from 'react'
import { Card, Table, Button, Badge, Input, Select, Modal } from '../components/ui'
import { 
  Upload, 
  Download, 
  ExternalLink, 
  Search, 
  FileText, 
  Trash2, 
  FileCheck, 
  Cloud, 
  HardDrive, 
  CheckCircle2, 
  File
} from 'lucide-react'
import { dbQuery, dbExecute, getSessionToken } from '../store/dbClient'
import { useProductStore } from '../store/productStore'
import { useAuthStore } from '../store/authStore'

interface DocMeta {
  id: string
  title: string
  category: string
  product_id?: string
  owner_id: string
  version?: string
  description?: string
  drive_item_id: string
  web_url: string
  last_modified: string
  file_size: number
  file_name?: string
  file_data?: string
  sharepoint_status?: string
}

export function Documents() {
  const [docs, setDocs] = useState<DocMeta[]>([])
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const { products, fetchProducts } = useProductStore()
  const currentUser = useAuthStore(state => state.user)

  // Form State
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('BRD')
  const [productId, setProductId] = useState('')
  const [version, setVersion] = useState('v1.0')
  const [description, setDescription] = useState('')
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number; base64: string } | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    fetchProducts()
    loadDocs()
  }, [fetchProducts])

  const loadDocs = async () => {
    try {
      const user = useAuthStore.getState().user || currentUser
      const isPO = user?.role === 'ProductOwner'
      const prodSubquery = isPO
        ? 'SELECT id FROM products'
        : 'SELECT id FROM products WHERE owner_id = ? OR owner_id = ? OR owner_id = ?'
      const prodParams = isPO ? [] : [user?.id, user?.username, user?.displayName]

      const rows = isPO
        ? await dbQuery<DocMeta>('SELECT * FROM documents_meta ORDER BY last_modified DESC')
        : await dbQuery<DocMeta>(
            `SELECT * FROM documents_meta WHERE (product_id IN (${prodSubquery}) OR owner_id = ? OR owner_id = ? OR owner_id = ?) ORDER BY last_modified DESC`,
            [...prodParams, ...prodParams]
          )

      setDocs(rows || [])
    } catch (err) {
      console.error(err)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setSelectedFile({
        name: file.name,
        size: file.size,
        base64: result
      })
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''))
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSaveDoc = async () => {
    if (!title.trim()) return
    setIsUploading(true)

    try {
      const id = `doc-${Date.now()}`
      let driveItemId = `local-${Date.now()}`
      let webUrl = '#'
      let spStatus = 'LocalOnly'
      const token = getSessionToken()

      // Attempt upload to active cloud backend (SharePoint or OneDrive)
      if (selectedFile && (window as any).horizon?.storage?.uploadDocument) {
        try {
          const res = await (window as any).horizon.storage.uploadDocument(
            selectedFile.name,
            selectedFile.base64,
            category
          )
          if (res?.driveItemId) {
            driveItemId = res.driveItemId
            webUrl = res.webUrl || '#'
            const activeBackend = await (window as any).horizon.plugins.getActiveBackend?.()
            spStatus = activeBackend === 'sharepoint-core'
              ? 'SharePoint Synced'
              : activeBackend === 'google-drive-core'
                ? 'Google Drive Synced'
                : activeBackend === 'mongodb-core'
                  ? 'MongoDB Synced'
                  : 'OneDrive Synced'
          }
        } catch (uploadErr) {
          console.warn('Cloud upload unavailable, saving locally in SQLite:', uploadErr)
        }
      }

      const newDoc: DocMeta = {
        id,
        title: title.trim(),
        category,
        product_id: productId || (products[0]?.id || ''),
        owner_id: currentUser?.displayName || currentUser?.username || 'Product Owner',
        version: version || 'v1.0',
        description,
        drive_item_id: driveItemId,
        web_url: webUrl,
        last_modified: new Date().toISOString(),
        file_size: selectedFile?.size || 1024 * 512,
        file_name: selectedFile?.name,
        file_data: selectedFile?.base64,
        sharepoint_status: spStatus
      }

      await dbExecute(
        `INSERT INTO documents_meta (id, title, category, product_id, owner_id, version, description, drive_item_id, web_url, last_modified, file_size, file_name, file_data, sharepoint_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newDoc.id,
          newDoc.title,
          newDoc.category,
          newDoc.product_id,
          newDoc.owner_id,
          newDoc.version,
          newDoc.description,
          newDoc.drive_item_id,
          newDoc.web_url,
          newDoc.last_modified,
          newDoc.file_size,
          newDoc.file_name || null,
          newDoc.file_data || null,
          newDoc.sharepoint_status || 'LocalOnly'
        ]
      )

      setDocs([newDoc, ...docs])
      setIsUploadOpen(false)
      setTitle('')
      setDescription('')
      setSelectedFile(null)
    } catch (err) {
      console.error('Failed to save document:', err)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownload = (d: DocMeta) => {
    if (d.file_data) {
      const link = document.createElement('a')
      link.href = d.file_data
      link.download = d.file_name || `${d.title}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else if (d.web_url && d.web_url !== '#') {
      window.open(d.web_url, '_blank')
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Delete this document specification?')) {
      await dbExecute('DELETE FROM documents_meta WHERE id = ?', [id])
      setDocs(docs.filter(d => d.id !== id))
    }
  }

  const formatSize = (bytes: number) => {
    if (!bytes) return '1.2 MB'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const filtered = docs.filter(d => {
    const matchSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchCat = !categoryFilter || d.category === categoryFilter
    return matchSearch && matchCat
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0A1024]/90 border border-[#15203D]">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <FileText className="text-[#2E5EFF]" size={22} /> Document & Specification Knowledge Base
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Architecture blueprints, ICD specifications, and API documentation connected to OneDrive and local storage.</p>
        </div>

        <Button onClick={() => setIsUploadOpen(true)} className="gap-1.5 shadow-lg shadow-[#2E5EFF]/20">
          <Upload size={15} /> Upload / Register Document
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-[#0A1024]/80 border border-[#15203D]">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search specifications by title or description..." 
            className="w-full bg-[#0D1429] border border-[#19264A] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF]"
          />
        </div>
        <Select 
          value={categoryFilter} 
          onChange={e => setCategoryFilter(e.target.value)}
          options={[
            { label: 'All Categories', value: '' }, 
            { label: 'BRD (Business Requirements)', value: 'BRD' }, 
            { label: 'ICD (Interface Spec)', value: 'ICD' },
            { label: 'API Specs', value: 'API' },
            { label: 'Runbook & Operations', value: 'Runbook' }
          ]} 
          className="w-56 bg-[#0D1429]" 
        />
      </div>

      <div className="rounded-2xl bg-[#0A1024]/90 border border-[#15203D] overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#15203D] bg-[#0D1429] text-gray-400 uppercase tracking-wider font-semibold">
              <th className="p-4">Document Title</th>
              <th className="p-4">Category</th>
              <th className="p-4">Linked Product</th>
              <th className="p-4">Storage Location</th>
              <th className="p-4">Size</th>
              <th className="p-4">Modified</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#15203D]">
            {filtered.map(d => {
              const prod = products.find(p => p.id === d.product_id)
              return (
                <tr key={d.id} className="hover:bg-[#0E1736] transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-[#2E5EFF] shrink-0" />
                      <div>
                        <span className="font-bold text-white block hover:text-[#6087FF] cursor-pointer" onClick={() => handleDownload(d)}>
                          {d.title}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {d.file_name ? d.file_name : (d.description || 'System documentation')}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant={d.category === 'BRD' ? 'blue' : d.category === 'ICD' ? 'orange' : 'neutral'}>
                      {d.category}
                    </Badge>
                  </td>
                  <td className="p-4 text-gray-300 font-medium">
                    {prod ? prod.name : 'Core'}
                  </td>
                  <td className="p-4">
                    {d.sharepoint_status?.includes('OneDrive') ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <Cloud size={11} /> OneDrive Cloud
                      </span>
                    ) : d.sharepoint_status === 'Synced' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2E5EFF]/15 text-[#8FA7FF] border border-[#2E5EFF]/30">
                        <Cloud size={11} /> SharePoint
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-700/30 text-gray-400 border border-gray-600/30">
                        <HardDrive size={11} /> Stored Locally
                      </span>
                    )}
                  </td>
                  <td className="p-4 font-mono text-gray-400">{formatSize(d.file_size)}</td>
                  <td className="p-4 text-gray-400 font-mono">
                    {new Date(d.last_modified).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button 
                        onClick={() => handleDownload(d)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1C2A54] transition-colors"
                        title="Download or View Document"
                      >
                        <Download size={15} />
                      </button>
                      {d.web_url && d.web_url !== '#' && (
                        <button 
                          onClick={() => window.open(d.web_url, '_blank')}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#2E5EFF] hover:bg-[#1C2A54] transition-colors"
                          title="Open Cloud URL"
                        >
                          <ExternalLink size={15} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(d.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete Document"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload / Register Document"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsUploadOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveDoc} loading={isUploading}>
              Save & Upload
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* File Picker Zone */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#1E2D52] hover:border-[#2E5EFF]/60 rounded-2xl p-5 text-center cursor-pointer transition-colors bg-[#070B19]"
          >
            <input 
              ref={fileInputRef} 
              type="file" 
              onChange={handleFileChange} 
              className="hidden" 
              accept=".pdf,.docx,.doc,.txt,.json,.yaml,.yml,.png,.jpg,.jpeg,.zip"
            />
            <Upload size={24} className="mx-auto text-[#2E5EFF] mb-2" />
            {selectedFile ? (
              <div>
                <p className="text-xs font-bold text-white font-mono">{selectedFile.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB — Click to change</p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold text-white">Click to select specification file</p>
                <p className="text-[10px] text-gray-400 mt-0.5">PDF, DOCX, JSON schemas, Markdown, or Images</p>
              </div>
            )}
          </div>

          <Input 
            label="Document Title" 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            placeholder="e.g. Phoenix Distributed Architecture Blueprint" 
            required 
          />

          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Document Category" 
              value={category} 
              onChange={e => setCategory(e.target.value)}
              options={[
                { label: 'BRD (Requirements)', value: 'BRD' }, 
                { label: 'ICD (Interface Contract)', value: 'ICD' }, 
                { label: 'API Specification', value: 'API' },
                { label: 'Deployment Runbook', value: 'Runbook' }
              ]} 
            />
            <Input label="Revision Version" value={version} onChange={e => setVersion(e.target.value)} placeholder="v2.4" />
          </div>

          <Select 
            label="Associated Product" 
            value={productId} 
            onChange={e => setProductId(e.target.value)}
            options={products.map(p => ({ label: p.name, value: p.id }))}
          />

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Executive Summary / Notes</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Summary of document purpose, key interfaces, or revision notes..." 
              className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] min-h-[70px]"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
