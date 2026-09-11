import Database from 'better-sqlite3';
import { MongoClient, Db, GridFSBucket, ObjectId } from 'mongodb';
import { PluginConfig } from '../../../src/types';
import { BackendProvider, DocumentUploadResult, TRACKED_ENTITIES } from '../types';
import { pluginLogger } from '../logger';

export class MongoDBConnector implements BackendProvider {
  readonly id = 'mongodb-core';
  readonly name = 'MongoDB Enterprise';

  private config: PluginConfig;
  private isConnected = false;
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private sanitizedHost = 'cluster.mongodb.net';
  private username = 'db_user';
  private dbName = 'horizon_pm';

  constructor(config: PluginConfig) {
    this.config = config;
  }

  private normalizeUri(rawUri: string): string {
    let uri = rawUri.trim();
    // Rewrite localhost to 127.0.0.1 to avoid Windows Node.js IPv6 ECONNREFUSED ::1
    if (uri.startsWith('mongodb://localhost:')) {
      uri = uri.replace('mongodb://localhost:', 'mongodb://127.0.0.1:');
    } else if (uri.startsWith('mongodb://localhost/')) {
      uri = uri.replace('mongodb://localhost/', 'mongodb://127.0.0.1/');
    } else if (uri === 'mongodb://localhost') {
      uri = 'mongodb://127.0.0.1:27017';
    }
    return uri;
  }

  private diagnoseError(err: any): string {
    const msg = err?.message || String(err);
    if (msg.includes('bad auth') || msg.includes('Authentication failed')) {
      return 'Authentication failed: Invalid MongoDB username or password. Please check your credentials.';
    }
    if (msg.includes('ECONNREFUSED')) {
      return 'Connection refused: MongoDB is not running at this address, or is listening on IPv4 only. If using local MongoDB, ensure your mongod service is running.';
    }
    if (msg.includes('Server selection timed out') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND')) {
      return 'Connection timed out: Could not reach MongoDB cluster. Ensure your IP address is whitelisted in MongoDB Atlas Network Access (e.g. Allow Access from Anywhere or add your current IP).';
    }
    if (msg.includes('MongoParseError') || msg.includes('Invalid scheme')) {
      return 'Invalid connection URI syntax. Format must be mongodb+srv://<username>:<password>@cluster.mongodb.net/<database>';
    }
    if (msg.includes('SSL') || msg.includes('certificate') || msg.includes('TLS')) {
      return `TLS/SSL handshake failure with MongoDB: ${msg}`;
    }
    return msg;
  }

  async initialize() {
    const rawUri = (this.config.settings?.connectionUri || '').trim();
    const uri = this.normalizeUri(rawUri);
    this.dbName = (this.config.settings?.databaseName || 'horizon_pm').trim();

    if (!uri) {
      throw new Error('MongoDB Connection String URI is required (e.g. mongodb+srv://user:password@cluster.mongodb.net/horizon_pm)');
    }

    if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
      throw new Error('Invalid connection string format. URI must start with mongodb:// or mongodb+srv://');
    }

    try {
      const match = uri.match(/mongodb(?:\+srv)?:\/\/(?:([^:]+):([^@]+)@)?([^/?#]+)(?:\/([^?#]+))?/);
      if (match) {
        this.username = match[1] || 'authenticated_user';
        this.sanitizedHost = match[3] || 'cluster.mongodb.net';
        if (match[4] && !this.config.settings?.databaseName) {
          this.dbName = match[4].split('?')[0];
        }
      }
    } catch (_) {}
  }

  async authenticate(): Promise<string> {
    await this.initialize();
    const uri = this.normalizeUri((this.config.settings?.connectionUri || '').trim());

    pluginLogger.info('MongoDB', `Connecting to cluster at ${this.sanitizedHost}...`);

    try {
      if (this.client) {
        try {
          await this.client.close(true);
        } catch (_) {}
        this.client = null;
        this.db = null;
      }

      this.client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000
      });

      await this.client.connect();
      this.db = this.client.db(this.dbName);

      const startTime = Date.now();
      await this.db.command({ ping: 1 });
      const pingMs = Date.now() - startTime;

      this.isConnected = true;
      pluginLogger.success(
        'MongoDB',
        `Successfully connected and pinged database '${this.dbName}' (${pingMs}ms latency)`
      );

      return `mongodb-connected-${this.sanitizedHost}`;
    } catch (err: any) {
      this.isConnected = false;
      this.client = null;
      this.db = null;
      const diagnosed = this.diagnoseError(err);
      pluginLogger.error('MongoDB', `Connection failed: ${diagnosed}`, err.stack);
      throw new Error(diagnosed);
    }
  }

