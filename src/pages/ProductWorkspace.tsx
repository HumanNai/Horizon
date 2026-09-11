import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Package, 
  GitMerge, 
  CheckSquare, 
  Network, 
  KeyRound, 
  Users, 
  Calendar, 
  FileText, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Lock, 
  Unlock, 
  Copy, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Edit3, 
  UserCheck, 
  Sparkles, 
  Layout, 
  Sliders, 
  ListChecks, 
  BookOpen, 
  Terminal, 
  Save, 
  X,
  ChevronRight,
  HelpCircle,
  Database,
  Upload,
  Download,
  File,
  Cloud,
  HardDrive,
  Check,
  Home,
  Laptop,
  Building,
  Phone,
  CalendarCheck,
  Search,
  Filter,
  RotateCcw,
  ShieldAlert,
  RefreshCw
} from 'lucide-react'
import { Card, Button, Badge, Modal, Input, Select } from '../components/ui'
import { PipelineBar } from '../components/PipelineBar'
import { KanbanBoard } from '../components/KanbanBoard'
import { Product, Release, Task, ReleaseStatus, TaskStatus, TaskPriority, UATCase, TestResult } from '../types'
import { dbQuery, dbExecute, getSessionToken, triggerAssignmentNotification } from '../store/dbClient'
import { useAuthStore } from '../store/authStore'
import { IconPicker, isImageIcon } from '../components/IconPicker'
import { useSettingsStore } from '../store/settingsStore'

interface CustomSection {
  id: string
  product_id: string
  title: string
  section_type: 'custom_form' | 'markdown' | 'checklist'
  content_json: string
  icon?: string
  created_at: string
}

function renderSectionIcon(iconName?: string, size = 14) {
  switch (iconName) {
    case 'ListChecks': return <ListChecks size={size} />
    case 'BookOpen': return <BookOpen size={size} />
    case 'Terminal': return <Terminal size={size} />
    case 'Layout': return <Layout size={size} />
    case 'Database': return <Database size={size} />
    default: return <Sliders size={size} />
  }
}

