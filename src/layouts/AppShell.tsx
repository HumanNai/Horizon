import React, { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProductStore } from '../store/productStore'
import { SyncStatusBar } from '../components/SyncStatusBar'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { SearchModal } from '../components/SearchModal'
import headerLogoDark from '../assets/header_logo_dark_bg.png'
import appIcon from '../assets/app_icon.png'
import { 
  LayoutDashboard, 
  Package, 
  ShieldAlert, 
  Puzzle, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Minus,
  Square,
  X as CloseIcon,
  Search,
  Bell,
  Sparkles,
  Command,
  UserCheck,
  Users,
  ChevronDown,
  CheckCircle2,
  Settings as SettingsIcon,
  Clock,
  CheckSquare
} from 'lucide-react'

import { Badge } from '../components/ui'
import { dbQuery, dbExecute } from '../store/dbClient'
import { useWindowMaximize, RestoreIcon } from '../hooks/useWindowMaximize'

export function AppShell() {
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1200)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [isNotifMenuOpen, setIsNotifMenuOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const { products, fetchProducts } = useProductStore()
  const { isMaximized, toggleMaximize } = useWindowMaximize()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setCollapsed(true)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const fetchNotifications = async () => {
    try {
      const isPO = user?.role === 'ProductOwner'
      const prodSubquery = isPO
        ? 'SELECT id FROM products'
        : 'SELECT id FROM products WHERE owner_id = ? OR owner_id = ? OR owner_id = ?'
      const prodParams = isPO ? [] : [user?.id, user?.username, user?.displayName]

      const prodCheck = isPO
        ? await dbQuery<any>('SELECT COUNT(*) as cnt FROM products')
        : await dbQuery<any>('SELECT COUNT(*) as cnt FROM products WHERE owner_id = ? OR owner_id = ? OR owner_id = ?', prodParams)

      if ((prodCheck[0]?.cnt || 0) === 0) {
        setNotifications([])
        return
      }

      let leadDays = 7
      let notifyRel = true
      let notifyTsk = true
      try {
        const sRows = await dbQuery<any>('SELECT key, value FROM app_settings')
        sRows.forEach(r => {
          if (r.key === 'deadline_lead_days') leadDays = parseInt(r.value, 10) || 7
          if (r.key === 'notify_releases') notifyRel = r.value !== 'false'
          if (r.key === 'notify_tasks') notifyTsk = r.value !== 'false'
        })
      } catch {}

      const notifs: any[] = []

      // 0. Dedicated Assignment notifications for logged-in user
      if (user) {
        try {
          const userNotifRows = await dbQuery<any>(
            `SELECT id, title, message, type, entity_type, entity_id, created_at as start_date, '' as product_name
             FROM user_notifications 
             WHERE (user_id = ? OR user_id = ? OR user_id = ?) AND read = 0
             ORDER BY created_at DESC LIMIT 20`,
            [user.id, user.username, user.displayName]
          )
          notifs.push(...userNotifRows)
        } catch (e) {
          console.warn('user_notifications query:', e)
        }
      }

      // 1. Release cutover notifications (scoped to products in view)
      if (notifyRel) {
        const relRows = await dbQuery<any>(
          `SELECT 
             ('rel-' || r.id) as id,
             ('Release Cutover: ' || r.name || ' (' || r.version || ')') as title,
             'Release' as type,
             r.target_date as start_date,
             p.name as product_name
           FROM releases r
           INNER JOIN products p ON r.product_id = p.id
           WHERE r.status NOT IN ('Released', 'Cancelled')
             AND r.target_date IS NOT NULL
             AND r.product_id IN (${prodSubquery})
             AND date(r.target_date) <= date('now', '+' || ? || ' days')
             AND date(r.target_date) >= date('now', '-1 day')
           ORDER BY r.target_date ASC`,
          [...prodParams, leadDays]
        )
        notifs.push(...relRows)
      }

      // 2. Task due notifications (scoped to user's products or tasks assigned to user)
      if (notifyTsk) {
        const taskRows = await dbQuery<any>(
          `SELECT 
             ('tsk-' || t.id) as id,
             ('Task Due: ' || t.title) as title,
             'Task' as type,
             t.due_date as start_date,
             p.name as product_name
           FROM tasks t
           INNER JOIN products p ON t.product_id = p.id
           WHERE t.status != 'Done'
             AND t.due_date IS NOT NULL
             AND (t.product_id IN (${prodSubquery}) ${!isPO ? 'OR t.assignee_id = ? OR t.assignee_id = ?' : ''})
             AND date(t.due_date) <= date('now', '+' || ? || ' days')
             AND date(t.due_date) >= date('now', '-1 day')
           ORDER BY t.due_date ASC`,
          isPO ? [leadDays] : [...prodParams, user?.username, user?.displayName, leadDays]
        )
        notifs.push(...taskRows)
      }

      // 3. Schedule events
      const schedRows = await dbQuery<any>(
        `SELECT s.id, s.title, s.type, s.start_date, '' as product_name
         FROM schedule_events s
         WHERE s.notified = 0 
           AND (s.linked_id IN (${prodSubquery}) 
             OR s.linked_id IN (SELECT id FROM releases WHERE product_id IN (${prodSubquery})))
           AND date(s.start_date) <= date('now', '+' || ? || ' days')
           AND date(s.start_date) >= date('now', '-1 day')
         ORDER BY s.start_date ASC`,
        [...prodParams, ...prodParams, leadDays]
      )
      notifs.push(...schedRows)

      // Filter out dismissed notifications
      const dismissed = JSON.parse(sessionStorage.getItem('horizon_dismissed_notifs') || '[]') as string[]
      const dismissedSet = new Set(dismissed)
      const filtered = notifs.filter(n => !dismissedSet.has(n.id))
      setNotifications(filtered)
    } catch {
      setNotifications([])
    }
  }

  useEffect(() => {
    fetchProducts()
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 10000)
    return () => clearInterval(interval)
  }, [fetchProducts])

  const handleDismissNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const dismissed = JSON.parse(sessionStorage.getItem('horizon_dismissed_notifs') || '[]') as string[]
      dismissed.push(id)
      sessionStorage.setItem('horizon_dismissed_notifs', JSON.stringify(dismissed))
      
      // Update user_notifications if it's an assignment notification
      try {
        await dbExecute('UPDATE user_notifications SET read = 1 WHERE id = ?', [id])
      } catch {}

      if (!id.startsWith('rel-') && !id.startsWith('tsk-')) {
        try {
          await dbExecute('UPDATE schedule_events SET notified = 1 WHERE id = ?', [id])
        } catch {}
      }
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      const allIds = notifications.map(n => n.id)
      sessionStorage.setItem('horizon_dismissed_notifs', JSON.stringify(allIds))
      if (user) {
        try {
          await dbExecute(
            'UPDATE user_notifications SET read = 1 WHERE user_id = ? OR user_id = ? OR user_id = ?',
            [user.id, user.username, user.displayName]
          )
        } catch {}
      }
      try {
        await dbExecute('UPDATE schedule_events SET notified = 1')
      } catch {}
      setNotifications([])
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const isPO = user?.role === 'ProductOwner'
  const isLead = user?.role === 'ProductLead'
  const isExec = user?.role === 'Management'

  const navItems = [
    { name: isExec ? 'Executive Oversight' : 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: isExec ? 'Applications (Oversight)' : 'Applications', path: '/products', icon: Package },
    // Plugins & Integrations, HR, Access, Audit: ONLY for Product Owner
    ...(isPO ? [
      { name: 'Plugins & Integrations', path: '/plugins', icon: Puzzle },
      { name: 'Team & HR', path: '/hr', icon: Users },
      { name: 'Role & Access (RBAC)', path: '/access', icon: UserCheck },
      { name: 'Audit Log', path: '/audit', icon: ShieldAlert }
    ] : []),
    { name: 'Settings', path: '/settings', icon: SettingsIcon }
  ]


  const handleWindowAction = (action: 'minimize' | 'maximize' | 'close') => {
    (window as any).horizon?.window?.[action]?.()
  }

  const activeItem = navItems.find(i => location.pathname.startsWith(i.path))
  const productMatch = location.pathname.match(/^\/products\/([^/]+)/)
  const currentProductId = productMatch ? productMatch[1] : null
  const currentProduct = currentProductId ? products.find(p => p.id === currentProductId) : null

  return (
    <div className="flex h-screen bg-[#070B19] text-gray-100 overflow-hidden font-sans selection:bg-[#2E5EFF]/30 selection:text-white">
      {/* Sleek Dark Sidebar */}
      <aside className={`transition-all duration-300 ease-in-out flex flex-col border-r border-[#15203D] bg-[#0A1024]/90 backdrop-blur-xl z-20 shrink-0 ${collapsed ? 'w-16' : 'w-56 lg:w-64'}`}>
        {/* Brand Header */}
        <div className="h-14 sm:h-16 flex items-center justify-between px-2.5 sm:px-3 border-b border-[#15203D] app-region-drag select-none">
          {!collapsed ? (
            <div className="flex items-center gap-2 app-region-no-drag cursor-pointer py-1" onClick={() => navigate('/dashboard')}>
              <img 
                src={headerLogoDark} 
                alt="Horizon Logo" 
                className="h-9 lg:h-11 w-auto max-w-[150px] lg:max-w-[190px] object-contain drop-shadow-md"
              />
            </div>
          ) : (
            <div className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center app-region-no-drag cursor-pointer hover:scale-105 transition-transform" onClick={() => navigate('/dashboard')}>
              <img 
                src={appIcon} 
                alt="Horizon" 
                className="w-9 h-9 object-contain rounded-xl shadow-lg"
              />
            </div>
          )}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#15203D] transition-colors app-region-no-drag"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname.startsWith(item.path)
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                  isActive 
                    ? 'bg-gradient-to-r from-[#2E5EFF]/20 to-[#2E5EFF]/5 text-[#6087FF] border border-[#2E5EFF]/30 shadow-[0_0_20px_rgba(46,94,255,0.15)]' 
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#111A33]/80'
                }`}
                title={collapsed ? item.name : undefined}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#2E5EFF] rounded-r-full shadow-[0_0_8px_#2E5EFF]" />
                )}
                <Icon size={18} className={`shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-[#2E5EFF]' : 'text-gray-400 group-hover:text-gray-200'}`} />
                {!collapsed && <span className="truncate">{item.name}</span>}
              </button>
            )
          })}
        </nav>

        {/* User Info & Footer */}
        <div className="p-3 border-t border-[#15203D] bg-[#070B19]/50">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} gap-2 p-2 rounded-xl bg-[#0F172E]/60 border border-[#172242]`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#2E5EFF] to-[#F5A623] flex items-center justify-center font-bold text-xs text-white shadow-sm shrink-0">
                {user?.avatarInitials || 'PO'}
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-white truncate">{user?.displayName || 'Product Owner'}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md mt-0.5 inline-block w-fit ${
                    user?.role === 'ProductOwner' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                    user?.role === 'ProductLead' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' :
                    user?.role === 'Management' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                    'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  }`}>
                    {user?.role === 'ProductOwner' ? 'Product Owner' :
                     user?.role === 'ProductLead' ? 'Product Lead' :
                     user?.role === 'Management' ? 'Executive' :
                     'Team Member'}
                  </span>
                </div>
              )}
            </div>
            {!collapsed && (
              <button 
                onClick={logout}
                className="text-gray-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#070B19]">
        {/* Unified Frameless Topbar */}
        <header className="h-14 sm:h-16 flex items-center justify-between px-3 sm:px-6 border-b border-[#15203D] bg-[#070B19] app-region-drag select-none z-30 gap-2">
          <div className="flex items-center gap-2 sm:gap-4 app-region-no-drag min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
              <img 
                src={appIcon} 
                alt="Horizon App Logo" 
                className="w-5 h-5 sm:w-6 sm:h-6 object-contain rounded-md shadow-sm shrink-0" 
              />
              <span className="hidden md:inline text-xs text-gray-500 font-mono tracking-wider uppercase">Horizon</span>
              <span className="hidden md:inline text-xs text-gray-600">/</span>

              {/* Application Context Switcher */}
              <div className="relative min-w-0">
                <button
                  onClick={() => setIsAppMenuOpen(!isAppMenuOpen)}
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0E1738] hover:bg-[#162347] border border-[#2E5EFF]/40 text-white transition-all shadow-md active:scale-95 min-w-0"
                >
                  <Package size={13} className="text-[#2E5EFF] shrink-0" />
                  <span className="max-w-[100px] sm:max-w-[140px] md:max-w-[180px] truncate">
                    {currentProduct ? currentProduct.name : (activeItem?.name || 'All Applications')}
                  </span>
                  <ChevronDown size={12} className={`text-gray-400 ml-0.5 shrink-0 transition-transform duration-200 ${isAppMenuOpen ? 'rotate-180 text-white' : ''}`} />
                </button>

                {isAppMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-black/40" 
                      onClick={() => setIsAppMenuOpen(false)} 
                    />
                    <div 
                      className="absolute left-0 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-[#0E1738] border-2 border-[#2E5EFF]/50 shadow-[0_20px_50px_rgba(0,0,0,0.95)] p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                    >
                      <div className="px-3 py-1.5 text-[11px] font-bold text-[#8FA7FF] uppercase tracking-wider flex items-center justify-between">
                        <span>Application Workspaces</span>
                        <span className="text-[10px] text-gray-400 font-normal">{products.length} total</span>
                      </div>
                      <button
                        onClick={() => { navigate('/products'); setIsAppMenuOpen(false); }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all ${
                          !currentProduct ? 'bg-[#2E5EFF] text-white font-bold shadow-md' : 'text-gray-200 hover:bg-[#192750] bg-[#111C3D]'
                        }`}
                      >
                        <span className="font-semibold flex items-center gap-2">🌐 Portfolio Catalog (All Apps)</span>
                      </button>
                      <div className="my-2 border-t border-[#1C2C59]" />
                      <div className="max-h-72 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                        {products.length === 0 ? (
                          <div className="p-4 text-center text-xs text-gray-400">No applications created yet</div>
                        ) : (
                          products.map(p => (
                            <button
                              key={p.id}
                              onClick={() => { navigate(`/products/${p.id}`); setIsAppMenuOpen(false); }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs text-left transition-all ${
                                currentProduct?.id === p.id 
                                  ? 'bg-[#2E5EFF] text-white font-bold shadow-md shadow-[#2E5EFF]/30' 
                                  : 'text-gray-200 hover:bg-[#192750] bg-[#111C3D]/80 hover:text-white'
                              }`}
                            >
                              <div className="truncate pr-2">
                                <span className="block truncate font-medium text-white">{p.name}</span>
                                <span className="text-[10px] text-gray-400 block mt-0.5">PM: {p.owner || 'Product Owner'}</span>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/60 font-mono text-gray-200 border border-white/10 shrink-0">
                                {p.type || 'Internal'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 app-region-no-drag shrink-0">
            {/* Quick Search - Command Palette Trigger */}
            <div 
              onClick={() => setIsSearchOpen(true)}
              className="relative hidden sm:flex items-center cursor-pointer group shrink-0"
            >
              <Search className="w-3.5 h-3.5 absolute left-3 text-gray-400 group-hover:text-white transition-colors pointer-events-none" />
              <input 
                type="text" 
                readOnly
                placeholder="Search..." 
                className="bg-[#0D1429] hover:bg-[#101830] border border-[#19264A] hover:border-[#2E5EFF]/60 rounded-xl pl-8 pr-10 py-1.5 text-xs text-gray-200 placeholder-gray-500 cursor-pointer w-28 md:w-36 lg:w-56 transition-all focus:outline-none"
              />
              <div className="absolute right-2 flex items-center gap-0.5 px-1 py-0.5 rounded bg-[#15203D] text-[9px] text-gray-400 border border-[#1E2D52] group-hover:border-[#2E5EFF]/40">
                <Command size={9} /> K
              </div>
            </div>

            {/* Sync Status Badge */}
            <div className="shrink-0">
              <SyncStatusBar />
            </div>

            {/* Notification Bell */}
            <div className="relative shrink-0">
              <button 
                onClick={() => setIsNotifMenuOpen(!isNotifMenuOpen)}
                className={`relative p-1.5 sm:p-2 rounded-xl text-gray-400 hover:text-white transition-colors ${
                  isNotifMenuOpen ? 'bg-[#15203D] text-white' : 'hover:bg-[#15203D]'
                }`}
                title="Notifications"
              >
                <Bell size={16} />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-[#F5A623] rounded-full ring-2 ring-[#0A1024] animate-pulse" />
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {isNotifMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotifMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-[#0D1429] border border-[#1C2B54] shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between border-b border-[#1A264D] pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <Bell size={15} className="text-[#F5A623]" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Notifications</span>
                        {notifications.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-[#F5A623]/20 text-[#F5A623] text-[10px] font-bold">
                            {notifications.length}
                          </span>
                        )}
                      </div>
                      {notifications.length > 0 && (
                        <button 
                          onClick={handleMarkAllRead}
                          className="text-[11px] text-[#2E5EFF] hover:underline font-medium"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-72 overflow-y-auto space-y-2 custom-scrollbar">
                      {notifications.length > 0 ? (
                        notifications.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => {
                              if (n.entity_type === 'UAT' || n.type === 'UAT') {
                                navigate('/uat')
                                setIsNotifMenuOpen(false)
                              } else if (n.type === 'Assignment' || n.type === 'Task' || n.entity_type === 'Task') {
                                navigate('/tasks')
                                setIsNotifMenuOpen(false)
                              } else if (n.type === 'Release' || n.entity_type === 'Release') {
                                navigate('/releases')
                                setIsNotifMenuOpen(false)
                              } else {
                                setIsNotifMenuOpen(false)
                              }
                            }}
                            className="p-2.5 rounded-xl bg-[#080D1F] border border-[#15203D] hover:border-[#2E5EFF]/50 hover:bg-[#0E1530] transition-colors cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-1.5 min-w-0">
                                {n.entity_type === 'UAT' || n.type === 'UAT' ? (
                                  <CheckCircle2 size={13} className="text-teal-400 shrink-0 mt-0.5" />
                                ) : n.type === 'Assignment' ? (
                                  <CheckSquare size={13} className="text-[#F5A623] shrink-0 mt-0.5" />
                                ) : n.type === 'Release' ? (
                                  <Package size={13} className="text-[#2E5EFF] shrink-0 mt-0.5" />
                                ) : (
                                  <Clock size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                                )}
                                <span className="text-xs font-semibold text-white leading-tight truncate">{n.title}</span>
                              </div>
                              <Badge variant={n.entity_type === 'UAT' || n.type === 'UAT' ? 'orange' : n.type === 'Release' ? 'blue' : n.type === 'Assignment' ? 'warning' : 'neutral'}>
                                {n.entity_type === 'UAT' ? 'Quality Gate' : n.type}
                              </Badge>
                            </div>
                            {n.message && (
                              <p className="text-[11px] text-gray-400 mt-1 leading-normal pl-4">{n.message}</p>
                            )}
                            <div className="flex items-center justify-between text-[10px] text-gray-500 mt-2 font-mono pl-4">
                              <span>{n.start_date ? new Date(n.start_date).toLocaleDateString() : 'Active'}</span>
                              <button 
                                onClick={(e) => handleDismissNotification(n.id, e)}
                                className="text-gray-400 hover:text-white transition-colors"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-6 text-center">
                          <CheckCircle2 size={24} className="mx-auto text-emerald-400/60 mb-2" />
                          <p className="text-xs font-semibold text-gray-300">No new notifications</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">You're all caught up!</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* Custom Frameless Window Controls */}
            <div className="flex items-center gap-0.5 border-l border-[#15203D] pl-1.5 sm:pl-2.5 ml-0.5 shrink-0">
              <button 
                onClick={() => handleWindowAction('minimize')} 
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Minimize"
              >
                <Minus size={13} />
              </button>
              <button 
                onClick={toggleMaximize} 
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                title={isMaximized ? "Restore" : "Maximize"}
              >
                {isMaximized ? <RestoreIcon size={11} /> : <Square size={11} />}
              </button>
              <button 
                onClick={() => handleWindowAction('close')} 
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-600 transition-colors"
                title="Close"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content Scroll Area */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 relative custom-scrollbar bg-gradient-to-b from-[#070B19] via-[#080D1F] to-[#070B19]">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Command Palette Search */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  )
}
