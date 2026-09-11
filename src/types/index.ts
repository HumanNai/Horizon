// ─────────────────────────────────────────────────────────────
//  Horizon Shared Types
//  Used by both the Electron main process and the React renderer.
// ─────────────────────────────────────────────────────────────

// ── Roles & Auth ─────────────────────────────────────────────
export type UserRole = 'ProductOwner' | 'ProductLead' | 'TeamMember' | 'Management'

export interface UserNotification {
  id: string
  userId: string
  title: string
  message: string
  type: 'Assignment' | 'Release' | 'Task' | 'Schedule' | string
  entityType?: string
  entityId?: string
  read: boolean
  createdAt: string
}

export interface HorizonUser {
  id: string
  username: string
  displayName: string
  role: UserRole
  active: boolean
  email?: string
  avatarInitials?: string
  spItemId?: string        // SharePoint list item ID
  createdAt: string
  updatedAt: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface SessionInfo {
  user: HorizonUser
  token: string
  expiresAt: string
}

// ── Products ──────────────────────────────────────────────────
export type ProductType = 'Internal' | 'External' | string
export type ProductStatus = 'Active' | 'OnHold' | 'Deprecated' | 'Planning'

export interface Product {
  id: string
  name: string
  type: ProductType
  status: ProductStatus
  owner: string            // HorizonUser.id
  description?: string
  icon?: string
  spItemId?: string
  createdAt: string
  updatedAt: string
}

// ── Releases ──────────────────────────────────────────────────
export type ReleaseStatus = 'Planning' | 'Development' | 'QA' | 'UAT' | 'SignOff' | 'Released' | 'Cancelled'

export interface Release {
  id: string
  productId: string
  version: string
  name: string
  status: ReleaseStatus
  targetDate: string
  releasedDate?: string
  description?: string
  features: string[]         // JSON array
  serverUpgrades?: string
  spItemId?: string
  createdAt: string
  updatedAt: string
}

// ── Tasks ──────────────────────────────────────────────────────
export type TaskStatus = 'Todo' | 'InProgress' | 'Blocked' | 'Done'
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical'

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  assigneeId: string          // HorizonUser.id
  productId?: string
  releaseId?: string
  dueDate?: string
  spItemId?: string
  createdAt: string
  updatedAt: string
}

// ── UAT / QA ──────────────────────────────────────────────────
export type TestResult = 'Pending' | 'Pass' | 'Fail' | 'Blocked'

export interface UATCase {
  id: string
  releaseId: string
  productId?: string
  title: string
  description?: string
  result: TestResult
  assigneeId?: string
  notes?: string
  attachmentName?: string
  attachmentData?: string
  attachmentSize?: number
  spItemId?: string
  updatedAt: string
}

export interface ReleaseSignOff {
  releaseId: string
  signedOffBy: string       // HorizonUser.id
  signedOffAt: string
  notes?: string
}

// ── Interfaces (MQ, Kafka, Schedulers, Event Brokers) ─────────
export type InterfaceType = 'MQ' | 'Kafka' | 'Scheduler' | 'gRPC' | 'SFTP' | 'DB Link' | 'REST' | 'SOAP' | 'Other'
export type InterfaceStatus = 'Active' | 'Deprecated' | 'Planned' | 'Archived'
export type InterfaceDirection = 'Provided' | 'Consumed' | 'Bidirectional'

export interface ProductInterface {
  id: string
  productId: string
  name: string
  type: InterfaceType
  endpoint: string
  serviceProvider?: string       // e.g. IBM MQ 9.3, Confluent Kafka, Control-M
  targetAudience?: string        // To / for whom given or consumed by
  direction?: InterfaceDirection  // Provided vs Consumed
  connectionDetails?: string     // Topics, queues, partitions, cron schedule
  owner: string                  // HorizonUser.id or contact
  status: InterfaceStatus
  description?: string
  spItemId?: string
  createdAt: string
  updatedAt: string
}

// ── APIs & Endpoints (REST, Endpoints, OAuth, Scopes, Given To) ─
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ALL'
export type AuthType = 'OAuth2' | 'API Key' | 'Bearer Token' | 'mTLS' | 'Basic' | 'None'
export type ApiStatus = 'Active' | 'Beta' | 'Deprecated' | 'Planning'

export interface ApiEndpoint {
  id: string
  productId: string
  name: string
  method: HttpMethod
  endpoint: string               // e.g. /api/v2/transactions
  authType: AuthType
  clientId?: string              // Client ID / App ID
  scope?: string                 // Scopes or permissions granted
  apiKeyMeta?: string            // Key identifier / masked key
  givenTo: string                // To whom / for whom given (consumer / client system)
  rateLimit?: string             // e.g. 1,000 req/min
  owner: string                  // Owner or lead
  status: ApiStatus
  description?: string
  spItemId?: string
  createdAt: string
  updatedAt: string
}


// ── Secrets ───────────────────────────────────────────────────
export interface SecretMeta {
  id: string
  name: string
  category: string
  description?: string
  lastRotatedAt?: string
  lastAccessedAt?: string
  lastAccessedBy?: string
  spItemId?: string
  source?: 'local' | 'azure-keyvault'
  vaultUrl?: string
  enabled?: boolean
  createdAt: string
  updatedAt: string
}

