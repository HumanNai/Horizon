import * as XLSX from 'xlsx'
import type { Product, Release, Task, UATCase, ProductInterface, ApiEndpoint, HorizonUser } from '../types'

export interface ProductPortfolioStats {
  productId: string
  totalReleases: number
  totalTasks: number
  completedTasks: number
  openTasks: number
  totalUat: number
  passedUat: number
  interfacesCount: number
  apisCount: number
}

export interface ProductWorkspaceExportData {
  releases: Release[]
  tasks: Task[]
  uatCases: UATCase[]
  interfaces: ProductInterface[]
  apis: ApiEndpoint[]
  teamMembers?: { id: string; name: string; role?: string; accessRole?: string; addedAt?: string }[]
  currentUser?: HorizonUser | null
}

export interface ExportAllProductsOptions {
  currentUser?: HorizonUser | null
  queryFn?: <T = any>(sql: string, params?: any[]) => Promise<T[]>
  allReleases?: any[]
  allTasks?: any[]
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/_+/g, '_')
}

export function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

function autoFitColumns(data: any[]): { wch: number }[] {
  if (!data || data.length === 0) return []
  const keys = Object.keys(data[0] || {})
  return keys.map(key => {
    let maxLen = key.length
    for (const row of data) {
      const val = row[key]
      if (val !== undefined && val !== null) {
        const len = String(val).length
        if (len > maxLen) maxLen = len
      }
    }
    return { wch: Math.min(Math.max(maxLen + 3, 10), 60) }
  })
}

/**
 * Builds the complete multi-sheet Excel workbook for the products portfolio.
 */
