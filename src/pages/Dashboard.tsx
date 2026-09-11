import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Table, Badge, Button } from '../components/ui'
import { PipelineBar } from '../components/PipelineBar'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { 
  Activity, 
  ArrowUpRight, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Plus, 
  Zap, 
  Layers, 
  ShieldAlert, 
  Users, 
  AlertTriangle, 
  GitMerge, 
  CheckSquare, 
  Eye, 
  Briefcase, 
  ChevronRight, 
  BarChart3, 
  TrendingUp 
} from 'lucide-react'
import { dbQuery, dbExecute } from '../store/dbClient'
import { useAuthStore } from '../store/authStore'

interface LeadPortfolio {
  leadId: string
  leadName: string
  role: string
  avatarInitials: string
  products: { id: string; name: string; type: string; status: string }[]
  activeReleases: { id: string; name: string; version: string; status: string; targetDate: string; productName?: string }[]
  tasksSummary: { todo: number; inProgress: number; blocked: number; done: number; total: number }
  health: 'Healthy' | 'Needs Attention'
}

interface BlockedTask {
  id: string
  title: string
  priority: string
  assignee: string
  productName: string
  productId: string
  dueDate: string
}

export function Dashboard() {
  const navigate = useNavigate()
  const currentUser = useAuthStore(state => state.user)
  const isPO = currentUser?.role === 'ProductOwner'
  const isManagement = currentUser?.role === 'Management'

  const [viewMode, setViewMode] = useState<'standard' | 'executive'>(() => {
    return currentUser?.role === 'Management' ? 'executive' : 'standard'
  })

  const [stats, setStats] = useState({
    totalProducts: 0,
    activeReleases: 0,
    openTasks: 0,
    qaPassRate: 0,
    teamAvailableCount: 0,
    totalTeamCount: 0
  })

  const [deadlines, setDeadlines] = useState<any[]>([])
  const [tasksByStatus, setTasksByStatus] = useState<any[]>([])
  const [activityLogs, setActivityLogs] = useState<any[]>([])
  const [latestRelease, setLatestRelease] = useState<any | null>(null)
  const [velocityData, setVelocityData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Executive Oversight specific state
  const [leadPortfolios, setLeadPortfolios] = useState<LeadPortfolio[]>([])
  const [executiveReleases, setExecutiveReleases] = useState<any[]>([])
  const [blockedTasks, setBlockedTasks] = useState<BlockedTask[]>([])
  const [totalBlockers, setTotalBlockers] = useState(0)

  const stepList = ['Planning', 'Development', 'QA', 'UAT', 'SignOff', 'Released']
  const getStepIndex = (st?: string) => st ? Math.max(0, stepList.indexOf(st)) : 0

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true)
      try {
        const user = useAuthStore.getState().user || currentUser
        const isPO = user?.role === 'ProductOwner'
        const isManagement = user?.role === 'Management'
        const isExecutive = isPO || isManagement

        // Executive & PO see all products across company; Team members/leads only scoped products
        const prodSubquery = isExecutive
          ? 'SELECT id FROM products'
          : 'SELECT id FROM products WHERE owner_id = ? OR owner_id = ? OR owner_id = ?'
        const prodParams = isExecutive ? [] : [user?.id, user?.username, user?.displayName]

        // Defensive automated orphan cleanup:
        // Only PO triggers full cleanup to ensure data integrity without race conditions
        if (isPO) {
          try {
            const prodCheck = await dbQuery<any>('SELECT COUNT(*) as count FROM products')
            const pCount = prodCheck[0]?.count || 0
            if (pCount === 0) {
              await dbExecute('DELETE FROM releases')
              await dbExecute('DELETE FROM tasks')
              await dbExecute('DELETE FROM uat_cases')
              await dbExecute('DELETE FROM interfaces')
              await dbExecute('DELETE FROM documents_meta')
              await dbExecute('DELETE FROM schedule_events')
              await dbExecute('DELETE FROM product_custom_sections')
              await dbExecute('DELETE FROM product_team_members')
            } else {
              await dbExecute('DELETE FROM releases WHERE product_id NOT IN (SELECT id FROM products)')
              await dbExecute("DELETE FROM tasks WHERE product_id IS NOT NULL AND product_id != '' AND product_id NOT IN (SELECT id FROM products)")
              await dbExecute('DELETE FROM uat_cases WHERE release_id NOT IN (SELECT id FROM releases)')
              await dbExecute('DELETE FROM interfaces WHERE product_id NOT IN (SELECT id FROM products)')
              await dbExecute("DELETE FROM documents_meta WHERE product_id IS NOT NULL AND product_id != '' AND product_id NOT IN (SELECT id FROM products)")
              await dbExecute("DELETE FROM schedule_events WHERE (linked_type = 'Product' AND linked_id NOT IN (SELECT id FROM products)) OR (linked_type = 'Release' AND linked_id NOT IN (SELECT id FROM releases))")
              await dbExecute('DELETE FROM product_custom_sections WHERE product_id NOT IN (SELECT id FROM products)')
              await dbExecute('DELETE FROM product_team_members WHERE product_id NOT IN (SELECT id FROM products)')
            }
          } catch (e) {
            console.warn('Orphan cleanup check:', e)
          }
        }

        // Products count (scoped or global)
        const prodRows = isExecutive
          ? await dbQuery<any>('SELECT COUNT(*) as count FROM products')
          : await dbQuery<any>('SELECT COUNT(*) as count FROM products WHERE owner_id = ? OR owner_id = ? OR owner_id = ?', prodParams)
        const totalProducts = prodRows[0]?.count || 0

        // Team Availability
        const hrRows = await dbQuery<any>('SELECT status, COUNT(*) as count FROM hr_records GROUP BY status')
        let totalTeam = 0
        let availableTeam = 0
        hrRows.forEach(r => {
          totalTeam += r.count
          if (r.status === 'Available') availableTeam += r.count
        })

        // Audit Log (Executive & PO see all, Team Member sees own)
        const logs = isExecutive
          ? await dbQuery<any>('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 6')
          : await dbQuery<any>('SELECT * FROM audit_log WHERE user_id = ? OR user_id = ? OR user_id = ? ORDER BY created_at DESC LIMIT 6', prodParams)
        setActivityLogs(logs)

        // Active releases count
        const relRows = await dbQuery<any>(
          `SELECT COUNT(*) as count FROM releases WHERE status NOT IN ('Released', 'Cancelled') AND product_id IN (${prodSubquery})`,
          prodParams
        )
        const activeReleases = relRows[0]?.count || 0

        // Latest Active Release in scope
        const latestRelRows = await dbQuery<any>(
          `SELECT r.*, p.name as product_name 
           FROM releases r 
           INNER JOIN products p ON r.product_id = p.id 
           WHERE r.status NOT IN ('Released', 'Cancelled') 
             AND r.product_id IN (${prodSubquery})
           ORDER BY r.target_date ASC LIMIT 1`,
          prodParams
        )
        setLatestRelease(latestRelRows[0] || null)

        // Tasks breakdown
        const taskRows = await dbQuery<any>(
          `SELECT status, COUNT(*) as count FROM tasks WHERE product_id IN (${prodSubquery}) GROUP BY status`,
          prodParams
        )
        let openCount = 0
        const statusMap: Record<string, number> = { Todo: 0, InProgress: 0, Blocked: 0, Done: 0 }
        taskRows.forEach(r => {
          statusMap[r.status] = r.count
          if (r.status !== 'Done') openCount += r.count
        })
        const hasTasks = Object.values(statusMap).some(v => v > 0)
        if (hasTasks) {
          setTasksByStatus([
            { name: 'To Do', value: statusMap.Todo || 0, color: '#4B5563' },
            { name: 'In Progress', value: statusMap.InProgress || 0, color: '#2E5EFF' },
            { name: 'Blocked', value: statusMap.Blocked || 0, color: '#EF4444' },
            { name: 'Done', value: statusMap.Done || 0, color: '#10B981' }
          ])
        } else {
          setTasksByStatus([])
        }

        // QA Pass Rate from UAT (support direct product-linked and release-linked test cases)
        const uatRows = await dbQuery<any>(
          `SELECT u.result, COUNT(*) as count 
           FROM uat_cases u 
           LEFT JOIN releases r ON u.release_id = r.id 
           WHERE (u.product_id IN (${prodSubquery}) OR r.product_id IN (${prodSubquery}))
           GROUP BY u.result`,
          [...prodParams, ...prodParams]
        )
        let uatTotal = 0
        let uatPass = 0
        uatRows.forEach(r => {
          uatTotal += r.count
          if (r.result === 'Pass') uatPass += r.count
        })
        const qaPassRate = uatTotal > 0 ? Math.round((uatPass / uatTotal) * 100) : 0

        setStats({
          totalProducts,
          activeReleases,
          openTasks: openCount,
          qaPassRate,
          teamAvailableCount: availableTeam,
          totalTeamCount: totalTeam || 4
        })

        // Upcoming Deadlines
        let leadDays = 7
        try {
          const sRow = await dbQuery<any>("SELECT value FROM app_settings WHERE key = 'deadline_lead_days'")
          if (sRow[0]?.value) leadDays = parseInt(sRow[0].value, 10) || 7
        } catch {}

        const upcomingReleases = await dbQuery<any>(
          `SELECT ('rel-' || r.id) as id, ('Release: ' || r.name || ' (' || r.version || ')') as title, 'Release' as type, r.target_date as start_date, r.id as linked_id
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

        const upcomingTasks = await dbQuery<any>(
          `SELECT ('tsk-' || t.id) as id, ('Task: ' || t.title) as title, 'Task' as type, t.due_date as start_date, t.id as linked_id
           FROM tasks t
           INNER JOIN products p ON t.product_id = p.id
           WHERE t.status != 'Done'
             AND t.due_date IS NOT NULL
             AND t.product_id IN (${prodSubquery})
             AND date(t.due_date) <= date('now', '+' || ? || ' days')
             AND date(t.due_date) >= date('now', '-1 day')
           ORDER BY t.due_date ASC`,
          [...prodParams, leadDays]
        )

        const schedRows = await dbQuery<any>(
          `SELECT s.id, s.title, s.type, s.start_date, s.linked_id
           FROM schedule_events s 
           WHERE (s.linked_id IN (${prodSubquery}) 
              OR s.linked_id IN (SELECT id FROM releases WHERE product_id IN (${prodSubquery})))
             AND date(s.start_date) <= date('now', '+' || ? || ' days')
             AND date(s.start_date) >= date('now', '-1 day')
           ORDER BY s.start_date ASC`,
          [...prodParams, ...prodParams, leadDays]
        )

        let mergedDeadlines = [...upcomingReleases, ...upcomingTasks, ...schedRows]
          .filter((item, index, self) => index === self.findIndex(t => t.id === item.id || (t.linked_id && t.linked_id === item.linked_id && t.type === item.type)))
          .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

        if (mergedDeadlines.length === 0) {
          const fallbackReleases = await dbQuery<any>(
            `SELECT ('rel-' || r.id) as id, ('Release: ' || r.name || ' (' || r.version || ')') as title, 'Release' as type, r.target_date as start_date, r.id as linked_id
             FROM releases r
             WHERE r.status NOT IN ('Released', 'Cancelled')
               AND r.target_date IS NOT NULL
               AND r.product_id IN (${prodSubquery})
             ORDER BY r.target_date ASC LIMIT 5`,
            prodParams
          )
          mergedDeadlines = fallbackReleases
        }

        setDeadlines(mergedDeadlines.slice(0, 6).map(s => ({
          id: s.id,
          title: s.title,
          type: s.type,
          startDate: s.start_date,
          linkedId: s.linked_id
        })))

        // Dynamic Velocity Trend Data
        const allReleases = await dbQuery<any>(
          `SELECT * FROM releases WHERE product_id IN (${prodSubquery}) ORDER BY target_date ASC`,
          prodParams
        )
        if (allReleases.length > 0) {
          const points = allReleases.map((rel, idx) => ({
            sprint: rel.version || `Rel ${idx + 1}`,
            completed: rel.status === 'Released' ? 10 : (rel.status === 'UAT' || rel.status === 'SignOff') ? 7 : 3,
            target: 10
          }))
          setVelocityData(points)
        } else {
          setVelocityData([])
        }

        // --- Executive Oversight Specific Data Aggregation ---
        if (isExecutive) {
          const allProds = await dbQuery<any>('SELECT * FROM products ORDER BY name ASC')
          const allRels = await dbQuery<any>(
            `SELECT r.*, p.name as product_name 
             FROM releases r 
             INNER JOIN products p ON r.product_id = p.id 
             ORDER BY r.target_date ASC`
          )
          const allTasksRaw = await dbQuery<any>(
            `SELECT t.*, p.name as product_name 
             FROM tasks t 
             LEFT JOIN products p ON t.product_id = p.id`
          )
          const allUsers = await dbQuery<any>('SELECT id, username, display_name, role, avatar_initials, email FROM users')

          // Extract all blocked tasks across company for immediate executive blocker triage
          const rawBlocked = allTasksRaw.filter((t: any) => t.status === 'Blocked')
          setBlockedTasks(rawBlocked.map((t: any) => ({
            id: t.id,
            title: t.title,
            priority: t.priority || 'Medium',
            assignee: t.assignee_id || 'Unassigned',
            productName: t.product_name || 'General',
            productId: t.product_id || '',
            dueDate: t.due_date || ''
          })))
          setTotalBlockers(rawBlocked.length)

          // Map products to owners / leads
          const leadMap = new Map<string, { user: any; products: any[] }>()

          allUsers.forEach((u: any) => {
            if (u.role === 'ProductLead' || u.role === 'ProductOwner') {
              leadMap.set(u.id, { user: u, products: [] })
            }
          })

          allProds.forEach((p: any) => {
            let ownerKey: string | undefined = Array.from(leadMap.keys()).find(k => {
              const item = leadMap.get(k)
              return item && (item.user.id === p.owner_id || item.user.username === p.owner_id || item.user.display_name === p.owner_id)
            })

            if (!ownerKey && p.owner_id) {
              const matched = allUsers.find((u: any) => u.id === p.owner_id || u.username === p.owner_id || u.display_name === p.owner_id)
              const resolvedKey: string = matched?.id ? String(matched.id) : String(p.owner_id)
              ownerKey = resolvedKey
              if (matched) {
                leadMap.set(resolvedKey, { user: matched, products: [] })
              } else {
                leadMap.set(resolvedKey, {
                  user: { 
                    id: p.owner_id, 
                    display_name: p.owner_id, 
                    role: 'ProductLead', 
                    avatar_initials: String(p.owner_id).slice(0, 2).toUpperCase() 
                  },
                  products: []
                })
              }
            }

            if (ownerKey && leadMap.has(ownerKey)) {
              leadMap.get(ownerKey)!.products.push(p)
            }
          })

          const portfolios: LeadPortfolio[] = []

          leadMap.forEach(({ user: u, products: prods }, key) => {
            if (prods.length === 0 && u.role !== 'ProductOwner') return

            const prodIds = new Set(prods.map(p => p.id))
            const prodReleases = allRels.filter((r: any) => prodIds.has(r.product_id) && r.status !== 'Released' && r.status !== 'Cancelled')
            const prodTasks = allTasksRaw.filter((t: any) => prodIds.has(t.product_id))

            let todo = 0, inProgress = 0, blocked = 0, done = 0
            prodTasks.forEach((t: any) => {
              if (t.status === 'Todo') todo++
              else if (t.status === 'InProgress') inProgress++
              else if (t.status === 'Blocked') blocked++
              else if (t.status === 'Done') done++
            })

            portfolios.push({
              leadId: key,
              leadName: u.display_name || u.username || 'Product Lead',
              role: u.role || 'ProductLead',
              avatarInitials: u.avatar_initials || (u.display_name ? u.display_name.slice(0, 2).toUpperCase() : 'PL'),
              products: prods.map((p: any) => ({ id: p.id, name: p.name, type: p.type || 'Internal', status: p.status || 'Active' })),
              activeReleases: prodReleases.map((r: any) => ({ 
                id: r.id, 
                name: r.name, 
                version: r.version, 
                status: r.status, 
                targetDate: r.target_date,
                productName: r.product_name 
              })),
              tasksSummary: { todo, inProgress, blocked, done, total: prodTasks.length },
              health: blocked > 0 ? 'Needs Attention' : 'Healthy'
            })
          })

          portfolios.sort((a, b) => b.products.length - a.products.length)
          setLeadPortfolios(portfolios)
          setExecutiveReleases(allRels.filter((r: any) => r.status !== 'Cancelled'))
        }
      } catch (err) {
        console.error('Failed to load live dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── View Toggle Header (PO can switch; Management is locked to Executive) ── */}
      {isPO && (
        <div className="flex items-center justify-between pb-2 border-b border-[#1E2D52]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dashboard View Mode:</span>
            <div className="flex bg-[#070B19] p-1 rounded-xl border border-[#1E2D52]">
              <button
                onClick={() => setViewMode('standard')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'standard'
                    ? 'bg-[#2E5EFF] text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                📊 Standard Telemetry
              </button>
              <button
                onClick={() => setViewMode('executive')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'executive'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                👔 Executive Oversight
              </button>
            </div>
          </div>
          <span className="text-xs text-gray-500 italic">Portfolio-wide intelligence active</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── VIEW 1: EXECUTIVE OVERSIGHT (Default for Management, PO toggle) ─── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'executive' ? (
        <div className="space-y-6">
          {/* Executive Hero Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0C142E] via-[#101C3F] to-[#0A1024] border border-[#1E2D52] p-6 shadow-2xl shadow-black/40">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E5EFF]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="warning" className="gap-1.5 font-bold">
                    <ShieldAlert size={12} /> Executive Read-Only Oversight
                  </Badge>
                  <span className="text-xs text-gray-400">· Cross-Portfolio Management</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Executive Portfolio Oversight
                </h2>
                <p className="text-xs text-gray-300 mt-1 max-w-2xl leading-relaxed">
                  Real-time visibility into all product managers and leads, active application roadmaps, sprint throughput, and blocker escalations. All mutations disabled in executive oversight mode.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={() => navigate('/products')} 
                  className="gap-1.5 text-xs border-[#233566] hover:bg-[#152042]"
                >
                  <Eye size={13} /> View All Applications ({stats.totalProducts})
                </Button>
              </div>
            </div>
          </div>

          {/* Executive Top Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Total Applications */}
            <div 
              onClick={() => navigate('/products')}
              className="p-4 rounded-xl bg-[#0D1429]/90 border border-[#1A264D] hover:border-[#2E5EFF]/50 cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Applications</span>
              <div className="text-2xl font-black text-white">{stats.totalProducts}</div>
              <span className="text-[10px] text-[#2E5EFF] font-medium mt-1 block">Active Portfolios</span>
            </div>

            {/* Product Managers & Leads */}
            <div className="p-4 rounded-xl bg-[#0D1429]/90 border border-[#1A264D]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Product Leads</span>
              <div className="text-2xl font-black text-purple-400">{leadPortfolios.length}</div>
              <span className="text-[10px] text-purple-300 font-medium mt-1 block">Managing Products</span>
            </div>

            {/* Active Releases */}
            <div 
              onClick={() => navigate('/releases')}
              className="p-4 rounded-xl bg-[#0D1429]/90 border border-[#1A264D] hover:border-[#F5A623]/50 cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Active Releases</span>
              <div className="text-2xl font-black text-[#F5A623]">{stats.activeReleases}</div>
              <span className="text-[10px] text-[#F5A623] font-medium mt-1 block">In Pipeline Stream</span>
            </div>

            {/* Open Sprint Tasks */}
            <div 
              onClick={() => navigate('/tasks')}
              className="p-4 rounded-xl bg-[#0D1429]/90 border border-[#1A264D] hover:border-blue-500/50 cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Sprint Tasks</span>
              <div className="text-2xl font-black text-blue-400">{stats.openTasks}</div>
              <span className="text-[10px] text-blue-300 font-medium mt-1 block">Across All Teams</span>
            </div>

            {/* QA Pass Rate */}
            <div 
              onClick={() => navigate('/uat')}
              className="p-4 rounded-xl bg-[#0D1429]/90 border border-[#1A264D] hover:border-emerald-500/50 cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">QA Pass Rate</span>
              <div className="text-2xl font-black text-emerald-400">{stats.qaPassRate}%</div>
              <span className="text-[10px] text-emerald-300 font-medium mt-1 block">UAT Quality Gate</span>
            </div>

            {/* Blockers */}
            <div className={`p-4 rounded-xl border transition-all ${
              totalBlockers > 0 
                ? 'bg-red-500/10 border-red-500/40 text-red-400 shadow-lg shadow-red-500/10' 
                : 'bg-[#0D1429]/90 border-[#1A264D] text-gray-300'
            }`}>
              <span className="text-[11px] font-semibold uppercase tracking-wider block mb-1">Blockers</span>
              <div className="text-2xl font-black">{totalBlockers}</div>
              <span className="text-[10px] font-medium mt-1 block">
                {totalBlockers > 0 ? 'Requires Attention' : 'All Streams Clear'}
              </span>
            </div>
          </div>

          {/* ── Section: Product Managers & Leads Activity Matrix ── */}
          <div className="rounded-2xl bg-[#0A1024]/90 border border-[#15203D] p-5 sm:p-6 shadow-xl shadow-black/20 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#15203D] pb-4">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Briefcase size={18} className="text-[#2E5EFF]" /> Product Managers & Leads Activity Matrix
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Overview of which product manager/lead is driving each application, in-flight releases, and task throughput.
                </p>
              </div>
              <span className="text-xs font-mono text-gray-400 bg-[#070B19] px-3 py-1 rounded-lg border border-[#1E2D52]">
                {leadPortfolios.length} Leads Active
              </span>
            </div>

            {leadPortfolios.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {leadPortfolios.map(lead => {
                  const totalTasks = lead.tasksSummary.total
                  const donePercent = totalTasks > 0 ? Math.round((lead.tasksSummary.done / totalTasks) * 100) : 0

                  return (
                    <div 
                      key={lead.leadId}
                      className="p-4 rounded-2xl bg-[#0E152E]/80 border border-[#182348] hover:border-[#2E5EFF]/40 transition-all flex flex-col justify-between space-y-4 group"
                    >
                      <div>
                        {/* Lead Profile Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#2E5EFF] to-[#F5A623] flex items-center justify-center font-black text-white text-xs shadow-md shrink-0">
                              {lead.avatarInitials}
                            </div>
                            <div className="min-w-0">
                              <span className="text-sm font-bold text-white block truncate">{lead.leadName}</span>
                              <Badge variant={lead.role === 'ProductOwner' ? 'warning' : 'blue'} className="text-[10px] mt-0.5">
                                {lead.role === 'ProductOwner' ? 'Product Owner' : 'Product Lead'}
                              </Badge>
                            </div>
                          </div>

                          {lead.health === 'Needs Attention' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 shrink-0">
                              <AlertTriangle size={10} /> {lead.tasksSummary.blocked} Blocked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                              <CheckCircle2 size={10} /> Healthy
                            </span>
                          )}
                        </div>

                        {/* Owned Applications */}
                        <div className="space-y-1.5 my-3">
                          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
                            Applications Led ({lead.products.length})
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {lead.products.map(p => (
                              <button
                                key={p.id}
                                onClick={() => navigate(`/products/${p.id}`)}
                                className="px-2 py-0.5 rounded-lg bg-[#070B19] hover:bg-[#152042] border border-[#1E2D52] hover:border-[#2E5EFF]/50 text-xs font-medium text-gray-300 hover:text-white transition-colors"
                              >
                                {p.name}
                              </button>
                            ))}
                            {lead.products.length === 0 && (
                              <span className="text-xs text-gray-500 italic">No assigned applications</span>
                            )}
                          </div>
                        </div>

                        {/* In-Flight Releases */}
                        <div className="space-y-1.5 my-3">
                          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
                            In-Flight Releases ({lead.activeReleases.length})
                          </span>
                          <div className="space-y-1">
                            {lead.activeReleases.slice(0, 2).map(r => (
                              <div key={r.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#070B19] border border-[#15203D]">
                                <span className="font-semibold text-white truncate max-w-[140px]">{r.name} ({r.version})</span>
                                <Badge variant={r.status === 'SignOff' ? 'orange' : 'blue'} className="text-[10px]">
                                  {r.status}
                                </Badge>
                              </div>
                            ))}
                            {lead.activeReleases.length === 0 && (
                              <span className="text-xs text-gray-500 italic">No active releases</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Task Velocity Mini Bar */}
                      <div className="pt-3 border-t border-[#182348] space-y-2">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-gray-400">Sprint Backlog ({totalTasks} tasks)</span>
                          <span className="font-bold text-white">{donePercent}% Done</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-[#131C38] overflow-hidden flex">
                          <div style={{ width: `${donePercent}%` }} className="h-full bg-emerald-500" />
                          <div style={{ width: `${totalTasks > 0 ? (lead.tasksSummary.inProgress / totalTasks) * 100 : 0}%` }} className="h-full bg-[#2E5EFF]" />
                          <div style={{ width: `${totalTasks > 0 ? (lead.tasksSummary.blocked / totalTasks) * 100 : 0}%` }} className="h-full bg-red-500" />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                          <span className="text-emerald-400">{lead.tasksSummary.done} Done</span>
                          <span className="text-[#6087FF]">{lead.tasksSummary.inProgress} Prog</span>
                          <span className="text-gray-400">{lead.tasksSummary.todo} Todo</span>
                          {lead.tasksSummary.blocked > 0 && <span className="text-red-400 font-bold">{lead.tasksSummary.blocked} Blocked</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-gray-500 bg-[#070B19] rounded-xl border border-[#1E2D52]">
                No product managers or leads registered yet.
              </div>
            )}
          </div>

          {/* ── Section: Consolidated Enterprise Release Roadmaps ── */}
          <div className="rounded-2xl bg-[#0A1024]/90 border border-[#15203D] p-5 sm:p-6 shadow-xl shadow-black/20 space-y-4">
            <div className="flex items-center justify-between border-b border-[#15203D] pb-4">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <GitMerge size={18} className="text-[#F5A623]" /> Consolidated Enterprise Release Roadmaps
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Active delivery streams and cutover gates across all engineering pipelines.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => navigate('/releases')} className="text-xs">
                Releases View →
              </Button>
            </div>

            <div className="space-y-3">
              {executiveReleases.filter(r => r.status !== 'Released').slice(0, 5).map(rel => (
                <div 
                  key={rel.id}
                  onClick={() => navigate(`/products/${rel.product_id}`)}
                  className="p-4 rounded-2xl bg-[#0E152E]/70 hover:bg-[#131D40] border border-[#172242] transition-all cursor-pointer group space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#2E5EFF]/10 border border-[#2E5EFF]/20 flex items-center justify-center text-[#2E5EFF]">
                        <GitMerge size={16} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white group-hover:text-[#6087FF] transition-colors">{rel.name}</span>
                          <span className="text-xs font-mono text-gray-400">({rel.version})</span>
                          <Badge variant="blue" className="text-[10px]">{rel.product_name}</Badge>
                        </div>
                        <span className="text-xs text-gray-400 mt-0.5 block">
                          Target Cutover: {rel.target_date ? new Date(rel.target_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                        </span>
                      </div>
                    </div>
                    <Badge variant={rel.status === 'SignOff' ? 'orange' : rel.status === 'UAT' ? 'warning' : 'blue'}>
                      {rel.status}
                    </Badge>
                  </div>

                  <div className="pt-1">
                    <PipelineBar activeStep={getStepIndex(rel.status)} size="sm" />
                  </div>
                </div>
              ))}

              {executiveReleases.length === 0 && (
                <div className="p-8 text-center text-xs text-gray-500 bg-[#070B19] rounded-xl border border-[#1E2D52]">
                  No active releases scheduled across applications.
                </div>
              )}
            </div>
          </div>

          {/* ── Section: Escalation & Blocker Triage Feed ── */}
          <div className="rounded-2xl bg-[#0A1024]/90 border border-[#15203D] p-5 sm:p-6 shadow-xl shadow-black/20 space-y-4">
            <div className="flex items-center justify-between border-b border-[#15203D] pb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className={totalBlockers > 0 ? 'text-red-400' : 'text-emerald-400'} />
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Enterprise Blockers & Escalations</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Tasks currently marked as blocked across all engineering workstreams.</p>
                </div>
              </div>
              <Badge variant={totalBlockers > 0 ? 'danger' : 'success'}>
                {totalBlockers} Blockers Active
              </Badge>
            </div>

            {blockedTasks.length > 0 ? (
              <div className="space-y-2.5">
                {blockedTasks.map(b => (
                  <div 
                    key={b.id} 
                    onClick={() => b.productId && navigate(`/products/${b.productId}`)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 transition-colors cursor-pointer gap-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                      <div>
                        <span className="text-sm font-semibold text-white block">{b.title}</span>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                          <span className="text-red-300 font-medium">App: {b.productName}</span>
                          <span>·</span>
                          <span>Assignee: {b.assignee}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="danger" className="text-[10px]">Priority: {b.priority}</Badge>
                      {b.dueDate && (
                        <span className="text-xs font-mono text-gray-400">Due: {b.dueDate}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center justify-center gap-2">
                <CheckCircle2 size={16} /> No blocked tasks across any application delivery streams. All systems clear.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════════ */
        /* ── VIEW 2: STANDARD TELEMETRY DASHBOARD ────────────────────────────── */
        /* ══════════════════════════════════════════════════════════════════════ */
        <>
          {/* Top Banner Hero with Pipeline Flow or Empty State */}
          {stats.totalProducts === 0 ? (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0E1733] via-[#101A3D] to-[#0A1024] border border-[#1B2952] p-5 sm:p-8 text-center shadow-xl shadow-black/40">
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#2E5EFF]/10 border border-[#2E5EFF]/20 flex items-center justify-center mx-auto text-[#2E5EFF]">
                  <Layers size={22} />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">No Active Applications</h2>
                <p className="text-xs text-gray-400 leading-relaxed">
                  No products or applications configured in the portfolio yet. Create your first application to start tracking release pipelines, sprint tasks, APIs, and roadmap metrics.
                </p>
                {!isManagement ? (
                  <Button size="sm" onClick={() => navigate('/products')} className="mt-2 shadow-lg shadow-[#2E5EFF]/20 gap-1.5">
                    <Plus size={15} /> Create Application
                  </Button>
                ) : (
                  <span className="text-xs text-amber-400 font-medium">Executive Read-Only Mode</span>
                )}
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0E1733] via-[#101A3D] to-[#0A1024] border border-[#1B2952] p-4 sm:p-6 shadow-xl shadow-black/40">
              <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E5EFF]/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4 sm:mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-[#2E5EFF]/20 text-[#6087FF] border border-[#2E5EFF]/30 flex items-center gap-1.5">
                      <Zap size={10} className="text-[#F5A623]" /> Active Pipeline Tracking
                    </span>
                    <span className="text-[11px] text-gray-400">· Horizon Release Cycle</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {latestRelease ? `${latestRelease.name} (${latestRelease.version})` : 'Application Delivery Portfolio'}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {latestRelease 
                      ? `Active deployment stream for ${latestRelease.product_name || 'Application'}. Status: ${latestRelease.status}.`
                      : 'All applications healthy and synchronized. Create a release in an application workspace to activate pipeline telemetry.'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={() => navigate('/products')} className="shadow-lg shadow-[#2E5EFF]/20 text-xs gap-1.5">
                    View Applications <ArrowRight size={13} />
                  </Button>
                </div>
              </div>

              {/* Global Pipeline Stepper */}
              <div className="pt-2 px-1 sm:px-2">
                <PipelineBar activeStep={getStepIndex(latestRelease?.status)} size="sm" />
              </div>
            </div>
          )}

          {/* KPI Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Products Card */}
            <div 
              onClick={() => navigate('/products')}
              className="group relative overflow-hidden rounded-xl bg-[#0D1429]/90 hover:bg-[#111B38] border border-[#1A264D] hover:border-[#2E5EFF]/50 p-3.5 sm:p-5 cursor-pointer transition-all duration-300 hover:shadow-[0_0_25px_rgba(46,94,255,0.15)] hover:-translate-y-0.5"
            >
              <div className="flex justify-between items-start mb-2 sm:mb-3">
                <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-400">Total Products</span>
                <div className="p-1.5 rounded-lg bg-[#2E5EFF]/10 text-[#2E5EFF] group-hover:bg-[#2E5EFF] group-hover:text-white transition-colors">
                  <ArrowUpRight size={14} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{stats.totalProducts}</div>
              <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-1.5 truncate">
                <span className="text-[#2E5EFF] font-medium">Internal & External</span> active
              </div>
            </div>

            {/* Active Releases Card */}
            <div 
              onClick={() => navigate('/releases')}
              className="group relative overflow-hidden rounded-xl bg-[#0D1429]/90 hover:bg-[#111B38] border border-[#1A264D] hover:border-[#F5A623]/50 p-3.5 sm:p-5 cursor-pointer transition-all duration-300 hover:shadow-[0_0_25px_rgba(245,166,35,0.15)] hover:-translate-y-0.5"
            >
              <div className="flex justify-between items-start mb-2 sm:mb-3">
                <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-400">Active Releases</span>
                <div className="p-1.5 rounded-lg bg-[#F5A623]/10 text-[#F5A623] group-hover:bg-[#F5A623] group-hover:text-black transition-colors">
                  <ArrowUpRight size={14} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{stats.activeReleases}</div>
              <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-1.5 truncate">
                <span className="text-[#F5A623] font-medium">Pipeline gates</span> active
              </div>
            </div>

            {/* Open Tasks Card -> Routes directly to Kanban tasks */}
            <div 
              onClick={() => navigate('/tasks')}
              className="group relative overflow-hidden rounded-xl bg-[#0D1429]/90 hover:bg-[#111B38] border border-[#1A264D] hover:border-[#2E5EFF]/50 p-3.5 sm:p-5 cursor-pointer transition-all duration-300 hover:shadow-[0_0_25px_rgba(46,94,255,0.15)] hover:-translate-y-0.5"
            >
              <div className="flex justify-between items-start mb-2 sm:mb-3">
                <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-400">Open Tasks</span>
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-[#2E5EFF] group-hover:text-white transition-colors">
                  <ArrowUpRight size={14} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{stats.openTasks}</div>
              <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-1.5 truncate">
                <span className="text-blue-400 font-medium">Kanban boards</span> ready
              </div>
            </div>

            {/* QA Pass Rate Card */}
            <div 
              onClick={() => navigate('/uat')}
              className="group relative overflow-hidden rounded-xl bg-[#0D1429]/90 hover:bg-[#111B38] border border-[#1A264D] hover:border-emerald-500/50 p-3.5 sm:p-5 cursor-pointer transition-all duration-300 hover:shadow-[0_0_25px_rgba(16,185,129,0.15)] hover:-translate-y-0.5"
            >
              <div className="flex justify-between items-start mb-2 sm:mb-3">
                <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-400">QA Pass Rate</span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <CheckCircle2 size={14} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tracking-tight">{stats.qaPassRate}%</div>
              <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-1.5 truncate">
                <span className="text-emerald-400 font-medium">Live UAT telemetry</span>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
            {/* Release Velocity Trend Line Chart */}
            <div className="xl:col-span-2 rounded-2xl bg-[#0A1024]/90 border border-[#15203D] p-4 sm:p-6 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Release Velocity & Throughput</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Cumulative feature completions vs sprint targets</p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#2E5EFF]" /> Completed</div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#F5A623]" /> Target</div>
                </div>
              </div>
              {velocityData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={velocityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#131C38" />
                      <XAxis dataKey="sprint" stroke="#4A5578" fontSize={11} tickLine={false} />
                      <YAxis stroke="#4A5578" fontSize={11} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#0D1429', 
                          borderColor: '#2E5EFF', 
                          borderRadius: '10px', 
                          color: '#FFFFFF',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                          padding: '8px 12px'
                        }} 
                        itemStyle={{ color: '#FFFFFF', fontSize: '12px', fontWeight: 'bold' }}
                        labelStyle={{ color: '#FFFFFF', fontWeight: 'bold' }}
                      />
                      <Line type="monotone" dataKey="completed" stroke="#2E5EFF" strokeWidth={3} dot={{ fill: '#2E5EFF', r: 4 }} activeDot={{ r: 6, fill: '#6087FF' }} />
                      <Line type="monotone" dataKey="target" stroke="#F5A623" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#15203D] rounded-2xl bg-[#080D1F]/40">
                  <span className="text-xs font-semibold text-gray-400">No release velocity or sprint throughput recorded</span>
                  <span className="text-[11px] text-gray-600 mt-1">Velocity curves will automatically plot as releases are created and shipped.</span>
                </div>
              )}
            </div>

            {/* Task Distribution Donut */}
            <div className="rounded-2xl bg-[#0A1024]/90 border border-[#15203D] p-6 shadow-xl shadow-black/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">Task Distribution</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Active sprint backlog status</p>
                  </div>
                  <button onClick={() => navigate('/tasks')} className="text-xs text-[#2E5EFF] hover:underline font-medium">Kanban →</button>
                </div>
                {tasksByStatus.length > 0 ? (
                  <>
                    <div className="h-48 relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={tasksByStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value">
                            {tasksByStatus.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#0D1429', 
                              borderColor: '#2E5EFF', 
                              borderRadius: '10px', 
                              color: '#FFFFFF',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                              padding: '8px 12px'
                            }} 
                            itemStyle={{ color: '#FFFFFF', fontSize: '12px', fontWeight: 'bold' }}
                            labelStyle={{ color: '#FFFFFF', fontWeight: 'bold' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-3xl font-black text-white tracking-tight">{stats.openTasks}</span>
                        <span className="text-[11px] uppercase tracking-wider text-gray-300 font-bold">Active</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs pt-4 border-t border-[#131C38]">
                      {tasksByStatus.map(t => (
                        <div key={t.name} className="flex items-center justify-between p-2 rounded-lg bg-[#0E152E]/80 border border-[#182348]">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full ring-2 ring-white/10" style={{ backgroundColor: t.color }} />
                            <span className="text-gray-200 font-medium">{t.name}</span>
                          </div>
                          <span className="font-bold text-white bg-[#152042] px-2 py-0.5 rounded text-xs border border-[#233566]">{t.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-48 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#15203D] rounded-2xl bg-[#080D1F]/40">
                    <span className="text-xs font-semibold text-gray-400">No active tasks in sprint backlog</span>
                    <span className="text-[11px] text-gray-600 mt-1">Sprint tasks created in application workspaces will appear here.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Lower Row: Deadlines & Live Audit Trail */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
            {/* Upcoming Deadlines */}
            <div className="rounded-2xl bg-[#0A1024]/90 border border-[#15203D] p-4 sm:p-6 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-[#F5A623]" />
                  <h3 className="text-base font-bold text-white tracking-tight">Upcoming Deadlines</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/products')}>Applications View →</Button>
              </div>
              
              <div className="space-y-2.5">
                {deadlines.length > 0 ? (
                  deadlines.map(d => (
                    <div 
                      key={d.id}
                      onClick={() => navigate(d.linkedId ? `/products/${d.linkedId}` : '/products')}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#0E152E]/70 hover:bg-[#131D40] border border-[#172242] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge variant={d.type === 'Release' ? 'blue' : d.type === 'UAT' ? 'orange' : 'danger'}>
                          {d.type}
                        </Badge>
                        <span className="text-sm font-medium text-white group-hover:text-[#6087FF] transition-colors truncate">
                          {d.title}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-gray-400 shrink-0">
                        {d.startDate ? (() => {
                          try {
                            const dt = new Date(d.startDate)
                            return isNaN(dt.getTime()) ? 'TBD' : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                          } catch {
                            return 'TBD'
                          }
                        })() : 'TBD'}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-xs text-gray-500">No scheduled events pending.</div>
                )}
              </div>
            </div>

            {/* Recent Audit & System Activity */}
            <div className="rounded-2xl bg-[#0A1024]/90 border border-[#15203D] p-6 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-[#2E5EFF]" />
                  <h3 className="text-base font-bold text-white tracking-tight">System Activity Stream</h3>
                </div>
                {isPO && <Button variant="ghost" size="sm" onClick={() => navigate('/audit')}>View All →</Button>}
              </div>

              <div className="space-y-3">
                {activityLogs.length > 0 ? (
                  activityLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-[#0E152E]/40 border border-[#15203D]/60 text-xs">
                      <div className="w-6 h-6 rounded-md bg-[#2E5EFF]/10 text-[#2E5EFF] flex items-center justify-center shrink-0 mt-0.5">
                        <Activity size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white">{log.user_id}</span>
                          <span className="text-gray-400 font-mono text-[11px]">[{log.action}]</span>
                        </div>
                        <p className="text-gray-400 truncate mt-0.5">{log.detail || `Action on ${log.entity_type}`}</p>
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono shrink-0">
                        {log.created_at ? (() => {
                          try {
                            const dt = new Date(log.created_at)
                            return isNaN(dt.getTime()) ? '' : dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          } catch {
                            return ''
                          }
                        })() : ''}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-xs text-gray-500">No recent activity logged.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