export interface AzureKeyVaultSecret {
  id: string
  name: string
  category: string
  description?: string
  enabled: boolean
  created_at: string
  updated_at: string
  source: 'azure-keyvault'
  vaultUrl: string
  tags?: Record<string, string>
}

// ── HR & Team Availability ──────────────────────────────────────────
export type AvailabilityStatus = 'Available' | 'OnLeave' | 'Partial' | 'Unavailable'
export type WorkLocation = 'Office' | 'WFH' | 'Hybrid' | 'Client Site' | 'Travel'

export interface HRRecord {
  id: string
  userId: string            // HorizonUser.id or display name
  status: AvailabilityStatus
  workLocation?: WorkLocation
  leaveFrom?: string
  leaveTo?: string
  phone?: string
  emergencyContact?: string
  skillsTags?: string
  notes?: string
  spItemId?: string
  createdAt?: string
  updatedAt: string
}

// ── Schedule / Events ─────────────────────────────────────────
export type EventType = 'Release' | 'UAT' | 'Deadline' | 'Meeting' | 'Leave' | 'Reminder' | 'Other'

export interface ScheduleEvent {
  id: string
  title: string
  type: EventType
  startDate: string
  endDate?: string
  linkedId?: string         // productId / releaseId / etc.
  linkedType?: string
  notifyAt?: string         // ISO datetime
  notified: boolean
  createdBy: string
  spItemId?: string
  createdAt: string
  updatedAt: string
}

// ── Documents ─────────────────────────────────────────────────
export type DocCategory = 'BRD' | 'ICD' | 'API' | 'Kafka' | 'UAT' | 'Other'

export interface Document {
  id: string
  title: string
  category: DocCategory
  productId?: string
  owner: string
  version?: string
  description?: string
  driveItemId: string        // OneDrive/SharePoint driveItem id
  webUrl: string
  lastModified: string
  fileSize?: number
  mimeType?: string
  fileName?: string
  fileData?: string          // Base64 data for direct offline viewing/downloading
  sharepointStatus?: string  // 'Synced' | 'Pending' | 'LocalOnly' | 'Failed'
}

// ── Audit Log ─────────────────────────────────────────────────
export type AuditAction =
  | 'Login' | 'Logout'
  | 'SecretView' | 'SecretAdd' | 'SecretRotate'
  | 'ProductCreate' | 'ProductUpdate' | 'ProductDelete'
  | 'ReleaseCreate' | 'ReleaseUpdate' | 'ReleaseSignOff'
  | 'TaskCreate' | 'TaskUpdate' | 'TaskDelete'
  | 'UserCreate' | 'UserUpdate' | 'UserDeactivate'
  | 'DocumentView' | 'DocumentUpload'
  | 'PluginConnect' | 'PluginDisconnect'
  | 'SyncSuccess' | 'SyncError'

export interface AuditEntry {
  id: string
  userId: string
  action: AuditAction
  entityType?: string
  entityId?: string
  detail?: string
  ipAddress?: string
  spItemId?: string
  createdAt: string
}

// ── KPI Dashboard ─────────────────────────────────────────────
export interface KPIData {
  releaseVelocity: number          // releases last 30 days
  qaPassRate: number               // %
  openTasksByProduct: Array<{ productId: string; productName: string; count: number }>
  openTasksByOwner: Array<{ userId: string; displayName: string; count: number }>
  upcomingDeadlines: ScheduleEvent[]
  recentActivity: AuditEntry[]
}

// ── Plugin System ─────────────────────────────────────────────
export type PluginConnectionStatus = 'connected' | 'disconnected' | 'error' | 'configuring'

export interface PluginFieldDef {
  key: string
  label: string
  type: 'text' | 'password' | 'select' | 'url'
  required: boolean
  options?: { label: string; value: string }[]
  placeholder?: string
  hint?: string
}

export interface PluginManifest {
  id: string
  name: string
  description: string
  version: string
  icon: string
  fields: PluginFieldDef[]
  scopes: string[]
  authType: 'oauth2' | 'apikey' | 'none'
}

export interface PluginConfig {
  pluginId: string
  settings: Record<string, string>
  status: PluginConnectionStatus
  connectedAs?: string
  connectedAt?: string
  error?: string
}

// ── Sync ─────────────────────────────────────────────────────
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncState {
  status: SyncStatus
  lastSyncAt?: string
  error?: string
  pendingChanges: number
}

// ── Diagnostic Logs ──────────────────────────────────────────
export interface DiagnosticLog {
  id: string
  timestamp: string
  level: 'info' | 'success' | 'warn' | 'error'
  source: string
  message: string
  details?: string
}

export interface BackendDiagnosticResult {
  success: boolean
  pingMs: number
  providerId: string
  providerName: string
  clusterInfo: string
  databaseOrPath: string
  collectionsOrLists: string[]
  error?: string
}

