import React, { useEffect, useState } from 'react'
import { Card, Table, Badge, Button, Modal, Input, Select } from '../components/ui'
import { useAuthStore } from '../store/authStore'
import { getSessionToken } from '../store/dbClient'
import { 
  ShieldCheck, 
  UserCheck, 
  Users, 
  Plus, 
  Lock, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  Key, 
  AlertTriangle,
  UserPlus,
  ShieldAlert
} from 'lucide-react'
import { HorizonUser, UserRole } from '../types'

export function Access() {
  const currentUser = useAuthStore(state => state.user)
  const [users, setUsers] = useState<HorizonUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<HorizonUser | null>(null)

  // Form state
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('TeamMember')
  const [password, setPassword] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const token = getSessionToken()
      if (!token) return
      const list = await (window as any).horizon.auth.listUsers(token)
      setUsers(Array.isArray(list) ? list : [])
    } catch (err: any) {
      setError(err.message || 'Failed to load user roster')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (u?: HorizonUser) => {
    setError('')
    if (u) {
      setEditingUser(u)
      setUsername(u.username)
      setDisplayName(u.displayName)
      setEmail(u.email || '')
      setRole(u.role)
      setPassword('')
      setActive(u.active)
    } else {
      setEditingUser(null)
      setUsername('')
      setDisplayName('')
      setEmail('')
      setRole('TeamMember')
      setPassword('')
      setActive(true)
    }
    setIsModalOpen(true)
  }

  const handleSaveUser = async () => {
    if (!displayName.trim()) {
      setError('Display name is required')
      return
    }
    if (!editingUser && !username.trim()) {
      setError('Username is required')
      return
    }
    if (!editingUser && (!password.trim() || password.trim().length < 6)) {
      setError('Password must be at least 6 characters')
      return
    }

    try {
      const token = getSessionToken()
      if (!token) return

      if (editingUser) {
        await (window as any).horizon.auth.updateUser(token, editingUser.id, {
          displayName: displayName.trim(),
          role,
          email: email.trim() || undefined,
          active,
          password: password.trim() || undefined
        })
      } else {
        await (window as any).horizon.auth.createUser(token, {
          username: username.trim(),
          displayName: displayName.trim(),
          role,
          email: email.trim() || undefined,
          password: password.trim(),
          active
        })
      }

      setIsModalOpen(false)
      await loadUsers()
    } catch (err: any) {
      setError(err.message || 'Failed to save user account')
    }
  }

  const handleDeleteUser = async (userId: string, targetName: string) => {
    if (userId === currentUser?.id) {
      alert('You cannot delete your own logged-in administrator account.')
      return
    }

    if (confirm(`Permanently remove user account "${targetName}"? This action cannot be undone.`)) {
      try {
        const token = getSessionToken()
        if (!token) return
        await (window as any).horizon.auth.deleteUser(token, userId)
        setUsers(users.filter(u => u.id !== userId))
      } catch (err: any) {
        alert(err.message || 'Failed to remove user account')
      }
    }
  }

  const handleToggleActive = async (u: HorizonUser) => {
    if (u.id === currentUser?.id) {
      alert('You cannot deactivate your own account.')
      return
    }
    try {
      const token = getSessionToken()
      if (!token) return
      await (window as any).horizon.auth.updateUser(token, u.id, { active: !u.active })
      setUsers(users.map(item => item.id === u.id ? { ...item, active: !item.active } : item))
    } catch (err: any) {
      alert(err.message || 'Failed to update user status')
    }
  }

  if (currentUser?.role !== 'ProductOwner') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center max-w-sm mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
          <ShieldAlert size={28} />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Access Restricted</h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          Role-Based Access Control (RBAC) administration is reserved exclusively for the Product Owner role.
        </p>
      </div>
    )
  }

  const poCount = users.filter(u => u.role === 'ProductOwner').length
  const tmCount = users.filter(u => u.role === 'TeamMember').length
  const activeCount = users.filter(u => u.active).length

  // RBAC Matrix definitions
  const rbacMatrix = [
    { module: 'Product Portfolio', po: 'Create, Edit, Archive, View', tm: 'View all products', icon: 'Package' },
    { module: 'Release Pipelines', po: 'Create, Edit, Stage Transition, Delete', tm: 'View release roadmap', icon: 'GitMerge' },
    { module: 'Production Gate Sign-Off', po: 'Official Gate Sign-Off & Audit', tm: 'No approval authority', icon: 'ShieldCheck' },
    { module: 'Sprint Tasks & Kanban', po: 'Assign all, Manage, Delete any task', tm: 'Create tasks, Update own tasks', icon: 'CheckSquare' },
    { module: 'UAT & Quality Verification', po: 'Create scenarios, Sign-Off gate', tm: 'Execute test runs (Pass/Fail/Blocked)', icon: 'CheckCircle' },
    { module: 'Interface Inventory', po: 'Register contracts, Archive endpoints', tm: 'View connection URIs & schemas', icon: 'Network' },
    { module: 'AES-256 Secrets Vault', po: 'Unlock, Reveal, Rotate, Delete secrets', tm: 'No vault access (Restricted)', icon: 'Key' },
    { module: 'Team Availability & HR', po: 'Manage team roster, Register leave', tm: 'View sprint availability calendar', icon: 'Users' },
    { module: 'Activity & Audit Trail', po: 'Access immutable logs, Export CSV', tm: 'Access restricted', icon: 'Activity' },
    { module: 'Enterprise Connectors', po: 'Configure tenant, OAuth, Sync frequency', tm: 'View connector status only', icon: 'Settings' },
    { module: 'Role Management (RBAC)', po: 'Create users, Assign roles, Reset keys', tm: 'Self password change only', icon: 'UserCheck' }
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0A1024]/90 border border-[#15203D]">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="text-[#2E5EFF]" size={22} /> Role-Based Access Control (RBAC) & Team Management
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Manage user accounts, assign roles, enforce least-privilege policies, and govern team access.
          </p>
        </div>

        <Button onClick={() => handleOpenModal()} className="gap-2 shadow-lg shadow-[#2E5EFF]/20">
          <UserPlus size={16} /> Add User Account
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#0A1024]/80 border border-[#15203D] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[#6087FF]">
            <Users size={20} />
          </div>
          <div>
            <div className="text-xs text-gray-400">Total Accounts</div>
            <div className="text-xl font-black text-white">{users.length}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0A1024]/80 border border-[#15203D] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#F5A623]">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="text-xs text-gray-400">Product Owners (Admins)</div>
            <div className="text-xl font-black text-white">{poCount}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0A1024]/80 border border-[#15203D] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <UserCheck size={20} />
          </div>
          <div>
            <div className="text-xs text-gray-400">Team Members</div>
            <div className="text-xl font-black text-white">{tmCount}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0A1024]/80 border border-[#15203D] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="text-xs text-gray-400">Active Credentials</div>
            <div className="text-xl font-black text-white">{activeCount}</div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-[#0A1024]/90 border border-[#15203D] overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#15203D] flex items-center justify-between bg-[#0D1429]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users size={16} className="text-[#2E5EFF]" /> Team Member Accounts
          </h3>
          <span className="text-xs text-gray-400">Role-governed local credentials</span>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#15203D] bg-[#0A1024] text-gray-400 uppercase tracking-wider font-semibold">
              <th className="p-4">User</th>
              <th className="p-4">Username</th>
              <th className="p-4">Email</th>
              <th className="p-4">Assigned Role</th>
              <th className="p-4">Status</th>
              <th className="p-4">Created</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#15203D]">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-[#0E1736] transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#2E5EFF] to-[#F5A623] flex items-center justify-center font-bold text-xs text-white shadow-sm shrink-0">
                      {u.avatarInitials || (u.displayName ? u.displayName.substring(0, 2).toUpperCase() : 'U')}
                    </div>
                    <div>
                      <span className="font-bold text-white block">{u.displayName}</span>
                      {u.id === currentUser?.id && (
                        <span className="text-[10px] text-[#2E5EFF] font-semibold">Current Session</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-4 font-mono text-gray-300">
                  {u.username}
                </td>
                <td className="p-4 text-gray-400">
                  {u.email || '—'}
                </td>
                <td className="p-4">
                  <Badge variant={
                    u.role === 'ProductOwner' ? 'orange' :
                    u.role === 'ProductLead' ? 'warning' :
                    u.role === 'Management' ? 'success' :
                    'blue'
                  }>
                    {u.role === 'ProductOwner' ? 'Product Owner' :
                     u.role === 'ProductLead' ? 'Product Lead' :
                     u.role === 'Management' ? 'Upper Management' :
                     'Team Member'}
                  </Badge>
                </td>
                <td className="p-4">
                  <Badge variant={u.active ? 'success' : 'neutral'}>
                    {u.active ? 'Active' : 'Disabled'}
                  </Badge>
                </td>
                <td className="p-4 text-gray-400 font-mono">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => handleOpenModal(u)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#15203D] transition-colors"
                      title="Edit User & Role"
                    >
                      <Edit3 size={14} />
                    </button>
                    {u.id !== currentUser?.id && (
                      <>
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.active ? 'text-gray-400 hover:text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                          title={u.active ? 'Disable Account' : 'Enable Account'}
                        >
                          {u.active ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.displayName)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete User"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  No accounts found. Click "Add User Account" to register team members.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* RBAC Permission Boundary Matrix */}
      <div className="rounded-2xl bg-[#0A1024]/90 border border-[#15203D] overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#15203D] bg-[#0D1429] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-[#F5A623]" />
            <h3 className="text-sm font-bold text-white">RBAC Permission Matrix</h3>
          </div>
          <span className="text-xs text-gray-400">Strict least-privilege boundaries</span>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#15203D] bg-[#0A1024] text-gray-400 uppercase tracking-wider font-semibold">
              <th className="p-4">Platform Module</th>
              <th className="p-4">Product Owner Permission</th>
              <th className="p-4">Team Member Permission</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#15203D]">
            {rbacMatrix.map(m => (
              <tr key={m.module} className="hover:bg-[#0E1736] transition-colors">
                <td className="p-4 font-semibold text-white">
                  {m.module}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 size={14} className="shrink-0" />
                    <span>{m.po}</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2 text-gray-300">
                    {m.tm.includes('Restricted') || m.tm.includes('No') ? (
                      <XCircle size={14} className="text-red-400 shrink-0" />
                    ) : (
                      <CheckCircle2 size={14} className="text-blue-400 shrink-0" />
                    )}
                    <span className={m.tm.includes('Restricted') || m.tm.includes('No') ? 'text-gray-500' : ''}>
                      {m.tm}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? `Edit Account: ${editingUser.displayName}` : 'Create New Team Member Account'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveUser}>
              {editingUser ? 'Save Changes' : 'Create Account'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          {!editingUser && (
            <Input
              label="Username (Login ID)"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. s.connor"
              required
              autoFocus
            />
          )}

          <Input
            label="Full Display Name & Title"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="e.g. Sarah Connor (Lead QA Engineer)"
            required
            autoFocus={Boolean(editingUser)}
          />

          <Input
            label="Corporate Email Address"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="e.g. sconnor@company.com"
          />

          <Select
            label="RBAC Assigned Role"
            value={role}
            onChange={e => setRole(e.target.value as UserRole)}
            options={[
              { label: 'Product Owner (Full Administrative Authority across organization)', value: 'ProductOwner' },
              { label: 'Product Lead (Product-Level Authority & Sprint Management)', value: 'ProductLead' },
              { label: 'Team Member (Sprint Execution & Tasks)', value: 'TeamMember' },
              { label: 'Upper Management (Read-Only Executive Oversight)', value: 'Management' }
            ]}
          />

          <Input
            label={editingUser ? 'Reset Password (Leave blank to keep unchanged)' : 'Account Password'}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={editingUser ? 'Enter new password or leave empty' : 'Enter account password (min 6 chars)'}
          />

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="userActive"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              className="rounded border-[#19264A] bg-[#070B19] text-[#2E5EFF] focus:ring-0"
            />
            <label htmlFor="userActive" className="text-xs text-gray-300 select-none cursor-pointer">
              Account Active & Enabled for Authentication
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}

