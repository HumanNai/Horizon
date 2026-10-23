import * as XLSX from 'xlsx'
import type { Product, Release, Task, UATCase, ProductInterface, ApiEndpoint, HorizonUser, UserRole } from '../types'

/**
 * Roles authorized to export Excel reports.
 * Only Product Owners, Executives (Management), and Super Admins have permission.
 */
export const EXPORT_ALLOWED_ROLES: UserRole[] = ['SuperAdmin', 'ProductOwner', 'Management']

/**
 * Verifies whether the specified user has authorization to download product Excel reports.
 */
export function canExportExcel(user?: HorizonUser | null): boolean {
  if (!user || !user.role) return false
  return EXPORT_ALLOWED_ROLES.includes(user.role)
}

/**
 * Throws an authorization error if the user is not permitted to export data.
 */
export function assertCanExportExcel(user?: HorizonUser | null): void {
  if (!canExportExcel(user)) {
    throw new Error('Access Denied: Only Product Owners, Executives (Management), and Super Admins are authorized to export product reports.')
  }
}

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
  docsCount: number
  milestonesCount: number
}

export interface ProductWorkspaceExportData {
  releases: Release[]
  tasks: Task[]
  uatCases: UATCase[]
  interfaces: ProductInterface[]
  apis: ApiEndpoint[]
  teamMembers?: { id: string; name: string; role?: string; accessRole?: string; addedAt?: string }[]
  releaseSignoffs?: { release_id?: string; release_name?: string; release_version?: string; signed_off_by?: string; signed_off_at?: string; notes?: string }[]
  documents?: { id: string; title: string; category?: string; version?: string; file_name?: string; file_size?: number; last_modified?: string; web_url?: string; sharepoint_status?: string; description?: string }[]
  scheduleEvents?: { id: string; title: string; type?: string; start_date?: string; end_date?: string; linked_type?: string; notified?: boolean | number; created_by?: string }[]
  customSections?: { id: string; title: string; section_type?: string; icon?: string; content_json?: string; updated_at?: string }[]
  currentUser?: HorizonUser | null
}