// ── IPC Channel Definitions ───────────────────────────────────
// These are the exact channel names used in ipcMain.handle / ipcRenderer.invoke
export const IPC = {
  // Auth & RBAC
  AUTH_LOGIN:            'auth:login',
  AUTH_LOGOUT:           'auth:logout',
  AUTH_GET_SESSION:      'auth:getSession',
  AUTH_CHANGE_PASSWORD:  'auth:changePassword',
  AUTH_LIST_USERS:       'auth:listUsers',
  AUTH_CREATE_USER:      'auth:createUser',
  AUTH_UPDATE_USER:      'auth:updateUser',
  AUTH_DELETE_USER:      'auth:deleteUser',

  // DB / CRUD (generic)
  DB_QUERY:              'db:query',
  DB_EXECUTE:            'db:execute',

  // Graph / SharePoint
  GRAPH_GET_TOKEN:       'graph:getToken',
  GRAPH_QUERY_LIST:      'graph:queryList',
  GRAPH_CREATE_ITEM:     'graph:createItem',
  GRAPH_UPDATE_ITEM:     'graph:updateItem',
  GRAPH_DELETE_ITEM:     'graph:deleteItem',
  GRAPH_LIST_DOCUMENTS:  'graph:listDocuments',
  GRAPH_UPLOAD_DOCUMENT: 'graph:uploadDocument',

  // Secrets
  SECRETS_UNLOCK:           'secrets:unlock',
  SECRETS_LOCK:             'secrets:lock',
  SECRETS_LIST:             'secrets:list',
  SECRETS_ADD:              'secrets:add',
  SECRETS_REVEAL:           'secrets:reveal',
  SECRETS_ROTATE:           'secrets:rotate',
  SECRETS_DELETE:           'secrets:delete',
  SECRETS_LIST_AZURE:       'secrets:listAzure',
  SECRETS_REVEAL_AZURE:     'secrets:revealAzure',
  SECRETS_ADD_AZURE:        'secrets:addAzure',
  SECRETS_GET_AZURE_STATUS: 'secrets:getAzureStatus',
  SECRETS_GET_STATUS:       'secrets:getStatus',
  SECRETS_SETUP_PASSPHRASE: 'secrets:setupPassphrase',
  SECRETS_CHANGE_PASSPHRASE:'secrets:changePassphrase',

  // Sync
  SYNC_TRIGGER:          'sync:trigger',
  SYNC_STATUS:           'sync:status',
  SYNC_GET_STATE:        'sync:getState',

  // Notifications
  NOTIFY_SCHEDULE:       'notify:schedule',
  NOTIFY_CANCEL:         'notify:cancel',
  NOTIFY_SEND:           'notify:send',

  // Plugins & Active Backend
  PLUGIN_LIST:                'plugin:list',
  PLUGIN_SAVE_CONFIG:         'plugin:saveConfig',
  PLUGIN_CONNECT:             'plugin:connect',
  PLUGIN_DISCONNECT:          'plugin:disconnect',
  PLUGIN_GET_STATUS:          'plugin:getStatus',
  PLUGIN_GET_ACTIVE_BACKEND:  'plugin:getActiveBackend',
  PLUGIN_SET_ACTIVE_BACKEND:  'plugin:setActiveBackend',
  PLUGIN_TEST_CONNECTION:     'plugin:testConnection',
  PLUGIN_SEED_BACKEND:        'plugin:seedBackend',
  PLUGIN_TEST_MONGO:          'plugin:testMongo',
  PLUGIN_SYNC_MONGO_SEED:     'plugin:syncMongoSeed',
  PLUGIN_GET_LOGS:            'plugin:getLogs',
  PLUGIN_LOG_EVENT:           'plugin:logEvent',
  PLUGIN_DELETE_CLOUD_RECORD: 'plugin:deleteCloudRecord',
  PLUGIN_GET_APP_SETTING:     'plugin:getAppSetting',
  PLUGIN_SET_APP_SETTING:     'plugin:setAppSetting',

  // Unified Cloud Storage (routes to active provider)
  STORAGE_UPLOAD_DOCUMENT:    'storage:uploadDocument',
  STORAGE_DOWNLOAD_DOCUMENT:  'storage:downloadDocument',

  // OneDrive
  ONEDRIVE_UPLOAD_FILE:       'onedrive:uploadFile',
  ONEDRIVE_DOWNLOAD_FILE:     'onedrive:downloadFile',
  ONEDRIVE_LIST_FILES:        'onedrive:listFiles',
  ONEDRIVE_DELETE_FILE:       'onedrive:deleteFile',

  // Google Drive
  GDRIVE_UPLOAD_FILE:         'gdrive:uploadFile',
  GDRIVE_DOWNLOAD_FILE:       'gdrive:downloadFile',
  GDRIVE_LIST_FILES:          'gdrive:listFiles',
  GDRIVE_DELETE_FILE:         'gdrive:deleteFile',

  // Window
  WINDOW_MINIMIZE:       'window:minimize',
  WINDOW_MAXIMIZE:       'window:maximize',
  WINDOW_CLOSE:          'window:close',
  WINDOW_IS_MAXIMIZED:   'window:isMaximized',
  WINDOW_MAXIMIZE_CHANGE:'window:maximizeChange',
} as const

