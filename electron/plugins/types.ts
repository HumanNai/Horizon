import Database from 'better-sqlite3';

export interface DocumentUploadResult {
  driveItemId: string;
  webUrl: string;
  name: string;
  fileSize: number;
  mimeType?: string;
}

export interface BackendProvider {
  readonly id: string;
  readonly name: string;

  initialize(): Promise<void>;
  authenticate(): Promise<string>;
  getConnectedUser(): Promise<string>;

  // ── Data Synchronization (Structured Records) ───────────────────
  pullDeltas(db: Database.Database): Promise<void>;
  pushMutations(db: Database.Database): Promise<void>;

  // ── Document & File Storage ─────────────────────────────────────
  uploadDocument(
    fileName: string,
    content: Buffer | Uint8Array | string,
    category?: string
  ): Promise<DocumentUploadResult>;

  downloadDocument(driveItemId: string): Promise<Buffer>;
  deleteDocument(driveItemId: string): Promise<boolean>;

  // ── Diagnostics & Seeding ───────────────────────────────────────
  testConnection?(overrideSettings?: Record<string, string>): Promise<any>;
  seedAllTables?(db: Database.Database): Promise<{ pushed: Record<string, number>; total: number; providerId: string }>;
}

export const TRACKED_ENTITIES = [
  'products',
  'releases',
  'tasks',
  'uat_cases',
  'interfaces',
  'apis',
  'hr_records',
  'schedule_events',
  'product_custom_sections',
  'users',
  'audit_log'
] as const;

export type TrackedEntity = typeof TRACKED_ENTITIES[number];