export interface ExportAllProductsOptions {
  currentUser?: HorizonUser | null
  queryFn?: <T = any>(sql: string, params?: any[]) => Promise<T[]>
  allReleases?: any[]
  allTasks?: any[]
  allUatCases?: any[]
  allInterfaces?: any[]
  allApis?: any[]
  allDocuments?: any[]
  allScheduleEvents?: any[]
  allReleaseSignoffs?: any[]
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
 * Strictly excludes any sensitive credentials (secrets_meta, password_hash).
 */
export async function buildProductsPortfolioWorkbook(
  products: Product[],
  options?: ExportAllProductsOptions
): Promise<XLSX.WorkBook> {
  assertCanExportExcel(options?.currentUser)

  const wb = XLSX.utils.book_new()
  const today = getTodayString()

  let relRows: any[] = []
  let taskRows: any[] = []
  let uatRows: any[] = []
  let ifRows: any[] = []
  let apiRows: any[] = []
  let docCountRows: any[] = []
  let schedCountRows: any[] = []

  let allReleases: any[] = options?.allReleases || []
  let allTasks: any[] = options?.allTasks || []
  let allUatCases: any[] = options?.allUatCases || []
  let allInterfaces: any[] = options?.allInterfaces || []
  let allApis: any[] = options?.allApis || []
  let allDocuments: any[] = options?.allDocuments || []
  let allScheduleEvents: any[] = options?.allScheduleEvents || []
  let allReleaseSignoffs: any[] = options?.allReleaseSignoffs || []

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
        q<any>('SELECT product_id, COUNT(*) as cnt FROM documents_meta GROUP BY product_id').catch(() => [] as any[]),
        q<any>('SELECT linked_id as product_id, COUNT(*) as cnt FROM schedule_events WHERE linked_type = \'Product\' GROUP BY linked_id').catch(() => [] as any[]),
        allReleases.length === 0 
          ? q<any>('SELECT r.*, p.name as product_name FROM releases r LEFT JOIN products p ON r.product_id = p.id ORDER BY p.name ASC, r.target_date ASC')
          : Promise.resolve(allReleases),
        allTasks.length === 0 
          ? q<any>('SELECT t.*, p.name as product_name FROM tasks t LEFT JOIN products p ON t.product_id = p.id ORDER BY p.name ASC, t.created_at DESC')
          : Promise.resolve(allTasks),
        allUatCases.length === 0
          ? q<any>(`SELECT u.id, u.title, u.description, u.result, u.assignee_id, u.notes, u.updated_at, r.name as release_name, r.version as release_version, p.name as product_name FROM uat_cases u LEFT JOIN releases r ON u.release_id = r.id LEFT JOIN products p ON r.product_id = p.id ORDER BY p.name ASC, r.version ASC`).catch(() => [] as any[])
          : Promise.resolve(allUatCases),
        allInterfaces.length === 0
          ? q<any>(`SELECT i.id, i.name, i.type, i.endpoint, i.direction, i.service_provider, i.target_audience, i.connection_details, i.owner_id, i.status, i.description, p.name as product_name FROM interfaces i LEFT JOIN products p ON i.product_id = p.id ORDER BY p.name ASC, i.name ASC`).catch(() => [] as any[])
          : Promise.resolve(allInterfaces),
        allApis.length === 0
          ? q<any>(`SELECT a.id, a.name, a.method, a.endpoint, a.auth_type, a.given_to, a.rate_limit, a.owner_id, a.status, a.description, p.name as product_name FROM apis a LEFT JOIN products p ON a.product_id = p.id ORDER BY p.name ASC, a.name ASC`).catch(() => [] as any[])
          : Promise.resolve(allApis),
        allDocuments.length === 0
          ? q<any>(`SELECT d.id, d.title, d.category, d.version, d.file_name, d.file_size, d.last_modified, d.web_url, d.sharepoint_status, d.description, p.name as product_name FROM documents_meta d LEFT JOIN products p ON d.product_id = p.id ORDER BY p.name ASC, d.title ASC`).catch(() => [] as any[])
          : Promise.resolve(allDocuments),
        allScheduleEvents.length === 0
          ? q<any>(`SELECT s.id, s.title, s.type, s.start_date, s.end_date, s.linked_id, s.linked_type, s.notified, s.created_by, p.name as product_name FROM schedule_events s LEFT JOIN products p ON (s.linked_id = p.id AND s.linked_type = 'Product') ORDER BY s.start_date ASC`).catch(() => [] as any[])
          : Promise.resolve(allScheduleEvents),
        allReleaseSignoffs.length === 0
          ? q<any>(`SELECT rs.release_id, rs.signed_off_by, rs.signed_off_at, rs.notes, r.name as release_name, r.version as release_version, p.name as product_name FROM release_signoffs rs INNER JOIN releases r ON rs.release_id = r.id LEFT JOIN products p ON r.product_id = p.id ORDER BY rs.signed_off_at DESC`).catch(() => [] as any[])
          : Promise.resolve(allReleaseSignoffs)
      ])

      relRows = results[0] || []
      taskRows = results[1] || []
      uatRows = results[2] || []
      ifRows = results[3] || []
      apiRows = results[4] || []
      docCountRows = results[5] || []
      schedCountRows = results[6] || []
      allReleases = results[7] || []
      allTasks = results[8] || []
      allUatCases = results[9] || []
      allInterfaces = results[10] || []
      allApis = results[11] || []
      allDocuments = results[12] || []
      allScheduleEvents = results[13] || []
      allReleaseSignoffs = results[14] || []
    } catch (err) {
      console.warn('[ExcelExport] Portfolio query warning:', err)
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

  const docMap = new Map<string, number>()
  docCountRows.forEach(r => docMap.set(r.product_id, Number(r.cnt) || 0))

  const schedMap = new Map<string, number>()
  schedCountRows.forEach(r => schedMap.set(r.product_id, Number(r.cnt) || 0))

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
      'Documents Count': docMap.get(p.id) || 0,
      'Milestones Count': schedMap.get(p.id) || 0,
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
    { 'Portfolio Metric': 'Generated By', 'Value': options?.currentUser?.displayName || options?.currentUser?.username || 'Authorized User' },
    { 'Portfolio Metric': 'Authorized Access Role', 'Value': options?.currentUser?.role || 'SuperAdmin' },
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
    { 'Portfolio Metric': 'Total Managed APIs', 'Value': apiRows.reduce((acc, r) => acc + (Number(r.cnt) || 0), 0) },
    { 'Portfolio Metric': 'Total Specifications & Docs', 'Value': docCountRows.reduce((acc, r) => acc + (Number(r.cnt) || 0), 0) }
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

  // ── Sheet 5: Quality Gate (UAT) ───────────────────────────────
  if (allUatCases.length > 0) {
    const uatExportData = allUatCases.map(u => ({
      'Product': u.product_name || 'General',
      'Release': u.release_name ? `${u.release_name} (${u.release_version || ''})` : (u.release_id || 'General'),
      'Case Title': u.title,
      'Result': u.result,
      'Tester / Assignee': u.assignee_id || 'Unassigned',
      'Description': u.description || '',
      'Verification Notes': u.notes || '',
      'Last Updated': (u.updated_at || '').split('T')[0],
      'UAT ID': u.id
    }))

    const wsUat = XLSX.utils.json_to_sheet(uatExportData)
    wsUat['!cols'] = autoFitColumns(uatExportData)
    XLSX.utils.book_append_sheet(wb, wsUat, 'Quality Gate (UAT)')
  }

  // ── Sheet 6: Interfaces & Integrations ────────────────────────
  if (allInterfaces.length > 0) {
    const ifExportData = allInterfaces.map(i => ({
      'Product': i.product_name || 'General',
      'Interface Name': i.name,
      'Direction': i.direction || 'Bidirectional',
      'Protocol / Type': i.type,
      'Endpoint / Queue': i.endpoint,
      'Service Provider': i.service_provider || '',
      'Target Audience': i.target_audience || '',
      'Connection Details': i.connection_details || '',
      'Owner': i.owner_id || '',
      'Status': i.status,
      'Description': i.description || '',
      'Interface ID': i.id
    }))

    const wsIf = XLSX.utils.json_to_sheet(ifExportData)
    wsIf['!cols'] = autoFitColumns(ifExportData)
    XLSX.utils.book_append_sheet(wb, wsIf, 'Interfaces')
  }

  // ── Sheet 7: APIs Catalog ─────────────────────────────────────
  if (allApis.length > 0) {
    const apiExportData = allApis.map(a => ({
      'Product': a.product_name || 'General',
      'API Name': a.name,
      'HTTP Method': a.method,
      'Endpoint Path': a.endpoint,
      'Authentication': a.auth_type,
      'Consumer / Given To': a.given_to || '',
      'Rate Limit': a.rate_limit || 'Default',
      'Status': a.status,
      'Owner': a.owner_id || '',
      'Description': a.description || '',
      'API ID': a.id
    }))

    const wsApis = XLSX.utils.json_to_sheet(apiExportData)
    wsApis['!cols'] = autoFitColumns(apiExportData)
    XLSX.utils.book_append_sheet(wb, wsApis, 'API Catalog')
  }

  // ── Sheet 8: Specs & Architecture Documents ───────────────────
  if (allDocuments.length > 0) {
    const docExportData = allDocuments.map(d => ({
      'Product': d.product_name || 'General',
      'Document Title': d.title,
      'Category': d.category || 'General',
      'Version': d.version || '1.0',
      'File Name': d.file_name || 'N/A',
      'File Size (Bytes)': d.file_size || 0,
      'SharePoint Status': d.sharepoint_status || 'Synced',
      'External Link / URL': d.web_url || '',
      'Last Modified': (d.last_modified || '').split('T')[0],
      'Description': d.description || '',
      'Document ID': d.id
    }))

    const wsDocs = XLSX.utils.json_to_sheet(docExportData)
    wsDocs['!cols'] = autoFitColumns(docExportData)
    XLSX.utils.book_append_sheet(wb, wsDocs, 'Architecture Docs')
  }

  // ── Sheet 9: Delivery Milestones & Schedule ───────────────────
  if (allScheduleEvents.length > 0) {
    const schedExportData = allScheduleEvents.map(s => ({
      'Product': s.product_name || 'General',
      'Milestone Title': s.title,
      'Event Type': s.type,
      'Start Date': s.start_date || '',
      'End Date': s.end_date || '',
      'Created By': s.created_by || '',
      'Notification Set': s.notified ? 'Yes' : 'No',
      'Milestone ID': s.id
    }))

    const wsSched = XLSX.utils.json_to_sheet(schedExportData)
    wsSched['!cols'] = autoFitColumns(schedExportData)
    XLSX.utils.book_append_sheet(wb, wsSched, 'Delivery Milestones')
  }

  // ── Sheet 10: QA Release Sign-Offs ────────────────────────────
  if (allReleaseSignoffs.length > 0) {
    const signoffExportData = allReleaseSignoffs.map(so => ({
      'Product': so.product_name || 'General',
      'Release Version': so.release_version || '',
      'Release Name': so.release_name || '',
      'Signed Off By': so.signed_off_by || '',
      'Signed Off Date': (so.signed_off_at || '').split('T')[0],
      'Acceptance Rationale / Notes': so.notes || ''
    }))

    const wsSignoffs = XLSX.utils.json_to_sheet(signoffExportData)
    wsSignoffs['!cols'] = autoFitColumns(signoffExportData)
    XLSX.utils.book_append_sheet(wb, wsSignoffs, 'QA Release Sign-Offs')
  }

  return wb
}