export async function buildProductsPortfolioWorkbook(
  products: Product[],
  options?: ExportAllProductsOptions
): Promise<XLSX.WorkBook> {
  const wb = XLSX.utils.book_new()
  const today = getTodayString()

  let relRows: any[] = []
  let taskRows: any[] = []
  let uatRows: any[] = []
  let ifRows: any[] = []
  let apiRows: any[] = []
  let allReleases: any[] = options?.allReleases || []
  let allTasks: any[] = options?.allTasks || []

  if (options?.queryFn) {
    try {
      const q = options.queryFn
      const results = await Promise.all([
        q<any>('SELECT product_id, COUNT(*) as cnt FROM releases GROUP BY product_id'),
        q<any>(`
          SELECT product_id, 
                 COUNT(*) as total,
                 SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as completed,
                 SUM(CASE WHEN status != 'Done' THEN 1 ELSE 0 END) as open
          FROM tasks 
          WHERE product_id IS NOT NULL AND product_id != '' 
          GROUP BY product_id
        `),
        q<any>(`
          SELECT r.product_id, 
                 COUNT(u.id) as total,
                 SUM(CASE WHEN u.result = 'Pass' THEN 1 ELSE 0 END) as passed
          FROM uat_cases u
          JOIN releases r ON u.release_id = r.id
          GROUP BY r.product_id
        `).catch(() => [] as any[]),
        q<any>('SELECT product_id, COUNT(*) as cnt FROM interfaces GROUP BY product_id'),
        q<any>('SELECT product_id, COUNT(*) as cnt FROM apis GROUP BY product_id').catch(() => [] as any[]),
        allReleases.length === 0 
          ? q<any>('SELECT r.*, p.name as product_name FROM releases r LEFT JOIN products p ON r.product_id = p.id ORDER BY p.name ASC, r.target_date ASC')
          : Promise.resolve(allReleases),
        allTasks.length === 0 
          ? q<any>('SELECT t.*, p.name as product_name FROM tasks t LEFT JOIN products p ON t.product_id = p.id ORDER BY p.name ASC, t.created_at DESC')
          : Promise.resolve(allTasks)
      ])

      relRows = results[0] || []
      taskRows = results[1] || []
      uatRows = results[2] || []
      ifRows = results[3] || []
      apiRows = results[4] || []
      allReleases = results[5] || []
      allTasks = results[6] || []
    } catch (err) {
      console.warn('[ExcelExport] Statistics query error:', err)
    }
  }

  // Build lookups
  const relMap = new Map<string, number>()
  relRows.forEach(r => relMap.set(r.product_id, Number(r.cnt) || 0))

  const taskMap = new Map<string, { total: number; completed: number; open: number }>()
  taskRows.forEach(r => taskMap.set(r.product_id, {
    total: Number(r.total) || 0,
    completed: Number(r.completed) || 0,
    open: Number(r.open) || 0
  }))

  const uatMap = new Map<string, { total: number; passed: number }>()
  uatRows.forEach(r => uatMap.set(r.product_id, {
    total: Number(r.total) || 0,
    passed: Number(r.passed) || 0
  }))

  const ifMap = new Map<string, number>()
  ifRows.forEach(r => ifMap.set(r.product_id, Number(r.cnt) || 0))

  const apiMap = new Map<string, number>()
  apiRows.forEach(r => apiMap.set(r.product_id, Number(r.cnt) || 0))

  // ── Sheet 1: Products Portfolio ───────────────────────────────
  const portfolioData = products.map(p => {
    const tStats = taskMap.get(p.id) || { total: 0, completed: 0, open: 0 }
    const uStats = uatMap.get(p.id) || { total: 0, passed: 0 }
    const passRate = uStats.total > 0 ? `${Math.round((uStats.passed / uStats.total) * 100)}%` : 'N/A'

    return {
      'Product Name': p.name,
      'Application Scope': p.type || 'Internal',
      'Status': p.status,
      'Product Owner': p.owner || 'Unassigned',
      'Releases Count': relMap.get(p.id) || 0,
      'Total Tasks': tStats.total,
      'Open Tasks': tStats.open,
      'Completed Tasks': tStats.completed,
      'Quality Gate Tests': uStats.total,
      'Passed UAT': uStats.passed,
      'UAT Pass Rate': passRate,
      'Interfaces Count': ifMap.get(p.id) || 0,
      'APIs Count': apiMap.get(p.id) || 0,
      'Description': p.description || '',
      'Created Date': p.createdAt ? p.createdAt.split('T')[0] : '',
      'Last Updated': p.updatedAt ? p.updatedAt.split('T')[0] : '',
      'Product ID': p.id
    }
  })

  const wsPortfolio = XLSX.utils.json_to_sheet(portfolioData)
  wsPortfolio['!cols'] = autoFitColumns(portfolioData)
  XLSX.utils.book_append_sheet(wb, wsPortfolio, 'Products Portfolio')

  // ── Sheet 2: Executive Summary ────────────────────────────────
  const activeCount = products.filter(p => p.status === 'Active').length
  const planningCount = products.filter(p => p.status === 'Planning').length
  const onHoldCount = products.filter(p => p.status === 'OnHold').length
  const deprecatedCount = products.filter(p => p.status === 'Deprecated').length
  const internalCount = products.filter(p => (p.type || 'Internal') === 'Internal').length
  const externalCount = products.filter(p => p.type === 'External').length

  const totalTasksSum = taskRows.reduce((acc, r) => acc + (Number(r.total) || 0), 0)
  const completedTasksSum = taskRows.reduce((acc, r) => acc + (Number(r.completed) || 0), 0)
  const totalUatSum = uatRows.reduce((acc, r) => acc + (Number(r.total) || 0), 0)
  const passedUatSum = uatRows.reduce((acc, r) => acc + (Number(r.passed) || 0), 0)
  const overallPassRate = totalUatSum > 0 ? `${Math.round((passedUatSum / totalUatSum) * 100)}%` : 'N/A'

  const summaryData = [
    { 'Portfolio Metric': 'Horizon Platform Version', 'Value': '1.2.0' },
    { 'Portfolio Metric': 'Report Generated Date', 'Value': today },
    { 'Portfolio Metric': 'Generated By', 'Value': options?.currentUser?.displayName || options?.currentUser?.username || 'Administrator' },
    { 'Portfolio Metric': 'User Role', 'Value': options?.currentUser?.role || 'System' },
    { 'Portfolio Metric': 'Total Portfolio Products', 'Value': products.length },
    { 'Portfolio Metric': 'Active Products', 'Value': activeCount },
    { 'Portfolio Metric': 'Planning Products', 'Value': planningCount },
    { 'Portfolio Metric': 'On Hold Products', 'Value': onHoldCount },
    { 'Portfolio Metric': 'Deprecated Products', 'Value': deprecatedCount },
    { 'Portfolio Metric': 'Internal Applications', 'Value': internalCount },
    { 'Portfolio Metric': 'External Applications', 'Value': externalCount },
    { 'Portfolio Metric': 'Total Active Releases', 'Value': allReleases.length },
    { 'Portfolio Metric': 'Total Tracked Tasks', 'Value': totalTasksSum },
    { 'Portfolio Metric': 'Completed Tasks', 'Value': completedTasksSum },
    { 'Portfolio Metric': 'Open Tasks', 'Value': totalTasksSum - completedTasksSum },
    { 'Portfolio Metric': 'Total UAT Cases Tested', 'Value': totalUatSum },
    { 'Portfolio Metric': 'Overall Quality Pass Rate', 'Value': overallPassRate },
    { 'Portfolio Metric': 'Total Integration Interfaces', 'Value': ifRows.reduce((acc, r) => acc + (Number(r.cnt) || 0), 0) },
    { 'Portfolio Metric': 'Total Managed APIs', 'Value': apiRows.reduce((acc, r) => acc + (Number(r.cnt) || 0), 0) }
  ]

  const wsSummary = XLSX.utils.json_to_sheet(summaryData)
  wsSummary['!cols'] = autoFitColumns(summaryData)
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary')

  // ── Sheet 3: Releases Roadmap ─────────────────────────────────
  if (allReleases.length > 0) {
    const releaseExportData = allReleases.map(r => ({
      'Product': r.product_name || 'General',
      'Release Version': r.version,
      'Release Name': r.name,
      'Lifecycle Status': r.status,
      'Target Date': r.target_date || r.targetDate || '',
      'Server Upgrades': r.server_upgrades || r.serverUpgrades || 'None',
      'Description': r.description || '',
      'Created Date': (r.created_at || r.createdAt || '').split('T')[0],
      'Release ID': r.id
    }))

    const wsReleases = XLSX.utils.json_to_sheet(releaseExportData)
    wsReleases['!cols'] = autoFitColumns(releaseExportData)
    XLSX.utils.book_append_sheet(wb, wsReleases, 'Releases Roadmap')
  }

  // ── Sheet 4: Tasks Backlog ────────────────────────────────────
  if (allTasks.length > 0) {
    const taskExportData = allTasks.map(t => ({
      'Product': t.product_name || 'General',
      'Task Title': t.title,
      'Status': t.status,
      'Priority': t.priority,
      'Assignee': t.assignee_id || t.assigneeId || 'Unassigned',
      'Due Date': t.due_date || t.dueDate || '',
      'Description': t.description || '',
      'Created Date': (t.created_at || t.createdAt || '').split('T')[0],
      'Task ID': t.id
    }))

    const wsTasks = XLSX.utils.json_to_sheet(taskExportData)
    wsTasks['!cols'] = autoFitColumns(taskExportData)
    XLSX.utils.book_append_sheet(wb, wsTasks, 'Tasks Backlog')
  }

  return wb
}