  async getConnectedUser(): Promise<string> {
    return `${this.username}@${this.sanitizedHost} [${this.dbName}]`;
  }

  private async ensureDb(): Promise<Db> {
    if (!this.isConnected || !this.client || !this.db) {
      await this.authenticate();
    }
    if (!this.db) {
      throw new Error('MongoDB database instance is not connected.');
    }
    return this.db;
  }

  // ── Diagnostics / Test Connection ──────────────────────────────

  async testConnection(overrideSettings?: Record<string, string> | string, overrideDbName?: string): Promise<any> {
    const overrideUri = typeof overrideSettings === 'string' ? overrideSettings : overrideSettings?.connectionUri;
    const dbOverride = typeof overrideSettings === 'string' ? overrideDbName : (overrideSettings?.databaseName || overrideDbName);
    const rawUri = (overrideUri || this.config.settings?.connectionUri || '').trim();
    const uri = this.normalizeUri(rawUri);
    const dbName = (dbOverride || this.config.settings?.databaseName || this.dbName || 'horizon_pm').trim();

    if (!uri) {
      return {
        success: false,
        pingMs: 0,
        clusterInfo: 'N/A',
        database: dbName,
        collections: [],
        error: 'Connection URI cannot be empty.'
      };
    }

    pluginLogger.info('MongoDB', `Testing connection to '${dbName}'...`);
    let testClient: MongoClient | null = null;
    try {
      testClient = new MongoClient(uri, {
        serverSelectionTimeoutMS: 7000,
        connectTimeoutMS: 7000
      });

      const startTime = Date.now();
      await testClient.connect();
      const testDb = testClient.db(dbName);
      const buildInfo = await testDb.command({ buildInfo: 1 }).catch(() => ({ version: 'Cluster' }));
      await testDb.command({ ping: 1 });
      const pingMs = Date.now() - startTime;

      const collList = await testDb.listCollections().toArray();
      const collections = collList.map(c => c.name);

      pluginLogger.success(
        'MongoDB',
        `Diagnostic ping passed in ${pingMs}ms. Found ${collections.length} existing collections in '${dbName}'.`
      );

      return {
        success: true,
        pingMs,
        providerId: this.id,
        providerName: this.name,
        clusterInfo: `MongoDB v${buildInfo.version || 'Atlas'}`,
        databaseOrPath: dbName,
        collectionsOrLists: collections,
        database: dbName,
        collections
      };
    } catch (err: any) {
      const diagnosed = this.diagnoseError(err);
      pluginLogger.error('MongoDB', `Diagnostic test failed: ${diagnosed}`);
      return {
        success: false,
        pingMs: 0,
        providerId: this.id,
        providerName: this.name,
        clusterInfo: 'Unavailable',
        databaseOrPath: dbName,
        collectionsOrLists: [],
        database: dbName,
        collections: [],
        error: diagnosed
      };
    } finally {
      if (testClient) {
        try {
          await testClient.close();
        } catch (_) {}
      }
    }
  }

  // ── Database Seeding (Push all SQLite tables to MongoDB) ─────────

  async seedAllTablesToMongo(db: Database.Database): Promise<{
    pushed: Record<string, number>;
    total: number;
    providerId: string;
  }> {
    const mongoDb = await this.ensureDb();
    pluginLogger.info('MongoDB', `Starting full seed push of all local tables to MongoDB database '${this.dbName}'...`);

    const results: Record<string, number> = {};
    let grandTotal = 0;

    for (const entity of TRACKED_ENTITIES) {
      try {
        // Check if table exists in SQLite
        const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(entity);
        if (!tableCheck) continue;

        const rows = db.prepare(`SELECT * FROM ${entity}`).all() as any[];
        if (rows.length === 0) {
          results[entity] = 0;
          continue;
        }

        const collection = mongoDb.collection(entity);
        const operations = rows.map(row => {
          const docId = String(row.id || row.user_id || row.key || Math.random().toString());
          const cleanDoc: any = { ...row, _id: docId, id: docId };

          // Parse JSON columns if applicable for clean MongoDB schema
          for (const [key, val] of Object.entries(cleanDoc)) {
            if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
              try {
                cleanDoc[key] = JSON.parse(val);
              } catch (_) {}
            }
          }

          return {
            updateOne: {
              filter: { _id: docId },
              update: { $set: cleanDoc },
              upsert: true
            }
          };
        });

        const res = await collection.bulkWrite(operations as any, { ordered: false });
        const count = (res.upsertedCount || 0) + (res.modifiedCount || 0) + (res.matchedCount || 0);
        results[entity] = rows.length;
        grandTotal += rows.length;

        pluginLogger.info('MongoDB', `Seeded ${rows.length} records into collection '${entity}'`);
      } catch (err: any) {
        pluginLogger.warn('MongoDB', `Warning seeding entity '${entity}': ${err.message}`);
      }
    }