/**
 * Builds the complete multi-sheet Excel workbook for a single product workspace.
 * Strictly excludes any sensitive credentials (secrets_meta, passwords, tokens).
 */
export function buildProductWorkspaceWorkbook(
  product: Product,
  data: ProductWorkspaceExportData
): XLSX.WorkBook {
  assertCanExportExcel(data.currentUser)

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
    { 'Property': 'Exported By', 'Detail': data.currentUser?.displayName || data.currentUser?.username || 'Authorized User' },
    { 'Property': 'Authorized Role', 'Detail': data.currentUser?.role || 'SuperAdmin' },
    { 'Property': 'Total Releases Tracked', 'Detail': data.releases.length },
    { 'Property': 'Total Sprint Tasks', 'Detail': data.tasks.length },
    { 'Property': 'Tasks Completed', 'Detail': completedTasks },
    { 'Property': 'Tasks Open / In Progress', 'Detail': data.tasks.length - completedTasks },
    { 'Property': 'UAT Quality Gate Tests', 'Detail': data.uatCases.length },
    { 'Property': 'Passed UAT Cases', 'Detail': passedUat },
    { 'Property': 'Quality Gate Pass Rate', 'Detail': uatRate },
    { 'Property': 'QA Release Sign-Offs', 'Detail': data.releaseSignoffs?.length || 0 },
    { 'Property': 'Integration Interfaces', 'Detail': data.interfaces.length },
    { 'Property': 'Application APIs', 'Detail': data.apis.length },
    { 'Property': 'Architecture Documents', 'Detail': data.documents?.length || 0 },
    { 'Property': 'Scheduled Milestones', 'Detail': data.scheduleEvents?.length || 0 },
    { 'Property': 'Team Members Count', 'Detail': data.teamMembers?.length || 0 },
    { 'Property': 'Custom RFC Sections', 'Detail': data.customSections?.length || 0 }
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

  // ── Sheet 5: QA Release Sign-Offs ─────────────────────────────
  if (data.releaseSignoffs && data.releaseSignoffs.length > 0) {
    const signoffData = data.releaseSignoffs.map(so => ({
      'Release Version': so.release_version || '',
      'Release Name': so.release_name || '',
      'Signed Off By': so.signed_off_by || '',
      'Signed Off Date': (so.signed_off_at || '').split('T')[0],
      'Acceptance Rationale / Notes': so.notes || ''
    }))

    const wsSignoffs = XLSX.utils.json_to_sheet(signoffData)
    wsSignoffs['!cols'] = autoFitColumns(signoffData)
    XLSX.utils.book_append_sheet(wb, wsSignoffs, 'QA Release Sign-Offs')
  }

  // ── Sheet 6: Interfaces & Integrations ────────────────────────
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

  // ── Sheet 7: API Catalog ──────────────────────────────────────
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

  // ── Sheet 8: Architecture Specs & Documents ───────────────────
  if (data.documents && data.documents.length > 0) {
    const docData = data.documents.map(d => ({
      'Document Title': d.title,
      'Category': d.category || 'General',
      'Version': d.version || '1.0',
      'File Name': d.file_name || 'N/A',
      'File Size (Bytes)': d.file_size || 0,
      'SharePoint Status': d.sharepoint_status || 'Synced',
      'External Link / URL': d.web_url || '',
      'Last Modified': (d.last_modified || '').split('T')[0],
      'Description': d.description || '',
      'Document ID': d.id
    }))

    const wsDocs = XLSX.utils.json_to_sheet(docData)
    wsDocs['!cols'] = autoFitColumns(docData)
    XLSX.utils.book_append_sheet(wb, wsDocs, 'Architecture Docs')
  }

  // ── Sheet 9: Delivery Milestones & Schedule ───────────────────
  if (data.scheduleEvents && data.scheduleEvents.length > 0) {
    const schedData = data.scheduleEvents.map(s => ({
      'Milestone Title': s.title,
      'Event Type': s.type || 'Milestone',
      'Start Date': s.start_date || '',
      'End Date': s.end_date || '',
      'Created By': s.created_by || '',
      'Notification Set': s.notified ? 'Yes' : 'No',
      'Milestone ID': s.id
    }))

    const wsSched = XLSX.utils.json_to_sheet(schedData)
    wsSched['!cols'] = autoFitColumns(schedData)
    XLSX.utils.book_append_sheet(wb, wsSched, 'Delivery Milestones')
  }

  // ── Sheet 10: Team Members ────────────────────────────────────
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

  // ── Sheet 11: Architecture RFCs & Runbooks ────────────────────
  if (data.customSections && data.customSections.length > 0) {
    const customData = data.customSections.map(cs => {
      let contentExcerpt = ''
      try {
        const parsed = JSON.parse(cs.content_json || '{}')
        contentExcerpt = typeof parsed === 'string' ? parsed : (parsed.markdown || parsed.text || JSON.stringify(parsed))
      } catch {
        contentExcerpt = cs.content_json || ''
      }
      return {
        'Section Title': cs.title,
        'Section Type': cs.section_type || 'Custom',
        'Icon': cs.icon || 'file-text',
        'Content / Specification': contentExcerpt.slice(0, 1000),
        'Last Updated': (cs.updated_at || '').split('T')[0],
        'Section ID': cs.id
      }
    })

    const wsCustom = XLSX.utils.json_to_sheet(customData)
    wsCustom['!cols'] = autoFitColumns(customData)
    XLSX.utils.book_append_sheet(wb, wsCustom, 'Architecture Sections')
  }

  return wb
}

/**
 * High-level download trigger: Exports all products in the portfolio to an Excel file.
 * Strictly checks that currentUser is authorized (ProductOwner, Management, SuperAdmin).
 */
export async function exportAllProductsToExcel(
  products: Product[],
  options?: ExportAllProductsOptions
): Promise<void> {
  assertCanExportExcel(options?.currentUser)
  const wb = await buildProductsPortfolioWorkbook(products, options)
  const today = getTodayString()
  const filename = `Horizon-Products-Portfolio-${today}.xlsx`
  XLSX.writeFile(wb, filename)
}

/**
 * High-level download trigger: Exports a single product workspace to an Excel file.
 * Strictly checks that currentUser is authorized (ProductOwner, Management, SuperAdmin).
 */
export function exportProductWorkspaceToExcel(
  product: Product,
  data: ProductWorkspaceExportData
): void {
  assertCanExportExcel(data.currentUser)
  const wb = buildProductWorkspaceWorkbook(product, data)
  const today = getTodayString()
  const cleanName = sanitizeFilename(product.name || 'Product')
  const filename = `Horizon-Product-Report-${cleanName}-${today}.xlsx`
  XLSX.writeFile(wb, filename)
}