export function ProductWorkspace() {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const currentUser = useAuthStore(state => state.user)
  const isPO = currentUser?.role === 'ProductOwner'
  const isManagement = currentUser?.role === 'Management'
  const isTeamMember = currentUser?.role === 'TeamMember'
  const isProductLead = currentUser?.role === 'ProductLead'

  const [product, setProduct] = useState<Product | null>(null)
  const [activeTab, setActiveTab] = useState('releases')
  const [loading, setLoading] = useState(true)
  const [isAccessDenied, setIsAccessDenied] = useState(false)

  // Scoped Entity States
  const [releases, setReleases] = useState<Release[]>([])
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [interfaces, setInterfaces] = useState<any[]>([])
  const [apis, setApis] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [scheduleEvents, setScheduleEvents] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [customSections, setCustomSections] = useState<CustomSection[]>([])
  const [uatCases, setUatCases] = useState<UATCase[]>([])

  // Modal States
  const [isAddReleaseOpen, setIsAddReleaseOpen] = useState(false)
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [isAddUatOpen, setIsAddUatOpen] = useState(false)
  const [isEditUatOpen, setIsEditUatOpen] = useState(false)
  const [editingUatCase, setEditingUatCase] = useState<UATCase | null>(null)
  const [isAddInterfaceOpen, setIsAddInterfaceOpen] = useState(false)
  const [isEditInterfaceOpen, setIsEditInterfaceOpen] = useState(false)
  const [editingInterface, setEditingInterface] = useState<any | null>(null)
  const [isAddApiOpen, setIsAddApiOpen] = useState(false)
  const [isEditApiOpen, setIsEditApiOpen] = useState(false)
  const [editingApi, setEditingApi] = useState<any | null>(null)
  const [isAddDocOpen, setIsAddDocOpen] = useState(false)
  const [isEditProductOpen, setIsEditProductOpen] = useState(false)
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false)
  const [isEditReleaseOpen, setIsEditReleaseOpen] = useState(false)
  const [editingRelease, setEditingRelease] = useState<Release | null>(null)

  // Schedule Modal & Form State
  const [isAddScheduleOpen, setIsAddScheduleOpen] = useState(false)
  const [schedTitle, setSchedTitle] = useState('')
  const [schedType, setSchedType] = useState('Release')
  const [schedStartDate, setSchedStartDate] = useState('')
  const [schedEndDate, setSchedEndDate] = useState('')
  const [schedLinkedReleaseId, setSchedLinkedReleaseId] = useState('')
  const [schedNotifyDays, setSchedNotifyDays] = useState('1')

  // Team Member Assignment State
  const [isAddTeamMemberOpen, setIsAddTeamMemberOpen] = useState(false)
  const [companyUsers, setCompanyUsers] = useState<any[]>([])
  const [selectedMemberUserId, setSelectedMemberUserId] = useState('')
  const [memberRoleInApp, setMemberRoleInApp] = useState('Developer')

  const { applicationScopes, fetchSettings } = useSettingsStore()

  // Custom Section Form State
  const [secTitle, setSecTitle] = useState('')
  const [secType, setSecType] = useState<'custom_form' | 'markdown' | 'checklist'>('custom_form')
  const [secIcon, setSecIcon] = useState('Sliders')
  const [secTitleError, setSecTitleError] = useState('')
  const [isSavingSection, setIsSavingSection] = useState(false)

  // Release Forms
  const [relVersion, setRelVersion] = useState('')
  const [relName, setRelName] = useState('')
  const [relTargetDate, setRelTargetDate] = useState(new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0])
  const [relDescription, setRelDescription] = useState('')
  const [relFeatures, setRelFeatures] = useState<string[]>([])
  const [featureInput, setFeatureInput] = useState('')

  // Edit Release Form
  const [editRelVersion, setEditRelVersion] = useState('')
  const [editRelName, setEditRelName] = useState('')
  const [editRelStatus, setEditRelStatus] = useState<ReleaseStatus>('Planning')
  const [editRelTargetDate, setEditRelTargetDate] = useState('')
  const [editRelDescription, setEditRelDescription] = useState('')
  const [editRelFeatures, setEditRelFeatures] = useState<string[]>([])
  const [editFeatureInput, setEditFeatureInput] = useState('')

  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('Medium')
  const [taskAssignee, setTaskAssignee] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')

  // Edit Task State
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editTaskTitle, setEditTaskTitle] = useState('')
  const [editTaskDesc, setEditTaskDesc] = useState('')
  const [editTaskPriority, setEditTaskPriority] = useState<TaskPriority>('Medium')
  const [editTaskStatus, setEditTaskStatus] = useState<TaskStatus>('Todo')
  const [editTaskAssignee, setEditTaskAssignee] = useState('')
  const [editTaskDueDate, setEditTaskDueDate] = useState('')

  // Universal Document Attachment States across Entities
  const [taskAttachName, setTaskAttachName] = useState('')
  const [taskAttachData, setTaskAttachData] = useState('')
  const [taskAttachSize, setTaskAttachSize] = useState<number | null>(null)

  const [editTaskAttachName, setEditTaskAttachName] = useState('')
  const [editTaskAttachData, setEditTaskAttachData] = useState('')
  const [editTaskAttachSize, setEditTaskAttachSize] = useState<number | null>(null)

  const [ifAttachName, setIfAttachName] = useState('')
  const [ifAttachData, setIfAttachData] = useState('')
  const [ifAttachSize, setIfAttachSize] = useState<number | null>(null)

  const [editIfAttachName, setEditIfAttachName] = useState('')
  const [editIfAttachData, setEditIfAttachData] = useState('')
  const [editIfAttachSize, setEditIfAttachSize] = useState<number | null>(null)

  const [apiAttachName, setApiAttachName] = useState('')
  const [apiAttachData, setApiAttachData] = useState('')
  const [apiAttachSize, setApiAttachSize] = useState<number | null>(null)

  const [editApiAttachName, setEditApiAttachName] = useState('')
  const [editApiAttachData, setEditApiAttachData] = useState('')
  const [editApiAttachSize, setEditApiAttachSize] = useState<number | null>(null)

  const [schedAttachName, setSchedAttachName] = useState('')
  const [schedAttachData, setSchedAttachData] = useState('')
  const [schedAttachSize, setSchedAttachSize] = useState<number | null>(null)

  const [activeBackend, setActiveBackend] = useState<string>('none')

  // Interface Form State (MQ, Kafka, Schedulers, Event Brokers)
  const [ifName, setIfName] = useState('')
  const [ifType, setIfType] = useState('MQ')
  const [ifServiceProvider, setIfServiceProvider] = useState('')
  const [ifTargetAudience, setIfTargetAudience] = useState('')
  const [ifDirection, setIfDirection] = useState('Provided')
  const [ifConnectionDetails, setIfConnectionDetails] = useState('')
  const [ifEndpoint, setIfEndpoint] = useState('')
  const [ifStatus, setIfStatus] = useState('Active')
  const [ifDescription, setIfDescription] = useState('')

  // API Form State (Endpoints, Client ID, Scopes, Given To)
  const [apiName, setApiName] = useState('')
  const [apiMethod, setApiMethod] = useState<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ALL'>('POST')
  const [apiEndpoint, setApiEndpoint] = useState('')
  const [apiAuthType, setApiAuthType] = useState('OAuth2')
  const [apiClientId, setApiClientId] = useState('')
  const [apiScope, setApiScope] = useState('')
  const [apiApiKeyMeta, setApiApiKeyMeta] = useState('')
  const [apiGivenTo, setApiGivenTo] = useState('')
  const [apiRateLimit, setApiRateLimit] = useState('')
  const [apiStatus, setApiStatus] = useState('Active')
  const [apiDescription, setApiDescription] = useState('')

  const [docTitle, setDocTitle] = useState('')
  const [docCategory, setDocCategory] = useState('BRD')
  const [docUrl, setDocUrl] = useState('')
  const [docFileName, setDocFileName] = useState('')
  const [docFileData, setDocFileData] = useState('')
  const [docFileSize, setDocFileSize] = useState<number | null>(null)
  const [isUploadingDoc, setIsUploadingDoc] = useState(false)

  // Secrets Vault inside Product
  const [vaultUnlocked, setVaultUnlocked] = useState(false)
  const [vaultPassphrase, setVaultPassphrase] = useState('')
  const [vaultError, setVaultError] = useState('')
  const [secrets, setSecrets] = useState<any[]>([])
  const [azureSecrets, setAzureSecrets] = useState<any[]>([])
  const [loadingAzureSecrets, setLoadingAzureSecrets] = useState(false)
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; val: string } | null>(null)
  const [isAddSecretOpen, setIsAddSecretOpen] = useState(false)
  const [secName, setSecName] = useState('')
  const [secVal, setSecVal] = useState('')
  const [secCat, setSecCat] = useState('Database')
  const [secTargetVault, setSecTargetVault] = useState<'azure' | 'local'>('azure')
  const [secModalPassphrase, setSecModalPassphrase] = useState('')
  const [secModalError, setSecModalError] = useState('')
  const [isSavingSecret, setIsSavingSecret] = useState(false)

  // UAT Form States
  const [uatTitle, setUatTitle] = useState('')
  const [uatReleaseId, setUatReleaseId] = useState('')
  const [uatAssignee, setUatAssignee] = useState('')
  const [uatDescription, setUatDescription] = useState('')
  const [uatNotes, setUatNotes] = useState('')
  const [uatResult, setUatResult] = useState<TestResult>('Pending')
  const [uatAttachName, setUatAttachName] = useState('')
  const [uatAttachData, setUatAttachData] = useState('')
  const [uatAttachSize, setUatAttachSize] = useState<number | null>(null)

  // Edit UAT Form States
  const [editUatTitle, setEditUatTitle] = useState('')
  const [editUatReleaseId, setEditUatReleaseId] = useState('')
  const [editUatAssignee, setEditUatAssignee] = useState('')
  const [editUatDescription, setEditUatDescription] = useState('')
  const [editUatNotes, setEditUatNotes] = useState('')
  const [editUatResult, setEditUatResult] = useState<TestResult>('Pending')
  const [editUatAttachName, setEditUatAttachName] = useState('')
  const [editUatAttachData, setEditUatAttachData] = useState('')
  const [editUatAttachSize, setEditUatAttachSize] = useState<number | null>(null)

  // QA Sign-Off Modal State
  const [isSignOffOpen, setIsSignOffOpen] = useState(false)
  const [signOffReleaseId, setSignOffReleaseId] = useState('')
  const [signOffNotes, setSignOffNotes] = useState('')
  const [signOffSigner, setSignOffSigner] = useState('')
  const [releaseSignoffs, setReleaseSignoffs] = useState<any[]>([])

  // Edit Product Form
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<string>('Internal')
  const [editStatus, setEditStatus] = useState<any>('Active')
  const [editOwner, setEditOwner] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editIcon, setEditIcon] = useState('')

  // Filter & Search States across Workspace Tabs
  const [relSearch, setRelSearch] = useState('')
  const [relStatusFilter, setRelStatusFilter] = useState('All')

  const [taskSearch, setTaskSearch] = useState('')
  const [taskStatusFilter, setTaskStatusFilter] = useState('All')
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('All')
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState('All')

  const [ifSearch, setIfSearch] = useState('')
  const [ifTypeFilter, setIfTypeFilter] = useState('All')
  const [ifDirectionFilter, setIfDirectionFilter] = useState('All')
  const [ifStatusFilter, setIfStatusFilter] = useState('All')
  const [ifConsumerFilter, setIfConsumerFilter] = useState('All')

  const [apiSearch, setApiSearch] = useState('')
  const [apiMethodFilter, setApiMethodFilter] = useState('All')
  const [apiAuthFilter, setApiAuthFilter] = useState('All')
  const [apiStatusFilter, setApiStatusFilter] = useState('All')
  const [apiConsumerFilter, setApiConsumerFilter] = useState('All')

  const [secSearch, setSecSearch] = useState('')
  const [secCatFilter, setSecCatFilter] = useState('All')
  const [secSourceFilter, setSecSourceFilter] = useState<'All' | 'local' | 'azure-keyvault'>('All')
  const [akvStatus, setAkvStatus] = useState<{ connected: boolean; status?: string; connectedAs?: string | null; error?: string | null } | null>(null)

  const [teamSearch, setTeamSearch] = useState('')
  const [teamStatusFilter, setTeamStatusFilter] = useState('All')
  const [teamLocFilter, setTeamLocFilter] = useState('All')

  const [docSearch, setDocSearch] = useState('')
  const [docCategoryFilter, setDocCategoryFilter] = useState('All')
  const [docStorageFilter, setDocStorageFilter] = useState('All')

  const [schedSearch, setSchedSearch] = useState('')
  const [schedTypeFilter, setSchedTypeFilter] = useState('All')

  // UAT Filter States
  const [uatSearch, setUatSearch] = useState('')
  const [uatStatusFilter, setUatStatusFilter] = useState('All')
  const [uatReleaseFilter, setUatReleaseFilter] = useState('All')
  const [uatAssigneeFilter, setUatAssigneeFilter] = useState('All')

  const loadWorkspaceData = async () => {
    if (!productId) return
    try {
      const prods = await dbQuery<any>('SELECT * FROM products WHERE id = ?', [productId])
      if (prods.length === 0) {
        navigate('/products')
        return
      }
      const p = prods[0]
      const isPO = currentUser?.role === 'ProductOwner'
      const isLead = currentUser?.role === 'ProductLead'
      const isExec = currentUser?.role === 'Management'
      const isOwner = Boolean(currentUser && (
        p.owner_id === currentUser.id || 
        p.owner_id === currentUser.displayName || 
        p.owner_id === currentUser.username
      ))

      let isAssignedMember = false
      if (currentUser) {
        try {
          const ptm = await dbQuery<any>(
            'SELECT id FROM product_team_members WHERE product_id = ? AND (user_id = ? OR user_id = ? OR user_id = ?)',
            [productId, currentUser.id, currentUser.username, currentUser.displayName]
          )
          isAssignedMember = ptm.length > 0
        } catch {}
      }

      const canView = isPO || isExec || isOwner || isAssignedMember || currentUser?.role === 'TeamMember'
      if (!canView) {
        setIsAccessDenied(true)
        setLoading(false)
        return
      }
      setIsAccessDenied(false)

      const prodObj: Product = {
        id: p.id,
        name: p.name,
        type: p.type || 'Internal',
        status: p.status,
        owner: p.owner_id || '',
        description: p.description || '',
        icon: p.icon || '',
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }
      setProduct(prodObj)
      setEditName(prodObj.name)
      setEditType(prodObj.type || 'Internal')
      setEditStatus(prodObj.status)
      setEditOwner(prodObj.owner)
      setEditDesc(prodObj.description || '')
      setEditIcon(prodObj.icon || '')

      try {
        const ab = await (window as any).horizon?.plugins?.getActiveBackend?.()
        if (ab) setActiveBackend(ab)
      } catch {}

      // Releases
      const relRows = await dbQuery<any>('SELECT * FROM releases WHERE product_id = ? ORDER BY target_date ASC', [productId])
      const mappedReleases: Release[] = relRows.map(r => ({
        id: r.id,
        productId: r.product_id,
        version: r.version,
        name: r.name,
        status: r.status,
        targetDate: r.target_date,
        releasedDate: r.released_date,
        description: r.description,
        features: r.features_json ? JSON.parse(r.features_json) : [],
        serverUpgrades: r.server_upgrades,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }))
      setReleases(mappedReleases)
      if (mappedReleases.length > 0 && !selectedRelease) {
        setSelectedRelease(mappedReleases[0])
      }

      // Tasks
      const taskRows = await dbQuery<any>('SELECT * FROM tasks WHERE product_id = ? ORDER BY created_at DESC', [productId])
      const mappedTasks: Task[] = taskRows.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assigneeId: t.assignee_id,
        productId: t.product_id,
        releaseId: t.release_id,
        dueDate: t.due_date,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }))
      setTasks(mappedTasks)

      // Interfaces (MQ, Kafka, Scheduler, Event Brokers)
      const ifRows = await dbQuery<any>('SELECT * FROM interfaces WHERE product_id = ? ORDER BY name ASC', [productId])
      setInterfaces(ifRows)

      // Dedicated APIs (Endpoints, Scopes, Given To)
      const apiRows = await dbQuery<any>('SELECT * FROM apis WHERE product_id = ? ORDER BY name ASC', [productId])
      setApis(apiRows)

      // Documents
      const docRows = await dbQuery<any>('SELECT * FROM documents_meta WHERE product_id = ?', [productId])
      setDocuments(docRows)

      // Schedule Events
      const schedRows = await dbQuery<any>(
        `SELECT * FROM schedule_events 
         WHERE linked_id = ? 
            OR (linked_type = 'Product' AND linked_id = ?) 
            OR (linked_type = 'Release' AND linked_id IN (SELECT id FROM releases WHERE product_id = ?))
         ORDER BY start_date ASC`,
        [productId, productId, productId]
      )
      setScheduleEvents(schedRows)

      // UAT Test Cases (linked directly or via releases of this product)
      try {
        const uatRows = await dbQuery<any>(
          `SELECT u.*, r.name as release_name, r.version as release_version 
           FROM uat_cases u
           LEFT JOIN releases r ON u.release_id = r.id
           WHERE u.product_id = ? 
              OR u.release_id IN (SELECT id FROM releases WHERE product_id = ?)
           ORDER BY u.updated_at DESC`,
          [productId, productId]
        )
        const mappedUat: UATCase[] = uatRows.map(u => ({
          id: u.id,
          releaseId: u.release_id,
          productId: u.product_id || productId,
          title: u.title,
          description: u.description,
          result: u.result || 'Pending',
          assigneeId: u.assignee_id,
          notes: u.notes,
          attachmentName: u.attachment_name,
          attachmentData: u.attachment_data,
          attachmentSize: u.attachment_size,
          spItemId: u.sp_item_id,
          updatedAt: u.updated_at,
          ...(u.release_name ? { releaseName: u.release_name, releaseVersion: u.release_version } : {})
        } as any))
        setUatCases(mappedUat)
      } catch (uatErr) {
        console.warn('Error loading UAT cases:', uatErr)
      }

      // Query Release Sign-Offs for releases belonging to this product
      try {
        const signoffRows = await dbQuery<any>(
          `SELECT rs.*, r.name as release_name, r.version as release_version
           FROM release_signoffs rs
           INNER JOIN releases r ON rs.release_id = r.id
           WHERE r.product_id = ?
           ORDER BY rs.signed_off_at DESC`,
          [productId]
        )
        setReleaseSignoffs(signoffRows)
      } catch (soErr) {
        console.warn('Error loading release signoffs:', soErr)
      }

      // Application Team Members
      try {
        await dbExecute(`CREATE TABLE IF NOT EXISTS product_team_members (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role_in_product TEXT DEFAULT 'Contributor',
          assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(product_id, user_id)
        )`)

        // Ensure application owner is seeded as Product Lead
        const appOwner = p.owner_id || currentUser?.displayName || currentUser?.username || 'Product Owner'
        await dbExecute(
          `INSERT OR IGNORE INTO product_team_members (id, product_id, user_id, role_in_product)
           VALUES (?, ?, ?, 'Product Lead')`,
          [`ptm-lead-${productId}`, productId, appOwner]
        )

        const members = await dbQuery<any>(`
          SELECT 
            ptm.id as membership_id,
            ptm.role_in_product,
            ptm.assigned_at,
            u.id as user_id,
            COALESCE(u.display_name, ptm.user_id) as display_name,
            u.username,
            COALESCE(u.role, 'TeamMember') as system_role,
            u.email,
            u.avatar_initials,
            hr.status as hr_status,
            hr.work_location,
            hr.leave_from,
            hr.leave_to,
            hr.notes as hr_notes,
            hr.phone
          FROM product_team_members ptm
          LEFT JOIN users u ON (u.id = ptm.user_id OR u.display_name = ptm.user_id OR u.username = ptm.user_id)
          LEFT JOIN hr_records hr ON (hr.user_id = u.id OR hr.user_id = u.display_name)
          WHERE ptm.product_id = ?
          ORDER BY 
            CASE WHEN ptm.role_in_product = 'Product Lead' THEN 0 ELSE 1 END,
            COALESCE(u.display_name, ptm.user_id) ASC
        `, [productId])
        setTeamMembers(members)

        // All active users for the Add Team Member dropdown
        const allUsers = await dbQuery<any>(
          'SELECT id, display_name, username, role, email, avatar_initials FROM users WHERE active = 1 ORDER BY display_name ASC'
        )
        setCompanyUsers(allUsers)
      } catch (tmErr) {
        console.warn('Error loading product team members:', tmErr)
      }

      // Custom Sections
      try {
        await dbExecute(`CREATE TABLE IF NOT EXISTS product_custom_sections (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          title TEXT NOT NULL,
          section_type TEXT NOT NULL,
          content_json TEXT NOT NULL,
          icon TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`)
        const customRows = await dbQuery<any>('SELECT * FROM product_custom_sections WHERE product_id = ? ORDER BY created_at ASC', [productId])
        setCustomSections(customRows)
      } catch (e) {
        console.warn('Could not query product_custom_sections:', e)
      }
    } catch (err) {
      console.error('Error loading workspace data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadAzureSecrets = async () => {
    try {
      const token = getSessionToken()
      if ((window as any).horizon?.secrets?.listAzure && token) {
        setLoadingAzureSecrets(true)
        const list = await (window as any).horizon.secrets.listAzure(token)
        const formatted = (list || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          category: s.category || 'Cloud Secret',
          description: s.description || (akvStatus?.connectedAs ? `Azure Key Vault (${akvStatus.connectedAs})` : 'Azure Key Vault Secret'),
          lastRotatedAt: s.updated_at,
          createdAt: s.created_at,
          source: 'azure-keyvault',
          vaultUrl: s.vaultUrl,
          enabled: s.enabled
        }))
        setAzureSecrets(formatted)
      }
    } catch (e) {
      console.warn('Could not list Azure secrets:', e)
    } finally {
      setLoadingAzureSecrets(false)
    }
  }

  useEffect(() => {
    loadWorkspaceData()
    fetchSettings()
    if ((window as any).horizon?.secrets?.getAzureStatus) {
      (window as any).horizon.secrets.getAzureStatus().then((res: any) => {
        setAkvStatus(res)
        if (res?.connected) {
          loadAzureSecrets()
        }
      }).catch(() => {})
    }
  }, [productId, fetchSettings])

  // --- Release Actions ---
  const handleAddFeature = () => {
    if (!featureInput.trim()) return
    setRelFeatures([...relFeatures, featureInput.trim()])
    setFeatureInput('')
  }

  const handleCreateRelease = async () => {
    if (!relVersion.trim() || !relName.trim() || !productId) return
    const id = `rel-${relVersion.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`
    const targetDateIso = new Date(relTargetDate).toISOString()
    await dbExecute(
      `INSERT INTO releases (id, product_id, version, name, status, target_date, description, features_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'Planning', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, productId, relVersion.trim(), relName.trim(), targetDateIso, relDescription, JSON.stringify(relFeatures)]
    )

    // Synchronize to schedule_events so deadline displays immediately across Dashboard and Notifications
    try {
      await dbExecute(
        `INSERT OR REPLACE INTO schedule_events (id, title, type, start_date, end_date, linked_id, linked_type, notify_at, notified, created_by, created_at, updated_at)
         VALUES (?, ?, 'Release', ?, ?, ?, 'Release', ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [`ev-${id}`, `${relName.trim()} (${relVersion.trim()}) Cutover`, targetDateIso, targetDateIso, id, targetDateIso, currentUser?.displayName || 'User']
      )
    } catch (e) {
      console.warn('schedule_events sync warning:', e)
    }

    setIsAddReleaseOpen(false)
    setRelVersion('')
    setRelName('')
    setRelDescription('')
    setRelFeatures([])
    await loadWorkspaceData()
  }

  const handleOpenEditRelease = (r: Release) => {
    setEditingRelease(r)
    setEditRelVersion(r.version)
    setEditRelName(r.name)
    setEditRelStatus(r.status)
    setEditRelTargetDate(r.targetDate ? new Date(r.targetDate).toISOString().split('T')[0] : '')
    setEditRelDescription(r.description || '')
    setEditRelFeatures(r.features || [])
    setEditFeatureInput('')
    setIsEditReleaseOpen(true)
  }

  const handleAddEditFeature = () => {
    if (!editFeatureInput.trim()) return
    setEditRelFeatures(prev => [...prev, editFeatureInput.trim()])
    setEditFeatureInput('')
  }

  const handleRemoveEditFeature = (idx: number) => {
    setEditRelFeatures(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSaveEditRelease = async () => {
    if (!editingRelease || !editRelVersion.trim() || !editRelName.trim()) return
    const targetDateIso = editRelTargetDate ? new Date(editRelTargetDate).toISOString() : new Date().toISOString()

    await dbExecute(
      `UPDATE releases SET version = ?, name = ?, status = ?, target_date = ?, description = ?, features_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [editRelVersion.trim(), editRelName.trim(), editRelStatus, targetDateIso, editRelDescription, JSON.stringify(editRelFeatures), editingRelease.id]
    )

    try {
      await dbExecute(
        `INSERT OR REPLACE INTO schedule_events (id, title, type, start_date, end_date, linked_id, linked_type, notify_at, notified, created_by, created_at, updated_at)
         VALUES (?, ?, 'Release', ?, ?, ?, 'Release', ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [`ev-${editingRelease.id}`, `${editRelName.trim()} (${editRelVersion.trim()}) Cutover`, targetDateIso, targetDateIso, editingRelease.id, targetDateIso, currentUser?.displayName || 'User']
      )
    } catch (e) {
      console.warn('schedule_events sync warning:', e)
    }

    setIsEditReleaseOpen(false)
    await loadWorkspaceData()
    if (selectedRelease?.id === editingRelease.id) {
      setSelectedRelease(prev => prev ? {
        ...prev,
        version: editRelVersion.trim(),
        name: editRelName.trim(),
        status: editRelStatus,
        targetDate: targetDateIso,
        description: editRelDescription,
        features: editRelFeatures
      } : null)
    }
    setEditingRelease(null)
  }

  const handleDeleteRelease = async (id: string) => {
    if (confirm('Permanently remove this release from the roadmap?')) {
      await dbExecute('DELETE FROM releases WHERE id = ?', [id])
      try {
        await dbExecute('DELETE FROM schedule_events WHERE linked_id = ?', [id])
      } catch {}
      await loadWorkspaceData()
      if (selectedRelease?.id === id) setSelectedRelease(null)
    }
  }

  const handleUpdateReleaseStatus = async (id: string, newStatus: ReleaseStatus) => {
    await dbExecute('UPDATE releases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id])
    await loadWorkspaceData()
    if (selectedRelease?.id === id) {
      setSelectedRelease(prev => prev ? { ...prev, status: newStatus } : null)
    }
  }

  // --- Universal Document Attachment Helper ---
  const uploadAndLinkDocument = async ({
    title,
    fileName,
    fileData,
    fileSize,
    category,
    linkedType,
    linkedId,
    linkedName,
    description
  }: {
    title: string
    fileName: string
    fileData: string
    fileSize?: number
    category: string
    linkedType?: string
    linkedId?: string
    linkedName?: string
    description?: string
  }) => {
    if (!fileName || !fileData || !productId) return
    const docId = `doc-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`
    let cloudStatus = 'LocalOnly'
    let webUrl = '#'
    let driveItemId = docId

    try {
      const currentBackend = await (window as any).horizon?.plugins?.getActiveBackend?.()
      if (currentBackend && currentBackend !== 'none' && (window as any).horizon?.storage?.uploadDocument) {
        const result = await (window as any).horizon.storage.uploadDocument(fileName, fileData, category)
        if (result) {
          cloudStatus = currentBackend === 'mongodb-core' ? 'GridFS' : 'Synced'
          if (result.webUrl) webUrl = result.webUrl
          if (result.driveItemId) driveItemId = result.driveItemId
        }
      }
    } catch (err) {
      console.warn('Document upload cloud sync error, saving locally:', err)
      cloudStatus = 'LocalOnly'
    }

    await dbExecute(
      `INSERT INTO documents_meta (
        id, title, description, category, product_id, owner_id, version, drive_item_id, web_url,
        last_modified, file_size, file_name, file_data, sharepoint_status,
        linked_entity_type, linked_entity_id, linked_entity_name
      ) VALUES (?, ?, ?, ?, ?, ?, '1.0', ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?)`,
      [
        docId,
        title || fileName,
        description || null,
        category,
        productId,
        product?.owner || currentUser?.displayName || 'Product Owner',
        driveItemId,
        webUrl,
        fileSize || null,
        fileName,
        fileData,
        cloudStatus,
        linkedType || null,
        linkedId || null,
        linkedName || null
      ]
    )
  }

  // --- Task Actions ---
  const handleCreateTask = async () => {
    if (!taskTitle.trim() || !productId) return
    const id = `tsk-${Date.now().toString().slice(-6)}`
    await dbExecute(
      `INSERT INTO tasks (id, title, description, status, priority, assignee_id, product_id, release_id, due_date, created_at, updated_at)
       VALUES (?, ?, ?, 'Todo', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, taskTitle.trim(), taskDesc, taskPriority, taskAssignee || currentUser?.displayName || 'Unassigned', productId, selectedRelease?.id || null, taskDueDate || null]
    )

    if (taskAssignee && taskAssignee !== 'Unassigned') {
      triggerAssignmentNotification({
        targetAssignee: taskAssignee,
        title: `Task Assigned: ${taskTitle.trim()}`,
        message: `${currentUser?.displayName || 'Product Lead'} assigned "${taskTitle.trim()}" to you in ${product?.name || 'Workspace'}.`,
        entityType: 'Task',
        entityId: id,
        productName: product?.name
      })
    }

    if (taskAttachName && taskAttachData) {
      await uploadAndLinkDocument({
        title: `${taskTitle.trim()} - Specification`,
        fileName: taskAttachName,
        fileData: taskAttachData,
        fileSize: taskAttachSize || undefined,
        category: 'Task',
        linkedType: 'task',
        linkedId: id,
        linkedName: taskTitle.trim()
      })
      setTaskAttachName('')
      setTaskAttachData('')
      setTaskAttachSize(null)
    }

    setIsAddTaskOpen(false)
    setTaskTitle('')
    setTaskDesc('')
    await loadWorkspaceData()
  }

  const handleOpenEditTask = (task: Task) => {
    setEditingTask(task)
    setEditTaskTitle(task.title || '')
    setEditTaskDesc(task.description || '')
    setEditTaskPriority(task.priority || 'Medium')
    setEditTaskStatus(task.status || 'Todo')
    setEditTaskAssignee(task.assigneeId || '')
    setEditTaskDueDate(task.dueDate || '')
    setEditTaskAttachName('')
    setEditTaskAttachData('')
    setEditTaskAttachSize(null)
    setIsEditTaskOpen(true)
  }

  const handleUpdateTask = async () => {
    if (!editingTask || !editTaskTitle.trim()) return
    await dbExecute(
      `UPDATE tasks
       SET title = ?, description = ?, status = ?, priority = ?, assignee_id = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        editTaskTitle.trim(),
        editTaskDesc,
        editTaskStatus,
        editTaskPriority,
        editTaskAssignee || 'Unassigned',
        editTaskDueDate || null,
        editingTask.id
      ]
    )

    if (editTaskAssignee && editTaskAssignee !== 'Unassigned' && editTaskAssignee !== editingTask.assigneeId) {
      triggerAssignmentNotification({
        targetAssignee: editTaskAssignee,
        title: `Task Assigned: ${editTaskTitle.trim()}`,
        message: `${currentUser?.displayName || 'Product Lead'} assigned "${editTaskTitle.trim()}" to you in ${product?.name || 'Workspace'}.`,
        entityType: 'Task',
        entityId: editingTask.id,
        productName: product?.name
      })
    }

    if (editTaskAttachName && editTaskAttachData) {
      await uploadAndLinkDocument({
        title: `${editTaskTitle.trim()} - Spec`,
        fileName: editTaskAttachName,
        fileData: editTaskAttachData,
        fileSize: editTaskAttachSize || undefined,
        category: 'Task',
        linkedType: 'task',
        linkedId: editingTask.id,
        linkedName: editTaskTitle.trim()
      })
      setEditTaskAttachName('')
      setEditTaskAttachData('')
      setEditTaskAttachSize(null)
    }

    setIsEditTaskOpen(false)
    setEditingTask(null)
    await loadWorkspaceData()
  }

  const handleDeleteTask = async (taskId: string) => {
    if (confirm('Delete this task?')) {
      await dbExecute('DELETE FROM tasks WHERE id = ?', [taskId])
      try {
        await (window as any).horizon?.plugins?.deleteCloudRecord?.('tasks', taskId)
      } catch {}
      setIsEditTaskOpen(false)
      setEditingTask(null)
      await loadWorkspaceData()
    }
  }

  const handleTaskStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    if (isManagement) return
    await dbExecute('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, taskId])
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
  }

  // --- Service & Event Interface Actions ---
  const handleOpenAddInterface = () => {
    setIfName('')
    setIfType('MQ')
    setIfServiceProvider('')
    setIfTargetAudience('')
    setIfDirection('Provided')
    setIfConnectionDetails('')
    setIfEndpoint('')
    setIfStatus('Active')
    setIfDescription('')
    setIfAttachName('')
    setIfAttachData('')
    setIfAttachSize(null)
    setIsAddInterfaceOpen(true)
  }

  const handleOpenEditInterface = (item: any) => {
    setEditingInterface(item)
    setIfName(item.name || '')
    setIfType(item.type || 'MQ')
    setIfServiceProvider(item.service_provider || '')
    setIfTargetAudience(item.target_audience || '')
    setIfDirection(item.direction || 'Provided')
    setIfConnectionDetails(item.connection_details || '')
    setIfEndpoint(item.endpoint || '')
    setIfStatus(item.status || 'Active')
    setIfDescription(item.description || '')
    setEditIfAttachName('')
    setEditIfAttachData('')
    setEditIfAttachSize(null)
    setIsEditInterfaceOpen(true)
  }

  const handleCreateInterface = async () => {
    if (!ifName.trim() || !productId) return
    const id = `if-${Date.now().toString().slice(-6)}`
    await dbExecute(
      `INSERT INTO interfaces (id, product_id, name, type, endpoint, service_provider, target_audience, direction, connection_details, owner_id, status, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        productId,
        ifName.trim(),
        ifType,
        ifEndpoint.trim() || 'N/A',
        ifServiceProvider.trim(),
        ifTargetAudience.trim(),
        ifDirection,
        ifConnectionDetails.trim(),
        product?.owner || 'Product Owner',
        ifStatus,
        ifDescription.trim()
      ]
    )

    if (ifAttachName && ifAttachData) {
      await uploadAndLinkDocument({
        title: `${ifName.trim()} - Interface Contract`,
        fileName: ifAttachName,
        fileData: ifAttachData,
        fileSize: ifAttachSize || undefined,
        category: 'ICD',
        linkedType: 'interface',
        linkedId: id,
        linkedName: ifName.trim()
      })
      setIfAttachName('')
      setIfAttachData('')
      setIfAttachSize(null)
    }

    setIsAddInterfaceOpen(false)
    await loadWorkspaceData()
  }

  const handleUpdateInterface = async () => {
    if (!editingInterface || !ifName.trim()) return
    await dbExecute(
      `UPDATE interfaces 
       SET name = ?, type = ?, endpoint = ?, service_provider = ?, target_audience = ?, direction = ?, connection_details = ?, status = ?, description = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        ifName.trim(),
        ifType,
        ifEndpoint.trim() || 'N/A',
        ifServiceProvider.trim(),
        ifTargetAudience.trim(),
        ifDirection,
        ifConnectionDetails.trim(),
        ifStatus,
        ifDescription.trim(),
        editingInterface.id
      ]
    )

    if (editIfAttachName && editIfAttachData) {
      await uploadAndLinkDocument({
        title: `${ifName.trim()} - Interface Contract`,
        fileName: editIfAttachName,
        fileData: editIfAttachData,
        fileSize: editIfAttachSize || undefined,
        category: 'ICD',
        linkedType: 'interface',
        linkedId: editingInterface.id,
        linkedName: ifName.trim()
      })
      setEditIfAttachName('')
      setEditIfAttachData('')
      setEditIfAttachSize(null)
    }

    setIsEditInterfaceOpen(false)
    setEditingInterface(null)
    await loadWorkspaceData()
  }

  const handleDeleteInterface = async (id: string) => {
    if (confirm('Delete this service / event interface?')) {
      await dbExecute('DELETE FROM interfaces WHERE id = ?', [id])
      try {
        await (window as any).horizon?.plugins?.deleteCloudRecord?.('interfaces', id)
      } catch {}
      await loadWorkspaceData()
    }
  }

  // --- API & Endpoint Actions ---
  const handleOpenAddApi = () => {
    setApiName('')
    setApiMethod('POST')
    setApiEndpoint('')
    setApiAuthType('OAuth2')
    setApiClientId('')
    setApiScope('')
    setApiApiKeyMeta('')
    setApiGivenTo('')
    setApiRateLimit('')
    setApiStatus('Active')
    setApiDescription('')
    setApiAttachName('')
    setApiAttachData('')
    setApiAttachSize(null)
    setIsAddApiOpen(true)
  }

  const handleOpenEditApi = (item: any) => {
    setEditingApi(item)
    setApiName(item.name || '')
    setApiMethod(item.method || 'POST')
    setApiEndpoint(item.endpoint || '')
    setApiAuthType(item.auth_type || 'OAuth2')
    setApiClientId(item.client_id || '')
    setApiScope(item.scope || '')
    setApiApiKeyMeta(item.api_key_meta || '')
    setApiGivenTo(item.given_to || '')
    setApiRateLimit(item.rate_limit || '')
    setApiStatus(item.status || 'Active')
    setApiDescription(item.description || '')
    setEditApiAttachName('')
    setEditApiAttachData('')
    setEditApiAttachSize(null)
    setIsEditApiOpen(true)
  }

  const handleCreateApi = async () => {
    if (!apiName.trim() || !apiEndpoint.trim() || !productId) return
    const id = `api-${Date.now().toString().slice(-6)}`
    await dbExecute(
      `INSERT INTO apis (id, product_id, name, method, endpoint, auth_type, client_id, scope, api_key_meta, given_to, rate_limit, owner_id, status, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        productId,
        apiName.trim(),
        apiMethod,
        apiEndpoint.trim(),
        apiAuthType,
        apiClientId.trim(),
        apiScope.trim(),
        apiApiKeyMeta.trim(),
        apiGivenTo.trim() || 'Internal Services',
        apiRateLimit.trim(),
        product?.owner || 'Product Owner',
        apiStatus,
        apiDescription.trim()
      ]
    )

    if (apiAttachName && apiAttachData) {
      await uploadAndLinkDocument({
        title: `${apiName.trim()} - API Specification`,
        fileName: apiAttachName,
        fileData: apiAttachData,
        fileSize: apiAttachSize || undefined,
        category: 'API',
        linkedType: 'api',
        linkedId: id,
        linkedName: apiName.trim()
      })
      setApiAttachName('')
      setApiAttachData('')
      setApiAttachSize(null)
    }

    setIsAddApiOpen(false)
    await loadWorkspaceData()
  }

  const handleUpdateApi = async () => {
    if (!editingApi || !apiName.trim() || !apiEndpoint.trim()) return
    await dbExecute(
      `UPDATE apis
       SET name = ?, method = ?, endpoint = ?, auth_type = ?, client_id = ?, scope = ?, api_key_meta = ?, given_to = ?, rate_limit = ?, status = ?, description = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        apiName.trim(),
        apiMethod,
        apiEndpoint.trim(),
        apiAuthType,
        apiClientId.trim(),
        apiScope.trim(),
        apiApiKeyMeta.trim(),
        apiGivenTo.trim() || 'Internal Services',
        apiRateLimit.trim(),
        apiStatus,
        apiDescription.trim(),
        editingApi.id
      ]
    )

    if (editApiAttachName && editApiAttachData) {
      await uploadAndLinkDocument({
        title: `${apiName.trim()} - API Specification`,
        fileName: editApiAttachName,
        fileData: editApiAttachData,
        fileSize: editApiAttachSize || undefined,
        category: 'API',
        linkedType: 'api',
        linkedId: editingApi.id,
        linkedName: apiName.trim()
      })
      setEditApiAttachName('')
      setEditApiAttachData('')
      setEditApiAttachSize(null)
    }

    setIsEditApiOpen(false)
    setEditingApi(null)
    await loadWorkspaceData()
  }

  const handleDeleteApi = async (id: string) => {
    if (confirm('Delete this API endpoint?')) {
      await dbExecute('DELETE FROM apis WHERE id = ?', [id])
      try {
        await (window as any).horizon?.plugins?.deleteCloudRecord?.('apis', id)
      } catch {}
      await loadWorkspaceData()
    }
  }

  // --- Document Actions ---
  const handleFileUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setDocFileName(file.name)
    setDocFileSize(file.size)
    if (!docTitle.trim()) {
      // Auto-populate title with file name without extension
      setDocTitle(file.name.replace(/\.[^/.]+$/, ''))
    }
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setDocFileData(base64)
    }
    reader.readAsDataURL(file)
  }

  const handleCreateDoc = async () => {
    if (!docTitle.trim() || !productId) return
    setIsUploadingDoc(true)
    const id = `doc-${Date.now().toString().slice(-6)}`
    let spStatus = docFileData ? 'LocalOnly' : 'Pending'
    let webUrl = docUrl || '#'
    let driveItemId = id

    // Unified storage router (MongoDB GridFS or SharePoint depending on active backend)
    if (docFileData && docFileName) {
      try {
        const currentBackend = await (window as any).horizon?.plugins?.getActiveBackend?.()
        if (currentBackend && currentBackend !== 'none' && (window as any).horizon?.storage?.uploadDocument) {
          const result = await (window as any).horizon.storage.uploadDocument(
            docFileName,
            docFileData,
            docCategory
          )
          if (result) {
            spStatus = currentBackend === 'mongodb-core' ? 'GridFS' : 'Synced'
            if (result.webUrl) webUrl = result.webUrl
            if (result.driveItemId) driveItemId = result.driveItemId
          }
        }
      } catch (err) {
        console.warn('Unified cloud document upload fallback to local:', err)
        spStatus = 'LocalOnly'
      }
    }

    await dbExecute(
      `INSERT INTO documents_meta (
        id, title, category, product_id, owner_id, version, drive_item_id, web_url, 
        last_modified, file_name, file_data, file_size, sharepoint_status
      ) VALUES (?, ?, ?, ?, ?, '1.0', ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)`,
      [
        id, 
        docTitle.trim(), 
        docCategory, 
        productId, 
        product?.owner || 'Product Owner', 
        driveItemId,
        webUrl, 
        docFileName || null,
        docFileData || null,
        docFileSize || null,
        spStatus
      ]
    )

    setIsUploadingDoc(false)
    setIsAddDocOpen(false)
    setDocTitle('')
    setDocUrl('')
    setDocFileName('')
    setDocFileData('')
    setDocFileSize(null)
    await loadWorkspaceData()
  }

  const handleDownloadDoc = (doc: any) => {
    if (doc.file_data) {
      const a = document.createElement('a')
      a.href = doc.file_data
      a.download = doc.file_name || `${doc.title || 'document'}.bin`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } else if (doc.web_url && doc.web_url !== '#') {
      window.open(doc.web_url, '_blank')
    } else {
      alert('No file attached or web link available for this document.')
    }
  }

  const handleDeleteDoc = async (id: string) => {
    if (confirm('Are you sure you want to delete this specification document?')) {
      await dbExecute('DELETE FROM documents_meta WHERE id = ?', [id])
      try {
        await (window as any).horizon?.plugins?.deleteCloudRecord?.('documents_meta', id)
      } catch {}
      await loadWorkspaceData()
    }
  }


  // --- Vault Actions ---
  const handleUnlockVault = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vaultPassphrase.trim()) return
    try {
      const token = getSessionToken()
      const ok = await (window as any).horizon.secrets.unlock(token, vaultPassphrase)
      if (ok) {
        setVaultUnlocked(true)
        setVaultError('')
        const list = await (window as any).horizon.secrets.list(token)
        setSecrets(list || [])
      } else {
        setVaultError('Invalid master passphrase')
      }
    } catch (err: any) {
      setVaultError(err.message || 'Failed to unlock')
    }
  }

  const handleAddSecret = async () => {
    setSecModalError('')
    if (!secName.trim()) {
      setSecModalError('Secret name is required')
      return
    }
    if (!secVal.trim()) {
      setSecModalError('Secret value is required')
      return
    }

    setIsSavingSecret(true)
    try {
      const token = getSessionToken()
      if (secTargetVault === 'azure' && akvStatus?.connected) {
        await (window as any).horizon.secrets.addAzure(token, secName.trim(), secVal.trim(), secCat)
        await loadAzureSecrets()
      } else {
        if (!vaultUnlocked) {
          if (!secModalPassphrase.trim()) {
            setSecModalError('Please enter your master passphrase to unlock & encrypt this secret')
            setIsSavingSecret(false)
            return
          }
          const ok = await (window as any).horizon.secrets.unlock(token, secModalPassphrase)
          if (!ok) {
            setSecModalError('Invalid master passphrase')
            setIsSavingSecret(false)
            return
          }
          setVaultUnlocked(true)
          setVaultError('')
        }

        await (window as any).horizon.secrets.add(token, secName.trim(), secCat, secVal.trim(), `Scoped to application: ${product?.name}`)
        const list = await (window as any).horizon.secrets.list(token)
        setSecrets(list || [])
      }
      setIsAddSecretOpen(false)
      setSecName('')
      setSecVal('')
      setSecModalPassphrase('')
      setSecModalError('')
    } catch (err: any) {
      setSecModalError(err.message || 'Error saving secret')
    } finally {
      setIsSavingSecret(false)
    }
  }

  const handleRevealSecret = async (id: string) => {
    if (revealedSecret?.id === id) {
      setRevealedSecret(null)
      return
    }
    try {
      const token = getSessionToken()
      let plain: string
      if (id.includes('.vault.azure.net') || id.startsWith('https://')) {
        const secretName = id.includes('/secrets/') ? (id.split('/secrets/')[1]?.split('/')[0] || id) : id
        plain = await (window as any).horizon.secrets.revealAzure(token, secretName)
      } else {
        plain = await (window as any).horizon.secrets.reveal(token, id)
      }
      setRevealedSecret({ id, val: plain })
      setTimeout(() => setRevealedSecret(prev => prev?.id === id ? null : prev), 30000)
    } catch (err: any) {
      alert(err.message || 'Failed to reveal')
    }
  }

  // --- Custom Section Management ---
  const handleCreateCustomSection = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setSecTitleError('')
    const cleanTitle = secTitle.trim()
    if (!cleanTitle) {
      setSecTitleError('Please enter a title for the custom section / form.')
      return
    }
    const targetProdId = productId || product?.id
    if (!targetProdId) {
      setSecTitleError('Active product ID not found. Please refresh the page.')
      return
    }

    setIsSavingSection(true)
    const id = `sec-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`
    let initialContent = ''
    if (secType === 'custom_form') {
      initialContent = JSON.stringify([
        { label: 'Environment / Cluster', value: 'Production-East-1' },
        { label: 'SLA Availability Target', value: '99.95%' },
        { label: 'Primary Contact / On-Call', value: product?.owner || currentUser?.displayName || 'Product Owner' }
      ])
    } else if (secType === 'checklist') {
      initialContent = JSON.stringify([
        { text: 'Architecture design review approved', done: true },
        { text: 'Security assessment completed', done: false },
        { text: 'Production load test verified', done: false }
      ])
    } else {
      initialContent = `# ${cleanTitle}\n\nDocument architectural specifics, runbooks, or deployment guidelines for ${product?.name || 'this application'} here.`
    }

    const newSection: CustomSection = {
      id,
      product_id: targetProdId,
      title: cleanTitle,
      section_type: secType,
      content_json: initialContent,
      icon: secIcon,
      created_at: new Date().toISOString()
    }

    try {
      await dbExecute(`CREATE TABLE IF NOT EXISTS product_custom_sections (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        title TEXT NOT NULL,
        section_type TEXT NOT NULL,
        content_json TEXT NOT NULL,
        icon TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`)

      await dbExecute(
        `INSERT INTO product_custom_sections (id, product_id, title, section_type, content_json, icon, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, targetProdId, newSection.title, newSection.section_type, newSection.content_json, newSection.icon]
      )

      // Update state and navigate to the newly created section
      setCustomSections(prev => [...prev, newSection])
      setIsAddSectionOpen(false)
      setSecTitle('')
      setSecTitleError('')
      setActiveTab(id)
    } catch (err: any) {
      console.error('Failed to save custom section to database:', err)
      setSecTitleError(`Failed to save section: ${err?.message || err}`)
    } finally {
      setIsSavingSection(false)
    }
  }

  const handleDeleteCustomSection = async (secId: string) => {
    if (confirm('Delete this custom section?')) {
      setCustomSections(prev => prev.filter(s => s.id !== secId))
      setActiveTab('releases')
      try {
        await dbExecute('DELETE FROM product_custom_sections WHERE id = ?', [secId])
      } catch (err) {
        console.error('Failed to delete section from DB:', err)
      }
    }
  }

  const handleUpdateCustomSectionContent = async (secId: string, updatedJson: string) => {
    setCustomSections(prev => prev.map(s => s.id === secId ? { ...s, content_json: updatedJson } : s))
    try {
      await dbExecute('UPDATE product_custom_sections SET content_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [updatedJson, secId])
    } catch (err) {
      console.error('Failed to update section content in DB:', err)
    }
  }

  // --- Schedule Milestone Handlers ---
  const handleCreateScheduleEvent = async () => {
    if (!schedTitle.trim() || !schedStartDate) {
      alert('Please provide a milestone title and start date.')
      return
    }
    if (!productId) return
    try {
      const id = `sched-${Date.now()}`
      const notifyAt = schedNotifyDays && schedNotifyDays !== '0'
        ? new Date(new Date(schedStartDate).getTime() - parseInt(schedNotifyDays, 10) * 86400000).toISOString()
        : null
      const creator = currentUser?.displayName || currentUser?.username || 'Team Member'
      const linkedId = schedLinkedReleaseId || productId
      const linkedType = schedLinkedReleaseId ? 'Release' : 'Product'

      await dbExecute(
        `INSERT INTO schedule_events (id, title, type, start_date, end_date, linked_id, linked_type, notify_at, notified, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          id,
          schedTitle.trim(),
          schedType,
          new Date(schedStartDate).toISOString(),
          schedEndDate ? new Date(schedEndDate).toISOString() : null,
          linkedId,
          linkedType,
          notifyAt,
          creator
        ]
      )

      if (schedAttachName && schedAttachData) {
        await uploadAndLinkDocument({
          title: `${schedTitle.trim()} - Milestone Doc`,
          fileName: schedAttachName,
          fileData: schedAttachData,
          fileSize: schedAttachSize || undefined,
          category: 'Runbook',
          linkedType: 'schedule',
          linkedId: id,
          linkedName: schedTitle.trim()
        })
        setSchedAttachName('')
        setSchedAttachData('')
        setSchedAttachSize(null)
      }

      await loadWorkspaceData()
      setIsAddScheduleOpen(false)
      setSchedTitle('')
      setSchedStartDate('')
      setSchedEndDate('')
      setSchedLinkedReleaseId('')
      setSchedNotifyDays('1')
    } catch (err: any) {
      alert('Failed to save schedule milestone: ' + (err.message || err))
    }
  }

  const handleDeleteScheduleEvent = async (id: string, title: string) => {
    if (confirm(`Delete milestone "${title}"?`)) {
      try {
        await dbExecute('DELETE FROM schedule_events WHERE id = ?', [id])
        await loadWorkspaceData()
      } catch (err: any) {
        alert('Failed to delete milestone: ' + (err.message || err))
      }
    }
  }

  // --- Team Member Assignment Handlers ---
  const handleAddTeamMember = async () => {
    if (!selectedMemberUserId) {
      alert('Please select a team member.')
      return
    }
    if (!productId) return
    try {
      const id = `ptm-${Date.now()}`
      await dbExecute(
        `INSERT INTO product_team_members (id, product_id, user_id, role_in_product, assigned_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [id, productId, selectedMemberUserId, memberRoleInApp || 'Developer']
      )
      await loadWorkspaceData()
      setIsAddTeamMemberOpen(false)
      setSelectedMemberUserId('')
      setMemberRoleInApp('Developer')
    } catch (err: any) {
      alert('Error assigning team member: ' + (err.message || err))
    }
  }

  const handleRemoveTeamMember = async (membershipId: string, name: string) => {
    if (confirm(`Remove ${name} from this application?`)) {
      try {
        await dbExecute('DELETE FROM product_team_members WHERE id = ?', [membershipId])
        await loadWorkspaceData()
      } catch (err: any) {
        alert('Error removing member: ' + (err.message || err))
      }
    }
  }

  // --- UAT Test Case Handlers ---
  const handleOpenAddUat = () => {
    setIsEditUatOpen(false)
    setEditingUatCase(null)
    setUatTitle('')
    const defaultRelId = (uatReleaseFilter !== 'All' ? uatReleaseFilter : '') || releases[0]?.id || 'rel-general'
    setUatReleaseId(defaultRelId)
    setUatAssignee(currentUser?.displayName || currentUser?.username || '')
    setUatDescription('')
    setUatNotes('')
    setUatResult('Pending')
    setUatAttachName('')
    setUatAttachData('')
    setUatAttachSize(null)
    setIsAddUatOpen(true)
  }

  const handleCreateUatCase = async () => {
    if (!uatTitle.trim() || !productId) return
    const relId = uatReleaseId || releases[0]?.id || 'rel-general'
    const id = `uat-${Date.now().toString().slice(-6)}`
    
    await dbExecute(
      `INSERT INTO uat_cases (id, release_id, product_id, title, description, result, assignee_id, notes, attachment_name, attachment_data, attachment_size, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [id, relId, productId, uatTitle.trim(), uatDescription, uatResult, uatAssignee || 'Unassigned', uatNotes, uatAttachName || null, uatAttachData || null, uatAttachSize || null]
    )

    if (uatAssignee && uatAssignee !== 'Unassigned') {
      triggerAssignmentNotification({
        targetAssignee: uatAssignee,
        title: `UAT Test Assigned: ${uatTitle.trim()}`,
        message: `${currentUser?.displayName || 'Product Lead'} assigned UAT test "${uatTitle.trim()}" to you in ${product?.name || 'Workspace'}.`,
        entityType: 'UAT',
        entityId: id,
        productName: product?.name
      })
    }

    if (uatAttachName && uatAttachData) {
      const matchedRel = releases.find(r => r.id === relId)
      const relLabel = matchedRel ? `${matchedRel.name} (${matchedRel.version})` : 'General UAT'
      await uploadAndLinkDocument({
        title: `${uatTitle.trim()} - Test Evidence`,
        fileName: uatAttachName,
        fileData: uatAttachData,
        fileSize: uatAttachSize || undefined,
        category: 'UAT',
        linkedType: 'uat',
        linkedId: id,
        linkedName: `${relLabel} / ${uatTitle.trim()}`,
        description: `Quality Gate Test Evidence for ${relLabel} - Scenario: ${uatTitle.trim()}`
      })
    }

    setIsAddUatOpen(false)
    await loadWorkspaceData()
  }

  const handleOpenEditUat = (tc: UATCase) => {
    setEditingUatCase(tc)
    setEditUatTitle(tc.title || '')
    setEditUatReleaseId(tc.releaseId || '')
    setEditUatAssignee(tc.assigneeId || '')
    setEditUatDescription(tc.description || '')
    setEditUatNotes(tc.notes || '')
    setEditUatResult(tc.result || 'Pending')
    setEditUatAttachName(tc.attachmentName || '')
    setEditUatAttachData(tc.attachmentData || '')
    setEditUatAttachSize(tc.attachmentSize || null)
    setIsEditUatOpen(true)
  }

  const handleUpdateUatCase = async () => {
    if (!editingUatCase || !editUatTitle.trim()) return
    const previousAssignee = editingUatCase.assigneeId
    const targetRelId = editUatReleaseId || editingUatCase.releaseId

    await dbExecute(
      `UPDATE uat_cases 
       SET title = ?, release_id = ?, assignee_id = ?, description = ?, notes = ?, result = ?, attachment_name = ?, attachment_data = ?, attachment_size = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        editUatTitle.trim(), 
        targetRelId, 
        editUatAssignee || 'Unassigned', 
        editUatDescription, 
        editUatNotes, 
        editUatResult, 
        editUatAttachName || null, 
        editUatAttachData || null, 
        editUatAttachSize || null, 
        editingUatCase.id
      ]
    )

    if (editUatAssignee && editUatAssignee !== 'Unassigned' && editUatAssignee !== previousAssignee) {
      triggerAssignmentNotification({
        targetAssignee: editUatAssignee,
        title: `UAT Test Reassigned: ${editUatTitle.trim()}`,
        message: `${currentUser?.displayName || 'Product Lead'} reassigned UAT test "${editUatTitle.trim()}" to you in ${product?.name || 'Workspace'}.`,
        entityType: 'UAT',
        entityId: editingUatCase.id,
        productName: product?.name
      })
    }

    if (editUatAttachName && editUatAttachData && editUatAttachData !== editingUatCase.attachmentData) {
      const matchedRel = releases.find(r => r.id === targetRelId)
      const relLabel = matchedRel ? `${matchedRel.name} (${matchedRel.version})` : 'General UAT'
      await uploadAndLinkDocument({
        title: `${editUatTitle.trim()} - Test Evidence`,
        fileName: editUatAttachName,
        fileData: editUatAttachData,
        fileSize: editUatAttachSize || undefined,
        category: 'UAT',
        linkedType: 'uat',
        linkedId: editingUatCase.id,
        linkedName: `${relLabel} / ${editUatTitle.trim()}`,
        description: `Quality Gate Test Evidence for ${relLabel} - Scenario: ${editUatTitle.trim()}`
      })
    }

    setIsEditUatOpen(false)
    setEditingUatCase(null)
    await loadWorkspaceData()
  }

  const handleDownloadUatAttachment = (name?: string, data?: string) => {
    if (!data) return
    const link = document.createElement('a')
    link.href = data
    link.download = name || 'test-evidence'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleOpenSignOff = (relId?: string) => {
    const targetRelId = relId || (uatReleaseFilter !== 'All' ? uatReleaseFilter : (releases[0]?.id || ''))
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
    const relCases = uatCases.filter(u => u.releaseId === signOffReleaseId)
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
      await loadWorkspaceData()
    } catch (err: any) {
      console.error('Error recording QA sign-off:', err)
      alert('Failed to complete QA sign-off: ' + (err.message || err))
    }
  }

  const handleDeleteUatCase = async (id: string, title: string) => {
    if (confirm(`Delete test scenario "${title}"?`)) {
      try {
        setIsEditUatOpen(false)
        setEditingUatCase(null)
        await dbExecute('DELETE FROM uat_cases WHERE id = ?', [id])
        await loadWorkspaceData()
      } catch (err: any) {
        alert('Failed to delete test scenario: ' + (err.message || err))
      }
    }
  }

  const handleUatStatusChange = async (id: string, newResult: TestResult) => {
    try {
      await dbExecute('UPDATE uat_cases SET result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newResult, id])
      setUatCases(prev => prev.map(tc => tc.id === id ? { ...tc, result: newResult } : tc))
    } catch (err) {
      console.error('Failed to update UAT status:', err)
    }
  }

  // --- Edit Product ---
  const handleUpdateProduct = async () => {
    if (!editName.trim() || !productId) return
    const isPO = currentUser?.role === 'ProductOwner'
    const finalOwner = isPO ? (editOwner.trim() || product?.owner || 'Product Owner') : (product?.owner || currentUser?.displayName || 'Team Member')
    await dbExecute(
      'UPDATE products SET name = ?, type = ?, status = ?, owner_id = ?, description = ?, icon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [editName.trim(), editType, editStatus, finalOwner, editDesc.trim(), editIcon, productId]
    )
    setIsEditProductOpen(false)
    await loadWorkspaceData()
  }

  if (isAccessDenied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 max-w-lg mx-auto">
        <div className="p-4 rounded-3xl bg-red-500/10 border border-red-500/30 text-red-400 mb-4 shadow-xl">
          <ShieldAlert size={40} />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Application Access Restricted</h3>
        <p className="text-xs text-gray-400 mb-6 leading-relaxed">
          You do not have administrative authority or ownership permissions to view or modify this application. Team members can only access applications they own.
        </p>
        <Button onClick={() => navigate('/products')} className="bg-[#2E5EFF] text-white gap-2">
          <ArrowLeft size={16} /> Return to My Applications
        </Button>
      </div>
    )
  }

  if (loading || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Sparkles className="animate-spin text-[#2E5EFF] mb-3" size={32} />
        <span className="text-xs font-semibold uppercase text-gray-400">Loading Application Workspace...</span>
      </div>
    )
  }

  const stepList = ['Planning', 'Development', 'QA', 'UAT', 'SignOff', 'Released']
  const getStepIndex = (st: string) => Math.max(0, stepList.indexOf(st))

  const activeCustomSection = customSections.find(s => s.id === activeTab)

  // Filtered collections
  const filteredReleases = releases.filter(r => {
    const q = relSearch.toLowerCase().trim()
    const matchesSearch = !q || 
      r.name.toLowerCase().includes(q) || 
      r.version.toLowerCase().includes(q) || 
      (r.description && r.description.toLowerCase().includes(q)) ||
      (r.features && r.features.some(f => f.toLowerCase().includes(q)))
    const matchesStatus = relStatusFilter === 'All' || r.status === relStatusFilter
    return matchesSearch && matchesStatus
  })

  const filteredTasks = tasks.filter(t => {
    const q = taskSearch.toLowerCase().trim()
    const matchesSearch = !q ||
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.assigneeId && t.assigneeId.toLowerCase().includes(q))
    const matchesStatus = taskStatusFilter === 'All' || t.status === taskStatusFilter
    const matchesPriority = taskPriorityFilter === 'All' || t.priority === taskPriorityFilter
    const matchesAssignee = taskAssigneeFilter === 'All' || t.assigneeId === taskAssigneeFilter
    return matchesSearch && matchesStatus && matchesPriority && matchesAssignee
  })

  // Distinct Consumer Options
  const ifConsumerOptions = Array.from(
    new Set(interfaces.map(i => (i.target_audience || '').trim()).filter(Boolean))
  ).sort()

  const apiConsumerOptions = Array.from(
    new Set(apis.map(a => (a.given_to || '').trim()).filter(Boolean))
  ).sort()

  const filteredInterfaces = interfaces.filter(i => {
    const q = ifSearch.toLowerCase().trim()
    const matchesSearch = !q ||
      (i.name && i.name.toLowerCase().includes(q)) ||
      (i.endpoint && i.endpoint.toLowerCase().includes(q)) ||
      (i.service_provider && i.service_provider.toLowerCase().includes(q)) ||
      (i.target_audience && i.target_audience.toLowerCase().includes(q)) ||
      (i.connection_details && i.connection_details.toLowerCase().includes(q)) ||
      (i.description && i.description.toLowerCase().includes(q))
    const matchesType = ifTypeFilter === 'All' || i.type === ifTypeFilter
    const matchesDirection = ifDirectionFilter === 'All' || i.direction === ifDirectionFilter
    const matchesStatus = ifStatusFilter === 'All' || i.status === ifStatusFilter
    const matchesConsumer = ifConsumerFilter === 'All' || (i.target_audience && i.target_audience.trim() === ifConsumerFilter)
    return matchesSearch && matchesType && matchesDirection && matchesStatus && matchesConsumer
  })

  const filteredApis = apis.filter(a => {
    const q = apiSearch.toLowerCase().trim()
    const matchesSearch = !q ||
      (a.name && a.name.toLowerCase().includes(q)) ||
      (a.endpoint && a.endpoint.toLowerCase().includes(q)) ||
      (a.client_id && a.client_id.toLowerCase().includes(q)) ||
      (a.scope && a.scope.toLowerCase().includes(q)) ||
      (a.given_to && a.given_to.toLowerCase().includes(q)) ||
      (a.description && a.description.toLowerCase().includes(q))
    const matchesMethod = apiMethodFilter === 'All' || a.method === apiMethodFilter
    const matchesAuth = apiAuthFilter === 'All' || a.auth_type === apiAuthFilter
    const matchesStatus = apiStatusFilter === 'All' || a.status === apiStatusFilter
    const matchesConsumer = apiConsumerFilter === 'All' || (a.given_to && a.given_to.trim() === apiConsumerFilter)
    return matchesSearch && matchesMethod && matchesAuth && matchesStatus && matchesConsumer
  })

  // Merge unlocked local secrets with always-available Azure Key Vault secrets
  const allAvailableSecrets = [
    ...(vaultUnlocked ? secrets.filter(s => s.source !== 'azure-keyvault') : []),
    ...azureSecrets
  ]

  const filteredSecrets = allAvailableSecrets.filter(s => {
    const q = secSearch.toLowerCase().trim()
    const matchesSearch = !q || (s.name && s.name.toLowerCase().includes(q)) || (s.description && s.description.toLowerCase().includes(q))
    const matchesCat = secCatFilter === 'All' || s.category === secCatFilter
    const matchesSource = secSourceFilter === 'All' || (s.source || 'local') === secSourceFilter
    return matchesSearch && matchesCat && matchesSource
  })

  const filteredTeamMembers = teamMembers.filter(m => {
    const q = teamSearch.toLowerCase().trim()
    const matchesSearch = !q ||
      (m.display_name && m.display_name.toLowerCase().includes(q)) ||
      (m.role && m.role.toLowerCase().includes(q)) ||
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.phone && m.phone.toLowerCase().includes(q)) ||
      (m.hr_notes && m.hr_notes.toLowerCase().includes(q))
    const matchesStatus = teamStatusFilter === 'All' || (m.hr_status || 'Available') === teamStatusFilter
    const matchesLoc = teamLocFilter === 'All' || (m.work_location || 'Office') === teamLocFilter
    return matchesSearch && matchesStatus && matchesLoc
  })

  const filteredDocuments = documents.filter(d => {
    const q = docSearch.toLowerCase().trim()
    const matchesSearch = !q ||
      (d.title && d.title.toLowerCase().includes(q)) ||
      (d.file_name && d.file_name.toLowerCase().includes(q)) ||
      (d.category && d.category.toLowerCase().includes(q)) ||
      (d.description && d.description.toLowerCase().includes(q)) ||
      (d.linked_entity_name && d.linked_entity_name.toLowerCase().includes(q)) ||
      (d.linked_entity_type && d.linked_entity_type.toLowerCase().includes(q))
    const matchesCat = docCategoryFilter === 'All' || d.category === docCategoryFilter
    const matchesStorage = docStorageFilter === 'All' ||
      (docStorageFilter === 'GridFS' && d.sharepoint_status === 'GridFS') ||
      (docStorageFilter === 'SharePoint' && d.sharepoint_status === 'Synced') ||
      (docStorageFilter === 'Local' && !!d.file_data && d.sharepoint_status !== 'Synced' && d.sharepoint_status !== 'GridFS') ||
      (docStorageFilter === 'Web' && (!d.file_data && d.web_url && d.web_url !== '#'))
    return matchesSearch && matchesCat && matchesStorage
  })

  const filteredScheduleEvents = scheduleEvents.filter(s => {
    const q = schedSearch.toLowerCase().trim()
    const matchesSearch = !q ||
      (s.title && s.title.toLowerCase().includes(q)) ||
      (s.linked_type && s.linked_type.toLowerCase().includes(q))
    const matchesType = schedTypeFilter === 'All' || s.type === schedTypeFilter
    return matchesSearch && matchesType
  })

  // Filtered UAT Test Cases & Stats
  const filteredUatCases = uatCases.filter(u => {
    const q = uatSearch.toLowerCase().trim()
    const matchesSearch = !q ||
      (u.title && u.title.toLowerCase().includes(q)) ||
      (u.description && u.description.toLowerCase().includes(q)) ||
      (u.assigneeId && u.assigneeId.toLowerCase().includes(q)) ||
      (u.notes && u.notes.toLowerCase().includes(q))
    const matchesStatus = uatStatusFilter === 'All' || u.result === uatStatusFilter
    const matchesRelease = uatReleaseFilter === 'All' || u.releaseId === uatReleaseFilter
    const matchesAssignee = uatAssigneeFilter === 'All' || u.assigneeId === uatAssigneeFilter
    return matchesSearch && matchesStatus && matchesRelease && matchesAssignee
  })

  const uatTotal = uatCases.length
  const uatPassed = uatCases.filter(u => u.result === 'Pass').length
  const uatFailed = uatCases.filter(u => u.result === 'Fail').length
  const uatBlocked = uatCases.filter(u => u.result === 'Blocked').length
  const uatPending = uatCases.filter(u => u.result === 'Pending').length
  const uatPassRate = uatTotal > 0 ? Math.round((uatPassed / uatTotal) * 100) : 0

  return (
    <div className="w-full max-w-[1720px] mx-auto space-y-6 px-2 sm:px-4 lg:px-6 py-3 animate-in fade-in duration-150">
      {/* ── Roomy Application Header Bar ──────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-[#0B1229]/95 border border-[#172347] shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={() => navigate('/products')}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#131D3B] transition-colors shrink-0 group"
            title="Back to All Applications"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <div className="w-10 h-10 rounded-xl bg-[#2E5EFF]/15 border border-[#2E5EFF]/30 flex items-center justify-center text-[#2E5EFF] text-xl font-bold shrink-0 overflow-hidden">
            {product.icon ? (
              isImageIcon(product.icon) ? (
                <img src={product.icon} alt={product.name} className="w-full h-full object-contain p-1 rounded-xl" />
              ) : (
                <span className="select-none">{product.icon}</span>
              )
            ) : (
              <Package size={20} />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-white tracking-tight truncate">{product.name}</h1>
              {(() => {
                const activeScope = applicationScopes.find(s => s.id === product.type)
                return (
                  <Badge variant={activeScope?.badge || (product.type === 'External' ? 'orange' : 'blue')}>
                    {activeScope?.label ? activeScope.id : (product.type || 'Internal')}
                  </Badge>
                )
              })()}
              <Badge variant={product.status === 'Active' ? 'success' : product.status === 'Planning' ? 'warning' : 'neutral'}>
                {product.status}
              </Badge>
            </div>
            {product.description && (
              <p className="text-xs text-gray-400 truncate max-w-xl mt-0.5">
                {product.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Quick Metrics Badges */}
          <div className="hidden lg:flex items-center gap-1.5 xl:gap-2 text-[11px] xl:text-xs font-mono text-gray-400 bg-[#070B19] px-2.5 xl:px-3 py-1.5 rounded-xl border border-[#15203D]">
            <span className="flex items-center gap-1"><GitMerge size={12} className="text-[#2E5EFF]" /><strong className="text-white">{releases.length}</strong> Rel</span>
            <span className="text-gray-600">|</span>
            <span className="flex items-center gap-1"><CheckSquare size={12} className="text-emerald-400" /><strong className="text-white">{tasks.filter(t => t.status !== 'Done').length}</strong> Tasks</span>
            <span className="text-gray-600">|</span>
            <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-teal-400" /><strong className="text-white">{uatCases.length}</strong> UAT ({uatPassRate}%)</span>
            <span className="text-gray-600">|</span>
            <span className="flex items-center gap-1"><Network size={12} className="text-purple-400" /><strong className="text-white">{interfaces.length}</strong> Interfaces</span>
            <span className="text-gray-600">|</span>
            <span className="flex items-center gap-1"><Terminal size={12} className="text-cyan-400" /><strong className="text-white">{apis.length}</strong> APIs</span>
            {akvStatus?.connected && (
              <>
                <span className="text-gray-600">|</span>
                <button 
                  onClick={() => setActiveTab('secrets')} 
                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                  title="Azure Key Vault Connected"
                >
                  <KeyRound size={12} className="text-indigo-400" />
                  <strong className="text-white">{azureSecrets.length}</strong> Azure KV
                </button>
              </>
            )}
            {customSections.length > 0 && (
              <>
                <span className="text-gray-600">|</span>
                <span className="flex items-center gap-1"><Sliders size={12} className="text-[#F5A623]" /><strong className="text-white">{customSections.length}</strong> Forms</span>
              </>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#070B19] border border-[#15203D] text-xs">
            <UserCheck size={13} className="text-[#2E5EFF]" />
            <span className="text-gray-300 font-medium truncate max-w-[120px]">{product.owner || 'Product Owner'}</span>
          </div>

          {isManagement ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
              <ShieldAlert size={14} className="text-amber-400 shrink-0" />
              <span>Executive Read-Only Oversight</span>
            </div>
          ) : (
            <Button 
              size="sm" 
              variant="secondary"
              onClick={() => setIsEditProductOpen(true)}
              className="gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs"
            >
              <Edit3 size={13} /> Configure
            </Button>
          )}
        </div>
      </div>

      {/* ── Roomy Dynamic Tab Navigation Bar ──────────────────────────── */}
      <div className="flex items-center gap-1.5 sm:gap-2 border-b border-[#1E2D52] pb-3 overflow-x-auto custom-scrollbar">
        {/* Core Tabs */}
        {[
          { id: 'releases', label: `Roadmap (${releases.length})`, icon: GitMerge },
          { id: 'tasks', label: `Sprint Tasks (${tasks.length})`, icon: CheckSquare },
          { id: 'uat', label: `Quality Gate (${uatCases.length})`, icon: CheckCircle2 },
          { id: 'interfaces', label: `Interfaces (${interfaces.length})`, icon: Network },
          { id: 'apis', label: `APIs (${apis.length})`, icon: Terminal },
          ...(!isTeamMember && !isManagement ? [{ 
            id: 'secrets', 
            label: `Secrets Vault${akvStatus?.connected ? ` (${allAvailableSecrets.length})` : ''}`, 
            icon: KeyRound,
            badge: akvStatus?.connected ? 'Azure KV' : undefined
          }] : []),
          { id: 'team', label: `Team (${teamMembers.length})`, icon: Users },
          { id: 'documents', label: `Specs (${documents.length})`, icon: FileText },
          { id: 'schedule', label: `Schedule (${scheduleEvents.length})`, icon: Calendar }
        ].map(t => {
          const Icon = t.icon
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? 'bg-[#2E5EFF] text-white shadow-lg shadow-[#2E5EFF]/30 scale-100 sm:scale-105'
                  : 'text-gray-400 hover:text-white hover:bg-[#111A33]'
              }`}
            >
              <Icon size={14} className="shrink-0" />
              <span>{t.label}</span>
              {(t as any).badge && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 uppercase tracking-wider">
                  {(t as any).badge}
                </span>
              )}
            </button>
          )
        })}

        {/* Dynamic Custom Section Tabs */}
        {customSections.map(s => {
          const isActive = activeTab === s.id
          return (
            <button
              key={s.id}
              onClick={() => setActiveTab(s.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border shrink-0 ${
                isActive
                  ? 'bg-[#F5A623] text-black border-[#F5A623] shadow-lg shadow-[#F5A623]/30 scale-100 sm:scale-105'
                  : 'text-[#F5A623] border-[#F5A623]/30 hover:bg-[#F5A623]/10'
              }`}
            >
              {renderSectionIcon(s.icon, 14)}
              <span>{s.title}</span>
            </button>
          )
        })}

        {/* Add Custom Section Action */}
        {!isManagement && (
          <Button 
            size="sm" 
            onClick={() => {
              setSecTitleError('')
              setIsAddSectionOpen(true)
            }}
            className="gap-1.5 shrink-0 bg-[#162347] hover:bg-[#203264] text-white border border-[#2E5EFF]/40 shadow-sm whitespace-nowrap"
          >
            <Plus size={14} /> Add Section
          </Button>
        )}
      </div>

      {/* ── Tab Views ─────────────────────────────────────────────────── */}

      {/* Tab 1: Roadmap & Releases */}
      {activeTab === 'releases' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Application Release Roadmap</h3>
              <p className="text-xs text-gray-400">Target production cutovers, included features, and gate sign-offs for {product.name}.</p>
            </div>
            {!isManagement && (
              <Button size="sm" onClick={() => setIsAddReleaseOpen(true)} className="gap-2">
                <Plus size={15} /> Add Release
              </Button>
            )}
          </div>


          {/* Release Filter Toolbar */}
          <div className="bg-[#0B1229]/90 border border-[#172347] p-3.5 sm:p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={relSearch}
                  onChange={e => setRelSearch(e.target.value)}
                  placeholder="Search releases, versions, features..."
                  className="w-full bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/50 focus:border-[#2E5EFF] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
                />
                {relSearch && (
                  <button onClick={() => setRelSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-medium flex items-center gap-1"><Filter size={12} className="text-[#2E5EFF]" /> Status:</span>
                <select
                  value={relStatusFilter}
                  onChange={e => setRelStatusFilter(e.target.value)}
                  className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
                >
                  <option value="All">All Statuses ({releases.length})</option>
                  <option value="Planning">Planning</option>
                  <option value="Development">Development</option>
                  <option value="QA">QA</option>
                  <option value="UAT">UAT</option>
                  <option value="SignOff">SignOff</option>
                  <option value="Released">Released</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-xs text-gray-400 bg-[#070B19] px-3 py-1.5 rounded-xl border border-[#15203D]">
                Showing <strong className="text-white">{filteredReleases.length}</strong> of {releases.length}
              </span>
              {(relSearch || relStatusFilter !== 'All') && (
                <button
                  onClick={() => { setRelSearch(''); setRelStatusFilter('All'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#15203D] hover:bg-[#1E2D52] text-xs text-gray-300 hover:text-white transition-colors border border-[#23335D]"
                  title="Reset filters"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              {filteredReleases.map(r => {
                const isSelected = selectedRelease?.id === r.id
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRelease(r)}
                    className={`p-6 rounded-2xl cursor-pointer border transition-all ${
                      isSelected
                        ? 'bg-[#0E1736] border-[#2E5EFF] shadow-[0_0_25px_rgba(46,94,255,0.25)]'
                        : 'bg-[#0A1024]/90 hover:bg-[#0E152E] border-[#1E2D52]'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2.5 mb-1">
                          <span className="font-bold text-base text-white">{r.name}</span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#15203D] text-[#6087FF] border border-[#1E2D52]">
                            {r.version}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-1.5">
                            <Clock size={13} className="text-gray-500" /> Target Cutover: {r.targetDate ? new Date(r.targetDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={r.status === 'Released' ? 'success' : r.status === 'SignOff' ? 'orange' : 'blue'}>
                          {r.status}
                        </Badge>
                        {!isManagement && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenEditRelease(r); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1C2B54] transition-colors"
                              title="Edit Release"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteRelease(r.id); }}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Delete Release"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="pt-3">
                      <PipelineBar activeStep={getStepIndex(r.status)} size="lg" />
                    </div>
                  </div>
                )
              })}

              {filteredReleases.length === 0 && (
                <div className="p-12 text-center bg-[#0A1024]/60 border border-[#1E2D52] rounded-3xl text-sm text-gray-400">
                  {releases.length === 0 ? 'No releases planned for this application yet.' : 'No releases match your search or filter criteria.'}
                  {(relSearch || relStatusFilter !== 'All') && (
                    <div className="mt-3">
                      <Button size="sm" variant="secondary" onClick={() => { setRelSearch(''); setRelStatusFilter('All'); }}>
                        Clear Filters
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Roomy Release Inspector */}
            <div className="lg:col-span-5 bg-[#0A1024] border border-[#1E2D52] rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
              {selectedRelease ? (
                <div className="space-y-6 text-xs">
                  <div className="flex justify-between items-start border-b border-[#1E2D52] pb-4">
                    <div>
                      <h4 className="font-bold text-base text-white">{selectedRelease.name}</h4>
                      <span className="text-xs text-gray-400 font-mono">{selectedRelease.version}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isManagement && (
                        <Button size="sm" variant="secondary" onClick={() => handleOpenEditRelease(selectedRelease)} className="gap-1.5 text-xs py-1 h-auto">
                          <Edit3 size={13} /> Edit
                        </Button>
                      )}
                      <Badge variant={selectedRelease.status === 'Released' ? 'success' : 'blue'}>
                        {selectedRelease.status}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-wider text-gray-400 font-bold block mb-2.5">
                      Advance Pipeline Stage
                    </label>
                    <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-[#070B19] border border-[#1E2D52]">
                      {(stepList as ReleaseStatus[]).map(st => (
                        <button
                          key={st}
                          disabled={isManagement}
                          onClick={() => handleUpdateReleaseStatus(selectedRelease.id, st)}
                          className={`py-2 rounded-xl text-xs font-semibold transition-colors ${
                            selectedRelease.status === st
                              ? 'bg-[#2E5EFF] text-white shadow-md'
                              : isManagement
                              ? 'text-gray-600 cursor-not-allowed opacity-60'
                              : 'text-gray-400 hover:text-white hover:bg-[#15203D]'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>


                  <div>
                    <label className="text-xs uppercase tracking-wider text-gray-400 font-bold block mb-2.5">
                      Scope & Included Features
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {(selectedRelease.features || []).map((feat, i) => (
                        <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#080D1F] border border-[#15203D] text-gray-200">
                          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                          <span className="truncate">{feat}</span>
                        </div>
                      ))}
                      {(!selectedRelease.features || selectedRelease.features.length === 0) && (
                        <span className="text-gray-500 py-2 block">No feature scope items registered.</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-sm text-gray-500">
                  Select a release from the list to inspect details and advance its pipeline stage.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Sprint Tasks & Kanban */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Application Sprint Kanban</h3>
              <p className="text-xs text-gray-400">Manage tasks and feature execution specifically for {product.name}.</p>
            </div>
            {!isManagement && (
              <Button size="sm" onClick={() => setIsAddTaskOpen(true)} className="gap-2">
                <Plus size={15} /> Add Task
              </Button>
            )}
          </div>


          {/* Task Filter Toolbar */}
          <div className="bg-[#0B1229]/90 border border-[#172347] p-3.5 sm:p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={taskSearch}
                  onChange={e => setTaskSearch(e.target.value)}
                  placeholder="Search tasks by title, criteria, assignee..."
                  className="w-full bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/50 focus:border-[#2E5EFF] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
                />
                {taskSearch && (
                  <button onClick={() => setTaskSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={taskStatusFilter}
                onChange={e => setTaskStatusFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Statuses ({tasks.length})</option>
                <option value="Todo">Todo ({tasks.filter(t => t.status === 'Todo').length})</option>
                <option value="InProgress">InProgress ({tasks.filter(t => t.status === 'InProgress').length})</option>
                <option value="Blocked">Blocked ({tasks.filter(t => t.status === 'Blocked').length})</option>
                <option value="Done">Done ({tasks.filter(t => t.status === 'Done').length})</option>
              </select>

              {/* Priority Filter */}
              <select
                value={taskPriorityFilter}
                onChange={e => setTaskPriorityFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Priorities</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

              {/* Assignee Filter */}
              <select
                value={taskAssigneeFilter}
                onChange={e => setTaskAssigneeFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Assignees</option>
                {Array.from(new Set(tasks.map(t => t.assigneeId).filter(Boolean))).map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-xs text-gray-400 bg-[#070B19] px-3 py-1.5 rounded-xl border border-[#15203D]">
                Showing <strong className="text-white">{filteredTasks.length}</strong> of {tasks.length}
              </span>
              {(taskSearch || taskStatusFilter !== 'All' || taskPriorityFilter !== 'All' || taskAssigneeFilter !== 'All') && (
                <button
                  onClick={() => { setTaskSearch(''); setTaskStatusFilter('All'); setTaskPriorityFilter('All'); setTaskAssigneeFilter('All'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#15203D] hover:bg-[#1E2D52] text-xs text-gray-300 hover:text-white transition-colors border border-[#23335D]"
                  title="Reset filters"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>
          </div>

          <div className="p-2 rounded-3xl bg-[#080D1F]/60 border border-[#1E2D52]">
            <KanbanBoard
              tasks={filteredTasks}
              onTaskStatusChange={handleTaskStatusChange}
              onTaskClick={(t) => handleOpenEditTask(t)}
            />
          </div>
        </div>
      )}

      {/* Tab: Quality Gate & UAT Acceptance Verification */}
      {activeTab === 'uat' && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0A1024]/90 border border-[#15203D]">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="text-teal-400" size={20} /> Quality Gate & UAT Verification
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Release acceptance criteria, test scenarios, and gate sign-off execution for {product.name}.
              </p>
            </div>
            {!isManagement && (
              <div className="flex items-center gap-2.5 shrink-0">
                <Button 
                  size="sm" 
                  onClick={() => handleOpenSignOff()} 
                  className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 font-bold"
                >
                  <ShieldCheck size={16} /> QA Sign-Off
                </Button>
                <Button size="sm" onClick={handleOpenAddUat} className="gap-2 bg-[#2E5EFF] text-white shadow-lg shadow-[#2E5EFF]/25">
                  <Plus size={15} /> Add Test Scenario
                </Button>
              </div>
            )}
          </div>

          {/* Release QA Sign-Off Banner (if signed off) */}
          {(() => {
            const activeRelId = uatReleaseFilter !== 'All' ? uatReleaseFilter : releases[0]?.id
            const signoff = releaseSignoffs.find(s => s.release_id === activeRelId)
            const activeRel = releases.find(r => r.id === activeRelId)
            if (!signoff && activeRel?.status !== 'SignOff') return null

            return (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#0D281E]/30 to-[#0A1024] border border-emerald-500/30 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">Quality Gate Certified & Signed Off</span>
                      <Badge variant="success">QA Approved</Badge>
                      {activeRel && (
                        <span className="font-mono text-xs text-emerald-300 font-bold">
                          {activeRel.name} ({activeRel.version})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Signed off by <strong className="text-white">{signoff?.signed_off_by || 'QA Lead'}</strong> on{' '}
                      {signoff?.signed_off_at ? new Date(signoff.signed_off_at).toLocaleDateString() : 'Recent'}.
                      {signoff?.notes ? ` Notes: "${signoff.notes}"` : ''}
                    </p>
                  </div>
                </div>
                {!isManagement && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleOpenSignOff(activeRelId)}
                    className="gap-1.5 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-300 text-xs"
                  >
                    <Edit3 size={13} /> Update Sign-Off
                  </Button>
                )}
              </div>
            )
          })()}

          {/* Quality Gate Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            <div className="p-4 rounded-xl bg-[#0D1429] border border-[#172242]">
              <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Total Scenarios</span>
              <div className="text-2xl font-black text-white mt-1">{uatTotal}</div>
            </div>

            <div className="p-4 rounded-xl bg-[#0D1429] border border-emerald-500/20">
              <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold">Passed</span>
              <div className="text-2xl font-black text-emerald-400 mt-1">{uatPassed}</div>
            </div>

            <div className="p-4 rounded-xl bg-[#0D1429] border border-red-500/20">
              <span className="text-[11px] uppercase tracking-wider text-red-400 font-semibold">Failed</span>
              <div className="text-2xl font-black text-red-400 mt-1">{uatFailed}</div>
            </div>

            <div className="p-4 rounded-xl bg-[#0D1429] border border-yellow-500/20">
              <span className="text-[11px] uppercase tracking-wider text-yellow-400 font-semibold">Blocked</span>
              <div className="text-2xl font-black text-yellow-400 mt-1">{uatBlocked}</div>
            </div>

            <div className="p-4 rounded-xl bg-[#0D1429] border border-teal-500/20">
              <span className="text-[11px] uppercase tracking-wider text-teal-400 font-semibold">Pass Rate</span>
              <div className="text-2xl font-black text-teal-400 mt-1">{uatPassRate}%</div>
            </div>
          </div>

          {/* Acceptance Gate Criteria Visual Progress Bar */}
          <div className="p-4 rounded-2xl bg-[#0A1024]/80 border border-[#15203D]">
            <div className="flex justify-between items-center text-xs font-semibold mb-2">
              <span className="text-gray-300">Acceptance Gate Completion</span>
              <span className={uatPassRate === 100 && uatTotal > 0 ? 'text-emerald-400 font-bold' : 'text-gray-400'}>
                {uatPassRate}% Verified ({uatPassed}/{uatTotal || 0} Passed)
              </span>
            </div>
            <div className="h-2.5 w-full bg-[#111A33] rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${(uatPassed / (uatTotal || 1)) * 100}%` }} title="Passed" />
              <div className="bg-red-500 transition-all duration-500" style={{ width: `${(uatFailed / (uatTotal || 1)) * 100}%` }} title="Failed" />
              <div className="bg-yellow-500 transition-all duration-500" style={{ width: `${(uatBlocked / (uatTotal || 1)) * 100}%` }} title="Blocked" />
            </div>
          </div>

          {/* UAT Filter Toolbar */}
          <div className="bg-[#0B1229]/90 border border-[#172347] p-3.5 sm:p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={uatSearch}
                  onChange={e => setUatSearch(e.target.value)}
                  placeholder="Search scenarios, criteria, testers, notes..."
                  className="w-full bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/50 focus:border-[#2E5EFF] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
                />
                {uatSearch && (
                  <button onClick={() => setUatSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={uatStatusFilter}
                onChange={e => setUatStatusFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Results ({uatCases.length})</option>
                <option value="Pass">Pass ({uatPassed})</option>
                <option value="Fail">Fail ({uatFailed})</option>
                <option value="Blocked">Blocked ({uatBlocked})</option>
                <option value="Pending">Pending ({uatPending})</option>
              </select>

              {/* Release Filter */}
              <select
                value={uatReleaseFilter}
                onChange={e => setUatReleaseFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Releases</option>
                {releases.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({r.version})</option>
                ))}
              </select>

              {/* Assignee Filter */}
              <select
                value={uatAssigneeFilter}
                onChange={e => setUatAssigneeFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Assignees</option>
                {Array.from(new Set(uatCases.map(u => u.assigneeId).filter(Boolean))).map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-xs text-gray-400 bg-[#070B19] px-3 py-1.5 rounded-xl border border-[#15203D]">
                Showing <strong className="text-white">{filteredUatCases.length}</strong> of {uatCases.length}
              </span>
              {(uatSearch || uatStatusFilter !== 'All' || uatReleaseFilter !== 'All' || uatAssigneeFilter !== 'All') && (
                <button
                  onClick={() => { setUatSearch(''); setUatStatusFilter('All'); setUatReleaseFilter('All'); setUatAssigneeFilter('All'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#15203D] hover:bg-[#1E2D52] text-xs text-gray-300 hover:text-white transition-colors border border-[#23335D]"
                  title="Reset filters"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>
          </div>

          {/* Test Case Cards List */}
          <div className="space-y-3.5">
            {filteredUatCases.map(tc => {
              const matchedRel = releases.find(r => r.id === tc.releaseId)
              return (
                <div
                  key={tc.id}
                  className="p-5 rounded-2xl bg-[#0A1024]/90 border border-[#15203D] hover:border-[#2E5EFF]/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h4 className="text-sm font-bold text-white truncate">{tc.title}</h4>
                      <Badge variant={tc.result === 'Pass' ? 'success' : tc.result === 'Fail' ? 'danger' : tc.result === 'Blocked' ? 'warning' : 'neutral'}>
                        {tc.result}
                      </Badge>
                      {matchedRel && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#111A33] text-[#6087FF] border border-[#1E2D52]">
                          {matchedRel.name} ({matchedRel.version})
                        </span>
                      )}
                      {tc.assigneeId && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#15203D] text-gray-300 border border-[#1E2D52]">
                          <UserCheck size={10} className="text-[#2E5EFF]" /> {tc.assigneeId}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                      {tc.description || 'No detailed verification steps specified.'}
                    </p>
                    {tc.notes && (
                      <div className="text-[11px] text-gray-500 font-mono mt-1.5 flex items-center gap-1.5">
                        <Clock size={11} className="text-gray-600" />
                        <span>Notes: {tc.notes}</span>
                      </div>
                    )}
                    {/* Attached Test Evidence Badge */}
                    {((tc as any).attachmentName || (tc as any).attachmentData) && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#080E21] border border-cyan-500/30 text-cyan-300 text-xs">
                          <File size={13} className="text-cyan-400 shrink-0" />
                          <span className="font-mono font-medium max-w-[200px] truncate">
                            {(tc as any).attachmentName || 'Test Evidence'}
                          </span>
                          {(tc as any).attachmentSize && (
                            <span className="text-[10px] text-gray-500 font-mono">
                              ({(((tc as any).attachmentSize || 0) / 1024).toFixed(1)} KB)
                            </span>
                          )}
                          {(tc as any).attachmentData && (
                            <button
                              onClick={() => handleDownloadUatAttachment((tc as any).attachmentName, (tc as any).attachmentData)}
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

                  {/* Status Toggle Buttons & Action Controls */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="flex items-center gap-1 shrink-0 bg-[#070B19] p-1 rounded-xl border border-[#15203D]">
                      {(['Pass', 'Fail', 'Blocked', 'Pending'] as const).map(res => (
                        <button
                          key={res}
                          disabled={isManagement}
                          onClick={() => handleUatStatusChange(tc.id, res)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            tc.result === res 
                              ? res === 'Pass' ? 'bg-emerald-500 text-black shadow-sm' :
                                res === 'Fail' ? 'bg-red-500 text-white shadow-sm' :
                                res === 'Blocked' ? 'bg-yellow-500 text-black shadow-sm' :
                                'bg-gray-700 text-white'
                              : isManagement
                              ? 'text-gray-600 cursor-not-allowed opacity-50'
                              : 'text-gray-400 hover:text-white hover:bg-[#15203D]'
                          }`}
                        >
                          {res}
                        </button>
                      ))}
                    </div>

                    {!isManagement && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditUat(tc)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#15203D] transition-colors"
                          title="Edit Test Case"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteUatCase(tc.id, tc.title)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete Test Case"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {filteredUatCases.length === 0 && (
              <div className="p-12 text-center bg-[#111d3c]/80 border border-[#1e2d52] rounded-2xl text-xs text-gray-400">
                <p className="text-sm font-medium text-gray-300">
                  {uatCases.length === 0
                    ? 'No quality gate test scenarios configured for this application yet.'
                    : 'No test scenarios match your search or filter criteria.'}
                </p>
                {uatCases.length === 0 && !isManagement && (
                  <div className="mt-4">
                    <Button size="sm" onClick={handleOpenAddUat} className="gap-2 bg-[#2E5EFF] text-white font-semibold shadow-md">
                      <Plus size={15} /> Add Test Scenario
                    </Button>
                  </div>
                )}
                {(uatSearch || uatStatusFilter !== 'All' || uatReleaseFilter !== 'All' || uatAssigneeFilter !== 'All') && uatCases.length > 0 && (
                  <div className="mt-3">
                    <Button size="sm" variant="secondary" onClick={() => { setUatSearch(''); setUatStatusFilter('All'); setUatReleaseFilter('All'); setUatAssigneeFilter('All'); }}>
                      Clear Filters
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Service & Event Interfaces (MQ, Kafka, Schedulers) */}
      {activeTab === 'interfaces' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Network className="text-[#2E5EFF]" size={20} /> Service & Event Interfaces
              </h3>
              <p className="text-xs text-gray-400">
                Message queues (MQ), Apache Kafka event streams, background schedulers, and system connections used by {product.name}.
              </p>
            </div>
            {!isManagement && (
              <Button size="sm" onClick={handleOpenAddInterface} className="gap-2 shrink-0">
                <Plus size={15} /> Add Interface
              </Button>
            )}
          </div>


          {/* Interface Filter Toolbar */}
          <div className="bg-[#0B1229]/90 border border-[#172347] p-3.5 sm:p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={ifSearch}
                  onChange={e => setIfSearch(e.target.value)}
                  placeholder="Search interfaces, brokers, queues, topics, consumers..."
                  className="w-full bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/50 focus:border-[#2E5EFF] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
                />
                {ifSearch && (
                  <button onClick={() => setIfSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Protocol Filter */}
              <select
                value={ifTypeFilter}
                onChange={e => setIfTypeFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Protocols ({interfaces.length})</option>
                <option value="MQ">MQ</option>
                <option value="Kafka">Kafka</option>
                <option value="Scheduler">Scheduler</option>
                <option value="gRPC">gRPC</option>
                <option value="SFTP">SFTP</option>
                <option value="DB Link">DB Link</option>
                <option value="Other">Other</option>
              </select>

              {/* Direction Filter */}
              <select
                value={ifDirectionFilter}
                onChange={e => setIfDirectionFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Directions</option>
                <option value="Provided">↑ Provided</option>
                <option value="Consumed">↓ Consumed</option>
                <option value="Bidirectional">⇄ Bidirectional</option>
              </select>

              {/* Status Filter */}
              <select
                value={ifStatusFilter}
                onChange={e => setIfStatusFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Planning">Planning</option>
                <option value="Deprecated">Deprecated</option>
              </select>

              {/* Consumer / Target Audience Filter */}
              <select
                value={ifConsumerFilter}
                onChange={e => setIfConsumerFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Consumers ({ifConsumerOptions.length})</option>
                {ifConsumerOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-xs text-gray-400 bg-[#070B19] px-3 py-1.5 rounded-xl border border-[#15203D]">
                Showing <strong className="text-white">{filteredInterfaces.length}</strong> of {interfaces.length}
              </span>
              {(ifSearch || ifTypeFilter !== 'All' || ifDirectionFilter !== 'All' || ifStatusFilter !== 'All' || ifConsumerFilter !== 'All') && (
                <button
                  onClick={() => { setIfSearch(''); setIfTypeFilter('All'); setIfDirectionFilter('All'); setIfStatusFilter('All'); setIfConsumerFilter('All'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#15203D] hover:bg-[#1E2D52] text-xs text-gray-300 hover:text-white transition-colors border border-[#23335D]"
                  title="Reset filters"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-[#0A1024] border border-[#1E2D52] overflow-hidden shadow-2xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1E2D52] bg-[#0D1429] text-gray-400 uppercase font-bold tracking-wider">
                  <th className="p-4">Interface Name</th>
                  <th className="p-4">Protocol</th>
                  <th className="p-4">Service / Broker</th>
                  <th className="p-4">Direction</th>
                  <th className="p-4">To / For Whom Given</th>
                  <th className="p-4">Connection / Topic / Spec</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2D52]">
                {filteredInterfaces.map(i => (
                  <tr key={i.id} className="hover:bg-[#0E1736] transition-colors">
                    <td className="p-4">
                      <span className="font-bold text-white text-sm block">{i.name}</span>
                      {i.description && <span className="text-[11px] text-gray-400 block mt-0.5 line-clamp-1">{i.description}</span>}
                    </td>
                    <td className="p-4">
                      <Badge variant={i.type === 'Kafka' ? 'orange' : i.type === 'MQ' ? 'blue' : i.type === 'Scheduler' ? 'neutral' : 'info'}>
                        {i.type}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <span className="text-gray-200 font-medium">{i.service_provider || '—'}</span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        i.direction === 'Consumed' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {i.direction === 'Consumed' ? '↓ Consumed' : '↑ Provided'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-gray-300 font-medium">{i.target_audience || 'Internal Systems'}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 max-w-xs">
                        <span className="truncate font-mono text-[11px] text-gray-300 bg-[#070B19] px-2 py-1 rounded border border-[#172242] flex-1">
                          {i.connection_details || i.endpoint}
                        </span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(i.connection_details || i.endpoint);
                            alert('Connection spec copied to clipboard!');
                          }}
                          className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#15203D] transition-colors shrink-0"
                          title="Copy Spec"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant={i.status === 'Active' ? 'success' : i.status === 'Planning' ? 'warning' : 'neutral'}>
                        {i.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      {!isManagement ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditInterface(i)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#15203D] transition-colors"
                            title="Edit Interface"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteInterface(i.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete Interface"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-500 italic">Read-only</span>
                      )}
                    </td>

                  </tr>
                ))}
                {filteredInterfaces.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-gray-500">
                      {interfaces.length === 0
                        ? 'No service or event interfaces registered for this application. Click "Add Interface" to register one.'
                        : 'No interfaces match your search or filter criteria.'}
                      {(ifSearch || ifTypeFilter !== 'All' || ifDirectionFilter !== 'All' || ifStatusFilter !== 'All' || ifConsumerFilter !== 'All') && (
                        <div className="mt-3">
                          <Button size="sm" variant="secondary" onClick={() => { setIfSearch(''); setIfTypeFilter('All'); setIfDirectionFilter('All'); setIfStatusFilter('All'); setIfConsumerFilter('All'); }}>
                            Clear Filters
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3.5: Dedicated APIs & Endpoints */}
      {activeTab === 'apis' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Terminal className="text-cyan-400" size={20} /> APIs & Web Endpoints
              </h3>
              <p className="text-xs text-gray-400">
                Managed endpoints, client IDs, access scopes, rate limits, and client consumers for {product.name}.
              </p>
            </div>
            {!isManagement && (
              <Button size="sm" onClick={handleOpenAddApi} className="gap-2 shrink-0">
                <Plus size={15} /> Add API Endpoint
              </Button>
            )}
          </div>


          {/* API Filter Toolbar */}
          <div className="bg-[#0B1229]/90 border border-[#172347] p-3.5 sm:p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={apiSearch}
                  onChange={e => setApiSearch(e.target.value)}
                  placeholder="Search APIs, endpoints, scopes, client IDs, consumers..."
                  className="w-full bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/50 focus:border-[#2E5EFF] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
                />
                {apiSearch && (
                  <button onClick={() => setApiSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* HTTP Method Filter */}
              <select
                value={apiMethodFilter}
                onChange={e => setApiMethodFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Methods ({apis.length})</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
                <option value="ALL">ALL</option>
              </select>

              {/* Auth Type Filter */}
              <select
                value={apiAuthFilter}
                onChange={e => setApiAuthFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Auth Types</option>
                <option value="OAuth2">OAuth2</option>
                <option value="API Key">API Key</option>
                <option value="Bearer Token">Bearer Token</option>
                <option value="mTLS">mTLS</option>
                <option value="Basic">Basic</option>
                <option value="None">None</option>
              </select>

              {/* Status Filter */}
              <select
                value={apiStatusFilter}
                onChange={e => setApiStatusFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Beta">Beta</option>
                <option value="Planning">Planning</option>
                <option value="Deprecated">Deprecated</option>
              </select>

              {/* Consumer / Given To Filter */}
              <select
                value={apiConsumerFilter}
                onChange={e => setApiConsumerFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Consumers ({apiConsumerOptions.length})</option>
                {apiConsumerOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-xs text-gray-400 bg-[#070B19] px-3 py-1.5 rounded-xl border border-[#15203D]">
                Showing <strong className="text-white">{filteredApis.length}</strong> of {apis.length}
              </span>
              {(apiSearch || apiMethodFilter !== 'All' || apiAuthFilter !== 'All' || apiStatusFilter !== 'All' || apiConsumerFilter !== 'All') && (
                <button
                  onClick={() => { setApiSearch(''); setApiMethodFilter('All'); setApiAuthFilter('All'); setApiStatusFilter('All'); setApiConsumerFilter('All'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#15203D] hover:bg-[#1E2D52] text-xs text-gray-300 hover:text-white transition-colors border border-[#23335D]"
                  title="Reset filters"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-[#0A1024] border border-[#1E2D52] overflow-hidden shadow-2xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1E2D52] bg-[#0D1429] text-gray-400 uppercase font-bold tracking-wider">
                  <th className="p-4">Method & URI</th>
                  <th className="p-4">API Name</th>
                  <th className="p-4">Auth Type</th>
                  <th className="p-4">Client ID & Scope</th>
                  <th className="p-4">Given To / Consumer</th>
                  <th className="p-4">Rate Limit</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2D52]">
                {filteredApis.map(a => (
                  <tr key={a.id} className="hover:bg-[#0E1736] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                          a.method === 'GET' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          a.method === 'POST' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          a.method === 'PUT' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          a.method === 'DELETE' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                          'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        }`}>
                          {a.method}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-gray-200 font-semibold">{a.endpoint}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(a.endpoint);
                              alert('Endpoint URI copied to clipboard!');
                            }}
                            className="p-1 rounded text-gray-500 hover:text-white hover:bg-[#15203D] transition-colors"
                            title="Copy URI"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-white text-sm block">{a.name}</span>
                      {a.description && <span className="text-[11px] text-gray-400 block mt-0.5 line-clamp-1">{a.description}</span>}
                    </td>
                    <td className="p-4">
                      <Badge variant="blue">{a.auth_type}</Badge>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1 max-w-[200px]">
                        {a.client_id ? (
                          <div className="flex items-center gap-1 font-mono text-[11px] text-gray-300 truncate">
                            <span className="text-gray-500">id:</span> {a.client_id}
                          </div>
                        ) : null}
                        {a.scope ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-[#15203D] text-[10px] text-cyan-300 font-mono truncate max-w-full">
                            {a.scope}
                          </span>
                        ) : <span className="text-gray-500 text-[11px]">—</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-gray-300 font-medium">{a.given_to}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-gray-400 text-[11px]">{a.rate_limit || 'Unlimited'}</span>
                    </td>
                    <td className="p-4">
                      <Badge variant={a.status === 'Active' ? 'success' : a.status === 'Beta' ? 'orange' : a.status === 'Planning' ? 'blue' : 'neutral'}>
                        {a.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      {!isManagement ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditApi(a)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#15203D] transition-colors"
                            title="Edit API"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteApi(a.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete API"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-500 italic">Read-only</span>
                      )}
                    </td>

                  </tr>
                ))}
                {filteredApis.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-gray-500">
                      {apis.length === 0
                        ? 'No APIs or endpoints registered for this application. Click "Add API Endpoint" to register one.'
                        : 'No APIs match your search or filter criteria.'}
                      {(apiSearch || apiMethodFilter !== 'All' || apiAuthFilter !== 'All' || apiStatusFilter !== 'All' || apiConsumerFilter !== 'All') && (
                        <div className="mt-3">
                          <Button size="sm" variant="secondary" onClick={() => { setApiSearch(''); setApiMethodFilter('All'); setApiAuthFilter('All'); setApiStatusFilter('All'); setApiConsumerFilter('All'); }}>
                            Clear Filters
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Secrets Vault */}
      {activeTab === 'secrets' && (
        isTeamMember || isManagement ? (
          <div className="flex flex-col items-center justify-center p-16 bg-[#0A1024] border border-[#1E2D52] rounded-3xl max-w-lg mx-auto text-center shadow-2xl my-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-5 shadow-lg">
              <ShieldAlert size={30} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Access Restricted</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Secrets Vault access is strictly restricted to Product Owners and Product Leads. Team members and upper management do not have access to encrypted application credentials.
            </p>
          </div>
        ) : (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#0A1024] border border-[#1E2D52] rounded-2xl shadow-xl">
            <div>
              <div className="flex items-center gap-2 text-base font-bold text-white">
                <KeyRound size={20} className="text-indigo-400" />
                <span>Application Secrets & Credentials Vault</span>
                {akvStatus?.connected ? (
                  <Badge variant="blue">Azure Key Vault Online</Badge>
                ) : (
                  <Badge variant="neutral">Local SQLite Vault</Badge>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Zero-knowledge encrypted local credentials and hardware-backed Azure Key Vault secrets for {product.name}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {akvStatus?.connected && (
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={loadAzureSecrets} 
                  loading={loadingAzureSecrets}
                  className="text-xs gap-1.5 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
                >
                  <RefreshCw size={13} className={loadingAzureSecrets ? 'animate-spin' : ''} /> Refresh Key Vault
                </Button>
              )}
              <Button size="sm" onClick={() => setIsAddSecretOpen(true)} className="gap-1.5 shadow-lg shadow-[#2E5EFF]/20">
                <Plus size={15} /> Add Secret
              </Button>
            </div>
          </div>

          {/* Azure Key Vault Remote Status Banner */}
          {akvStatus?.connected ? (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-indigo-950/50 via-[#0A1024] to-[#0A1024] border border-indigo-500/40 text-xs shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <KeyRound size={20} />
                </div>
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span>Azure Key Vault Connected & Synced</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="text-indigo-200 font-mono text-[11px] mt-0.5">
                    Vault: {akvStatus.connectedAs || 'Active Vault'} • {azureSecrets.length} remote secret{azureSecrets.length === 1 ? '' : 's'} available to reveal below
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => navigate('/plugins')} className="text-xs text-gray-400 hover:text-white">
                  Manage in Plugins &rarr;
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#0A1024] border border-[#1E2D52] text-xs">
              <div className="flex items-center gap-3 text-gray-400">
                <KeyRound size={18} className="text-indigo-400/60 shrink-0" />
                <div>
                  <span className="font-bold text-white">Azure Key Vault Integration: </span>
                  <span>Connect your Azure Key Vault in Plugins to sync, inspect, and reveal enterprise HSM credentials right here in this workspace.</span>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => navigate('/plugins')} className="text-xs shrink-0 gap-1.5 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10">
                <KeyRound size={13} /> Configure Key Vault Plugin
              </Button>
            </div>
          )}

          {/* Local AES-256 Vault Status / Inline Unlock Card */}
          {!vaultUnlocked ? (
            <div className="p-4 rounded-2xl bg-[#070B19] border border-[#1E2D52] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#2E5EFF]/15 border border-[#2E5EFF]/30 flex items-center justify-center text-[#2E5EFF] shrink-0">
                  <Lock size={16} />
                </div>
                <div>
                  <div className="font-bold text-white">Local AES-256 Vault is Locked</div>
                  <div className="text-gray-400 text-[11px]">
                    Local SQLite encrypted credentials require master passphrase. {akvStatus?.connected ? 'Azure Key Vault cloud secrets are fully accessible below.' : ''}
                  </div>
                  {vaultError && <div className="text-[11px] text-red-400 mt-0.5">{vaultError}</div>}
                </div>
              </div>
              <form onSubmit={handleUnlockVault} className="flex items-center gap-2 shrink-0">
                <input
                  type="password"
                  placeholder="Master passphrase..."
                  value={vaultPassphrase}
                  onChange={e => setVaultPassphrase(e.target.value)}
                  className="bg-[#0A1024] border border-[#1E2D52] rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] w-48"
                />
                <Button type="submit" size="sm" className="whitespace-nowrap">Unlock Local</Button>
              </form>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                <span>Local Zero-Knowledge Vault Unlocked ({secrets.length} local secret{secrets.length === 1 ? '' : 's'})</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setVaultUnlocked(false)} className="text-xs text-gray-400 hover:text-white h-7">
                Lock Local Vault
              </Button>
            </div>
          )}

          {/* Secrets Filter Toolbar */}
          <div className="bg-[#0B1229]/90 border border-[#172347] p-3.5 sm:p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={secSearch}
                  onChange={e => setSecSearch(e.target.value)}
                  placeholder="Search secrets by key name or description..."
                  className="w-full bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/50 focus:border-[#2E5EFF] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
                />
                {secSearch && (
                  <button onClick={() => setSecSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-medium flex items-center gap-1"><Filter size={12} className="text-[#2E5EFF]" /> Category:</span>
                <select
                  value={secCatFilter}
                  onChange={e => setSecCatFilter(e.target.value)}
                  className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
                >
                  <option value="All">All Categories</option>
                  <option value="Database">Database</option>
                  <option value="API Key">API Key</option>
                  <option value="OAuth">OAuth</option>
                  <option value="Cloud Secret">Cloud Secret</option>
                  <option value="Certificate">Certificate</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-medium">Source:</span>
                <select
                  value={secSourceFilter}
                  onChange={e => setSecSourceFilter(e.target.value as any)}
                  className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
                >
                  <option value="All">All Sources ({allAvailableSecrets.length})</option>
                  <option value="azure-keyvault">Azure Key Vault ({azureSecrets.length})</option>
                  <option value="local">Local Vault ({vaultUnlocked ? secrets.length : 0})</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-xs text-gray-400 bg-[#070B19] px-3 py-1.5 rounded-xl border border-[#15203D]">
                Showing <strong className="text-white">{filteredSecrets.length}</strong> of {allAvailableSecrets.length}
              </span>
              {(secSearch || secCatFilter !== 'All' || secSourceFilter !== 'All') && (
                <button
                  onClick={() => { setSecSearch(''); setSecCatFilter('All'); setSecSourceFilter('All'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#15203D] hover:bg-[#1E2D52] text-xs text-gray-300 hover:text-white transition-colors border border-[#23335D]"
                  title="Reset filters"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>
          </div>

          {/* Secrets Table */}
          <div className="rounded-3xl bg-[#0A1024] border border-[#1E2D52] overflow-hidden shadow-2xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1E2D52] bg-[#0D1429] text-gray-400 uppercase font-bold">
                  <th className="p-5">Secret Name</th>
                  <th className="p-5">Source</th>
                  <th className="p-5">Category</th>
                  <th className="p-5">Decrypted Value</th>
                  <th className="p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2D52]">
                {filteredSecrets.map(s => {
                  const isRevealed = revealedSecret?.id === s.id
                  return (
                    <tr key={s.id} className="hover:bg-[#0E1736]">
                      <td className="p-5 font-bold text-white text-sm">
                        <div className="flex items-center gap-2">
                          <span>{s.name}</span>
                          {s.enabled === false && (
                            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-normal">
                              Disabled
                            </span>
                          )}
                        </div>
                        {s.description && <div className="text-[11px] text-gray-400 font-normal mt-0.5">{s.description}</div>}
                      </td>
                      <td className="p-5">
                        {s.source === 'azure-keyvault' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                            <KeyRound size={10} /> Azure KV
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-500/15 text-gray-300 border border-gray-500/30">
                            Local
                          </span>
                        )}
                      </td>
                      <td className="p-5"><Badge variant="blue">{s.category}</Badge></td>
                      <td className="p-5 font-mono">
                        {isRevealed ? (
                          <span className="text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 break-all">
                            {revealedSecret?.val}
                          </span>
                        ) : (
                          <span className="text-gray-500 tracking-widest">••••••••••••••••</span>
                        )}
                      </td>
                      <td className="p-5 text-right">
                        <button
                          onClick={() => handleRevealSecret(s.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#15203D] hover:bg-[#203060] text-gray-200 hover:text-white text-xs font-semibold transition-colors"
                        >
                          {isRevealed ? 'Hide' : 'Reveal'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filteredSecrets.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-gray-500">
                      {allAvailableSecrets.length === 0 
                        ? (akvStatus?.connected 
                            ? 'No secrets found in Azure Key Vault or local vault.' 
                            : 'No application secrets configured. Connect Azure Key Vault or unlock the local vault to manage credentials.') 
                        : 'No secrets match your search or filter criteria.'}
                      {(secSearch || secCatFilter !== 'All' || secSourceFilter !== 'All') && (
                        <div className="mt-3">
                          <Button size="sm" variant="secondary" onClick={() => { setSecSearch(''); setSecCatFilter('All'); setSecSourceFilter('All'); }}>
                            Clear Filters
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        )
      )}


      {/* Tab 5: Team Availability */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Application Engineering Personnel & Capacity</h3>
              <p className="text-xs text-gray-400">Team members assigned to {product.name}, their project roles, and working capacity.</p>
            </div>
            <div className="flex items-center gap-2">
              {!isManagement && !isTeamMember && (
                <Button size="sm" onClick={() => {
                  const unassignedUser = companyUsers.find(u => !teamMembers.some(m => m.user_id === u.id || m.user_id === u.display_name))
                  setSelectedMemberUserId(unassignedUser?.id || companyUsers[0]?.id || '')
                  setMemberRoleInApp('Developer')
                  setIsAddTeamMemberOpen(true)
                }} className="gap-2 shadow-lg shadow-[#2E5EFF]/20">
                  <Plus size={15} /> Add Team Member
                </Button>
              )}

              {currentUser?.role === 'ProductOwner' && (
                <Button size="sm" variant="secondary" onClick={() => navigate('/hr')} className="gap-2 border-[#1E2D52] hover:bg-[#15203D]">
                  <Users size={15} /> Open Global Team Roster
                </Button>
              )}
            </div>
          </div>

          {/* Team Filter Toolbar */}
          <div className="bg-[#0B1229]/90 border border-[#172347] p-3.5 sm:p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={teamSearch}
                  onChange={e => setTeamSearch(e.target.value)}
                  placeholder="Search team by name, role, email, notes..."
                  className="w-full bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/50 focus:border-[#2E5EFF] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
                />
                {teamSearch && (
                  <button onClick={() => setTeamSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={teamStatusFilter}
                onChange={e => setTeamStatusFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Availability ({teamMembers.length})</option>
                <option value="Available">Available</option>
                <option value="Partial">Partial</option>
                <option value="OnLeave">On Leave</option>
                <option value="Unavailable">Unavailable</option>
              </select>

              {/* Location Filter */}
              <select
                value={teamLocFilter}
                onChange={e => setTeamLocFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Locations</option>
                <option value="Office">Office</option>
                <option value="WFH">WFH</option>
              </select>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-xs text-gray-400 bg-[#070B19] px-3 py-1.5 rounded-xl border border-[#15203D]">
                Showing <strong className="text-white">{filteredTeamMembers.length}</strong> of {teamMembers.length}
              </span>
              {(teamSearch || teamStatusFilter !== 'All' || teamLocFilter !== 'All') && (
                <button
                  onClick={() => { setTeamSearch(''); setTeamStatusFilter('All'); setTeamLocFilter('All'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#15203D] hover:bg-[#1E2D52] text-xs text-gray-300 hover:text-white transition-colors border border-[#23335D]"
                  title="Reset filters"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTeamMembers.map(m => {
              const isLead = m.role_in_product === 'Product Lead' || m.id === product.owner || m.display_name === product.owner || m.user_id === product.owner
              const statusVariant = m.hr_status === 'Available' ? 'success' : m.hr_status === 'OnLeave' ? 'danger' : m.hr_status === 'Partial' ? 'warning' : 'neutral'
              const workLoc = m.work_location || 'Office'
              return (
                <div key={m.membership_id || m.id} className="p-5 rounded-3xl bg-[#0A1024] border border-[#1E2D52] hover:border-[#2E5EFF]/40 transition-all flex flex-col justify-between shadow-xl group">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#2E5EFF] to-[#F5A623] flex items-center justify-center font-black text-white text-sm shadow-md shrink-0">
                          {m.avatar_initials || (m.display_name ? m.display_name.slice(0, 2).toUpperCase() : 'TM')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-bold text-white block truncate" title={m.display_name}>{m.display_name}</span>
                          <span className="text-xs text-[#6087FF] font-medium block truncate">{m.role_in_product || m.system_role || 'Contributor'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isLead ? (
                          <Badge variant="orange">Product Lead</Badge>
                        ) : (
                          <Badge variant="blue">{m.role_in_product || 'Contributor'}</Badge>
                        )}
                        {!isLead && m.membership_id && !isManagement && !isTeamMember && (
                          <button
                            onClick={() => handleRemoveTeamMember(m.membership_id, m.display_name)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Remove from application"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}

                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 my-3">
                      <Badge variant={statusVariant as any}>
                        {m.hr_status || 'Available'}
                      </Badge>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#111C3D] text-gray-300 border border-[#1E2D52]">
                        {workLoc === 'WFH' ? <Home size={10} className="text-[#2E5EFF]" /> : <Building size={10} className="text-emerald-400" />}
                        {workLoc}
                      </span>
                    </div>

                    {m.leave_from && (
                      <div className="p-2.5 rounded-xl bg-[#070B19] border border-[#15203D] text-[11px] text-amber-400 flex items-center gap-2 mb-2">
                        <CalendarCheck size={14} className="shrink-0" />
                        <span>
                          Leave: {new Date(m.leave_from).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          {m.leave_to ? ` - ${new Date(m.leave_to).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
                        </span>
                      </div>
                    )}

                    {m.hr_notes && (
                      <p className="text-xs text-gray-400 italic line-clamp-2 mt-1">"{m.hr_notes}"</p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#1E2D52] flex items-center justify-between text-xs text-gray-500">
                    <span className="truncate">{m.email || 'Internal Member'}</span>
                    {m.phone && <span className="font-mono text-[10px] text-gray-400">{m.phone}</span>}
                  </div>
                </div>
              )
            })}
            {filteredTeamMembers.length === 0 && (
              <div className="col-span-3 p-12 text-center bg-[#0A1024] border border-[#1E2D52] rounded-3xl text-sm text-gray-500">
                {teamMembers.length === 0 ? 'No team members assigned to this application yet.' : 'No team members match your search or filter criteria.'}
                {(teamSearch || teamStatusFilter !== 'All' || teamLocFilter !== 'All') && (
                  <div className="mt-3">
                    <Button size="sm" variant="secondary" onClick={() => { setTeamSearch(''); setTeamStatusFilter('All'); setTeamLocFilter('All'); }}>
                      Clear Filters
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Documents & Architecture */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Application Specifications & Documents</h3>
              <p className="text-xs text-gray-400">Architecture RFCs, ICD interfaces, and API runbooks for {product.name}.</p>
            </div>
            {!isManagement && (
              <Button size="sm" onClick={() => setIsAddDocOpen(true)} className="gap-2">
                <Plus size={15} /> Add Document
              </Button>
            )}
          </div>


          {/* Document Filter Toolbar */}
          <div className="bg-[#0B1229]/90 border border-[#172347] p-3.5 sm:p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={docSearch}
                  onChange={e => setDocSearch(e.target.value)}
                  placeholder="Search documents by title, file name, RFC..."
                  className="w-full bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/50 focus:border-[#2E5EFF] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
                />
                {docSearch && (
                  <button onClick={() => setDocSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <select
                value={docCategoryFilter}
                onChange={e => setDocCategoryFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Categories ({documents.length})</option>
                <option value="UAT">UAT & Quality Gate ({documents.filter(d => d.category === 'UAT' || d.linked_entity_type === 'uat').length})</option>
                <option value="BRD">BRD</option>
                <option value="ICD">ICD</option>
                <option value="API">API</option>
                <option value="Kafka">Kafka</option>
                <option value="Architecture">Architecture</option>
                <option value="Runbook">Runbook</option>
                <option value="Other">Other</option>
              </select>

              {/* Storage Filter */}
              <select
                value={docStorageFilter}
                onChange={e => setDocStorageFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Storage Locations</option>
                <option value="GridFS">MongoDB GridFS</option>
                <option value="SharePoint">SharePoint Cloud</option>
                <option value="Local">Stored Locally</option>
                <option value="Web">External Web Link</option>
              </select>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-xs text-gray-400 bg-[#070B19] px-3 py-1.5 rounded-xl border border-[#15203D]">
                Showing <strong className="text-white">{filteredDocuments.length}</strong> of {documents.length}
              </span>
              {(docSearch || docCategoryFilter !== 'All' || docStorageFilter !== 'All') && (
                <button
                  onClick={() => { setDocSearch(''); setDocCategoryFilter('All'); setDocStorageFilter('All'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#15203D] hover:bg-[#1E2D52] text-xs text-gray-300 hover:text-white transition-colors border border-[#23335D]"
                  title="Reset filters"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>
          </div>

          {/* Dedicated Release UAT & Quality Gate Evidence Section */}
          {(() => {
            const uatEvidenceDocs = filteredDocuments.filter(d => d.category === 'UAT' || d.linked_entity_type === 'uat')
            if ((docCategoryFilter !== 'All' && docCategoryFilter !== 'UAT') || uatEvidenceDocs.length === 0) return null

            return (
              <div className="space-y-4 p-5 rounded-3xl bg-[#080E21]/90 border border-teal-500/30 shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#17264A] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/30">
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        Release UAT & Quality Gate Artifacts
                        <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-mono font-bold">
                          {uatEvidenceDocs.length} Artifacts
                        </span>
                      </h4>
                      <p className="text-[11px] text-gray-400">
                        Test scenario evidence, execution artifacts, and acceptance logs grouped by release folder.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {releases.map(rel => {
                    const relDocs = uatEvidenceDocs.filter(d => 
                      (d.linked_entity_name && (d.linked_entity_name.includes(rel.name) || d.linked_entity_name.includes(rel.version))) ||
                      (d.description && (d.description.includes(rel.name) || d.description.includes(rel.version)))
                    )
                    if (relDocs.length === 0) return null

                    return (
                      <div key={rel.id} className="p-4 rounded-2xl bg-[#0A1229] border border-[#1E2D52]">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <GitMerge size={14} className="text-[#2E5EFF]" />
                              {rel.name} ({rel.version})
                            </span>
                            <Badge variant={rel.status === 'SignOff' ? 'success' : 'blue'}>{rel.status}</Badge>
                            <span className="text-[11px] text-gray-400">· {relDocs.length} test evidence file(s)</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {relDocs.map(d => (
                            <div key={d.id} className="p-3.5 rounded-xl bg-[#070B19] border border-[#15203D] hover:border-teal-500/40 transition-colors flex flex-col justify-between">
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-semibold text-xs text-white truncate" title={d.title}>{d.title}</span>
                                  <Badge variant="orange">UAT</Badge>
                                </div>
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-[#0C142A] border border-[#15203D] my-2 text-[11px] text-gray-300">
                                  <File size={14} className="text-teal-400 shrink-0" />
                                  <div className="truncate flex-1">
                                    <span className="block truncate font-mono text-[11px] text-gray-200">{d.file_name || 'evidence-file'}</span>
                                    {d.file_size && (
                                      <span className="text-[10px] text-gray-500">
                                        {(d.file_size / 1024).toFixed(1)} KB
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="pt-2 border-t border-[#15203D] flex justify-between items-center text-[10px] text-gray-500">
                                <span>{new Date(d.last_modified).toLocaleDateString()}</span>
                                <button
                                  onClick={() => handleDownloadDoc(d)}
                                  className="px-2 py-1 rounded-lg text-teal-300 hover:bg-teal-500/10 font-semibold flex items-center gap-1 text-xs"
                                >
                                  <Download size={11} /> Download
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}

                  {/* Unclassified UAT Evidence */}
                  {(() => {
                    const unclassifiedDocs = uatEvidenceDocs.filter(d => 
                      !releases.some(rel => 
                        (d.linked_entity_name && (d.linked_entity_name.includes(rel.name) || d.linked_entity_name.includes(rel.version))) ||
                        (d.description && (d.description.includes(rel.name) || d.description.includes(rel.version)))
                      )
                    )
                    if (unclassifiedDocs.length === 0) return null

                    return (
                      <div className="p-4 rounded-2xl bg-[#0A1229] border border-[#1E2D52]">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-white text-xs">General / Unclassified UAT Evidence ({unclassifiedDocs.length})</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {unclassifiedDocs.map(d => (
                            <div key={d.id} className="p-3.5 rounded-xl bg-[#070B19] border border-[#15203D] flex flex-col justify-between">
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-semibold text-xs text-white truncate" title={d.title}>{d.title}</span>
                                  <Badge variant="orange">UAT</Badge>
                                </div>
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-[#0C142A] border border-[#15203D] my-2 text-[11px] text-gray-300">
                                  <File size={14} className="text-teal-400 shrink-0" />
                                  <span className="truncate font-mono text-[11px] text-gray-200">{d.file_name || 'evidence-file'}</span>
                                </div>
                              </div>
                              <div className="pt-2 border-t border-[#15203D] flex justify-between items-center text-[10px] text-gray-500">
                                <span>{new Date(d.last_modified).toLocaleDateString()}</span>
                                <button
                                  onClick={() => handleDownloadDoc(d)}
                                  className="px-2 py-1 rounded-lg text-teal-300 hover:bg-teal-500/10 font-semibold flex items-center gap-1 text-xs"
                                >
                                  <Download size={11} /> Download
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )
          })()}

          {/* Regular Documentation Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredDocuments
              .filter(d => docCategoryFilter === 'UAT' ? false : (d.category !== 'UAT' && d.linked_entity_type !== 'uat'))
              .map(d => (
              <div key={d.id} className="p-6 rounded-3xl bg-[#0A1024] border border-[#1E2D52] flex flex-col justify-between shadow-xl hover:border-[#2E5EFF]/40 transition-colors group">
                <div>
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="orange">{d.category}</Badge>
                      {d.linked_entity_type && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#15203D] text-cyan-300 border border-cyan-500/30 truncate max-w-[140px]" title={d.linked_entity_name || ''}>
                          [{d.linked_entity_type.toUpperCase()}] {d.linked_entity_name || ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {d.sharepoint_status === 'GridFS' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" title="Stored in MongoDB GridFS bucket">
                          <Database size={11} /> GridFS
                        </span>
                      ) : d.sharepoint_status === 'Synced' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30" title="Synced to SharePoint library">
                          <Cloud size={11} /> SharePoint
                        </span>
                      ) : d.file_data ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2E5EFF]/15 text-[#8FA7FF] border border-[#2E5EFF]/30" title="Stored safely in Horizon local database">
                          <HardDrive size={11} /> Local
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-700/30 text-gray-400 border border-gray-600/30">
                          <ExternalLink size={11} /> Web Link
                        </span>
                      )}
                      <span className="text-xs text-gray-500 font-mono">v{d.version || '1.0'}</span>
                    </div>
                  </div>
                  <h4 className="font-bold text-base text-white mb-1.5 line-clamp-1">{d.title}</h4>
                  
                  {d.file_name ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#070B19] border border-[#15203D] my-2 text-xs text-gray-300">
                      <File size={16} className="text-[#2E5EFF] shrink-0" />
                      <div className="truncate flex-1">
                        <span className="block truncate font-mono text-[11px] text-gray-200">{d.file_name}</span>
                        {d.file_size && (
                          <span className="text-[10px] text-gray-500">
                            {(d.file_size / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 line-clamp-2 my-2 leading-relaxed">System documentation for {product.name}.</p>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-[#1E2D52] flex justify-between items-center text-xs">
                  <span className="text-gray-500">{new Date(d.last_modified).toLocaleDateString()}</span>
                  <div className="flex items-center gap-1">
                    {d.file_data ? (
                      <button 
                        onClick={() => handleDownloadDoc(d)}
                        className="p-2 px-3 rounded-xl text-[#2E5EFF] hover:bg-[#2E5EFF]/10 transition-colors font-semibold flex items-center gap-1.5"
                        title="Download / View file"
                      >
                        <Download size={13} /> Download
                      </button>
                    ) : d.web_url && d.web_url !== '#' ? (
                      <a 
                        href={d.web_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-2 px-3 rounded-xl text-[#2E5EFF] hover:bg-[#2E5EFF]/10 transition-colors font-semibold flex items-center gap-1.5"
                      >
                        Open <ExternalLink size={13} />
                      </a>
                    ) : null}

                    {!isManagement && (
                      <button
                        onClick={() => handleDeleteDoc(d.id)}
                        className="p-2 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete document"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                </div>
              </div>
            ))}
            {filteredDocuments.length === 0 && (
              <div className="col-span-3 p-12 text-center bg-[#0A1024] border border-[#1E2D52] rounded-3xl text-sm text-gray-500">
                {documents.length === 0 ? 'No documents registered for this application.' : 'No documents match your search or filter criteria.'}
                {(docSearch || docCategoryFilter !== 'All' || docStorageFilter !== 'All') && (
                  <div className="mt-3">
                    <Button size="sm" variant="secondary" onClick={() => { setDocSearch(''); setDocCategoryFilter('All'); setDocStorageFilter('All'); }}>
                      Clear Filters
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 7: Schedule & Deadlines */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Application Deadlines & Milestones</h3>
              <p className="text-xs text-gray-400">Release cutovers, maintenance windows, and UAT gates for {product.name}.</p>
            </div>
            {!isManagement && (
              <Button size="sm" onClick={() => {
                setSchedTitle('')
                setSchedType('Release')
                setSchedStartDate(new Date().toISOString().split('T')[0])
                setSchedEndDate('')
                setSchedLinkedReleaseId(releases[0]?.id || '')
                setSchedNotifyDays('1')
                setIsAddScheduleOpen(true)
              }} className="gap-2 shadow-lg shadow-[#2E5EFF]/20">
                <Plus size={15} /> Add Milestone / Event
              </Button>
            )}
          </div>


          {/* Schedule Filter Toolbar */}
          <div className="bg-[#0B1229]/90 border border-[#172347] p-3.5 sm:p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={schedSearch}
                  onChange={e => setSchedSearch(e.target.value)}
                  placeholder="Search milestone by title, type..."
                  className="w-full bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/50 focus:border-[#2E5EFF] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
                />
                {schedSearch && (
                  <button onClick={() => setSchedSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Milestone Type Filter */}
              <select
                value={schedTypeFilter}
                onChange={e => setSchedTypeFilter(e.target.value)}
                className="bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/40 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#2E5EFF] transition-colors cursor-pointer"
              >
                <option value="All">All Event Types ({scheduleEvents.length})</option>
                <option value="Release">Release Cutover</option>
                <option value="UAT">UAT Gate</option>
                <option value="Deadline">Deadline</option>
                <option value="Maintenance">Maintenance Window</option>
                <option value="Reminder">Reminder</option>
              </select>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-xs text-gray-400 bg-[#070B19] px-3 py-1.5 rounded-xl border border-[#15203D]">
                Showing <strong className="text-white">{filteredScheduleEvents.length}</strong> of {scheduleEvents.length}
              </span>
              {(schedSearch || schedTypeFilter !== 'All') && (
                <button
                  onClick={() => { setSchedSearch(''); setSchedTypeFilter('All'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#15203D] hover:bg-[#1E2D52] text-xs text-gray-300 hover:text-white transition-colors border border-[#23335D]"
                  title="Reset filters"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {filteredScheduleEvents.map(s => (
              <div key={s.id} className="p-5 rounded-2xl bg-[#0A1024] border border-[#1E2D52] hover:border-[#2E5EFF]/40 transition-colors flex items-center justify-between shadow-lg group">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-[#070B19] border border-[#1E2D52] text-[#F5A623]">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white block">{s.title}</span>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-gray-400">
                      <span>
                        {new Date(s.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        {s.end_date ? ` – ${new Date(s.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                      </span>
                      <span>·</span>
                      <span className="font-medium text-gray-300">Type: {s.type}</span>
                      {s.created_by && (
                        <>
                          <span>·</span>
                          <span className="text-gray-500">By {s.created_by}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={s.type === 'Release' ? 'blue' : s.type === 'UAT' ? 'orange' : s.type === 'Maintenance' ? 'warning' : 'neutral'}>
                    {s.type}
                  </Badge>
                  {!isManagement && (
                    <button
                      onClick={() => handleDeleteScheduleEvent(s.id, s.title)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete milestone"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

              </div>
            ))}
            {filteredScheduleEvents.length === 0 && (
              <div className="p-12 text-center bg-[#0A1024] border border-[#1E2D52] rounded-3xl text-sm text-gray-500">
                {scheduleEvents.length === 0 ? 'No schedule events linked to this product.' : 'No schedule events match your search or filter criteria.'}
                {(schedSearch || schedTypeFilter !== 'All') && (
                  <div className="mt-3">
                    <Button size="sm" variant="secondary" onClick={() => { setSchedSearch(''); setSchedTypeFilter('All'); }}>
                      Clear Filters
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dynamic Tab: Custom Section Viewer / Editor */}
      {activeCustomSection && (
        <CustomSectionRenderer
          key={activeCustomSection.id}
          section={activeCustomSection}
          readOnly={isManagement}
          onDelete={() => handleDeleteCustomSection(activeCustomSection.id)}
          onSave={(newJson) => handleUpdateCustomSectionContent(activeCustomSection.id, newJson)}
        />
      )}


      {/* ── Modals ────────────────────────────────────────────────────── */}
      {/* 1. Add Release Modal */}
      <Modal 
        isOpen={isAddReleaseOpen} 
        onClose={() => setIsAddReleaseOpen(false)}
        title={`Publish Release for ${product.name}`}
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setIsAddReleaseOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRelease}>Publish Release</Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Release Version" value={relVersion} onChange={e => setRelVersion(e.target.value)} placeholder="e.g. v2.5.0" required />
            <Input label="Target Cutover Date" type="date" value={relTargetDate} onChange={e => setRelTargetDate(e.target.value)} required />
          </div>
          <Input label="Release Name" value={relName} onChange={e => setRelName(e.target.value)} placeholder="e.g. Scalability Wave 1" required />
          <Input label="Description" value={relDescription} onChange={e => setRelDescription(e.target.value)} placeholder="Release scope notes..." />

          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">Feature Scope Items</label>
            <div className="flex gap-2 mb-2">
              <input 
                type="text" 
                value={featureInput} 
                onChange={e => setFeatureInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddFeature(); } }}
                placeholder="Type feature item and press Enter..." 
                className="flex-1 bg-[#070B19] border border-[#1E2D52] rounded-xl px-3 py-2 text-xs text-white"
              />
              <Button size="sm" type="button" onClick={handleAddFeature}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {relFeatures.map((f, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg bg-[#15203D] text-gray-300 text-xs">{f}</span>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* 3. Add Task Modal */}
      <Modal 
        isOpen={isAddTaskOpen} 
        onClose={() => setIsAddTaskOpen(false)}
        title={`Add Sprint Task for ${product.name}`}
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setIsAddTaskOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTask}>Create Task</Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <Input label="Task Title" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="e.g. Migrate Kafka partitions" required />
          <Input label="Description" value={taskDesc} onChange={e => setTaskDesc(e.target.value)} placeholder="Acceptance criteria..." />
          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Priority" 
              value={taskPriority} 
              onChange={e => setTaskPriority(e.target.value as any)}
              options={[
                { label: 'Urgent', value: 'Urgent' },
                { label: 'High', value: 'High' },
                { label: 'Medium', value: 'Medium' },
                { label: 'Low', value: 'Low' }
              ]}
            />
            <Select 
              label="Assignee" 
              value={taskAssignee} 
              onChange={e => setTaskAssignee(e.target.value)}
              options={teamMembers.map(m => ({ label: `${m.display_name} (${m.role})`, value: m.display_name }))}
            />
          </div>
          <Input label="Due Date" type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} />

          <div className="pt-2 border-t border-[#1E2D52]">
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Attach Specification / Document (Saved to Active Cloud Backend & Specs Tab)
            </label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setTaskAttachName(file.name)
                setTaskAttachSize(file.size)
                const reader = new FileReader()
                reader.onload = () => setTaskAttachData(reader.result as string)
                reader.readAsDataURL(file)
              }}
              className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#15203D] file:text-gray-200 hover:file:bg-[#1E2D52] cursor-pointer"
            />
            {taskAttachName && (
              <span className="text-[11px] text-cyan-400 block mt-1">
                Selected: {taskAttachName} ({((taskAttachSize || 0) / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>
        </div>
      </Modal>

      {/* 3b. Edit Task Modal */}
      <Modal 
        isOpen={isEditTaskOpen} 
        onClose={() => { setIsEditTaskOpen(false); setEditingTask(null); }}
        title={`Edit Sprint Task: ${editingTask?.title || ''}`}
        footer={
          isManagement ? (
            <div className="flex justify-between items-center w-full">
              <span className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
                <ShieldAlert size={14} /> Executive Read-Only Oversight
              </span>
              <Button variant="secondary" onClick={() => { setIsEditTaskOpen(false); setEditingTask(null); }}>Close</Button>
            </div>
          ) : (
            <div className="flex justify-between items-center w-full">
              <Button 
                variant="danger" 
                onClick={() => editingTask && handleDeleteTask(editingTask.id)}
                className="gap-1.5"
              >
                <Trash2 size={13} /> Delete Task
              </Button>
              <div className="flex gap-2.5">
                <Button variant="ghost" onClick={() => { setIsEditTaskOpen(false); setEditingTask(null); }}>Cancel</Button>
                <Button onClick={handleUpdateTask}>Save Changes</Button>
              </div>
            </div>
          )
        }

      >
        <div className="space-y-4 text-xs">
          <Input 
            label="Task Title" 
            value={editTaskTitle} 
            onChange={e => setEditTaskTitle(e.target.value)} 
            placeholder="e.g. Migrate Kafka partitions" 
            required 
          />
          <Input 
            label="Description" 
            value={editTaskDesc} 
            onChange={e => setEditTaskDesc(e.target.value)} 
            placeholder="Acceptance criteria..." 
          />
          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Status" 
              value={editTaskStatus} 
              onChange={e => setEditTaskStatus(e.target.value as any)}
              options={[
                { label: 'Todo', value: 'Todo' },
                { label: 'In Progress', value: 'InProgress' },
                { label: 'Blocked', value: 'Blocked' },
                { label: 'Done', value: 'Done' }
              ]}
            />
            <Select 
              label="Priority" 
              value={editTaskPriority} 
              onChange={e => setEditTaskPriority(e.target.value as any)}
              options={[
                { label: 'Urgent', value: 'Urgent' },
                { label: 'High', value: 'High' },
                { label: 'Medium', value: 'Medium' },
                { label: 'Low', value: 'Low' }
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Assignee" 
              value={editTaskAssignee} 
              onChange={e => setEditTaskAssignee(e.target.value)}
              options={teamMembers.map(m => ({ label: `${m.display_name} (${m.role_in_product || m.role || 'Member'})`, value: m.display_name }))}
            />
            <Input label="Due Date" type="date" value={editTaskDueDate} onChange={e => setEditTaskDueDate(e.target.value)} />
          </div>

          <div className="pt-2 border-t border-[#1E2D52]">
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Attach Specification / Document (Saved to Active Cloud Backend & Specs Tab)
            </label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setEditTaskAttachName(file.name)
                setEditTaskAttachSize(file.size)
                const reader = new FileReader()
                reader.onload = () => setEditTaskAttachData(reader.result as string)
                reader.readAsDataURL(file)
              }}
              className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#15203D] file:text-gray-200 hover:file:bg-[#1E2D52] cursor-pointer"
            />
            {editTaskAttachName && (
              <span className="text-[11px] text-cyan-400 block mt-1">
                Selected: {editTaskAttachName} ({((editTaskAttachSize || 0) / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>
        </div>
      </Modal>

      {/* 4. Add Interface Modal */}
      <Modal
        isOpen={isAddInterfaceOpen}
        onClose={() => setIsAddInterfaceOpen(false)}
        title={`Register Service / Event Interface for ${product.name}`}
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setIsAddInterfaceOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateInterface}>Save Interface</Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <Input 
            label="Interface Name" 
            value={ifName} 
            onChange={e => setIfName(e.target.value)} 
            placeholder="e.g. JOC Task Worker Inbound Queue" 
            required 
            autoFocus 
          />
          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Protocol / Technology" 
              value={ifType} 
              onChange={e => setIfType(e.target.value)}
              options={[
                { label: 'Message Queue (MQ)', value: 'MQ' },
                { label: 'Kafka Stream / Topic', value: 'Kafka' },
                { label: 'Background Scheduler / Cron', value: 'Scheduler' },
                { label: 'gRPC RPC Service', value: 'gRPC' },
                { label: 'SFTP File Gateway', value: 'SFTP' },
                { label: 'Database Link / CDC', value: 'DB Link' },
                { label: 'Other Enterprise Service', value: 'Other' }
              ]}
            />
            <Select 
              label="Direction" 
              value={ifDirection} 
              onChange={e => setIfDirection(e.target.value)}
              options={[
                { label: '↑ Provided (We publish / provide)', value: 'Provided' },
                { label: '↓ Consumed (We subscribe / consume)', value: 'Consumed' },
                { label: '⇄ Bidirectional Exchange', value: 'Bidirectional' }
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input 
              label="Service / Broker Used" 
              value={ifServiceProvider} 
              onChange={e => setIfServiceProvider(e.target.value)} 
              placeholder="e.g. IBM MQ 9.3, AWS MSK Kafka, Control-M" 
            />
            <Input 
              label="To Whom / For Whom Given (Target Audience)" 
              value={ifTargetAudience} 
              onChange={e => setIfTargetAudience(e.target.value)} 
              placeholder="e.g. Risk Analytics, Core Banking, Worker Pods" 
              required 
            />
          </div>

          <Input 
            label="Connection Details / Queue / Topic / Cron" 
            value={ifConnectionDetails} 
            onChange={e => setIfConnectionDetails(e.target.value)} 
            placeholder="e.g. topic: jta.events.v1 or 0 2 * * * (Daily at 02:00 AM)" 
          />

          <div className="grid grid-cols-2 gap-3">
            <Input 
              label="Endpoint Host / Broker URI (Optional)" 
              value={ifEndpoint} 
              onChange={e => setIfEndpoint(e.target.value)} 
              placeholder="e.g. tcp://mq.corp.internal:61616" 
            />
            <Select 
              label="Status" 
              value={ifStatus} 
              onChange={e => setIfStatus(e.target.value)}
              options={[
                { label: 'Active', value: 'Active' },
                { label: 'Planning', value: 'Planning' },
                { label: 'Deprecated', value: 'Deprecated' }
              ]}
            />
          </div>

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Description & Usage Notes</label>
            <textarea 
              value={ifDescription} 
              onChange={e => setIfDescription(e.target.value)} 
              placeholder="Details regarding serialization (Avro/Protobuf), consumer groups, or scheduling windows..."
              className="w-full bg-[#070B19] border border-[#1E2D52] rounded-xl px-3 py-2 text-xs text-white min-h-[65px] focus:outline-none focus:border-[#2E5EFF]"
            />
          </div>

          <div className="pt-2 border-t border-[#1E2D52]">
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Attach Interface Contract / Schema Document (Saved to Cloud Storage & Specs Tab)
            </label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setIfAttachName(file.name)
                setIfAttachSize(file.size)
                const reader = new FileReader()
                reader.onload = () => setIfAttachData(reader.result as string)
                reader.readAsDataURL(file)
              }}
              className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#15203D] file:text-gray-200 hover:file:bg-[#1E2D52] cursor-pointer"
            />
            {ifAttachName && (
              <span className="text-[11px] text-cyan-400 block mt-1">
                Selected: {ifAttachName} ({((ifAttachSize || 0) / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>
        </div>
      </Modal>

      {/* 4b. Edit Interface Modal */}
      <Modal
        isOpen={isEditInterfaceOpen}
        onClose={() => { setIsEditInterfaceOpen(false); setEditingInterface(null); }}
        title={`Edit Interface: ${editingInterface?.name || ''}`}
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => { setIsEditInterfaceOpen(false); setEditingInterface(null); }}>Cancel</Button>
            <Button onClick={handleUpdateInterface}>Update Interface</Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <Input 
            label="Interface Name" 
            value={ifName} 
            onChange={e => setIfName(e.target.value)} 
            required 
            autoFocus 
          />
          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Protocol / Technology" 
              value={ifType} 
              onChange={e => setIfType(e.target.value)}
              options={[
                { label: 'Message Queue (MQ)', value: 'MQ' },
                { label: 'Kafka Stream / Topic', value: 'Kafka' },
                { label: 'Background Scheduler / Cron', value: 'Scheduler' },
                { label: 'gRPC RPC Service', value: 'gRPC' },
                { label: 'SFTP File Gateway', value: 'SFTP' },
                { label: 'Database Link / CDC', value: 'DB Link' },
                { label: 'Other Enterprise Service', value: 'Other' }
              ]}
            />
            <Select 
              label="Direction" 
              value={ifDirection} 
              onChange={e => setIfDirection(e.target.value)}
              options={[
                { label: '↑ Provided (We publish / provide)', value: 'Provided' },
                { label: '↓ Consumed (We subscribe / consume)', value: 'Consumed' },
                { label: '⇄ Bidirectional Exchange', value: 'Bidirectional' }
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input 
              label="Service / Broker Used" 
              value={ifServiceProvider} 
              onChange={e => setIfServiceProvider(e.target.value)} 
            />
            <Input 
              label="To Whom / For Whom Given" 
              value={ifTargetAudience} 
              onChange={e => setIfTargetAudience(e.target.value)} 
              required 
            />
          </div>

          <Input 
            label="Connection Details / Queue / Topic / Cron" 
            value={ifConnectionDetails} 
            onChange={e => setIfConnectionDetails(e.target.value)} 
          />

          <div className="grid grid-cols-2 gap-3">
            <Input 
              label="Endpoint Host / Broker URI" 
              value={ifEndpoint} 
              onChange={e => setIfEndpoint(e.target.value)} 
            />
            <Select 
              label="Status" 
              value={ifStatus} 
              onChange={e => setIfStatus(e.target.value)}
              options={[
                { label: 'Active', value: 'Active' },
                { label: 'Planning', value: 'Planning' },
                { label: 'Deprecated', value: 'Deprecated' }
              ]}
            />
          </div>

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Description & Notes</label>
            <textarea 
              value={ifDescription} 
              onChange={e => setIfDescription(e.target.value)} 
              className="w-full bg-[#070B19] border border-[#1E2D52] rounded-xl px-3 py-2 text-xs text-white min-h-[65px] focus:outline-none focus:border-[#2E5EFF]"
            />
          </div>

          <div className="pt-2 border-t border-[#1E2D52]">
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Attach Interface Contract / Schema Document (Saved to Cloud Storage & Specs Tab)
            </label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setEditIfAttachName(file.name)
                setEditIfAttachSize(file.size)
                const reader = new FileReader()
                reader.onload = () => setEditIfAttachData(reader.result as string)
                reader.readAsDataURL(file)
              }}
              className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#15203D] file:text-gray-200 hover:file:bg-[#1E2D52] cursor-pointer"
            />
            {editIfAttachName && (
              <span className="text-[11px] text-cyan-400 block mt-1">
                Selected: {editIfAttachName} ({((editIfAttachSize || 0) / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>
        </div>
      </Modal>

      {/* 4c. Add API Endpoint Modal */}
      <Modal
        isOpen={isAddApiOpen}
        onClose={() => setIsAddApiOpen(false)}
        title={`Register API Endpoint for ${product.name}`}
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setIsAddApiOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateApi}>Save API Endpoint</Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <Input 
            label="API Name" 
            value={apiName} 
            onChange={e => setApiName(e.target.value)} 
            placeholder="e.g. Job Dispatch & Execution API" 
            required 
            autoFocus 
          />

          <div className="grid grid-cols-3 gap-3">
            <Select 
              label="HTTP Method" 
              value={apiMethod} 
              onChange={e => setApiMethod(e.target.value as any)}
              options={[
                { label: 'POST', value: 'POST' },
                { label: 'GET', value: 'GET' },
                { label: 'PUT', value: 'PUT' },
                { label: 'PATCH', value: 'PATCH' },
                { label: 'DELETE', value: 'DELETE' },
                { label: 'ALL / GraphQL', value: 'ALL' }
              ]}
            />
            <div className="col-span-2">
              <Input 
                label="Endpoint Path / URI" 
                value={apiEndpoint} 
                onChange={e => setApiEndpoint(e.target.value)} 
                placeholder="e.g. /api/v2/dispatch" 
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Authentication Type" 
              value={apiAuthType} 
              onChange={e => setApiAuthType(e.target.value)}
              options={[
                { label: 'OAuth2 Bearer Token', value: 'OAuth2' },
                { label: 'API Key (Header / Query)', value: 'API Key' },
                { label: 'JWT / Bearer Token', value: 'Bearer Token' },
                { label: 'mTLS Mutual TLS', value: 'mTLS' },
                { label: 'Basic Auth', value: 'Basic' },
                { label: 'None / Public', value: 'None' }
              ]}
            />
            <Input 
              label="Client ID / App ID" 
              value={apiClientId} 
              onChange={e => setApiClientId(e.target.value)} 
              placeholder="e.g. joc_worker_client" 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input 
              label="Granted Scopes / Permissions" 
              value={apiScope} 
              onChange={e => setApiScope(e.target.value)} 
              placeholder="e.g. jobs:write, workflows:execute" 
            />
            <Input 
              label="API Key Mask / Identifier (Optional)" 
              value={apiApiKeyMeta} 
              onChange={e => setApiApiKeyMeta(e.target.value)} 
              placeholder="e.g. ak_live_***9a41" 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input 
              label="To Whom / For Whom Given (Consumer)" 
              value={apiGivenTo} 
              onChange={e => setApiGivenTo(e.target.value)} 
              placeholder="e.g. Mobile iOS App, Partner Portal, POS Gateway" 
              required 
            />
            <Input 
              label="Rate Limit Policy" 
              value={apiRateLimit} 
              onChange={e => setApiRateLimit(e.target.value)} 
              placeholder="e.g. 2,000 req/min or 50 req/sec" 
            />
          </div>

          <Select 
            label="Lifecycle Status" 
            value={apiStatus} 
            onChange={e => setApiStatus(e.target.value)}
            options={[
              { label: 'Active', value: 'Active' },
              { label: 'Beta', value: 'Beta' },
              { label: 'Planning', value: 'Planning' },
              { label: 'Deprecated', value: 'Deprecated' }
            ]}
          />

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Endpoint Description & Payload Spec</label>
            <textarea 
              value={apiDescription} 
              onChange={e => setApiDescription(e.target.value)} 
              placeholder="Summary of request body JSON schema, return types, and response codes..."
              className="w-full bg-[#070B19] border border-[#1E2D52] rounded-xl px-3 py-2 text-xs text-white min-h-[65px] focus:outline-none focus:border-[#2E5EFF]"
            />
          </div>

          <div className="pt-2 border-t border-[#1E2D52]">
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Attach OpenAPI / Swagger Spec / Schema (Saved to Cloud Storage & Specs Tab)
            </label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setApiAttachName(file.name)
                setApiAttachSize(file.size)
                const reader = new FileReader()
                reader.onload = () => setApiAttachData(reader.result as string)
                reader.readAsDataURL(file)
              }}
              className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#15203D] file:text-gray-200 hover:file:bg-[#1E2D52] cursor-pointer"
            />
            {apiAttachName && (
              <span className="text-[11px] text-cyan-400 block mt-1">
                Selected: {apiAttachName} ({((apiAttachSize || 0) / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>
        </div>
      </Modal>

      {/* 4d. Edit API Endpoint Modal */}
      <Modal
        isOpen={isEditApiOpen}
        onClose={() => { setIsEditApiOpen(false); setEditingApi(null); }}
        title={`Edit API Endpoint: ${editingApi?.name || ''}`}
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => { setIsEditApiOpen(false); setEditingApi(null); }}>Cancel</Button>
            <Button onClick={handleUpdateApi}>Update API Endpoint</Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <Input 
            label="API Name" 
            value={apiName} 
            onChange={e => setApiName(e.target.value)} 
            required 
            autoFocus 
          />

          <div className="grid grid-cols-3 gap-3">
            <Select 
              label="HTTP Method" 
              value={apiMethod} 
              onChange={e => setApiMethod(e.target.value as any)}
              options={[
                { label: 'POST', value: 'POST' },
                { label: 'GET', value: 'GET' },
                { label: 'PUT', value: 'PUT' },
                { label: 'PATCH', value: 'PATCH' },
                { label: 'DELETE', value: 'DELETE' },
                { label: 'ALL / GraphQL', value: 'ALL' }
              ]}
            />
            <div className="col-span-2">
              <Input 
                label="Endpoint Path / URI" 
                value={apiEndpoint} 
                onChange={e => setApiEndpoint(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Authentication Type" 
              value={apiAuthType} 
              onChange={e => setApiAuthType(e.target.value)}
              options={[
                { label: 'OAuth2 Bearer Token', value: 'OAuth2' },
                { label: 'API Key (Header / Query)', value: 'API Key' },
                { label: 'JWT / Bearer Token', value: 'Bearer Token' },
                { label: 'mTLS Mutual TLS', value: 'mTLS' },
                { label: 'Basic Auth', value: 'Basic' },
                { label: 'None / Public', value: 'None' }
              ]}
            />
            <Input 
              label="Client ID / App ID" 
              value={apiClientId} 
              onChange={e => setApiClientId(e.target.value)} 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input 
              label="Granted Scopes / Permissions" 
              value={apiScope} 
              onChange={e => setApiScope(e.target.value)} 
            />
            <Input 
              label="API Key Mask / Identifier" 
              value={apiApiKeyMeta} 
              onChange={e => setApiApiKeyMeta(e.target.value)} 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input 
              label="To Whom / For Whom Given (Consumer)" 
              value={apiGivenTo} 
              onChange={e => setApiGivenTo(e.target.value)} 
              required 
            />
            <Input 
              label="Rate Limit Policy" 
              value={apiRateLimit} 
              onChange={e => setApiRateLimit(e.target.value)} 
            />
          </div>

          <Select 
            label="Lifecycle Status" 
            value={apiStatus} 
            onChange={e => setApiStatus(e.target.value)}
            options={[
              { label: 'Active', value: 'Active' },
              { label: 'Beta', value: 'Beta' },
              { label: 'Planning', value: 'Planning' },
              { label: 'Deprecated', value: 'Deprecated' }
            ]}
          />

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Endpoint Description & Notes</label>
            <textarea 
              value={apiDescription} 
              onChange={e => setApiDescription(e.target.value)} 
              className="w-full bg-[#070B19] border border-[#1E2D52] rounded-xl px-3 py-2 text-xs text-white min-h-[65px] focus:outline-none focus:border-[#2E5EFF]"
            />
          </div>

          <div className="pt-2 border-t border-[#1E2D52]">
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Attach OpenAPI / Swagger Spec / Schema (Saved to Cloud Storage & Specs Tab)
            </label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setEditApiAttachName(file.name)
                setEditApiAttachSize(file.size)
                const reader = new FileReader()
                reader.onload = () => setEditApiAttachData(reader.result as string)
                reader.readAsDataURL(file)
              }}
              className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#15203D] file:text-gray-200 hover:file:bg-[#1E2D52] cursor-pointer"
            />
            {editApiAttachName && (
              <span className="text-[11px] text-cyan-400 block mt-1">
                Selected: {editApiAttachName} ({((editApiAttachSize || 0) / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>
        </div>
      </Modal>

      {/* 5. Add Secret Modal */}
      <Modal
        isOpen={isAddSecretOpen}
        onClose={() => {
          setIsAddSecretOpen(false)
          setSecModalError('')
          setSecModalPassphrase('')
        }}
        title={`Store Secret for ${product.name}`}
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => {
              setIsAddSecretOpen(false)
              setSecModalError('')
              setSecModalPassphrase('')
            }}>Cancel</Button>
            <Button 
              onClick={handleAddSecret}
              loading={isSavingSecret}
              className={secTargetVault === 'azure' && akvStatus?.connected ? 'bg-indigo-600 hover:bg-indigo-500' : ''}
            >
              {secTargetVault === 'azure' && akvStatus?.connected ? 'Save to Azure Key Vault' : 'Encrypt & Save Locally'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {secModalError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <ShieldAlert size={16} className="shrink-0" />
              <span>{secModalError}</span>
            </div>
          )}

          {akvStatus?.connected && (
            <div className="space-y-1">
              <label className="font-semibold text-gray-300">Target Vault Destination</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSecTargetVault('azure')}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 text-left transition-all cursor-pointer ${
                    secTargetVault === 'azure'
                      ? 'bg-indigo-500/15 border-indigo-500 text-white font-bold'
                      : 'bg-[#070B19] border-[#1E2D52] text-gray-400 hover:text-white'
                  }`}
                >
                  <KeyRound size={16} className={secTargetVault === 'azure' ? 'text-indigo-400' : 'text-gray-500'} />
                  <div>
                    <div>Azure Key Vault</div>
                    <div className="text-[10px] text-gray-400 font-normal">Cloud HSM Hardware Vault</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSecTargetVault('local')}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 text-left transition-all cursor-pointer ${
                    secTargetVault === 'local'
                      ? 'bg-[#2E5EFF]/15 border-[#2E5EFF] text-white font-bold'
                      : 'bg-[#070B19] border-[#1E2D52] text-gray-400 hover:text-white'
                  }`}
                >
                  <Lock size={16} className={secTargetVault === 'local' ? 'text-[#2E5EFF]' : 'text-gray-500'} />
                  <div>
                    <div>Local Encrypted</div>
                    <div className="text-[10px] text-gray-400 font-normal">Client AES-256 Storage</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* If saving to local vault and local vault is locked, prompt for master passphrase */}
          {(secTargetVault === 'local' || !akvStatus?.connected) && !vaultUnlocked && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                <Lock size={14} />
                <span>Local SQLite Vault is Locked</span>
              </div>
              <p className="text-[11px] text-gray-400">
                Enter your master passphrase to unlock the local vault and encrypt this secret:
              </p>
              <Input
                label="Master Passphrase"
                type="password"
                value={secModalPassphrase}
                onChange={e => setSecModalPassphrase(e.target.value)}
                placeholder="Enter master passphrase..."
                required
              />
            </div>
          )}

          <Input label="Secret Name" value={secName} onChange={e => setSecName(e.target.value)} placeholder="e.g. Primary Replica Connection" required />
          <Select 
            label="Category" 
            value={secCat} 
            onChange={e => setSecCat(e.target.value)}
            options={[
              { label: 'Database Credentials', value: 'Database' },
              { label: 'Cloud API Key', value: 'Cloud' },
              { label: 'OAuth Token', value: 'OAuth' },
              { label: 'Kafka SASL Credentials', value: 'Kafka' },
              { label: 'General / Certificate', value: 'Other' }
            ]}
          />
          <Input label="Secret Value" type="password" value={secVal} onChange={e => setSecVal(e.target.value)} placeholder="Enter plaintext value..." required />
        </div>
      </Modal>

      {/* 6. Add Document Modal */}
      <Modal
        isOpen={isAddDocOpen}
        onClose={() => {
          setIsAddDocOpen(false)
          setDocFileName('')
          setDocFileData('')
          setDocFileSize(null)
          setDocTitle('')
          setDocUrl('')
        }}
        title={`Add Specification & Document for ${product.name}`}
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setIsAddDocOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateDoc} disabled={isUploadingDoc || !docTitle.trim()}>
              {isUploadingDoc ? 'Uploading...' : 'Save & Sync Document'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {/* File Upload Dropzone */}
          <div>
            <label className="mb-1.5 text-xs font-semibold text-gray-300 block">
              Upload Specification File (Stored in Active Cloud Backend & Local DB)
            </label>
            <label className="border-2 border-dashed border-[#1E2D52] hover:border-[#2E5EFF]/60 bg-[#070B19] hover:bg-[#0E1738]/50 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all group">
              <input 
                type="file" 
                className="hidden" 
                onChange={handleFileUploadChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.json,.yaml,.yml,.md,.txt,.png,.jpg,.jpeg,.svg"
              />
              {docFileName ? (
                <div className="flex items-center gap-3 text-left w-full p-2 bg-[#0E1738] rounded-xl border border-[#2E5EFF]/30">
                  <div className="w-10 h-10 rounded-lg bg-[#2E5EFF]/20 flex items-center justify-center text-[#2E5EFF] shrink-0">
                    <File size={20} />
                  </div>
                  <div className="truncate flex-1">
                    <span className="text-xs font-bold text-white block truncate">{docFileName}</span>
                    <span className="text-[10px] text-gray-400">
                      {docFileSize ? `${(docFileSize / 1024).toFixed(1)} KB` : 'Ready to store'} • Click to change
                    </span>
                  </div>
                  <div className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                    <Check size={11} /> Attached
                  </div>
                </div>
              ) : (
                <div className="text-center py-2">
                  <div className="w-10 h-10 rounded-2xl bg-[#2E5EFF]/10 text-[#2E5EFF] flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                    <Upload size={18} />
                  </div>
                  <p className="text-xs font-semibold text-gray-200">
                    Click or drag & drop file here
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    PDF, Word, Excel, JSON, YAML, OpenAPI, Markdown (Up to 50MB)
                  </p>
                </div>
              )}
            </label>
          </div>

          <Input 
            label="Document Title" 
            value={docTitle} 
            onChange={e => setDocTitle(e.target.value)} 
            placeholder="e.g. Order Processing ICD Specification" 
            required 
          />

          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Specification Category" 
              value={docCategory} 
              onChange={e => setDocCategory(e.target.value)}
              options={[
                { label: 'Business Requirements (BRD)', value: 'BRD' },
                { label: 'Interface Control Document (ICD)', value: 'ICD' },
                { label: 'API Runbook / Swagger / Postman', value: 'API' },
                { label: 'Kafka / MQ Architecture Spec', value: 'Kafka' },
                { label: 'UAT / QA Test Plan', value: 'UAT' },
                { label: 'Architecture & RFC', value: 'Architecture' },
                { label: 'Other Documentation', value: 'Other' }
              ]}
            />
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold text-gray-300">Active Storage Target</label>
              <div className="h-[38px] px-3 rounded-xl bg-[#070B19] border border-[#1E2D52] flex items-center justify-between text-xs text-gray-300">
                {activeBackend === 'mongodb-core' ? (
                  <>
                    <span className="flex items-center gap-1.5 text-emerald-300 font-mono text-[11px] truncate">
                      <Database size={13} className="text-emerald-400" /> MongoDB GridFS (fs.files)
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      GridFS
                    </span>
                  </>
                ) : activeBackend === 'sharepoint-core' ? (
                  <>
                    <span className="flex items-center gap-1.5 text-blue-300 font-mono text-[11px] truncate">
                      <Cloud size={13} className="text-[#2E5EFF]" /> SharePoint (Shared Documents)
                    </span>
                    <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                      Shared
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5 text-gray-400 font-mono text-[11px] truncate">
                      <HardDrive size={13} className="text-amber-400" /> Local Encrypted Database
                    </span>
                    <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      Local
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div>
            <Input 
              label="External Web / Cloud Link (Optional)" 
              value={docUrl} 
              onChange={e => setDocUrl(e.target.value)} 
              placeholder="https://company.sharepoint.com/... or cloud document URL" 
            />
            <span className="text-[10px] text-gray-500 block mt-1">
              If left blank, Horizon automatically stores documents in your active cloud backend (MongoDB GridFS or SharePoint) or preserves securely in the local offline database.
            </span>
          </div>
        </div>
      </Modal>

      {/* 7. Edit Product Modal */}
      <Modal
        isOpen={isEditProductOpen}
        onClose={() => setIsEditProductOpen(false)}
        title={`Configure Application: ${product.name}`}
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setIsEditProductOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateProduct}>Save Configuration</Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <Input label="Application Name" value={editName} onChange={e => setEditName(e.target.value)} required />
          <div className="grid grid-cols-3 gap-3">
            <Select 
              label="Application Scope" 
              value={editType} 
              onChange={e => setEditType(e.target.value as any)}
              options={applicationScopes.map(s => ({ label: s.label, value: s.id }))} 
            />
            <Select 
              label="Status" 
              value={editStatus} 
              onChange={e => setEditStatus(e.target.value as any)}
              options={[
                { label: 'Active', value: 'Active' },
                { label: 'Planning', value: 'Planning' },
                { label: 'Maintenance', value: 'Maintenance' },
                { label: 'Deprecated', value: 'Deprecated' }
              ]}
            />
            {currentUser?.role === 'ProductOwner' ? (
              <Select 
                label="Application Owner" 
                value={editOwner} 
                onChange={e => setEditOwner(e.target.value)}
                options={teamMembers.map(m => ({ label: `${m.display_name} (${m.role})`, value: m.display_name }))}
              />
            ) : (
              <div className="flex flex-col">
                <label className="mb-1 text-xs font-semibold text-gray-300">Application Owner</label>
                <div className="bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-2 text-xs text-gray-300 flex items-center justify-between">
                  <span className="font-semibold text-white truncate">{product.owner}</span>
                  <span className="text-[10px] text-[#6087FF] shrink-0 font-bold ml-1">(You)</span>
                </div>
              </div>
            )}
          </div>

          <IconPicker 
            value={editIcon} 
            onChange={setEditIcon} 
            label="Application Icon / Logo (Optional)" 
          />

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Description</label>
            <textarea 
              value={editDesc} 
              onChange={e => setEditDesc(e.target.value)}
              className="w-full bg-[#070B19] border border-[#1E2D52] rounded-xl px-4 py-2.5 text-xs text-white min-h-[80px] focus:outline-none focus:border-[#2E5EFF]"
            />
          </div>
        </div>
      </Modal>

      {/* Edit Release Modal */}
      <Modal
        isOpen={isEditReleaseOpen}
        onClose={() => setIsEditReleaseOpen(false)}
        title={editingRelease ? `Edit Release: ${editingRelease.name} (${editingRelease.version})` : 'Edit Release'}
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setIsEditReleaseOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEditRelease}>Save Release Changes</Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Version Tag"
              value={editRelVersion}
              onChange={e => setEditRelVersion(e.target.value)}
              placeholder="e.g. v2.5.0"
              required
            />
            <Select
              label="Pipeline Stage"
              value={editRelStatus}
              onChange={e => setEditRelStatus(e.target.value as ReleaseStatus)}
              options={(stepList as ReleaseStatus[]).map(st => ({ label: st, value: st }))}
            />
          </div>

          <Input
            label="Release Title / Milestone Name"
            value={editRelName}
            onChange={e => setEditRelName(e.target.value)}
            placeholder="e.g. Phoenix Scale Out"
            required
          />

          <Input
            label="Target Cutover / Deadline Date"
            type="date"
            value={editRelTargetDate}
            onChange={e => setEditRelTargetDate(e.target.value)}
            required
          />

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Release Summary / Objectives</label>
            <textarea
              value={editRelDescription}
              onChange={e => setEditRelDescription(e.target.value)}
              placeholder="Describe what is shipping in this milestone..."
              className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] min-h-[70px]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1.5">Scope & Included Feature Items</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Add feature item..."
                value={editFeatureInput}
                onChange={e => setEditFeatureInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddEditFeature(); } }}
                className="flex-1 bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-1.5 text-xs text-white"
              />
              <Button type="button" size="sm" onClick={handleAddEditFeature} className="gap-1 text-xs">
                <Plus size={13} /> Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar">
              {editRelFeatures.map((feat, idx) => (
                <span key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0E1736] border border-[#1E2D52] text-white text-[11px]">
                  <span>{feat}</span>
                  <button type="button" onClick={() => handleRemoveEditFeature(idx)} className="text-gray-400 hover:text-red-400">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* 8. Add Custom Section / Form Modal */}
      <Modal
        isOpen={isAddSectionOpen}
        onClose={() => {
          setIsAddSectionOpen(false)
          setSecTitleError('')
        }}
        title="Create Custom Section / Form"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button 
              variant="ghost" 
              type="button" 
              onClick={() => {
                setIsAddSectionOpen(false)
                setSecTitleError('')
              }}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              form="create-custom-section-form"
              loading={isSavingSection}
              onClick={handleCreateCustomSection} 
              className="bg-[#2E5EFF] text-white"
            >
              Create Section
            </Button>
          </div>
        }
      >
        <form id="create-custom-section-form" onSubmit={handleCreateCustomSection} className="space-y-4 text-xs">
          <Input 
            label="Section / Form Title" 
            value={secTitle} 
            onChange={e => {
              setSecTitle(e.target.value)
              if (secTitleError) setSecTitleError('')
            }} 
            placeholder="e.g. Cluster Topology, Deployment Runbook, On-Call Rota" 
            error={secTitleError}
            required 
            autoFocus
          />
          <Select
            label="Section Format"
            value={secType}
            onChange={e => setSecType(e.target.value as any)}
            options={[
              { label: 'Structured Key-Value Form (Parameters, Configs, IPs)', value: 'custom_form' },
              { label: 'Interactive Checklist (Release Gates, Verifications)', value: 'checklist' },
              { label: 'Rich Markdown & Documentation (Runbooks, Specs)', value: 'markdown' }
            ]}
          />
          <div>
            <label className="mb-1.5 text-xs font-semibold text-gray-300 block">Section Icon Style</label>
            <div className="flex flex-wrap items-center gap-2">
              {['Sliders', 'ListChecks', 'BookOpen', 'Terminal', 'Layout', 'Database'].map(iconName => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setSecIcon(iconName)}
                  className={`p-2 px-3 rounded-xl border text-xs flex items-center gap-1.5 transition-all ${
                    secIcon === iconName 
                      ? 'bg-[#2E5EFF]/25 border-[#2E5EFF] text-white font-bold shadow-md shadow-[#2E5EFF]/20' 
                      : 'bg-[#080D1F] border-[#1E2D52] text-gray-400 hover:text-white'
                  }`}
                >
                  {iconName === 'Sliders' && <Sliders size={14} />}
                  {iconName === 'ListChecks' && <ListChecks size={14} />}
                  {iconName === 'BookOpen' && <BookOpen size={14} />}
                  {iconName === 'Terminal' && <Terminal size={14} />}
                  {iconName === 'Layout' && <Layout size={14} />}
                  {iconName === 'Database' && <Database size={14} />}
                  <span>{iconName}</span>
                </button>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      {/* Add Schedule Milestone Modal */}
      <Modal
        isOpen={isAddScheduleOpen}
        onClose={() => setIsAddScheduleOpen(false)}
        title={`Add Milestone / Schedule for ${product.name}`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsAddScheduleOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateScheduleEvent} className="bg-[#2E5EFF] text-white">Save Milestone</Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <Input
            label="Milestone Title"
            value={schedTitle}
            onChange={e => setSchedTitle(e.target.value)}
            placeholder="e.g. Production Cutover v2.4, Database Maintenance Window"
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Milestone Type"
              value={schedType}
              onChange={e => setSchedType(e.target.value)}
              options={[
                { label: 'Release Cutover', value: 'Release' },
                { label: 'Maintenance Window', value: 'Maintenance' },
                { label: 'UAT Gate', value: 'UAT' },
                { label: 'Deployment Deadline', value: 'Deadline' },
                { label: 'Operational Reminder', value: 'Reminder' }
              ]}
            />

            <Select
              label="Link to Release (Optional)"
              value={schedLinkedReleaseId}
              onChange={e => setSchedLinkedReleaseId(e.target.value)}
              options={[
                { label: `Direct Application Milestone (${product.name})`, value: '' },
                ...releases.map(r => ({
                  label: `Release: ${r.name} (${r.version})`,
                  value: r.id
                }))
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={schedStartDate}
              onChange={e => setSchedStartDate(e.target.value)}
              required
            />

            <Input
              label="End Date (Optional)"
              type="date"
              value={schedEndDate}
              onChange={e => setSchedEndDate(e.target.value)}
            />
          </div>

          <Select
            label="Advance Notification Alert"
            value={schedNotifyDays}
            onChange={e => setSchedNotifyDays(e.target.value)}
            options={[
              { label: 'Same day (at cutover time)', value: '0' },
              { label: '1 day prior', value: '1' },
              { label: '2 days prior', value: '2' },
              { label: '3 days prior', value: '3' },
              { label: '1 week prior', value: '7' }
            ]}
          />

          <div className="pt-2 border-t border-[#1E2D52]">
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Attach Runbook / Cutover Document (Saved to Cloud Storage & Specs Tab)
            </label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setSchedAttachName(file.name)
                setSchedAttachSize(file.size)
                const reader = new FileReader()
                reader.onload = () => setSchedAttachData(reader.result as string)
                reader.readAsDataURL(file)
              }}
              className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#15203D] file:text-gray-200 hover:file:bg-[#1E2D52] cursor-pointer"
            />
            {schedAttachName && (
              <span className="text-[11px] text-cyan-400 block mt-1">
                Selected: {schedAttachName} ({((schedAttachSize || 0) / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>
        </div>
      </Modal>

      {/* Assign Team Member Modal */}
      <Modal
        isOpen={isAddTeamMemberOpen}
        onClose={() => setIsAddTeamMemberOpen(false)}
        title={`Assign Team Member to ${product.name}`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsAddTeamMemberOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTeamMember} className="bg-[#2E5EFF] text-white">Assign to Application</Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">Select User from Company Directory</label>
            <select
              value={selectedMemberUserId}
              onChange={e => setSelectedMemberUserId(e.target.value)}
              className="w-full bg-[#070B19] border border-[#1E2D52] hover:border-[#2E5EFF]/50 focus:border-[#2E5EFF] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              {companyUsers.map(u => {
                const isAlreadyAssigned = teamMembers.some(m => m.user_id === u.id || m.user_id === u.display_name)
                return (
                  <option key={u.id} value={u.id}>
                    {u.display_name} ({u.role || 'User'}) {isAlreadyAssigned ? '· [Already Assigned]' : ''}
                  </option>
                )
              })}
            </select>
          </div>

          <Select
            label="Role in this Application"
            value={memberRoleInApp}
            onChange={e => setMemberRoleInApp(e.target.value)}
            options={[
              { label: 'Developer', value: 'Developer' },
              { label: 'QA / Test Lead', value: 'QA / Test Lead' },
              { label: 'DevOps / SRE', value: 'DevOps / SRE' },
              { label: 'Solution Architect', value: 'Solution Architect' },
              { label: 'Business Analyst', value: 'Business Analyst' },
              { label: 'Product Specialist', value: 'Product Specialist' },
              { label: 'Contributor', value: 'Contributor' }
            ]}
          />
        </div>
      </Modal>

      {/* Add UAT Test Scenario Modal */}
      <Modal
        isOpen={isAddUatOpen}
        onClose={() => setIsAddUatOpen(false)}
        title={`Add Quality Gate / UAT Scenario for ${product.name}`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsAddUatOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateUatCase} className="bg-[#2E5EFF] text-white font-bold">
              Save Test Scenario
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <Input
            label="Test Scenario Summary"
            value={uatTitle}
            onChange={e => setUatTitle(e.target.value)}
            placeholder="e.g. Verify multi-tenant authentication token rotation"
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Linked Release"
              value={uatReleaseId}
              onChange={e => setUatReleaseId(e.target.value)}
              options={releases.length > 0 ? releases.map(r => ({
                label: `${r.name} (${r.version})`,
                value: r.id
              })) : [{ label: 'General / No Release', value: 'rel-general' }]}
            />

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Tester / Assignee</label>
              <select
                value={uatAssignee}
                onChange={e => setUatAssignee(e.target.value)}
                className="w-full bg-[#111d3c] border border-[#1e2d52] hover:border-[#2E5EFF]/50 focus:border-[#2E5EFF] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="">Unassigned</option>
                {/* Product Team Members first */}
                {teamMembers.map(m => (
                  <option key={m.membership_id || m.id} value={m.display_name} className="bg-[#111d3c] text-white">
                    {m.display_name} ({m.role_in_product || 'Team Member'})
                  </option>
                ))}
                {/* Other active company users */}
                {companyUsers
                  .filter(u => !teamMembers.some(m => m.user_id === u.id || m.display_name === u.display_name))
                  .map(u => (
                    <option key={u.id} value={u.display_name} className="bg-[#111d3c] text-white">
                      {u.display_name} ({u.role || 'User'})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <Select
            label="Initial Result Status"
            value={uatResult}
            onChange={e => setUatResult(e.target.value as TestResult)}
            options={[
              { label: 'Pending (Ready to Execute)', value: 'Pending' },
              { label: 'Pass (Acceptance Criteria Verified)', value: 'Pass' },
              { label: 'Fail (Defect Detected)', value: 'Fail' },
              { label: 'Blocked (Impediment / Dependency)', value: 'Blocked' }
            ]}
          />

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Detailed Steps & Expected Behavior</label>
            <textarea
              value={uatDescription}
              onChange={e => setUatDescription(e.target.value)}
              placeholder="1. Send valid auth request...&#10;2. Check response token expiration...&#10;3. Assert 200 OK status code."
              className="w-full bg-[#111d3c] border border-[#1e2d52] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] min-h-[90px]"
            />
          </div>

          <Input
            label="Initial Test Notes / Environment (Optional)"
            value={uatNotes}
            onChange={e => setUatNotes(e.target.value)}
            placeholder="e.g. Executed on staging-cluster-west with build #142"
          />

          <div className="pt-2 border-t border-[#1E2D52]">
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Attach Test Evidence / Artifact (Optional, saved to Cloud & Specs tab)
            </label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setUatAttachName(file.name)
                setUatAttachSize(file.size)
                const reader = new FileReader()
                reader.onload = () => setUatAttachData(reader.result as string)
                reader.readAsDataURL(file)
              }}
              className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#15203D] file:text-gray-200 hover:file:bg-[#1E2D52] cursor-pointer"
            />
            {uatAttachName && (
              <span className="text-[11px] text-cyan-400 block mt-1">
                Selected: {uatAttachName} ({((uatAttachSize || 0) / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>
        </div>
      </Modal>

      {/* Edit UAT Test Scenario Modal */}
      <Modal
        isOpen={isEditUatOpen}
        onClose={() => setIsEditUatOpen(false)}
        title="Edit Quality Gate / UAT Scenario"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsEditUatOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateUatCase} className="bg-[#2E5EFF] text-white font-bold">
              Update Scenario
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <Input
            label="Test Scenario Summary"
            value={editUatTitle}
            onChange={e => setEditUatTitle(e.target.value)}
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Linked Release"
              value={editUatReleaseId}
              onChange={e => setEditUatReleaseId(e.target.value)}
              options={releases.length > 0 ? releases.map(r => ({
                label: `${r.name} (${r.version})`,
                value: r.id
              })) : [{ label: 'General / No Release', value: 'rel-general' }]}
            />

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Tester / Assignee</label>
              <select
                value={editUatAssignee}
                onChange={e => setEditUatAssignee(e.target.value)}
                className="w-full bg-[#111d3c] border border-[#1e2d52] hover:border-[#2E5EFF]/50 focus:border-[#2E5EFF] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="">Unassigned</option>
                {teamMembers.map(m => (
                  <option key={m.membership_id || m.id} value={m.display_name} className="bg-[#111d3c] text-white">
                    {m.display_name} ({m.role_in_product || 'Team Member'})
                  </option>
                ))}
                {companyUsers
                  .filter(u => !teamMembers.some(m => m.user_id === u.id || m.display_name === u.display_name))
                  .map(u => (
                    <option key={u.id} value={u.display_name} className="bg-[#111d3c] text-white">
                      {u.display_name} ({u.role || 'User'})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <Select
            label="Acceptance Result Status"
            value={editUatResult}
            onChange={e => setEditUatResult(e.target.value as TestResult)}
            options={[
              { label: 'Pending (Ready to Execute)', value: 'Pending' },
              { label: 'Pass (Acceptance Criteria Verified)', value: 'Pass' },
              { label: 'Fail (Defect Detected)', value: 'Fail' },
              { label: 'Blocked (Impediment / Dependency)', value: 'Blocked' }
            ]}
          />

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Detailed Steps & Expected Behavior</label>
            <textarea
              value={editUatDescription}
              onChange={e => setEditUatDescription(e.target.value)}
              className="w-full bg-[#111d3c] border border-[#1e2d52] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] min-h-[90px]"
            />
          </div>

          <Input
            label="Execution Notes / Defect Details"
            value={editUatNotes}
            onChange={e => setEditUatNotes(e.target.value)}
            placeholder="e.g. Logs attached to defect ticket #89"
          />

          <div className="pt-2 border-t border-[#1E2D52]">
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Attached Test Evidence / Artifact
            </label>
            {editUatAttachName && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#080E21] border border-cyan-500/30 text-cyan-300 text-xs mb-2">
                <div className="flex items-center gap-2 truncate">
                  <File size={14} className="text-cyan-400 shrink-0" />
                  <span className="font-mono truncate">{editUatAttachName}</span>
                  {editUatAttachSize && (
                    <span className="text-[10px] text-gray-500">
                      ({((editUatAttachSize || 0) / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {editUatAttachData && (
                    <button
                      type="button"
                      onClick={() => handleDownloadUatAttachment(editUatAttachName, editUatAttachData)}
                      className="p-1 text-cyan-300 hover:text-white"
                      title="Download artifact"
                    >
                      <Download size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditUatAttachName('')
                      setEditUatAttachData('')
                      setEditUatAttachSize(null)
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
                setEditUatAttachName(file.name)
                setEditUatAttachSize(file.size)
                const reader = new FileReader()
                reader.onload = () => setEditUatAttachData(reader.result as string)
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
          <Select
            label="Target Release to Sign Off"
            value={signOffReleaseId}
            onChange={e => setSignOffReleaseId(e.target.value)}
            options={releases.map(r => ({
              label: `${r.name} (${r.version}) - Status: ${r.status}`,
              value: r.id
            }))}
          />

          {/* Release Verification Readiness Assessment */}
          {(() => {
            const relCases = uatCases.filter(u => u.releaseId === signOffReleaseId)
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

/** ── Subcomponent: Dynamic Custom Section Renderer ────────────────── */
function CustomSectionRenderer({ 
  section, 
  readOnly = false,
  onDelete, 
  onSave 
}: { 
  section: CustomSection
  readOnly?: boolean
  onDelete: () => void
  onSave: (newJson: string) => void 
}) {
  const [fields, setFields] = useState<any[]>(() => {
    try { return JSON.parse(section.content_json) } catch { return [] }
  })
  const [markdownText, setMarkdownText] = useState(section.content_json || '')
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldValue, setNewFieldValue] = useState('')
  const [newChecklistText, setNewChecklistText] = useState('')
  const [savedToast, setSavedToast] = useState(false)

  useEffect(() => {
    try {
      setFields(JSON.parse(section.content_json))
    } catch {
      setFields([])
    }
    setMarkdownText(section.content_json || '')
  }, [section.id, section.content_json])

  const showSaved = () => {
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2000)
  }

  // Save Form Fields
  const handleSaveFields = () => {
    onSave(JSON.stringify(fields))
    showSaved()
  }

  const handleAddField = () => {
    if (!newFieldLabel.trim()) return
    const updated = [...fields, { label: newFieldLabel.trim(), value: newFieldValue.trim() }]
    setFields(updated)
    onSave(JSON.stringify(updated))
    setNewFieldLabel('')
    setNewFieldValue('')
    showSaved()
  }

  const handleRemoveField = (idx: number) => {
    const updated = fields.filter((_, i) => i !== idx)
    setFields(updated)
    onSave(JSON.stringify(updated))
  }

  // Save Checklist
  const handleToggleChecklist = (idx: number) => {
    if (readOnly) return
    const updated = fields.map((item, i) => i === idx ? { ...item, done: !item.done } : item)
    setFields(updated)
    onSave(JSON.stringify(updated))
  }

  const handleAddChecklist = () => {
    if (!newChecklistText.trim()) return
    const updated = [...fields, { text: newChecklistText.trim(), done: false }]
    setFields(updated)
    onSave(JSON.stringify(updated))
    setNewChecklistText('')
    showSaved()
  }

  const handleRemoveChecklist = (idx: number) => {
    const updated = fields.filter((_, i) => i !== idx)
    setFields(updated)
    onSave(JSON.stringify(updated))
  }

  // Save Markdown
  const handleSaveMarkdown = () => {
    onSave(markdownText)
    showSaved()
  }

  return (
    <div className="p-8 rounded-3xl bg-[#0A1024] border border-[#1E2D52] shadow-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-[#1E2D52] pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#F5A623]/10 border border-[#F5A623]/30 text-[#F5A623]">
            {renderSectionIcon(section.icon, 20)}
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{section.title}</h3>
            <span className="text-xs text-gray-400 capitalize">Custom Section Type: {section.section_type.replace('_', ' ')}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {savedToast && (
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 animate-in fade-in">
              <CheckCircle2 size={14} /> Changes Saved!
            </span>
          )}
          {readOnly ? (
            <span className="text-xs text-amber-400 font-semibold px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              Read-Only
            </span>
          ) : (
            <Button 
              size="sm" 
              variant="danger" 
              onClick={onDelete}
              className="gap-1.5"
            >
              <Trash2 size={14} /> Remove Section
            </Button>
          )}
        </div>
      </div>

      {/* 1. Custom Form / Key-Value Field Registry */}
      {section.section_type === 'custom_form' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((f, i) => (
              <div key={i} className="p-4 rounded-2xl bg-[#080D1F] border border-[#1E2D52] flex flex-col justify-between space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">{f.label}</span>
                  {!readOnly && (
                    <button 
                      onClick={() => handleRemoveField(i)}
                      className="text-gray-500 hover:text-red-400 p-1"
                      title="Remove Field"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  disabled={readOnly}
                  value={f.value}
                  onChange={(e) => {
                    const updated = [...fields]
                    updated[i].value = e.target.value
                    setFields(updated)
                  }}
                  className={`w-full bg-[#0B1229] border border-[#1E2D52] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2E5EFF] ${readOnly ? 'opacity-75 cursor-not-allowed' : ''}`}
                />
              </div>
            ))}
          </div>

          {!readOnly && (
            <>
              <div className="p-5 rounded-2xl bg-[#080D1F] border border-[#1E2D52] flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <label className="text-xs font-semibold text-gray-400 block mb-1">Add New Field Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Cluster Node IP, SLA Threshold, Ops Lead"
                    value={newFieldLabel}
                    onChange={e => setNewFieldLabel(e.target.value)}
                    className="w-full bg-[#0B1229] border border-[#1E2D52] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="text-xs font-semibold text-gray-400 block mb-1">Field Value</label>
                  <input
                    type="text"
                    placeholder="Enter value..."
                    value={newFieldValue}
                    onChange={e => setNewFieldValue(e.target.value)}
                    className="w-full bg-[#0B1229] border border-[#1E2D52] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <Button onClick={handleAddField} className="shrink-0 gap-1.5">
                  <Plus size={14} /> Add Field
                </Button>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveFields} className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                  <Save size={15} /> Save Form Configuration
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 2. Interactive Checklist */}
      {section.section_type === 'checklist' && (
        <div className="space-y-6">
          <div className="space-y-2.5">
            {fields.map((c, i) => (
              <div 
                key={i} 
                className={`p-4 rounded-2xl border transition-colors flex items-center justify-between ${
                  c.done ? 'bg-emerald-500/10 border-emerald-500/30 text-white' : 'bg-[#080D1F] border-[#1E2D52] text-gray-200'
                }`}
              >
                <label className={`flex items-center gap-3 select-none flex-1 ${readOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={c.done}
                    onChange={() => handleToggleChecklist(i)}
                    className="w-4 h-4 rounded text-[#2E5EFF] focus:ring-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span className={`text-sm ${c.done ? 'line-through text-gray-400' : 'font-medium text-white'}`}>
                    {c.text}
                  </span>
                </label>
                {!readOnly && (
                  <button 
                    onClick={() => handleRemoveChecklist(i)}
                    className="text-gray-500 hover:text-red-400 p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            {fields.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-500">No checklist items yet.</div>
            )}
          </div>

          {!readOnly && (
            <div className="p-4 rounded-2xl bg-[#080D1F] border border-[#1E2D52] flex gap-3">
              <input
                type="text"
                placeholder="Add checklist milestone or audit condition..."
                value={newChecklistText}
                onChange={e => setNewChecklistText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddChecklist(); }}
                className="flex-1 bg-[#0B1229] border border-[#1E2D52] rounded-xl px-3 py-2 text-sm text-white"
              />
              <Button onClick={handleAddChecklist} className="shrink-0 gap-1.5">
                <Plus size={14} /> Add Item
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 3. Rich Markdown & Notes */}
      {section.section_type === 'markdown' && (
        <div className="space-y-4">
          <textarea
            value={markdownText}
            disabled={readOnly}
            onChange={e => setMarkdownText(e.target.value)}
            className={`w-full min-h-[300px] bg-[#070B19] border border-[#1E2D52] rounded-2xl p-4 text-sm text-white font-mono leading-relaxed focus:outline-none focus:border-[#2E5EFF] ${readOnly ? 'opacity-75 cursor-not-allowed' : ''}`}
            placeholder="Write architecture guidelines, runbooks, or operational notes in Markdown..."
          />
          {!readOnly && (
            <div className="flex justify-end">
              <Button onClick={handleSaveMarkdown} className="gap-2 bg-emerald-600 hover:bg-emerald-500 font-bold">
                <Save size={15} /> Save Notes & Specs
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