    pluginLogger.success(
      'MongoDB',
      `Full seed complete: ${grandTotal} total records synchronized into MongoDB across ${Object.keys(results).length} collections.`
    );

    return { pushed: results, total: grandTotal, providerId: this.id };
  }

  async seedAllTables(db: Database.Database): Promise<{ pushed: Record<string, number>; total: number; providerId: string }> {
    return this.seedAllTablesToMongo(db);
  }

  // ── BackendProvider Implementation: Data Sync ───────────────────

  async pullDeltas(db: Database.Database): Promise<void> {
    const mongoDb = await this.ensureDb();
    pluginLogger.info('MongoDB', 'Checking MongoDB collections for remote updates...');

    for (const entity of TRACKED_ENTITIES) {
      try {
        const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(entity);
        if (!tableCheck) continue;

        // Get SQLite table column names
        const columnsInfo = db.prepare(`PRAGMA table_info(${entity})`).all() as any[];
        const validColumns = new Set(columnsInfo.map(c => c.name));

        const collection = mongoDb.collection(entity);
        const docs = await collection.find({}).limit(500).toArray();
        if (docs.length === 0) continue;

        const insert = db.transaction((rows: any[]) => {
          for (const doc of rows) {
            const filteredRow: any = {};
            for (const key of Object.keys(doc)) {
              if (key === '_id') {
                if (!filteredRow.id && validColumns.has('id')) {
                  filteredRow.id = String(doc._id);
                }
              } else if (validColumns.has(key)) {
                let val = doc[key];
                if (typeof val === 'object' && val !== null) {
                  val = JSON.stringify(val);
                }
                filteredRow[key] = val;
              }
            }

            const cols = Object.keys(filteredRow);
            if (cols.length === 0) continue;

            const colNames = cols.join(', ');
            const placeholders = cols.map(() => '?').join(', ');
            try {
              db.prepare(`INSERT OR REPLACE INTO ${entity} (${colNames}) VALUES (${placeholders})`).run(
                ...Object.values(filteredRow)
              );
            } catch (_) {}
          }
        });

        insert(docs);
        pluginLogger.info('MongoDB', `Synced ${docs.length} documents from collection '${entity}' to local database`);
      } catch (err: any) {
        pluginLogger.warn('MongoDB', `Failed to pull deltas for '${entity}': ${err.message}`);
      }
    }
  }

  async pushMutations(db: Database.Database): Promise<void> {
    const mongoDb = await this.ensureDb();
    const pending = db.prepare('SELECT * FROM local_mutations WHERE synced = 0 ORDER BY created_at ASC').all() as any[];

    if (pending.length === 0) {
      // If no local mutations are pending, verify if collections are empty; if so, seed them automatically
      try {
        const prodCount = await mongoDb.collection('products').countDocuments();
        if (prodCount === 0) {
          const localProdCount = (db.prepare('SELECT COUNT(*) as cnt FROM products').get() as any).cnt;
          if (localProdCount > 0) {
            pluginLogger.info('MongoDB', 'Remote collections appear empty. Auto-seeding existing local tables...');
            await this.seedAllTablesToMongo(db);
          }
        }
      } catch (_) {}
      return;
    }

    pluginLogger.info('MongoDB', `Processing ${pending.length} pending mutations to MongoDB...`);

    for (const mut of pending) {
      try {
        const collection = mongoDb.collection(mut.entity);
        let payload: any = {};
        try {
          payload = JSON.parse(mut.payload_json);
        } catch (_) {}

        const docId = String(payload.id || mut.sp_item_id || Math.random().toString());

        if (mut.operation === 'CREATE' || mut.operation === 'UPDATE') {
          const cleanDoc = { ...payload, id: docId, _id: docId, updated_at: new Date().toISOString() };
          await collection.updateOne({ _id: docId } as any, { $set: cleanDoc }, { upsert: true });
        } else if (mut.operation === 'DELETE') {
          await collection.deleteOne({ _id: docId } as any);
        }

        db.prepare('UPDATE local_mutations SET synced = 1 WHERE id = ?').run(mut.id);
      } catch (mutErr: any) {
        pluginLogger.error('MongoDB', `Failed to push mutation ${mut.id} for ${mut.entity}: ${mutErr.message}`);
      }
    }

    pluginLogger.success('MongoDB', `Successfully synchronized ${pending.length} mutations into MongoDB collections.`);
  }

  // ── BackendProvider Implementation: File & Document Storage ─────

  async uploadDocument(
    fileName: string,
    content: Buffer | Uint8Array | string,
    category?: string
  ): Promise<DocumentUploadResult> {
    const mongoDb = await this.ensureDb();
    const cleanFileName = fileName.replace(/^\/+/, '');
    const bucket = new GridFSBucket(mongoDb, { bucketName: 'fs' });

    let buffer: Buffer;
    if (Buffer.isBuffer(content)) {
      buffer = content;
    } else if (typeof content === 'string') {
      if (content.startsWith('data:')) {
        const base64 = content.split(',')[1];
        buffer = Buffer.from(base64, 'base64');
      } else {
        buffer = Buffer.from(content, 'utf-8');
      }
    } else {
      buffer = Buffer.from(content);
    }

    pluginLogger.info('MongoDB', `Uploading '${cleanFileName}' (${buffer.length} bytes) to GridFS bucket 'fs'...`);

    return new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(cleanFileName, {
        metadata: {
          category: category || 'general',
          uploadedAt: new Date(),
          size: buffer.length
        }
      });

      uploadStream.on('error', (err) => {
        pluginLogger.error('MongoDB', `GridFS upload error for '${cleanFileName}': ${err.message}`);
        reject(err);
      });

      uploadStream.on('finish', () => {
        const fileId = uploadStream.id.toString();
        pluginLogger.success('MongoDB', `Stored '${cleanFileName}' in GridFS with id ${fileId}`);
        resolve({
          driveItemId: fileId,
          webUrl: `mongodb://${this.sanitizedHost}/${this.dbName}/fs.files/${fileId}`,
          name: cleanFileName,
          fileSize: buffer.length,
          mimeType: 'application/octet-stream'
        });
      });

      uploadStream.write(buffer);
      uploadStream.end();
    });
  }

  async downloadDocument(driveItemId: string): Promise<Buffer> {
    const mongoDb = await this.ensureDb();
    const bucket = new GridFSBucket(mongoDb, { bucketName: 'fs' });

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(driveItemId);
    } catch (_) {
      throw new Error(`Invalid GridFS ObjectId: ${driveItemId}`);
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const downloadStream = bucket.openDownloadStream(objectId);

      downloadStream.on('data', chunk => chunks.push(Buffer.from(chunk)));
      downloadStream.on('error', err => reject(err));
      downloadStream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async deleteDocument(driveItemId: string): Promise<boolean> {
    const mongoDb = await this.ensureDb();
    const bucket = new GridFSBucket(mongoDb, { bucketName: 'fs' });

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(driveItemId);
    } catch (_) {
      return false;
    }

    try {
      await bucket.delete(objectId);
      pluginLogger.info('MongoDB', `Deleted GridFS document ${driveItemId}`);
      return true;
    } catch (err: any) {
      pluginLogger.warn('MongoDB', `Failed to delete GridFS document ${driveItemId}: ${err.message}`);
      return false;
    }
  }

  // ── Cloud User Management & Authentication ───────────────────────

  async findUser(username: string): Promise<any | null> {
    const mongoDb = await this.ensureDb();
    const doc = await mongoDb.collection('users').findOne({ username: username.trim() });
    return doc;
  }

  async upsertUser(user: any): Promise<void> {
    const mongoDb = await this.ensureDb();
    const docId = String(user.id || user._id || user.user_id || Math.random().toString());
    const cleanDoc = { ...user, _id: docId, id: docId, updated_at: new Date().toISOString() };
    await mongoDb.collection('users').updateOne({ _id: docId } as any, { $set: cleanDoc }, { upsert: true });
    pluginLogger.info('MongoDB', `Upserted user '${user.username || docId}' to cloud users collection`);
  }

  async deleteUser(userId: string): Promise<void> {
    const mongoDb = await this.ensureDb();
    await mongoDb.collection('users').deleteOne({ _id: String(userId) } as any);
    pluginLogger.info('MongoDB', `Deleted user '${userId}' from cloud users collection`);
  }

  async deleteRecord(entity: string, docId: string): Promise<boolean> {
    try {
      const mongoDb = await this.ensureDb();
      await mongoDb.collection(entity).deleteOne({ _id: String(docId) } as any);
      pluginLogger.info('MongoDB', `Deleted record '${docId}' from collection '${entity}'`);
      return true;
    } catch (err: any) {
      pluginLogger.warn('MongoDB', `Failed to delete record '${docId}' from '${entity}': ${err.message}`);
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.close(true);
      } catch (_) {}
      this.client = null;
      this.db = null;
      this.isConnected = false;
      pluginLogger.info('MongoDB', 'Disconnected from MongoDB cluster.');
    }
  }
}

