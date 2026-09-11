import React, { useEffect, useState } from 'react'
import { Card, Table, Badge, Select, Button, Modal, Input } from '../components/ui'
import { 
  Plus, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Check, 
  ShieldCheck, 
  Sparkles,
  Search,
  Filter,
  RotateCcw,
  UserCheck,
  Package,
  GitMerge,
  Edit3,
  Trash2,
  X,
  File,
  Download
} from 'lucide-react'
import { useReleaseStore } from '../store/releaseStore'
import { useProductStore } from '../store/productStore'
import { useAuthStore } from '../store/authStore'
import { dbQuery, dbExecute, triggerAssignmentNotification } from '../store/dbClient'
import { UATCase, TestResult } from '../types'

interface EnhancedUATCase extends UATCase {
  release_id: string
  product_id?: string
  assignee_id?: string
  product_name?: string
  release_name?: string
  release_version?: string
  attachment_name?: string
  attachment_data?: string
  attachment_size?: number
}

export function UAT() {
  const { releases, fetchReleases } = useReleaseStore()
  const { products, fetchProducts } = useProductStore()
  const currentUser = useAuthStore(state => state.user)
  const isManagement = currentUser?.role === 'Management'

  const [selectedProductId, setSelectedProductId] = useState('All')
  const [selectedReleaseId, setSelectedReleaseId] = useState('All')
  const [testCases, setTestCases] = useState<EnhancedUATCase[]>([])
  const [usersList, setUsersList] = useState<any[]>([])

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [assigneeFilter, setAssigneeFilter] = useState('All')

  // Add Test Case Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [modalProductId, setModalProductId] = useState('')
  const [modalReleaseId, setModalReleaseId] = useState('')
  const [description, setDescription] = useState('')
  const [assignee, setAssignee] = useState('')
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState<TestResult>('Pending')
  const [attachName, setAttachName] = useState('')
  const [attachData, setAttachData] = useState('')
  const [attachSize, setAttachSize] = useState<number | null>(null)

  // Edit Test Case Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingCase, setEditingCase] = useState<EnhancedUATCase | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editProductId, setEditProductId] = useState('')
  const [editReleaseId, setEditReleaseId] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAssignee, setEditAssignee] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editResult, setEditResult] = useState<TestResult>('Pending')
  const [editAttachName, setEditAttachName] = useState('')
  const [editAttachData, setEditAttachData] = useState('')
  const [editAttachSize, setEditAttachSize] = useState<number | null>(null)

  // QA Sign-Off Modal State
  const [isSignOffOpen, setIsSignOffOpen] = useState(false)
  const [signOffReleaseId, setSignOffReleaseId] = useState('')
  const [signOffSigner, setSignOffSigner] = useState('')
  const [signOffNotes, setSignOffNotes] = useState('')

  useEffect(() => {
    fetchProducts()
    fetchReleases()
    loadUsers()
  }, [fetchProducts, fetchReleases])

  const loadUsers = async () => {
    try {
      const rows = await dbQuery<any>(
        'SELECT id, display_name, username, role FROM users WHERE active = 1 ORDER BY display_name ASC'
      )
      setUsersList(rows)
    } catch (err) {
      console.warn('Could not load users list:', err)
    }
  }

  const loadTestCases = async () => {
    try {
      let query = `
        SELECT 
          u.*,
          COALESCE(u.product_id, r.product_id) as product_id,
          p.name as product_name,
          r.name as release_name,
          r.version as release_version
        FROM uat_cases u
        LEFT JOIN releases r ON u.release_id = r.id
        LEFT JOIN products p ON (u.product_id = p.id OR r.product_id = p.id)
      `
      const params: any[] = []
      const conditions: string[] = []

      if (selectedProductId !== 'All') {
        conditions.push('(u.product_id = ? OR r.product_id = ?)')
        params.push(selectedProductId, selectedProductId)
      }

      if (selectedReleaseId !== 'All') {
        conditions.push('u.release_id = ?')
        params.push(selectedReleaseId)
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ')
      }

      query += ' ORDER BY u.updated_at DESC'

      const rows = await dbQuery<EnhancedUATCase>(query, params)
      setTestCases(rows)
    } catch (err) {
      console.error('Failed to load UAT cases:', err)
    }
  }

  useEffect(() => {
    loadTestCases()
  }, [selectedProductId, selectedReleaseId])

  const availableReleases = releases.filter(r => 
    selectedProductId === 'All' ? true : r.productId === selectedProductId
  )

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId)
    setSelectedReleaseId('All')
  }

  const handleStatusChange = async (id: string, newResult: TestResult) => {
    try {
      await dbExecute('UPDATE uat_cases SET result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newResult, id])
      setTestCases(prev => prev.map(tc => tc.id === id ? { ...tc, result: newResult } : tc))
    } catch (err) {
      console.error(err)
    }
  }

  const handleOpenAddModal = () => {
    const defaultProd = selectedProductId !== 'All' ? selectedProductId : (products[0]?.id || '')
    const prodRels = releases.filter(r => r.productId === defaultProd)
    setTitle('')
    setModalProductId(defaultProd)
    setModalReleaseId(prodRels[0]?.id || releases[0]?.id || '')
    setAssignee(currentUser?.displayName || '')
    setDescription('')
    setNotes('')
    setResult('Pending')
    setAttachName('')
    setAttachData('')
    setAttachSize(null)
    setIsAddModalOpen(true)
  }

  const handleCreateTestCase = async () => {
    if (!title.trim() || !modalReleaseId) return
    const id = `uat-${Date.now().toString().slice(-6)}`
    const targetProdId = modalProductId || (releases.find(r => r.id === modalReleaseId)?.productId || '')
    
    await dbExecute(
      `INSERT INTO uat_cases (id, release_id, product_id, title, description, result, assignee_id, notes, attachment_name, attachment_data, attachment_size, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [id, modalReleaseId, targetProdId || null, title.trim(), description, result, assignee || 'Unassigned', notes, attachName || null, attachData || null, attachSize || null]
    )

    if (assignee && assignee !== 'Unassigned') {
      const prodName = products.find(p => p.id === targetProdId)?.name || 'Product Workspace'
      triggerAssignmentNotification({
        targetAssignee: assignee,
        title: `UAT Test Assigned: ${title.trim()}`,
        message: `${currentUser?.displayName || 'Lead'} assigned UAT test "${title.trim()}" to you in ${prodName}.`,
        entityType: 'UAT',
        entityId: id,
        productName: prodName
      })
    }

    setIsAddModalOpen(false)
    await loadTestCases()
  }

  const handleOpenEditModal = (tc: EnhancedUATCase) => {
    setEditingCase(tc)
    setEditTitle(tc.title || '')
    const pId = tc.product_id || (releases.find(r => r.id === tc.release_id)?.productId || '')
    setEditProductId(pId)
    setEditReleaseId(tc.release_id || '')
    setEditAssignee(tc.assignee_id || '')
    setEditDescription(tc.description || '')
    setEditNotes(tc.notes || '')
    setEditResult(tc.result || 'Pending')
    setEditAttachName(tc.attachment_name || '')
    setEditAttachData(tc.attachment_data || '')
    setEditAttachSize(tc.attachment_size || null)
    setIsEditModalOpen(true)
  }

  const handleUpdateTestCase = async () => {
    if (!editingCase || !editTitle.trim()) return
    const previousAssignee = editingCase.assignee_id

    await dbExecute(
      `UPDATE uat_cases
       SET title = ?, release_id = ?, product_id = ?, assignee_id = ?, description = ?, notes = ?, result = ?, attachment_name = ?, attachment_data = ?, attachment_size = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [editTitle.trim(), editReleaseId, editProductId || null, editAssignee || 'Unassigned', editDescription, editNotes, editResult, editAttachName || null, editAttachData || null, editAttachSize || null, editingCase.id]
    )

    if (editAssignee && editAssignee !== 'Unassigned' && editAssignee !== previousAssignee) {
      const prodName = products.find(p => p.id === editProductId)?.name || 'Product Workspace'
      triggerAssignmentNotification({
        targetAssignee: editAssignee,
        title: `UAT Test Reassigned: ${editTitle.trim()}`,
        message: `${currentUser?.displayName || 'Lead'} reassigned UAT test "${editTitle.trim()}" to you in ${prodName}.`,
        entityType: 'UAT',
        entityId: editingCase.id,
        productName: prodName
      })
    }

    setIsEditModalOpen(false)
    setEditingCase(null)
    await loadTestCases()
  }

  const handleDownloadAttachment = (name?: string, data?: string) => {
    if (!data) return
    const link = document.createElement('a')
    link.href = data
    link.download = name || 'test-evidence'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleOpenSignOff = (relId?: string) => {
    const targetRelId = relId || (selectedReleaseId !== 'All' ? selectedReleaseId : (releases[0]?.id || ''))
    setSignOffReleaseId(targetRelId)
    setSignOffSigner(currentUser?.displayName || currentUser?.username || 'QA Lead')
    setSignOffNotes('')
    setIsSignOffOpen(true)
  }

  const handleSaveSignOff = async () => {
    if (!signOffReleaseId) {
      alert('Please select a release to sign off.')
      return
    }
    const targetRel = releases.find(r => r.id === signOffReleaseId)
    const relCases = testCases.filter(u => u.release_id === signOffReleaseId)
    const pendingOrFailed = relCases.filter(u => u.result !== 'Pass')

    if (pendingOrFailed.length > 0) {
      const confirmProceed = confirm(
        `Notice: ${pendingOrFailed.length} test scenario(s) are not marked as Passed for release "${targetRel?.name}". Are you sure you want to proceed with QA Sign-Off?`
      )
      if (!confirmProceed) return
    }

    try {
      await dbExecute(`
        CREATE TABLE IF NOT EXISTS release_signoffs (
          release_id TEXT PRIMARY KEY,
          signed_off_by TEXT NOT NULL,
          signed_off_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          notes TEXT
        )
      `)

      await dbExecute(
        `INSERT OR REPLACE INTO release_signoffs (release_id, signed_off_by, signed_off_at, notes)
         VALUES (?, ?, CURRENT_TIMESTAMP, ?)`,
        [signOffReleaseId, signOffSigner.trim() || 'QA Lead', signOffNotes.trim()]
      )

      await dbExecute(
        `UPDATE releases SET status = 'SignOff', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [signOffReleaseId]
      )

      if ((window as any).horizon?.notify?.send) {
        await (window as any).horizon.notify.send({
          title: `QA Sign-Off Completed`,
          body: `Release "${targetRel?.name || signOffReleaseId}" has received Quality Gate sign-off by ${signOffSigner.trim() || 'QA Lead'}.`
        })
      }

      setIsSignOffOpen(false)
      await fetchReleases()
      await loadTestCases()
    } catch (err: any) {
      console.error('Error recording QA sign-off:', err)
      alert('Failed to complete QA sign-off: ' + (err.message || err))
    }
  }

  const handleDeleteTestCase = async (id: string, scenarioTitle: string) => {
    if (confirm(`Delete test scenario "${scenarioTitle}"?`)) {
      try {
        await dbExecute('DELETE FROM uat_cases WHERE id = ?', [id])
        await loadTestCases()
      } catch (err: any) {
        alert('Failed to delete test scenario: ' + (err.message || err))
      }
    }
  }

  const filteredCases = testCases.filter(tc => {
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch = !q ||
      tc.title.toLowerCase().includes(q) ||
      (tc.description && tc.description.toLowerCase().includes(q)) ||
      (tc.assignee_id && tc.assignee_id.toLowerCase().includes(q)) ||
      (tc.product_name && tc.product_name.toLowerCase().includes(q)) ||
      (tc.notes && tc.notes.toLowerCase().includes(q))
    const matchesStatus = statusFilter === 'All' || tc.result === statusFilter
    const matchesAssignee = assigneeFilter === 'All' || tc.assignee_id === assigneeFilter
    return matchesSearch && matchesStatus && matchesAssignee
  })

  const total = testCases.length
  const passed = testCases.filter(t => t.result === 'Pass').length
  const failed = testCases.filter(t => t.result === 'Fail').length
  const blocked = testCases.filter(t => t.result === 'Blocked').length
  const pending = testCases.filter(t => t.result === 'Pending').length
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Scope Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0A1024]/90 border border-[#15203D] shadow-xl">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <CheckCircle2 className="text-emerald-400" size={24} /> UAT Verification & Quality Gate
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Enterprise QA checklist, acceptance criteria tracking, and tester assignments across products and releases.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Application Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Package size={13} className="text-[#2E5EFF]" /> App:
            </span>
            <select
              value={selectedProductId}
              onChange={e => handleProductChange(e.target.value)}
              className="bg-[#0D1429] text-white text-xs border border-[#19264A] rounded-xl px-3 py-2 focus:outline-none focus:border-[#2E5EFF] transition-colors"
            >
              <option value="All">All Applications</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
              ))}
            </select>
          </div>

          {/* Release Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <GitMerge size={13} className="text-emerald-400" /> Release:
            </span>
            <select
              value={selectedReleaseId}
              onChange={e => setSelectedReleaseId(e.target.value)}
              className="bg-[#0D1429] text-white text-xs border border-[#19264A] rounded-xl px-3 py-2 focus:outline-none focus:border-[#2E5EFF] transition-colors"
            >
              <option value="All">All Releases</option>
              {availableReleases.map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.version})</option>
              ))}
            </select>
          </div>

          {!isManagement && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => handleOpenSignOff()} className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/20">
                <ShieldCheck size={15} /> QA Sign-Off
              </Button>
              <Button size="sm" onClick={handleOpenAddModal} className="gap-1.5 shadow-lg shadow-[#2E5EFF]/20">
                <Plus size={15} /> Add Test Scenario
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl bg-[#0D1429] border border-[#172242]">
          <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Total Scenarios</span>
          <div className="text-2xl font-black text-white mt-1">{total}</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0D1429] border border-emerald-500/20">
          <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold">Passed</span>
          <div className="text-2xl font-black text-emerald-400 mt-1">{passed}</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0D1429] border border-red-500/20">
          <span className="text-[11px] uppercase tracking-wider text-red-400 font-semibold">Failed</span>
          <div className="text-2xl font-black text-red-400 mt-1">{failed}</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0D1429] border border-yellow-500/20">
          <span className="text-[11px] uppercase tracking-wider text-yellow-400 font-semibold">Blocked</span>
          <div className="text-2xl font-black text-yellow-400 mt-1">{blocked}</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0D1429] border border-[#2E5EFF]/20">
          <span className="text-[11px] uppercase tracking-wider text-[#6087FF] font-semibold">Pass Rate</span>
          <div className="text-2xl font-black text-[#6087FF] mt-1">{passRate}%</div>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="p-4 rounded-2xl bg-[#0A1024]/80 border border-[#15203D]">
        <div className="flex justify-between items-center text-xs font-semibold mb-2">
          <span className="text-gray-300">Acceptance Gate Criteria</span>
          <span className={passRate === 100 ? 'text-emerald-400 font-bold' : 'text-gray-400'}>{passRate}% Complete ({passed}/{total || 1} Passed)</span>
        </div>
        <div className="h-2.5 w-full bg-[#111A33] rounded-full overflow-hidden flex">
          <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${(passed / (total || 1)) * 100}%` }} />
          <div className="bg-red-500 transition-all duration-500" style={{ width: `${(failed / (total || 1)) * 100}%` }} />
          <div className="bg-yellow-500 transition-all duration-500" style={{ width: `${(blocked / (total || 1)) * 100}%` }} />
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-3.5 rounded-xl bg-[#0A1024]/60 border border-[#15203D] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
          <Search size={15} className="text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search test scenario, notes, application, or tester..."
            className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-white text-xs">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Status filter */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Filter size={13} />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-[#0D1429] text-white text-xs border border-[#19264A] rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#2E5EFF]"
            >
              <option value="All">All Statuses</option>
              <option value="Pass">Pass</option>
              <option value="Fail">Fail</option>
              <option value="Blocked">Blocked</option>
              <option value="Pending">Pending</option>
            </select>
          </div>

          {/* Assignee filter */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <UserCheck size={13} />
            <span>Assignee:</span>
            <select
              value={assigneeFilter}
              onChange={e => setAssigneeFilter(e.target.value)}
              className="bg-[#0D1429] text-white text-xs border border-[#19264A] rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#2E5EFF]"
            >
              <option value="All">All Assignees</option>
              {Array.from(new Set(testCases.map(t => t.assignee_id).filter(Boolean))).map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Test Cases List */}
      <div className="space-y-3">
        {filteredCases.map(tc => (
          <div 
            key={tc.id}
            className="p-4 rounded-2xl bg-[#0A1024]/90 border border-[#15203D] hover:border-[#2E5EFF]/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h4 className="text-sm font-bold text-white">{tc.title}</h4>
                <Badge variant={tc.result === 'Pass' ? 'success' : tc.result === 'Fail' ? 'danger' : tc.result === 'Blocked' ? 'warning' : 'neutral'}>
                  {tc.result}
                </Badge>
                {tc.product_name && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#162040] text-[#6087FF] border border-[#2E5EFF]/30 font-medium">
                    {tc.product_name}
                  </span>
                )}
                {tc.release_name && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#152720] text-emerald-300 border border-emerald-500/30 font-medium">
                    {tc.release_name} {tc.release_version ? `(${tc.release_version})` : ''}
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-300 line-clamp-2">{tc.description || 'No detailed steps provided.'}</p>
              
              <div className="flex flex-wrap items-center gap-4 mt-2 text-[11px] text-gray-400">
                <span className="flex items-center gap-1">
                  <UserCheck size={12} className="text-[#2E5EFF]" />
                  <span className="text-gray-500">Assignee:</span> <strong className="text-gray-200">{tc.assignee_id || 'Unassigned'}</strong>
                </span>
                {tc.notes && (
                  <span className="text-gray-400 font-mono">
                    Notes: {tc.notes}
                  </span>
                )}
              </div>

              {/* Attached Test Evidence Badge */}
              {(tc.attachment_name || tc.attachment_data) && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#080E21] border border-cyan-500/30 text-cyan-300 text-xs">
                    <File size={13} className="text-cyan-400 shrink-0" />
                    <span className="font-mono font-medium max-w-[200px] truncate">
                      {tc.attachment_name || 'Test Evidence'}
                    </span>
                    {tc.attachment_size && (
                      <span className="text-[10px] text-gray-500 font-mono">
                        ({((tc.attachment_size || 0) / 1024).toFixed(1)} KB)
                      </span>
                    )}
                    {tc.attachment_data && (
                      <button
                        onClick={() => handleDownloadAttachment(tc.attachment_name, tc.attachment_data)}
                        className="ml-1 p-0.5 text-cyan-400 hover:text-white transition-colors"
                        title="Download attachment"
                      >
                        <Download size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions & Status Selector */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1 bg-[#070B19] p-1 rounded-xl border border-[#15203D]">
                {(['Pass', 'Fail', 'Blocked', 'Pending'] as const).map(res => (
                  <button
                    key={res}
                    disabled={isManagement}
                    onClick={() => handleStatusChange(tc.id, res)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      tc.result === res 
                        ? res === 'Pass' ? 'bg-emerald-500 text-black shadow-sm' :
                          res === 'Fail' ? 'bg-red-500 text-white shadow-sm' :
                          res === 'Blocked' ? 'bg-yellow-500 text-black shadow-sm' :
                          'bg-gray-700 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-[#15203D]'
                    } ${isManagement ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {res}
                  </button>
                ))}
              </div>

              {!isManagement && (
                <div className="flex items-center gap-1 border-l border-[#19264A] pl-2">
                  <button
                    onClick={() => handleOpenEditModal(tc)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-[#162040] rounded-lg transition-colors"
                    title="Edit Test Scenario"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => handleDeleteTestCase(tc.id, tc.title)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete Test Scenario"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {filteredCases.length === 0 && (
          <div className="text-center py-12 rounded-2xl bg-[#0A1024]/40 border border-dashed border-[#15203D] text-xs text-gray-500">
            {testCases.length === 0 
              ? 'No test scenarios registered for this selection. Click "Add Test Scenario" to create one.'
              : 'No test scenarios match your search filters.'}
          </div>
        )}
      </div>

      {/* Add Test Case Modal */}
      <Modal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add UAT Verification Test Scenario"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTestCase}>Save Test Scenario</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input 
            label="Test Scenario Summary" 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            placeholder="e.g. Ingest 50,000 transactions without dropped frames" 
            required 
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Application / Product</label>
              <select
                value={modalProductId}
                onChange={e => {
                  setModalProductId(e.target.value)
                  const rels = releases.filter(r => r.productId === e.target.value)
                  setModalReleaseId(rels[0]?.id || '')
                }}
                className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2E5EFF]"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Target Release</label>
              <select
                value={modalReleaseId}
                onChange={e => setModalReleaseId(e.target.value)}
                className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2E5EFF]"
              >
                {releases
                  .filter(r => !modalProductId || r.productId === modalProductId)
                  .map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.version})</option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Tester / Assignee</label>
            <select
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
              className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2E5EFF]"
            >
              <option value="Unassigned">Unassigned</option>
              {usersList.map(u => (
                <option key={u.id} value={u.display_name || u.username}>
                  {u.display_name || u.username} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Detailed Steps & Expected Behavior</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Outline execution steps, preconditions, and expected test results..." 
              className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] min-h-[90px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Initial Result</label>
              <select
                value={result}
                onChange={e => setResult(e.target.value as TestResult)}
                className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2E5EFF]"
              >
                <option value="Pending">Pending</option>
                <option value="Pass">Pass</option>
                <option value="Fail">Fail</option>
                <option value="Blocked">Blocked</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Execution Notes (Optional)</label>
              <input 
                type="text"
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="e.g. Tested in staging-us-east" 
                className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF]"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-[#19264A]">
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Attach Test Evidence / Artifact (Optional)
            </label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setAttachName(file.name)
                setAttachSize(file.size)
                const reader = new FileReader()
                reader.onload = () => setAttachData(reader.result as string)
                reader.readAsDataURL(file)
              }}
              className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#15203D] file:text-gray-200 hover:file:bg-[#1E2D52] cursor-pointer"
            />
            {attachName && (
              <span className="text-[11px] text-cyan-400 block mt-1">
                Selected: {attachName} ({((attachSize || 0) / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>
        </div>
      </Modal>

      {/* Edit Test Case Modal */}
      <Modal 
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingCase(null)
        }}
        title="Edit UAT Verification Test Scenario"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setIsEditModalOpen(false); setEditingCase(null) }}>Cancel</Button>
            <Button onClick={handleUpdateTestCase}>Save Changes</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input 
            label="Test Scenario Summary" 
            value={editTitle} 
            onChange={e => setEditTitle(e.target.value)} 
            placeholder="e.g. Ingest 50,000 transactions without dropped frames" 
            required 
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Application / Product</label>
              <select
                value={editProductId}
                onChange={e => {
                  setEditProductId(e.target.value)
                  const rels = releases.filter(r => r.productId === e.target.value)
                  setEditReleaseId(rels[0]?.id || '')
                }}
                className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2E5EFF]"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Target Release</label>
              <select
                value={editReleaseId}
                onChange={e => setEditReleaseId(e.target.value)}
                className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2E5EFF]"
              >
                {releases
                  .filter(r => !editProductId || r.productId === editProductId)
                  .map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.version})</option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Tester / Assignee</label>
            <select
              value={editAssignee}
              onChange={e => setEditAssignee(e.target.value)}
              className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2E5EFF]"
            >
              <option value="Unassigned">Unassigned</option>
              {usersList.map(u => (
                <option key={u.id} value={u.display_name || u.username}>
                  {u.display_name || u.username} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Detailed Steps & Expected Behavior</label>
            <textarea 
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              placeholder="Outline execution steps, preconditions, and expected test results..." 
              className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] min-h-[90px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Result</label>
              <select
                value={editResult}
                onChange={e => setEditResult(e.target.value as TestResult)}
                className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2E5EFF]"
              >
                <option value="Pending">Pending</option>
                <option value="Pass">Pass</option>
                <option value="Fail">Fail</option>
                <option value="Blocked">Blocked</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Execution Notes (Optional)</label>
              <input 
                type="text"
                value={editNotes} 
                onChange={e => setEditNotes(e.target.value)} 
                placeholder="e.g. Tested on build #104" 
                className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF]"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-[#19264A]">
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Attached Test Evidence / Artifact
            </label>
            {editAttachName && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#080E21] border border-cyan-500/30 text-cyan-300 text-xs mb-2">
                <div className="flex items-center gap-2 truncate">
                  <File size={14} className="text-cyan-400 shrink-0" />
                  <span className="font-mono truncate">{editAttachName}</span>
                  {editAttachSize && (
                    <span className="text-[10px] text-gray-500">
                      ({((editAttachSize || 0) / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {editAttachData && (
                    <button
                      type="button"
                      onClick={() => handleDownloadAttachment(editAttachName, editAttachData)}
                      className="p-1 text-cyan-300 hover:text-white"
                      title="Download artifact"
                    >
                      <Download size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditAttachName('')
                      setEditAttachData('')
                      setEditAttachSize(null)
                    }}
                    className="p-1 text-red-400 hover:text-red-300"
                    title="Remove attachment"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            )}
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setEditAttachName(file.name)
                setEditAttachSize(file.size)
                const reader = new FileReader()
                reader.onload = () => setEditAttachData(reader.result as string)
                reader.readAsDataURL(file)
              }}
              className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#15203D] file:text-gray-200 hover:file:bg-[#1E2D52] cursor-pointer"
            />
          </div>
        </div>
      </Modal>

      {/* QA Sign-Off Quality Gate Modal */}
      <Modal
        isOpen={isSignOffOpen}
        onClose={() => setIsSignOffOpen(false)}
        title="Quality Gate QA Sign-Off"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsSignOffOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSignOff} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2">
              <ShieldCheck size={16} /> Confirm QA Sign-Off
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Target Release to Sign Off</label>
            <select
              value={signOffReleaseId}
              onChange={e => setSignOffReleaseId(e.target.value)}
              className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2E5EFF]"
            >
              {releases.map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.version}) - Status: {r.status}</option>
              ))}
            </select>
          </div>

          {/* Release Readiness Check */}
          {(() => {
            const relCases = testCases.filter(u => u.release_id === signOffReleaseId)
            const passCount = relCases.filter(u => u.result === 'Pass').length
            const failCount = relCases.filter(u => u.result === 'Fail').length
            const blockCount = relCases.filter(u => u.result === 'Blocked').length
            const pendingCount = relCases.filter(u => u.result === 'Pending').length
            const total = relCases.length
            const allPassed = total > 0 && passCount === total

            return (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-300 block">Acceptance Gate Readiness</label>
                <div className={`p-4 rounded-xl border ${
                  allPassed
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : total === 0
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-yellow-500/10 border-yellow-500/30'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-xs">
                      {allPassed ? '✓ 100% Acceptance Criteria Met' : total === 0 ? '⚠ No Test Cases Defined' : '⚠ Incomplete Test Verification'}
                    </span>
                    <span className="font-mono text-[11px] text-gray-300">
                      {passCount}/{total} Passed
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono mt-2">
                    <div className="p-1.5 rounded-lg bg-[#070B19] text-emerald-400 border border-emerald-500/20">
                      Passed: <strong>{passCount}</strong>
                    </div>
                    <div className="p-1.5 rounded-lg bg-[#070B19] text-red-400 border border-red-500/20">
                      Failed: <strong>{failCount}</strong>
                    </div>
                    <div className="p-1.5 rounded-lg bg-[#070B19] text-yellow-400 border border-yellow-500/20">
                      Blocked: <strong>{blockCount}</strong>
                    </div>
                    <div className="p-1.5 rounded-lg bg-[#070B19] text-gray-400 border border-gray-600/20">
                      Pending: <strong>{pendingCount}</strong>
                    </div>
                  </div>
                  {!allPassed && total > 0 && (
                    <p className="text-[11px] text-yellow-300 mt-2">
                      Notice: Signing off this release will set its status to "SignOff" despite non-passing test scenarios.
                    </p>
                  )}
                </div>
              </div>
            )
          })()}

          <Input
            label="Quality Gate Signer / Authorizer"
            value={signOffSigner}
            onChange={e => setSignOffSigner(e.target.value)}
            placeholder="e.g. Jane Doe (QA Lead / Product Lead)"
            required
          />

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">QA Sign-Off Acceptance Notes & Decision Rationale</label>
            <textarea
              value={signOffNotes}
              onChange={e => setSignOffNotes(e.target.value)}
              placeholder="e.g. All critical and high test cases passed in regression suite. Performance SLAs confirmed within 150ms budget. Approved for production cutover."
              className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] min-h-[90px]"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
