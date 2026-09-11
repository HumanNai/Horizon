import React, { useEffect, useState } from 'react'
import { useReleaseStore } from '../store/releaseStore'
import { useProductStore } from '../store/productStore'
import { Card, Button, Badge, Modal, Input, Select } from '../components/ui'
import { PipelineBar } from '../components/PipelineBar'
import { Release, ReleaseStatus } from '../types'
import { Plus, GitMerge, CheckCircle2, ChevronRight, Calendar, Server, ListChecks, ShieldCheck, Trash2, X, Edit3 } from 'lucide-react'

export function Releases() {
  const { releases, fetchReleases, createRelease, updateRelease, updateReleaseStatus, signOffRelease, deleteRelease } = useReleaseStore()
  const { products, fetchProducts } = useProductStore()
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isSignOffModalOpen, setIsSignOffModalOpen] = useState(false)
  const [signOffNotes, setSignOffNotes] = useState('')

  // Form State
  const [version, setVersion] = useState('')
  const [name, setName] = useState('')
  const [productId, setProductId] = useState('')
  const [status, setStatus] = useState<ReleaseStatus>('Planning')
  const [targetDate, setTargetDate] = useState(new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [featureInput, setFeatureInput] = useState('')
  const [features, setFeatures] = useState<string[]>([])
  const [serverUpgrades, setServerUpgrades] = useState('')

  // Edit Release Form State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingRelease, setEditingRelease] = useState<Release | null>(null)
  const [editVersion, setEditVersion] = useState('')
  const [editName, setEditName] = useState('')
  const [editProductId, setEditProductId] = useState('')
  const [editStatus, setEditStatus] = useState<ReleaseStatus>('Planning')
  const [editTargetDate, setEditTargetDate] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editFeatureInput, setEditFeatureInput] = useState('')
  const [editFeatures, setEditFeatures] = useState<string[]>([])
  const [editServerUpgrades, setEditServerUpgrades] = useState('')

  useEffect(() => {
    fetchReleases()
    fetchProducts()
  }, [fetchReleases, fetchProducts])

  useEffect(() => {
    if (releases.length > 0 && !selectedRelease) {
      setSelectedRelease(releases[0])
    }
  }, [releases, selectedRelease])

  const getStepIndex = (st: string) => {
    const steps = ['Planning', 'Development', 'QA', 'UAT', 'SignOff', 'Released']
    const idx = steps.indexOf(st)
    return idx === -1 ? 0 : idx
  }

  const handleAddFeature = () => {
    if (!featureInput.trim()) return
    setFeatures([...features, featureInput.trim()])
    setFeatureInput('')
  }

  const handleRemoveFeature = (idx: number) => {
    setFeatures(features.filter((_, i) => i !== idx))
  }

  const handleCreateRelease = async () => {
    if (!version.trim() || !name.trim()) return
    await createRelease({
      version: version.trim(),
      name: name.trim(),
      productId: productId || (products[0]?.id || ''),
      status,
      targetDate: new Date(targetDate).toISOString(),
      description,
      features,
      serverUpgrades
    })
    setIsAddModalOpen(false)
    setVersion('')
    setName('')
    setDescription('')
    setFeatures([])
    setServerUpgrades('')
  }

  const handleOpenEditModal = (r: Release, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setEditingRelease(r)
    setEditVersion(r.version)
    setEditName(r.name)
    setEditProductId(r.productId)
    setEditStatus(r.status)
    setEditTargetDate(r.targetDate ? new Date(r.targetDate).toISOString().split('T')[0] : '')
    setEditDescription(r.description || '')
    setEditFeatures(r.features || [])
    setEditFeatureInput('')
    setEditServerUpgrades(r.serverUpgrades || '')
    setIsEditModalOpen(true)
  }

  const handleAddEditFeature = () => {
    if (!editFeatureInput.trim()) return
    setEditFeatures(prev => [...prev, editFeatureInput.trim()])
    setEditFeatureInput('')
  }

  const handleRemoveEditFeature = (idx: number) => {
    setEditFeatures(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSaveEditRelease = async () => {
    if (!editingRelease || !editVersion.trim() || !editName.trim()) return
    const targetDateIso = editTargetDate ? new Date(editTargetDate).toISOString() : new Date().toISOString()
    await updateRelease(editingRelease.id, {
      version: editVersion.trim(),
      name: editName.trim(),
      productId: editProductId || editingRelease.productId,
      status: editStatus,
      targetDate: targetDateIso,
      description: editDescription,
      features: editFeatures,
      serverUpgrades: editServerUpgrades
    })
    setIsEditModalOpen(false)
    if (selectedRelease?.id === editingRelease.id) {
      setSelectedRelease(prev => prev ? {
        ...prev,
        version: editVersion.trim(),
        name: editName.trim(),
        productId: editProductId || editingRelease.productId,
        status: editStatus,
        targetDate: targetDateIso,
        description: editDescription,
        features: editFeatures,
        serverUpgrades: editServerUpgrades
      } : null)
    }
    setEditingRelease(null)
  }

  const handleSignOffSubmit = async () => {
    if (!selectedRelease) return
    await signOffRelease(selectedRelease.id, signOffNotes || 'Approved for production cutover by Product Owner.')
    setIsSignOffModalOpen(false)
    setSignOffNotes('')
    // Update active release selection
    setSelectedRelease(prev => prev ? { ...prev, status: 'SignOff' } : null)
  }

  const handleStepTransition = async (newStatus: ReleaseStatus) => {
    if (!selectedRelease) return
    await updateReleaseStatus(selectedRelease.id, newStatus)
    setSelectedRelease(prev => prev ? { ...prev, status: newStatus } : null)
  }

  const handleDeleteRelease = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (confirm('Are you sure you want to delete this release from the pipeline?')) {
      await deleteRelease(id)
      if (selectedRelease?.id === id) {
        const remaining = releases.filter(r => r.id !== id)
        setSelectedRelease(remaining.length > 0 ? remaining[0] : null)
      }
    }
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-7.5rem)] gap-6 max-w-7xl mx-auto">
      {/* Left List: Releases Feed */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <GitMerge size={20} className="text-[#2E5EFF]" /> Release Roadmap
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Pipeline progression from Planning to Production Sign-Off.</p>
          </div>
          <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="gap-1.5 shadow-lg shadow-[#2E5EFF]/20">
            <Plus size={15} /> Add Release
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 custom-scrollbar">
          {releases.map(r => {
            const isSelected = selectedRelease?.id === r.id
            const prod = products.find(p => p.id === r.productId)
            return (
              <div 
                key={r.id} 
                onClick={() => setSelectedRelease(r)}
                className={`p-5 rounded-2xl cursor-pointer transition-all duration-300 border ${
                  isSelected 
                    ? 'bg-[#0E1736] border-[#2E5EFF] shadow-[0_0_25px_rgba(46,94,255,0.2)]' 
                    : 'bg-[#0A1024]/80 hover:bg-[#0E152E] border-[#15203D]'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-base text-white hover:text-[#6087FF] transition-colors">{r.name}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#15203D] text-[#6087FF] border border-[#1F2F59]">
                        {r.version}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-2">
                      <span>{prod?.name || 'Core Product'}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-gray-500" /> 
                        {r.targetDate ? (() => {
                          try {
                            const d = new Date(r.targetDate)
                            return isNaN(d.getTime()) ? 'TBD' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                          } catch {
                            return 'TBD'
                          }
                        })() : 'TBD'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={r.status === 'Released' ? 'success' : r.status === 'SignOff' ? 'orange' : r.status === 'Cancelled' ? 'danger' : 'blue'}>
                      {r.status}
                    </Badge>
                    <button
                      onClick={(e) => handleOpenEditModal(r, e)}
                      className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#19264A] transition-colors"
                      title="Edit Release"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteRelease(r.id, e)}
                      className="p-1 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove Release"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <PipelineBar activeStep={getStepIndex(r.status)} size="sm" />
                </div>
              </div>
            )
          })}
          {releases.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-[#0A1024]/60 rounded-2xl border border-[#15203D]">
              <GitMerge size={36} className="text-gray-600 mb-3" />
              <h3 className="text-sm font-bold text-white mb-1">No Releases in Pipeline</h3>
              <p className="text-xs text-gray-400 mb-4 max-w-xs">
                Create a product release to track scope, target cutover dates, and UAT sign-off criteria.
              </p>
              <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="gap-1.5 shadow-lg shadow-[#2E5EFF]/20">
                <Plus size={14} /> Add First Release
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Right Slide-over / Detail Inspector */}
      {selectedRelease && (
        <div className="w-full lg:w-[480px] bg-[#0A1024]/90 border border-[#15203D] rounded-2xl flex flex-col shadow-2xl overflow-hidden shrink-0">
          <div className="p-5 border-b border-[#15203D] flex justify-between items-start bg-[#0D1429]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-white">{selectedRelease.name}</h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#19264A] text-[#6087FF]">{selectedRelease.version}</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{selectedRelease.description || 'No release description.'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => handleOpenEditModal(selectedRelease)} className="gap-1.5 text-xs py-1 h-auto">
                <Edit3 size={13} /> Edit
              </Button>
              <Badge variant={selectedRelease.status === 'Released' ? 'success' : selectedRelease.status === 'SignOff' ? 'orange' : 'blue'}>
                {selectedRelease.status}
              </Badge>
              <button
                onClick={() => handleDeleteRelease(selectedRelease.id)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Remove Release"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar text-xs">
            {/* Stage Quick Advance */}
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Stage Progression</label>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#070B19] border border-[#15203D]">
                {(['Planning', 'Development', 'QA', 'UAT', 'SignOff', 'Released'] as ReleaseStatus[]).map(st => (
                  <button
                    key={st}
                    onClick={() => handleStepTransition(st)}
                    className={`py-1.5 text-center rounded-lg text-xs font-medium transition-colors ${
                      selectedRelease.status === st 
                        ? 'bg-[#2E5EFF] text-white shadow-sm' 
                        : 'text-gray-400 hover:text-white hover:bg-[#15203D]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Scope / Features Checklist */}
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Included Features & Scope</label>
              <div className="space-y-1.5">
                {(Array.isArray(selectedRelease.features) ? selectedRelease.features : []).map((feat, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-[#0D1429] border border-[#15203D] text-gray-200">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span className="truncate">{feat}</span>
                  </div>
                ))}
                {(!selectedRelease.features || selectedRelease.features.length === 0) && (
                  <div className="text-gray-500 py-2">No features listed for this release.</div>
                )}
              </div>
            </div>

            {/* Infrastructure / Server Upgrades */}
            {selectedRelease.serverUpgrades && (
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5 flex items-center gap-1.5">
                  <Server size={13} className="text-[#F5A623]" /> Infrastructure & Server Notes
                </label>
                <div className="p-3 rounded-xl bg-[#0D1429] border border-[#15203D] text-gray-300 text-xs leading-relaxed">
                  {selectedRelease.serverUpgrades}
                </div>
              </div>
            )}
          </div>

          {/* PO Gate Sign-Off Action */}
          <div className="p-4 border-t border-[#15203D] bg-[#070B19]/80 flex items-center justify-between gap-3">
            <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-[#2E5EFF]" />
              <span>Gate Sign-off requires 100% QA pass</span>
            </div>
            <Button 
              size="sm" 
              onClick={() => setIsSignOffModalOpen(true)}
              className="bg-gradient-to-r from-[#F5A623] to-[#E08A10] text-black font-bold hover:opacity-90 shadow-lg shadow-[#F5A623]/20"
            >
              Sign-Off Release
            </Button>
          </div>
        </div>
      )}

      {/* Add Release Modal */}
      <Modal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create Product Release"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRelease}>Publish Release</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Release Version" value={version} onChange={e => setVersion(e.target.value)} placeholder="e.g. v2.5.0" required />
            <Input label="Target Cutover Date" type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} required />
          </div>

          <Input label="Release Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Phoenix Performance Wave" required />

          <Select 
            label="Target Product" 
            value={productId} 
            onChange={e => setProductId(e.target.value)}
            options={products.map(p => ({ label: `${p.name} (${p.type})`, value: p.id }))}
          />

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Feature Scope Items</label>
            <div className="flex gap-2 mb-2">
              <input 
                type="text" 
                value={featureInput} 
                onChange={e => setFeatureInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddFeature() } }}
                placeholder="Type feature and press Enter or Add..." 
                className="flex-1 bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2E5EFF]"
              />
              <Button size="sm" type="button" onClick={handleAddFeature}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {features.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#111A33] text-gray-200 border border-[#19264A]">
                  {f} <X size={12} className="cursor-pointer hover:text-red-400" onClick={() => handleRemoveFeature(i)} />
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Server & Infrastructure Notes</label>
            <textarea 
              value={serverUpgrades}
              onChange={e => setServerUpgrades(e.target.value)}
              placeholder="e.g. Node pool update, DB migration runbook..." 
              className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] min-h-[60px]"
            />
          </div>
        </div>
      </Modal>

      {/* Edit Release Modal */}
      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)}
        title={editingRelease ? `Edit Release: ${editingRelease.name} (${editingRelease.version})` : 'Edit Release'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEditRelease}>Save Release Changes</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input 
              label="Version Tag" 
              value={editVersion} 
              onChange={e => setEditVersion(e.target.value)} 
              placeholder="e.g. v2.4.0" 
              required 
            />
            <Select 
              label="Pipeline Stage" 
              value={editStatus} 
              onChange={e => setEditStatus(e.target.value as ReleaseStatus)} 
              options={[
                { label: 'Planning', value: 'Planning' },
                { label: 'Development', value: 'Development' },
                { label: 'QA', value: 'QA' },
                { label: 'UAT', value: 'UAT' },
                { label: 'SignOff', value: 'SignOff' },
                { label: 'Released', value: 'Released' },
                { label: 'Cancelled', value: 'Cancelled' }
              ]}
            />
          </div>

          <Input 
            label="Release Name / Milestone" 
            value={editName} 
            onChange={e => setEditName(e.target.value)} 
            placeholder="e.g. Phoenix Engine Scale Out" 
            required 
          />

          <Input 
            label="Target Cutover Date" 
            type="date" 
            value={editTargetDate} 
            onChange={e => setEditTargetDate(e.target.value)} 
            required 
          />

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Release Description</label>
            <textarea 
              value={editDescription} 
              onChange={e => setEditDescription(e.target.value)} 
              placeholder="Describe release scope, architectural goals, and business deliverables..." 
              className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] min-h-[60px]"
            />
          </div>

          <Select 
            label="Target Product" 
            value={editProductId} 
            onChange={e => setEditProductId(e.target.value)}
            options={products.map(p => ({ label: `${p.name} (${p.type})`, value: p.id }))}
          />

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Feature Scope Items</label>
            <div className="flex gap-2 mb-2">
              <input 
                type="text" 
                value={editFeatureInput} 
                onChange={e => setEditFeatureInput(e.target.value)} 
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddEditFeature() } }}
                placeholder="Type feature and press Enter or Add..." 
                className="flex-1 bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2E5EFF]"
              />
              <Button size="sm" type="button" onClick={handleAddEditFeature}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {editFeatures.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#111A33] text-gray-200 border border-[#19264A]">
                  {f} <X size={12} className="cursor-pointer hover:text-red-400" onClick={() => handleRemoveEditFeature(i)} />
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Server & Infrastructure Notes</label>
            <textarea 
              value={editServerUpgrades} 
              onChange={e => setEditServerUpgrades(e.target.value)} 
              placeholder="e.g. Node pool update, DB migration runbook..." 
              className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] min-h-[60px]"
            />
          </div>
        </div>
      </Modal>

      {/* PO Sign-Off Modal */}
      {selectedRelease && (
        <Modal 
          isOpen={isSignOffModalOpen}
          onClose={() => setIsSignOffModalOpen(false)}
          title="Product Owner Gate Sign-Off"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsSignOffModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSignOffSubmit} className="bg-[#F5A623] text-black hover:bg-[#F5A623]/90 font-bold">
                Confirm & Sign Off
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-xs">
            <p className="text-gray-300 leading-relaxed">
              By signing off on <span className="font-bold text-white">{selectedRelease?.name || 'Release'}</span> ({selectedRelease?.version || 'Version'}), you certify that UAT criteria have been met and the build is authorized for production deployment.
            </p>
            <div className="flex flex-col w-full">
              <label className="mb-1 text-xs font-semibold text-gray-300">Sign-Off Notes & Verification Record</label>
              <textarea 
                value={signOffNotes}
                onChange={e => setSignOffNotes(e.target.value)}
                placeholder="Provide approval comments, test run references, or deployment conditions..."
                className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] min-h-[80px]"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
