import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as XLSX from 'xlsx';
import {
  buildProductWorkspaceWorkbook,
  buildProductsPortfolioWorkbook,
  sanitizeFilename,
  canExportExcel,
  assertCanExportExcel,
  EXPORT_ALLOWED_ROLES
} from '../src/utils/excelExport.ts';
import type { Product, Release, Task, UATCase, ProductInterface, ApiEndpoint, HorizonUser, UserRole } from '../src/types/index.ts';

describe('Excel Product Report Export & Role Security Test Suite', () => {
  const mockProduct: Product = {
    id: 'prod-test-001',
    name: 'Horizon Mobile Platform',
    type: 'External',
    status: 'Active',
    owner: 'John Doe',
    description: 'Flagship enterprise mobile banking platform',
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-03-20T12:00:00Z'
  };

  const mockReleases: Release[] = [
    {
      id: 'rel-1',
      productId: 'prod-test-001',
      version: 'v2.0.0',
      name: 'Spring Cutover',
      status: 'Released',
      targetDate: '2026-04-01',
      features: ['Biometric login', 'Instant transfers'],
      serverUpgrades: 'Linux Kernel 6.6 patch',
      createdAt: '2026-01-20T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z'
    }
  ];

  const mockTasks: Task[] = [
    {
      id: 'tsk-1',
      productId: 'prod-test-001',
      releaseId: 'rel-1',
      title: 'Setup Apple FaceID API integration',
      status: 'Done',
      priority: 'High',
      assigneeId: 'Alice Dev',
      dueDate: '2026-03-15',
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-03-14T00:00:00Z'
    },
    {
      id: 'tsk-2',
      productId: 'prod-test-001',
      releaseId: 'rel-1',
      title: 'Regression testing on Android 15',
      status: 'InProgress',
      priority: 'Medium',
      assigneeId: 'Bob QA',
      dueDate: '2026-03-25',
      createdAt: '2026-02-10T00:00:00Z',
      updatedAt: '2026-02-10T00:00:00Z'
    }
  ];

  const mockUatCases: UATCase[] = [
    {
      id: 'uat-1',
      releaseId: 'rel-1',
      productId: 'prod-test-001',
      title: 'Verify biometric authentication prompt',
      result: 'Pass',
      assigneeId: 'Tester Carol',
      description: 'Open app and verify biometric prompt triggers',
      notes: 'Passed on iOS 18.2 device',
      updatedAt: '2026-03-16T00:00:00Z'
    }
  ];

  const mockInterfaces: ProductInterface[] = [
    {
      id: 'if-1',
      productId: 'prod-test-001',
      name: 'Core Banking Payment MQ',
      type: 'MQ',
      endpoint: 'mq://prod-gw.bank.internal:1414/Q.PAYMENTS.REQ',
      direction: 'Bidirectional',
      serviceProvider: 'IBM MQ 9.3',
      owner: 'Integration Lead',
      status: 'Active',
      description: 'ISO20022 message queue',
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-01-10T00:00:00Z'
    }
  ];

  const mockApis: ApiEndpoint[] = [
    {
      id: 'api-1',
      productId: 'prod-test-001',
      name: 'Initiate Transfer Endpoint',
      method: 'POST',
      endpoint: '/api/v2/transfers/instant',
      authType: 'OAuth2',
      status: 'Active',
      givenTo: 'Partner Banking App',
      rateLimit: '500 req/min',
      description: 'Real-time payment initiation endpoint',
      owner: 'API Team',
      createdAt: '2026-01-12T00:00:00Z',
      updatedAt: '2026-01-12T00:00:00Z'
    }
  ];

  const mockTeam = [
    { id: 'usr-1', name: 'John Doe', role: 'Lead Architect', accessRole: 'ProductOwner', addedAt: '2026-01-01' },
    { id: 'usr-2', name: 'Alice Dev', role: 'Senior iOS Engineer', accessRole: 'TeamMember', addedAt: '2026-01-05' }
  ];

  const mockReleaseSignoffs = [
    { release_id: 'rel-1', release_name: 'Spring Cutover', release_version: 'v2.0.0', signed_off_by: 'QA Lead Victor', signed_off_at: '2026-03-31T18:00:00Z', notes: 'All regression tests verified.' }
  ];

  const mockDocuments = [
    { id: 'doc-1', title: 'Payment Integration Architecture RFC', category: 'Architecture', version: '2.1', file_name: 'rfc_payments.pdf', file_size: 450000, last_modified: '2026-03-01', web_url: 'https://sharepoint.bank.internal/docs/rfc_payments.pdf', sharepoint_status: 'Synced', description: 'Technical design document for ISO20022 messaging' }
  ];

  const mockScheduleEvents = [
    { id: 'ev-1', title: 'Production Cutover & Traffic Ramp', type: 'Cutover', start_date: '2026-04-01', end_date: '2026-04-02', linked_type: 'Product', notified: 1, created_by: 'Release Manager' }
  ];

  const mockCustomSections = [
    { id: 'cs-1', title: 'Production Runbook & Escalation Paths', section_type: 'Markdown', icon: 'book-open', content_json: JSON.stringify({ markdown: '# Runbook\nEscalation contacts: 24/7 Ops bridge.' }), updated_at: '2026-03-15' }
  ];

  const superAdminUser: HorizonUser = {
    id: 'usr-sa',
    username: 'superadmin',
    displayName: 'Super Administrator',
    role: 'SuperAdmin',
    active: true,
    avatarInitials: 'SA',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  };

  const productOwnerUser: HorizonUser = {
    id: 'usr-po',
    username: 'po_sarah',
    displayName: 'Sarah PO',
    role: 'ProductOwner',
    active: true,
    avatarInitials: 'SP',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  };

  const executiveUser: HorizonUser = {
    id: 'usr-exec',
    username: 'exec_director',
    displayName: 'Director Management',
    role: 'Management',
    active: true,
    avatarInitials: 'DM',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  };

  const teamMemberUser: HorizonUser = {
    id: 'usr-dev',
    username: 'dev_bob',
    displayName: 'Bob Developer',
    role: 'TeamMember',
    active: true,
    avatarInitials: 'BD',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  };

  const productLeadUser: HorizonUser = {
    id: 'usr-lead',
    username: 'lead_dave',
    displayName: 'Dave TechLead',
    role: 'ProductLead',
    active: true,
    avatarInitials: 'DT',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  };

  test('role-based authorization: allows only SuperAdmin, ProductOwner, and Management (Executives)', () => {
    assert.deepStrictEqual(EXPORT_ALLOWED_ROLES, ['SuperAdmin', 'ProductOwner', 'Management']);

    assert.strictEqual(canExportExcel(superAdminUser), true, 'SuperAdmin must be permitted to export');
    assert.strictEqual(canExportExcel(productOwnerUser), true, 'ProductOwner must be permitted to export');
    assert.strictEqual(canExportExcel(executiveUser), true, 'Management (Executive) must be permitted to export');

    assert.strictEqual(canExportExcel(teamMemberUser), false, 'TeamMember must NOT be permitted to export');
    assert.strictEqual(canExportExcel(productLeadUser), false, 'ProductLead must NOT be permitted to export');
    assert.strictEqual(canExportExcel(null), false, 'Unauthenticated users must NOT be permitted to export');
    assert.strictEqual(canExportExcel(undefined), false, 'Undefined users must NOT be permitted to export');
  });

  test('assertCanExportExcel throws Access Denied error for unauthorized roles', () => {
    assert.throws(
      () => assertCanExportExcel(teamMemberUser),
      /Access Denied: Only Product Owners, Executives \(Management\), and Super Admins are authorized/
    );

    assert.throws(
      () => assertCanExportExcel(productLeadUser),
      /Access Denied: Only Product Owners, Executives \(Management\), and Super Admins are authorized/
    );

    assert.throws(
      () => assertCanExportExcel(null),
      /Access Denied: Only Product Owners, Executives \(Management\), and Super Admins are authorized/
    );

    // Should not throw for authorized roles
    assert.doesNotThrow(() => assertCanExportExcel(superAdminUser));
    assert.doesNotThrow(() => assertCanExportExcel(productOwnerUser));
    assert.doesNotThrow(() => assertCanExportExcel(executiveUser));
  });

  test('buildProductWorkspaceWorkbook rejects unauthorized users', () => {
    assert.throws(() => {
      buildProductWorkspaceWorkbook(mockProduct, {
        releases: mockReleases,
        tasks: mockTasks,
        uatCases: mockUatCases,
        interfaces: mockInterfaces,
        apis: mockApis,
        currentUser: teamMemberUser
      });
    }, /Access Denied/);
  });

  test('buildProductsPortfolioWorkbook rejects unauthorized users', async () => {
    await assert.rejects(async () => {
      await buildProductsPortfolioWorkbook([mockProduct], {
        currentUser: teamMemberUser
      });
    }, /Access Denied/);
  });

  test('sanitizeFilename correctly sanitizes special characters', () => {
    assert.strictEqual(sanitizeFilename('Horizon / Product * & # 1'), 'Horizon_Product_1');
    assert.strictEqual(sanitizeFilename('Product Name (v2.0)'), 'Product_Name_v2.0_');
  });

  test('successfully generates comprehensive Excel workbook for product workspace with all 11 detail sheets', () => {
    const wb = buildProductWorkspaceWorkbook(mockProduct, {
      releases: mockReleases,
      tasks: mockTasks,
      uatCases: mockUatCases,
      interfaces: mockInterfaces,
      apis: mockApis,
      teamMembers: mockTeam,
      releaseSignoffs: mockReleaseSignoffs,
      documents: mockDocuments,
      scheduleEvents: mockScheduleEvents,
      customSections: mockCustomSections,
      currentUser: productOwnerUser
    });

    assert.ok(wb !== null, 'Workbook must be generated');
    assert.deepStrictEqual(
      wb.SheetNames,
      [
        'Product Overview',
        'Roadmap & Releases',
        'Sprint Tasks',
        'Quality Gate (UAT)',
        'QA Release Sign-Offs',
        'Interfaces',
        'API Catalog',
        'Architecture Docs',
        'Delivery Milestones',
        'Team Members',
        'Architecture Sections'
      ],
      'Must contain all 11 detailed product workspace sheets'
    );

    // Verify Product Overview
    const overviewSheet = wb.Sheets['Product Overview'];
    const overviewJson: any[] = XLSX.utils.sheet_to_json(overviewSheet);
    const nameRow = overviewJson.find(r => r.Property === 'Product Name');
    assert.strictEqual(nameRow?.Detail, 'Horizon Mobile Platform');
    const roleRow = overviewJson.find(r => r.Property === 'Authorized Role');
    assert.strictEqual(roleRow?.Detail, 'ProductOwner');

    // Verify QA Release Sign-Offs sheet
    const signoffSheet = wb.Sheets['QA Release Sign-Offs'];
    const signoffJson: any[] = XLSX.utils.sheet_to_json(signoffSheet);
    assert.strictEqual(signoffJson.length, 1);
    assert.strictEqual(signoffJson[0]['Release Version'], 'v2.0.0');
    assert.strictEqual(signoffJson[0]['Signed Off By'], 'QA Lead Victor');

    // Verify Architecture Docs sheet
    const docsSheet = wb.Sheets['Architecture Docs'];
    const docsJson: any[] = XLSX.utils.sheet_to_json(docsSheet);
    assert.strictEqual(docsJson.length, 1);
    assert.strictEqual(docsJson[0]['Document Title'], 'Payment Integration Architecture RFC');
    assert.strictEqual(docsJson[0]['Category'], 'Architecture');

    // Verify Delivery Milestones sheet
    const schedSheet = wb.Sheets['Delivery Milestones'];
    const schedJson: any[] = XLSX.utils.sheet_to_json(schedSheet);
    assert.strictEqual(schedJson.length, 1);
    assert.strictEqual(schedJson[0]['Milestone Title'], 'Production Cutover & Traffic Ramp');

    // Verify Architecture Sections sheet
    const customSheet = wb.Sheets['Architecture Sections'];
    const customJson: any[] = XLSX.utils.sheet_to_json(customSheet);
    assert.strictEqual(customJson.length, 1);
    assert.strictEqual(customJson[0]['Section Title'], 'Production Runbook & Escalation Paths');
  });

  test('successfully generates comprehensive Excel workbook for products portfolio with all 10 detail sheets', async () => {
    const wb = await buildProductsPortfolioWorkbook([mockProduct], {
      currentUser: executiveUser,
      allReleases: [{
        product_name: 'Horizon Mobile Platform',
        version: 'v2.0.0',
        name: 'Spring Cutover',
        status: 'Released',
        target_date: '2026-04-01',
        server_upgrades: 'Linux Kernel 6.6 patch',
        description: 'First release',
        created_at: '2026-01-20T00:00:00Z',
        id: 'rel-1'
      }],
      allTasks: [{
        product_name: 'Horizon Mobile Platform',
        title: 'Setup FaceID',
        status: 'Done',
        priority: 'High',
        assignee_id: 'Alice',
        due_date: '2026-03-15',
        description: 'Biometrics task',
        created_at: '2026-02-01T00:00:00Z',
        id: 'tsk-1'
      }],
      allUatCases: [{
        product_name: 'Horizon Mobile Platform',
        release_name: 'Spring Cutover',
        release_version: 'v2.0.0',
        title: 'Verify FaceID prompt',
        result: 'Pass',
        assignee_id: 'Carol QA',
        description: 'Biometric prompt check',
        notes: 'Verified OK',
        updated_at: '2026-03-16T00:00:00Z',
        id: 'uat-1'
      }],
      allInterfaces: [{
        product_name: 'Horizon Mobile Platform',
        name: 'Payment MQ',
        type: 'MQ',
        endpoint: 'mq://prod-gw:1414',
        direction: 'Bidirectional',
        service_provider: 'IBM MQ',
        owner_id: 'Integration Lead',
        status: 'Active',
        id: 'if-1'
      }],
      allApis: [{
        product_name: 'Horizon Mobile Platform',
        name: 'Instant Transfers',
        method: 'POST',
        endpoint: '/api/v2/transfers',
        auth_type: 'OAuth2',
        given_to: 'Mobile Banking',
        rate_limit: '1000/min',
        status: 'Active',
        id: 'api-1'
      }],
      allDocuments: [{
        product_name: 'Horizon Mobile Platform',
        title: 'Core Architecture Specs',
        category: 'Architecture',
        version: '1.0',
        file_name: 'arch.pdf',
        file_size: 120000,
        sharepoint_status: 'Synced',
        web_url: 'https://sharepoint/arch.pdf',
        last_modified: '2026-03-01',
        id: 'doc-1'
      }],
      allScheduleEvents: [{
        product_name: 'Horizon Mobile Platform',
        title: 'Production Cutover',
        type: 'Cutover',
        start_date: '2026-04-01',
        end_date: '2026-04-02',
        created_by: 'Lead Architect',
        notified: 1,
        id: 'sched-1'
      }],
      allReleaseSignoffs: [{
        product_name: 'Horizon Mobile Platform',
        release_version: 'v2.0.0',
        release_name: 'Spring Cutover',
        signed_off_by: 'QA Victor',
        signed_off_at: '2026-03-31T00:00:00Z',
        notes: 'Passed'
      }]
    });

    assert.ok(wb !== null, 'Portfolio workbook must be generated');
    assert.deepStrictEqual(
      wb.SheetNames,
      [
        'Products Portfolio',
        'Executive Summary',
        'Releases Roadmap',
        'Tasks Backlog',
        'Quality Gate (UAT)',
        'Interfaces',
        'API Catalog',
        'Architecture Docs',
        'Delivery Milestones',
        'QA Release Sign-Offs'
      ],
      'Portfolio must contain all 10 detailed sheets'
    );

    const portfolioSheet = wb.Sheets['Products Portfolio'];
    const portfolioJson: any[] = XLSX.utils.sheet_to_json(portfolioSheet);
    assert.strictEqual(portfolioJson.length, 1);
    assert.strictEqual(portfolioJson[0]['Product Name'], 'Horizon Mobile Platform');

    const summarySheet = wb.Sheets['Executive Summary'];
    const summaryJson: any[] = XLSX.utils.sheet_to_json(summarySheet);
    const totalProdRow = summaryJson.find(r => r['Portfolio Metric'] === 'Total Portfolio Products');
    assert.strictEqual(totalProdRow?.Value, 1);
    const roleRow = summaryJson.find(r => r['Portfolio Metric'] === 'Authorized Access Role');
    assert.strictEqual(roleRow?.Value, 'Management');
  });

  test('strict security: workbook never contains secrets_meta, password_hash, or secret keys', () => {
    const wb = buildProductWorkspaceWorkbook(mockProduct, {
      releases: mockReleases,
      tasks: mockTasks,
      uatCases: mockUatCases,
      interfaces: mockInterfaces,
      apis: mockApis,
      teamMembers: mockTeam,
      currentUser: superAdminUser
    });

    // 1. Verify no secret sheet exists
    assert.strictEqual(wb.SheetNames.includes('Secrets'), false);
    assert.strictEqual(wb.SheetNames.includes('Secrets Vault'), false);
    assert.strictEqual(wb.SheetNames.includes('secrets_meta'), false);

    // 2. Scan every cell in every sheet to confirm absence of sensitive credentials
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(sheet);
      const str = JSON.stringify(json);
      assert.strictEqual(str.includes('password_hash'), false, `Sheet ${sheetName} must not contain password_hash`);
      assert.strictEqual(str.includes('secret_key'), false, `Sheet ${sheetName} must not contain secret_key`);
      assert.strictEqual(str.includes('private_key'), false, `Sheet ${sheetName} must not contain private_key`);
      assert.strictEqual(str.includes('vault_passphrase'), false, `Sheet ${sheetName} must not contain vault_passphrase`);
    }
  });
});
