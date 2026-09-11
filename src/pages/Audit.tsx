import React, { useEffect, useState } from 'react'
import { Card, Table, Badge, Button, Select } from '../components/ui'
import { useAuthStore } from '../store/authStore'
import { Download, ShieldAlert, Activity, Search } from 'lucide-react'
import { dbQuery } from '../store/dbClient'

interface AuditLogItem {
  id: string
  user_id: string
  action: string
  entity_type?: string
  entity_id?: string
  detail?: string
  ip_address?: string
  created_at: string
}

export function Audit() {
  const user = useAuthStore(state => state.user)
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  useEffect(() => {
    loadAuditLogs()
  }, [])

  const loadAuditLogs = async () => {
    try {
      const rows = await dbQuery<AuditLogItem>('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100')
      setLogs(rows)
    } catch (err) {
      console.error(err)
    }
  }

  const exportCSV = () => {
    const headers = ['Timestamp', 'User', 'Action', 'EntityType', 'EntityID', 'Details']
    const csvRows = logs.map(l => [
      `"${l.created_at}"`,
      `"${l.user_id}"`,
      `"${l.action}"`,
      `"${l.entity_type || ''}"`,
      `"${l.entity_id || ''}"`,
      `"${(l.detail || '').replace(/"/g, '""')}"`
    ])
    const csvContent = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `horizon-audit-log-${new Date().toISOString().split('T')[0]}.csv`)
    link.click()
  }

  if (user?.role !== 'ProductOwner') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center max-w-sm mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
          <ShieldAlert size={28} />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Restricted Administrative Area</h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          Audit trail access is reserved exclusively for the Product Owner role to ensure compliance and security oversight.
        </p>
      </div>
    )
  }

  const filtered = logs.filter(l => {
    const matchSearch = l.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (l.detail && l.detail.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        l.action.toLowerCase().includes(searchQuery.toLowerCase())
    const matchAction = !actionFilter || l.action === actionFilter
    return matchSearch && matchAction
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0A1024]/90 border border-[#15203D]">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Activity className="text-[#2E5EFF]" size={22} /> Audit & Governance Trail
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Immutable record of system changes, secret reveals, and user mutations.</p>
        </div>

        <Button variant="secondary" size="sm" onClick={exportCSV} className="gap-1.5 border-[#1A264D] hover:bg-[#15203D]">
          <Download size={15} /> Export Audit CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-[#0A1024]/80 border border-[#15203D]">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search audit trail..." 
            className="w-full bg-[#0D1429] border border-[#19264A] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF]"
          />
        </div>
        <Select 
          value={actionFilter} 
          onChange={e => setActionFilter(e.target.value)}
          options={[
            { label: 'All Operations', value: '' }, 
            { label: 'Secret Reveals', value: 'SecretReveal' }, 
            { label: 'Secret Additions', value: 'SecretAdd' }, 
            { label: 'System Initializations', value: 'SystemInit' }
          ]} 
          className="w-48 bg-[#0D1429]" 
        />
      </div>

      <div className="rounded-2xl bg-[#0A1024]/90 border border-[#15203D] overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#15203D] bg-[#0D1429] text-gray-400 uppercase tracking-wider font-semibold">
              <th className="p-4">Timestamp</th>
              <th className="p-4">User</th>
              <th className="p-4">Action</th>
              <th className="p-4">Target Entity</th>
              <th className="p-4">Operation Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#15203D]">
            {filtered.map(l => (
              <tr key={l.id} className="hover:bg-[#0E1736] transition-colors">
                <td className="p-4 text-gray-400 font-mono">
                  {new Date(l.created_at).toLocaleString()}
                </td>
                <td className="p-4 font-bold text-white">
                  {l.user_id}
                </td>
                <td className="p-4">
                  <Badge variant={l.action.includes('Secret') ? 'orange' : 'blue'}>
                    {l.action}
                  </Badge>
                </td>
                <td className="p-4 text-gray-300 font-mono">
                  {l.entity_type || 'System'}: {l.entity_id || '-'}
                </td>
                <td className="p-4 text-gray-300 leading-relaxed">
                  {l.detail || 'Standard execution'}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No matching audit logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
