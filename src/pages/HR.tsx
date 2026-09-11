import React, { useEffect, useState } from 'react'
import { Card, Badge, Button, Modal, Input, Select } from '../components/ui'
import { useAuthStore } from '../store/authStore'
import { 
  Users, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Edit3, 
  Trash2, 
  Home, 
  Building, 
  Phone, 
  Mail, 
  Calendar, 
  Search, 
  Filter, 
  CalendarCheck, 
  Briefcase, 
  Tag, 
  MapPin,
  ShieldCheck,
  Plane,
  AlertTriangle,
  UserCheck,
  ShieldAlert
} from 'lucide-react'
import { dbQuery, dbExecute } from '../store/dbClient'
import { AvailabilityStatus, WorkLocation } from '../types'

interface TeamMemberRecord {
  id: string
  user_id: string
  display_name?: string
  role?: string
  email?: string
  avatar_initials?: string
  status: AvailabilityStatus
  work_location: WorkLocation
  leave_from?: string
  leave_to?: string
  phone?: string
  emergency_contact?: string
  skills_tags?: string
  notes?: string
  updated_at: string
}

interface UserOption {
  id: string
  display_name: string
  role: string
  email: string
  avatar_initials?: string
}

export function HR() {
  const currentUser = useAuthStore(state => state.user)
  const isPO = currentUser?.role === 'ProductOwner'

  const [team, setTeam] = useState<TeamMemberRecord[]>([])
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('All')
  const [filterLocation, setFilterLocation] = useState<string>('All')
  const [viewTab, setViewTab] = useState<'roster' | 'leave_planner' | 'wfh_tracker'>('roster')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMemberRecord | null>(null)

  // Form Fields
  const [selectedUser, setSelectedUser] = useState('')
  const [customName, setCustomName] = useState('')
  const [status, setStatus] = useState<AvailabilityStatus>('Available')
  const [workLocation, setWorkLocation] = useState<WorkLocation>('Office')
  const [leaveFrom, setLeaveFrom] = useState('')
  const [leaveTo, setLeaveTo] = useState('')
  const [phone, setPhone] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [skillsTags, setSkillsTags] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // 1. Fetch all registered system users
      const users = await dbQuery<UserOption>(
        'SELECT id, display_name, role, email, avatar_initials FROM users WHERE active = 1 ORDER BY display_name ASC'
      )
      setUserOptions(users)

      // 2. Fetch HR records joined with user info
      const records = await dbQuery<any>(`
        SELECT 
          hr.id,
          hr.user_id,
          COALESCE(u.display_name, hr.user_id) as display_name,
          COALESCE(u.role, 'Team Member') as role,
          u.email,
          u.avatar_initials,
          hr.status,
          COALESCE(hr.work_location, 'Office') as work_location,
          hr.leave_from,
          hr.leave_to,
          hr.phone,
          hr.emergency_contact,
          hr.skills_tags,
          hr.notes,
          hr.updated_at
        FROM hr_records hr
        LEFT JOIN users u ON (u.id = hr.user_id OR u.display_name = hr.user_id)
        ORDER BY hr.status ASC, display_name ASC
      `)

      setTeam(records)
    } catch (err) {
      console.error('Error loading team HR records:', err)
    }
  }

  const handleOpenModal = (member?: TeamMemberRecord) => {
    if (member) {
      setEditingMember(member)
      setSelectedUser(member.user_id)
      setCustomName(member.display_name || member.user_id)
      setStatus(member.status)
      setWorkLocation(member.work_location || 'Office')
      setLeaveFrom(member.leave_from ? member.leave_from.split('T')[0] : '')
      setLeaveTo(member.leave_to ? member.leave_to.split('T')[0] : '')
      setPhone(member.phone || '')
      setEmergencyContact(member.emergency_contact || '')
      setSkillsTags(member.skills_tags || '')
      setNotes(member.notes || '')
    } else {
      setEditingMember(null)
      setSelectedUser(userOptions[0]?.id || '')
      setCustomName('')
      setStatus('Available')
      setWorkLocation('Office')
      setLeaveFrom('')
      setLeaveTo('')
      setPhone('')
      setEmergencyContact('')
      setSkillsTags('')
      setNotes('')
    }
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    const finalUserId = selectedUser || customName.trim()
    if (!finalUserId) {
      alert('Please select or specify a team member')
      return
    }

    try {
      if (editingMember) {
        await dbExecute(
          `UPDATE hr_records SET 
            user_id = ?, 
            status = ?, 
            work_location = ?,
            leave_from = ?, 
            leave_to = ?, 
            phone = ?,
            emergency_contact = ?,
            skills_tags = ?,
            notes = ?, 
            updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [
            finalUserId,
            status,
            workLocation,
            leaveFrom ? new Date(leaveFrom).toISOString() : null,
            leaveTo ? new Date(leaveTo).toISOString() : null,
            phone.trim() || null,
            emergencyContact.trim() || null,
            skillsTags.trim() || null,
            notes.trim() || null,
            editingMember.id
          ]
        )
      } else {
        const id = `hr-${Date.now()}`
        await dbExecute(
          `INSERT INTO hr_records (
            id, user_id, status, work_location, leave_from, leave_to, phone, emergency_contact, skills_tags, notes, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            id,
            finalUserId,
            status,
            workLocation,
            leaveFrom ? new Date(leaveFrom).toISOString() : null,
            leaveTo ? new Date(leaveTo).toISOString() : null,
            phone.trim() || null,
            emergencyContact.trim() || null,
            skillsTags.trim() || null,
            notes.trim() || null
          ]
        )
      }
      await loadData()
      setIsModalOpen(false)
    } catch (err: any) {
      alert('Error saving record: ' + (err.message || err))
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Remove availability record for ${name}?`)) {
      try {
        await dbExecute('DELETE FROM hr_records WHERE id = ?', [id])
        
        // Record deletion mutation for background sync
        const mutId = `mut-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        await dbExecute(
          `INSERT INTO local_mutations (id, entity, sp_item_id, operation, payload_json, created_at, synced)
           VALUES (?, 'hr_records', ?, 'DELETE', ?, CURRENT_TIMESTAMP, 0)`,
          [mutId, id, JSON.stringify({ id })]
        )

        // Directly delete from active cloud backend (MongoDB collection or SharePoint list)
        if ((window as any).horizon?.plugins?.deleteCloudRecord) {
          await (window as any).horizon.plugins.deleteCloudRecord('hr_records', id)
        }

        await loadData()
      } catch (err: any) {
        console.error('Error deleting HR record:', err)
        alert('Failed to remove record: ' + (err.message || err))
      }
    }
  }

  const getStatusBadge = (st: AvailabilityStatus) => {
    switch (st) {
      case 'Available':
        return <Badge variant="success">Available</Badge>
      case 'OnLeave':
        return <Badge variant="danger">On Leave</Badge>
      case 'Partial':
        return <Badge variant="warning">Partial Coverage</Badge>
      case 'Unavailable':
        return <Badge variant="neutral">Unavailable</Badge>
      default:
        return <Badge variant="neutral">{st}</Badge>
    }
  }

  const getLocationBadge = (loc: WorkLocation) => {
    switch (loc) {
      case 'WFH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#2E5EFF]/15 text-[#8FA7FF] border border-[#2E5EFF]/30">
            <Home size={11} /> WFH
          </span>
        )
      case 'Office':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Building size={11} /> Office
          </span>
        )
      case 'Hybrid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <Briefcase size={11} /> Hybrid
          </span>
        )
      case 'Client Site':
      case 'Travel':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Plane size={11} /> {loc}
          </span>
        )
      default:
        return <Badge variant="neutral">{loc}</Badge>
    }
  }

  if (!isPO) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center max-w-sm mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
          <ShieldAlert size={28} />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Restricted Administrative Area</h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          The Global Team Roster and HR Availability center is reserved exclusively for the Product Owner (admin) role. Team members can view and manage assigned members within their respective application workspaces.
        </p>
      </div>
    )
  }

  // Filtered list
  const filteredTeam = team.filter(m => {
    const matchesSearch = 
      (m.display_name || m.user_id).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.skills_tags || '').toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = filterStatus === 'All' || m.status === filterStatus
    const matchesLocation = filterLocation === 'All' || m.work_location === filterLocation

    return matchesSearch && matchesStatus && matchesLocation
  })

  // Aggregated KPIs
  const totalCount = team.length
  const availableCount = team.filter(t => t.status === 'Available').length
  const onLeaveCount = team.filter(t => t.status === 'OnLeave').length
  const wfhCount = team.filter(t => t.work_location === 'WFH').length
  const officeCount = team.filter(t => t.work_location === 'Office').length
  const capacityRate = totalCount > 0 ? Math.round((availableCount / totalCount) * 100) : 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-3xl bg-[#0A1024] border border-[#15203D] shadow-xl">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#2E5EFF] to-[#F5A623] flex items-center justify-center text-white shadow-lg">
              <Users size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Team & Personnel Management
              </h2>
              <p className="text-xs text-gray-400">
                Team capacity, leave planning, Work From Home (WFH) roster, and emergency contacts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => handleOpenModal()} className="gap-2 shadow-lg shadow-[#2E5EFF]/20">
            <Plus size={16} /> Update Member Status
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#0A1024] border border-[#15203D] shadow-md">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>Sprint Capacity</span>
            <CheckCircle2 size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">{capacityRate}%</div>
          <p className="text-[11px] text-gray-500 mt-1">{availableCount} of {totalCount} active members ready</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0A1024] border border-[#15203D] shadow-md">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>Work From Home</span>
            <Home size={16} className="text-[#2E5EFF]" />
          </div>
          <div className="text-2xl font-black text-[#8FA7FF]">{wfhCount}</div>
          <p className="text-[11px] text-gray-500 mt-1">{officeCount} currently in-office</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0A1024] border border-[#15203D] shadow-md">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>On Planned Leave</span>
            <CalendarCheck size={16} className="text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">{onLeaveCount}</div>
          <p className="text-[11px] text-gray-500 mt-1">Leave & PTO scheduled</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0A1024] border border-[#15203D] shadow-md">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>Total Personnel</span>
            <Briefcase size={16} className="text-[#F5A623]" />
          </div>
          <div className="text-2xl font-black text-white">{totalCount}</div>
          <p className="text-[11px] text-gray-500 mt-1">Across all product workspaces</p>
        </div>
      </div>

      {/* Control Bar: View Tabs + Search & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-[#0A1024] border border-[#15203D]">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#070B19] rounded-xl border border-[#172242]">
          <button
            onClick={() => setViewTab('roster')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewTab === 'roster' 
                ? 'bg-[#2E5EFF] text-white shadow-md' 
                : 'text-gray-400 hover:text-white hover:bg-[#111A33]'
            }`}
          >
            All Personnel ({team.length})
          </button>
          <button
            onClick={() => setViewTab('leave_planner')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewTab === 'leave_planner' 
                ? 'bg-[#2E5EFF] text-white shadow-md' 
                : 'text-gray-400 hover:text-white hover:bg-[#111A33]'
            }`}
          >
            Leave & PTO Planner ({onLeaveCount})
          </button>
          <button
            onClick={() => setViewTab('wfh_tracker')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewTab === 'wfh_tracker' 
                ? 'bg-[#2E5EFF] text-white shadow-md' 
                : 'text-gray-400 hover:text-white hover:bg-[#111A33]'
            }`}
          >
            WFH & Location Tracker ({wfhCount})
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search member, skill, role..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-[#070B19] border border-[#172242] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] w-48"
            />
          </div>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-[#070B19] border border-[#172242] rounded-xl px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF]"
          >
            <option value="All">All Statuses</option>
            <option value="Available">Available</option>
            <option value="OnLeave">On Leave</option>
            <option value="Partial">Partial Coverage</option>
            <option value="Unavailable">Unavailable</option>
          </select>

          <select
            value={filterLocation}
            onChange={e => setFilterLocation(e.target.value)}
            className="bg-[#070B19] border border-[#172242] rounded-xl px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF]"
          >
            <option value="All">All Locations</option>
            <option value="Office">Office</option>
            <option value="WFH">WFH (Remote)</option>
            <option value="Hybrid">Hybrid</option>
            <option value="Client Site">Client Site</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {viewTab === 'roster' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeam.map(member => {
            const initials = member.avatar_initials || (member.display_name || member.user_id).slice(0, 2).toUpperCase()
            return (
              <div 
                key={member.id} 
                className="p-6 rounded-3xl bg-[#0A1024] border border-[#1E2D52] hover:border-[#2E5EFF]/50 transition-all flex flex-col justify-between shadow-xl group"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#2E5EFF] to-[#F5A623] flex items-center justify-center font-black text-sm text-white shadow-md">
                        {initials}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white leading-tight">
                          {member.display_name || member.user_id}
                        </h3>
                        <span className="text-xs text-gray-400">{member.role}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenModal(member)} 
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#15203D] transition-colors"
                        title="Edit member"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button 
                        onClick={() => handleDelete(member.id, member.display_name || member.user_id)} 
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete record"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Status & Work Location Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    {getStatusBadge(member.status)}
                    {getLocationBadge(member.work_location)}
                  </div>

                  {/* Leave Details Banner if applicable */}
                  {member.leave_from && (
                    <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 mb-3 flex items-center gap-2">
                      <CalendarCheck size={16} className="shrink-0 text-rose-400" />
                      <div>
                        <span className="font-semibold block">Scheduled Leave:</span>
                        <span className="text-[11px] font-mono text-gray-300">
                          {new Date(member.leave_from).toLocaleDateString()} 
                          {member.leave_to ? ` to ${new Date(member.leave_to).toLocaleDateString()}` : ''}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Skills / Focus Tags */}
                  {member.skills_tags && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {member.skills_tags.split(',').map((tag, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[#111C3D] text-gray-300 border border-[#1E2D52]">
                          #{tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Sprint Notes */}
                  {member.notes && (
                    <p className="text-xs text-gray-400 bg-[#070B19] p-3 rounded-xl border border-[#15203D] mb-3 leading-relaxed">
                      "{member.notes}"
                    </p>
                  )}
                </div>

                {/* Footer Info: Phone, Email & Emergency Contact */}
                <div className="pt-3 border-t border-[#15203D] space-y-1.5 text-xs text-gray-500">
                  {member.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail size={12} className="text-gray-400 shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </div>
                  )}
                  {member.phone && (
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <Phone size={12} className="text-gray-400 shrink-0" />
                      <span>{member.phone}</span>
                    </div>
                  )}
                  {member.emergency_contact && (
                    <div className="flex items-center gap-2 text-[11px] text-amber-400/90 font-medium">
                      <AlertTriangle size={12} className="shrink-0" />
                      <span className="truncate">Emergency: {member.emergency_contact}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {filteredTeam.length === 0 && (
            <div className="col-span-3 p-12 text-center bg-[#0A1024] border border-[#1E2D52] rounded-3xl">
              <Users size={36} className="mx-auto text-gray-500 mb-3" />
              <p className="text-sm font-semibold text-gray-300">No team members match the filter criteria.</p>
              <p className="text-xs text-gray-500 mt-1">Try resetting the search or add a new team member status record.</p>
            </div>
          )}
        </div>
      )}

      {/* Leave & PTO Planner Table View */}
      {viewTab === 'leave_planner' && (
        <div className="rounded-3xl bg-[#0A1024] border border-[#1E2D52] overflow-hidden shadow-xl">
          <div className="p-5 border-b border-[#1E2D52] bg-[#070B19] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Leave & Planned Time Off Schedule</h3>
              <p className="text-xs text-gray-400">Track coverage gaps and release milestone conflicts</p>
            </div>
            <Button size="sm" onClick={() => handleOpenModal()} className="gap-2">
              <Plus size={14} /> Plan Leave
            </Button>
          </div>

          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1E2D52] bg-[#0D1429] text-gray-400 font-bold uppercase">
                <th className="p-4">Team Member</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4">Leave From</th>
                <th className="p-4">Leave To</th>
                <th className="p-4">Coverage Notes</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2D52]">
              {team.filter(m => m.leave_from || m.status === 'OnLeave').map(member => (
                <tr key={member.id} className="hover:bg-[#0E1738]">
                  <td className="p-4 font-bold text-white flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#2E5EFF] to-[#F5A623] flex items-center justify-center text-xs font-bold text-white">
                      {member.avatar_initials || (member.display_name || member.user_id).slice(0, 2).toUpperCase()}
                    </div>
                    <span>{member.display_name || member.user_id}</span>
                  </td>
                  <td className="p-4 text-gray-400">{member.role}</td>
                  <td className="p-4">{getStatusBadge(member.status)}</td>
                  <td className="p-4 font-mono text-gray-300">
                    {member.leave_from ? new Date(member.leave_from).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-4 font-mono text-gray-300">
                    {member.leave_to ? new Date(member.leave_to).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-4 text-gray-300 max-w-xs truncate">{member.notes || '—'}</td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => handleOpenModal(member)} 
                      className="px-3 py-1 rounded-lg bg-[#15203D] hover:bg-[#1E2D52] text-white font-semibold transition-colors mr-1.5"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {team.filter(m => m.leave_from || m.status === 'OnLeave').length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-500">
                    No active or upcoming leaves registered in the system.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* WFH & Work Location Tracker */}
      {viewTab === 'wfh_tracker' && (
        <div className="rounded-3xl bg-[#0A1024] border border-[#1E2D52] overflow-hidden shadow-xl">
          <div className="p-5 border-b border-[#1E2D52] bg-[#070B19] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Work From Home (WFH) & Office Location Tracker</h3>
              <p className="text-xs text-gray-400">View team distribution, hot-desking, and remote availability</p>
            </div>
          </div>

          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1E2D52] bg-[#0D1429] text-gray-400 font-bold uppercase">
                <th className="p-4">Member Name</th>
                <th className="p-4">Role</th>
                <th className="p-4">Current Location</th>
                <th className="p-4">Status</th>
                <th className="p-4">Contact Phone</th>
                <th className="p-4">Emergency Contact</th>
                <th className="p-4 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2D52]">
              {team.map(member => (
                <tr key={member.id} className="hover:bg-[#0E1738]">
                  <td className="p-4 font-bold text-white flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#2E5EFF] to-[#F5A623] flex items-center justify-center text-xs font-bold text-white">
                      {member.avatar_initials || (member.display_name || member.user_id).slice(0, 2).toUpperCase()}
                    </div>
                    <span>{member.display_name || member.user_id}</span>
                  </td>
                  <td className="p-4 text-gray-400">{member.role}</td>
                  <td className="p-4">{getLocationBadge(member.work_location)}</td>
                  <td className="p-4">{getStatusBadge(member.status)}</td>
                  <td className="p-4 font-mono text-gray-300">{member.phone || '—'}</td>
                  <td className="p-4 text-amber-400/90 font-medium">{member.emergency_contact || '—'}</td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => handleOpenModal(member)} 
                      className="px-3 py-1 rounded-lg bg-[#15203D] hover:bg-[#1E2D52] text-white font-semibold transition-colors"
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Update / Register Team Member Status Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingMember ? `Update Status: ${editingMember.display_name || editingMember.user_id}` : 'Register Team Member Status'}
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Record</Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Member Selection */}
          {!editingMember ? (
            <div>
              <label className="mb-1 text-xs font-semibold text-gray-300 block">Select Team Member</label>
              <select
                value={selectedUser}
                onChange={e => setSelectedUser(e.target.value)}
                className="w-full bg-[#070B19] border border-[#1E2D52] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2E5EFF]"
              >
                {userOptions.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.display_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <Input 
              label="Team Member" 
              value={customName} 
              onChange={e => setCustomName(e.target.value)} 
              disabled 
            />
          )}

          {/* Status & Work Location */}
          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Availability Status" 
              value={status} 
              onChange={e => setStatus(e.target.value as any)}
              options={[
                { label: 'Available (Active Capacity)', value: 'Available' },
                { label: 'On Leave / Vacation / PTO', value: 'OnLeave' },
                { label: 'Partial Coverage / Half-Day', value: 'Partial' },
                { label: 'Unavailable / Off-Grid', value: 'Unavailable' }
              ]} 
            />
            <Select 
              label="Working Mode / Location" 
              value={workLocation} 
              onChange={e => setWorkLocation(e.target.value as any)}
              options={[
                { label: 'Office (On-Premise)', value: 'Office' },
                { label: 'Work From Home (WFH)', value: 'WFH' },
                { label: 'Hybrid (Split Schedule)', value: 'Hybrid' },
                { label: 'Client Site Visit', value: 'Client Site' },
                { label: 'Business Travel', value: 'Travel' }
              ]} 
            />
          </div>

          {/* Leave Planning Date Range */}
          <div>
            <label className="mb-1 text-xs font-semibold text-gray-300 block">Planned Leave Dates (If applicable)</label>
            <div className="grid grid-cols-2 gap-3">
              <Input 
                label="From Date" 
                type="date" 
                value={leaveFrom} 
                onChange={e => setLeaveFrom(e.target.value)} 
              />
              <Input 
                label="To Date" 
                type="date" 
                value={leaveTo} 
                onChange={e => setLeaveTo(e.target.value)} 
              />
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-2 gap-3">
            <Input 
              label="Contact Phone" 
              placeholder="+1 (555) 019-2834" 
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
            />
            <Input 
              label="Emergency Contact (Name & Number)" 
              placeholder="e.g. Jane (Spouse) - 555-9821" 
              value={emergencyContact} 
              onChange={e => setEmergencyContact(e.target.value)} 
            />
          </div>

          {/* Skills & Focus Areas */}
          <Input 
            label="Domain / Skills Tags (Comma-separated)" 
            placeholder="e.g. Core Banking, Kafka, MQ, Settlement Engine" 
            value={skillsTags} 
            onChange={e => setSkillsTags(e.target.value)} 
          />

          {/* Notes */}
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-semibold text-gray-300">Sprint Coverage Notes & Instructions</label>
            <textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Working from home on sprint planning days. Handling critical MQ incident escalations."
              className="w-full bg-[#070B19] border border-[#1E2D52] rounded-xl px-3 py-2 text-xs text-white min-h-[70px] focus:outline-none focus:border-[#2E5EFF]"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