/**
 * Builds the complete multi-sheet Excel workbook for a single product workspace.
 */
export function buildProductWorkspaceWorkbook(
  product: Product,
  data: ProductWorkspaceExportData
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const today = getTodayString()

  // ── Sheet 1: Overview & Metrics ───────────────────────────────
  const completedTasks = data.tasks.filter(t => t.status === 'Done').length
  const passedUat = data.uatCases.filter(u => u.result === 'Pass').length
  const uatRate = data.uatCases.length > 0 ? `${Math.round((passedUat / data.uatCases.length) * 100)}%` : 'N/A'

  const overviewData = [
    { 'Property': 'Product Name', 'Detail': product.name },
    { 'Property': 'Application Scope / Type', 'Detail': product.type || 'Internal' },
    { 'Property': 'Lifecycle Status', 'Detail': product.status },
    { 'Property': 'Product Owner', 'Detail': product.owner || 'Unassigned' },
    { 'Property': 'Product Description', 'Detail': product.description || 'No description provided' },
    { 'Property': 'Product Identifier', 'Detail': product.id },
    { 'Property': 'Created Date', 'Detail': product.createdAt ? product.createdAt.split('T')[0] : '' },
    { 'Property': 'Last Updated', 'Detail': product.updatedAt ? product.updatedAt.split('T')[0] : '' },
    { 'Property': 'Report Export Date', 'Detail': today },
    { 'Property': 'Exported By', 'Detail': data.currentUser?.displayName || data.currentUser?.username || 'Horizon User' },
    { 'Property': 'Total Releases Tracked', 'Detail': data.releases.length },
    { 'Property': 'Total Sprint Tasks', 'Detail': data.tasks.length },
    { 'Property': 'Tasks Completed', 'Detail': completedTasks },
    { 'Property': 'Tasks Open / In Progress', 'Detail': data.tasks.length - completedTasks },
    { 'Property': 'UAT Quality Gate Tests', 'Detail': data.uatCases.length },
    { 'Property': 'Passed UAT Cases', 'Detail': passedUat },
    { 'Property': 'Quality Gate Pass Rate', 'Detail': uatRate },
    { 'Property': 'Integration Interfaces', 'Detail': data.interfaces.length },
    { 'Property': 'Application APIs', 'Detail': data.apis.length },
    { 'Property': 'Team Members Count', 'Detail': data.teamMembers?.length || 0 }
  ]

  const wsOverview = XLSX.utils.json_to_sheet(overviewData)
  wsOverview['!cols'] = autoFitColumns(overviewData)
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Product Overview')

  // ── Sheet 2: Releases & Roadmap ───────────────────────────────
  if (data.releases.length > 0) {
    const releasesData = data.releases.map(r => ({
      'Version': r.version,
      'Release Name': r.name,
      'Status': r.status,
      'Target Date': r.targetDate || '',
      'Server Upgrades': r.serverUpgrades || 'None',
      'Features List': Array.isArray(r.features) ? r.features.join('; ') : (r.features || ''),
      'Description': r.description || '',
      'Created Date': r.createdAt ? r.createdAt.split('T')[0] : '',
      'Release ID': r.id
    }))

    const wsReleases = XLSX.utils.json_to_sheet(releasesData)
    wsReleases['!cols'] = autoFitColumns(releasesData)
    XLSX.utils.book_append_sheet(wb, wsReleases, 'Roadmap & Releases')
  }

  // ── Sheet 3: Tasks & Backlog ──────────────────────────────────
  if (data.tasks.length > 0) {
    const relLookup = new Map<string, string>()
    data.releases.forEach(r => relLookup.set(r.id, `${r.name} (${r.version})`))

    const tasksData = data.tasks.map(t => ({
      'Task Title': t.title,
      'Status': t.status,
      'Priority': t.priority,
      'Assignee': t.assigneeId || 'Unassigned',
      'Linked Release': t.releaseId ? (relLookup.get(t.releaseId) || t.releaseId) : 'None / Backlog',
      'Due Date': t.dueDate || '',
      'Description': t.description || '',
      'Created Date': t.createdAt ? t.createdAt.split('T')[0] : '',
      'Task ID': t.id
    }))

    const wsTasks = XLSX.utils.json_to_sheet(tasksData)
    wsTasks['!cols'] = autoFitColumns(tasksData)
    XLSX.utils.book_append_sheet(wb, wsTasks, 'Sprint Tasks')
  }

  // ── Sheet 4: Quality Gate & UAT ───────────────────────────────
  if (data.uatCases.length > 0) {
    const relLookup = new Map<string, string>()
    data.releases.forEach(r => relLookup.set(r.id, `${r.name} (${r.version})`))

    const uatData = data.uatCases.map(u => ({
      'Case Title': u.title,
      'Linked Release': u.releaseId ? (relLookup.get(u.releaseId) || u.releaseId) : 'General',
      'Result': u.result,
      'Assignee / Tester': u.assigneeId || 'Unassigned',
      'Step Description': u.description || '',
      'Verification Notes': u.notes || '',
      'Last Updated': u.updatedAt ? u.updatedAt.split('T')[0] : '',
      'Test Case ID': u.id
    }))

    const wsUat = XLSX.utils.json_to_sheet(uatData)
    wsUat['!cols'] = autoFitColumns(uatData)
    XLSX.utils.book_append_sheet(wb, wsUat, 'Quality Gate (UAT)')
  }

  // ── Sheet 5: Interfaces & Integrations ────────────────────────
  if (data.interfaces.length > 0) {
    const ifData = data.interfaces.map(i => ({
      'Interface Name': i.name,
      'Direction': i.direction || 'Bidirectional',
      'Protocol / Type': i.type,
      'Endpoint / Queue': i.endpoint,
      'Service Provider': i.serviceProvider || '',
      'Target Audience': i.targetAudience || '',
      'Connection Details': i.connectionDetails || '',
      'Owner': i.owner || '',
      'Status': i.status,
      'Description': i.description || '',
      'Interface ID': i.id
    }))

    const wsIf = XLSX.utils.json_to_sheet(ifData)
    wsIf['!cols'] = autoFitColumns(ifData)
    XLSX.utils.book_append_sheet(wb, wsIf, 'Interfaces')
  }

  // ── Sheet 6: API Catalog ──────────────────────────────────────
  if (data.apis.length > 0) {
    const apiData = data.apis.map(a => ({
      'API Name': a.name,
      'HTTP Method': a.method,
      'Endpoint Path': a.endpoint,
      'Authentication': a.authType,
      'Status': a.status,
      'Consumer / Given To': a.givenTo || '',
      'Rate Limit': a.rateLimit || 'Default',
      'Description': a.description || '',
      'Owner': a.owner || '',
      'API ID': a.id
    }))

    const wsApis = XLSX.utils.json_to_sheet(apiData)
    wsApis['!cols'] = autoFitColumns(apiData)
    XLSX.utils.book_append_sheet(wb, wsApis, 'API Catalog')
  }

  // ── Sheet 7: Team Members ─────────────────────────────────────
  if (data.teamMembers && data.teamMembers.length > 0) {
    const teamData = data.teamMembers.map(m => ({
      'Member Name': m.name,
      'Functional Role': m.role || 'Contributor',
      'Platform Access': m.accessRole || 'TeamMember',
      'Added Date': m.addedAt ? m.addedAt.split('T')[0] : today,
      'User ID': m.id
    }))

    const wsTeam = XLSX.utils.json_to_sheet(teamData)
    wsTeam['!cols'] = autoFitColumns(teamData)
    XLSX.utils.book_append_sheet(wb, wsTeam, 'Team Members')
  }

  return wb
}

/**
 * High-level download trigger: Exports all products in the portfolio to an Excel file.
 */
export async function exportAllProductsToExcel(
  products: Product[],
  options?: ExportAllProductsOptions
): Promise<void> {
  const wb = await buildProductsPortfolioWorkbook(products, options)
  const today = getTodayString()
  const filename = `Horizon-Products-Portfolio-${today}.xlsx`
  XLSX.writeFile(wb, filename)
}

/**
 * High-level download trigger: Exports a single product workspace to an Excel file.
 */
export function exportProductWorkspaceToExcel(
  product: Product,
  data: ProductWorkspaceExportData
): void {
  const wb = buildProductWorkspaceWorkbook(product, data)
  const today = getTodayString()
  const cleanName = sanitizeFilename(product.name || 'Product')
  const filename = `Horizon-Product-Report-${cleanName}-${today}.xlsx`
  XLSX.writeFile(wb, filename)
}

