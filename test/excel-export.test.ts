import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as XLSX from 'xlsx';
import {
  buildProductWorkspaceWorkbook,
  buildProductsPortfolioWorkbook,
  sanitizeFilename
} from '../src/utils/excelExport.ts';
import type { Product, Release, Task, UATCase, ProductInterface, ApiEndpoint, HorizonUser } from '../src/types/index.ts';

describe('Excel Product Report Export Test Suite', () => {
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

  const mockUser: HorizonUser = {
    id: 'usr-1',
    username: 'superadmin',
    displayName: 'Super Administrator',
    role: 'SuperAdmin',
    active: true,
    avatarInitials: 'SA',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  };

  test('sanitizeFilename correctly sanitizes special characters', () => {
    assert.strictEqual(sanitizeFilename('Horizon / Product * & # 1'), 'Horizon_Product_1');
    assert.strictEqual(sanitizeFilename('Product Name (v2.0)'), 'Product_Name_v2.0_');
  });

  test('successfully generates valid Excel workbook for a product workspace', () => {
    const wb = buildProductWorkspaceWorkbook(mockProduct, {
      releases: mockReleases,
      tasks: mockTasks,
      uatCases: mockUatCases,
      interfaces: mockInterfaces,
      apis: mockApis,
      teamMembers: mockTeam,
      currentUser: mockUser
    });

    assert.ok(wb !== null, 'Workbook must be generated');
    assert.deepStrictEqual(
      wb.SheetNames,
      [
        'Product Overview',
        'Roadmap & Releases',
        'Sprint Tasks',
        'Quality Gate (UAT)',
        'Interfaces',
        'API Catalog',
        'Team Members'
      ],
      'Must contain all 7 structured product sheets'
    );

    // Validate Product Overview content
    const overviewSheet = wb.Sheets['Product Overview'];
    const overviewJson: any[] = XLSX.utils.sheet_to_json(overviewSheet);
    const nameRow = overviewJson.find(r => r.Property === 'Product Name');
    assert.strictEqual(nameRow?.Detail, 'Horizon Mobile Platform');
    const totalReleasesRow = overviewJson.find(r => r.Property === 'Total Releases Tracked');
    assert.strictEqual(totalReleasesRow?.Detail, 1);

    // Validate Roadmap & Releases content
    const releaseSheet = wb.Sheets['Roadmap & Releases'];
    const releaseJson: any[] = XLSX.utils.sheet_to_json(releaseSheet);
    assert.strictEqual(releaseJson.length, 1);
    assert.strictEqual(releaseJson[0]['Version'], 'v2.0.0');
    assert.strictEqual(releaseJson[0]['Release Name'], 'Spring Cutover');

    // Validate Sprint Tasks content
    const taskSheet = wb.Sheets['Sprint Tasks'];
    const taskJson: any[] = XLSX.utils.sheet_to_json(taskSheet);
    assert.strictEqual(taskJson.length, 2);
    assert.strictEqual(taskJson[0]['Task Title'], 'Setup Apple FaceID API integration');
    assert.strictEqual(taskJson[0]['Status'], 'Done');

    // Validate Quality Gate content
    const uatSheet = wb.Sheets['Quality Gate (UAT)'];
    const uatJson: any[] = XLSX.utils.sheet_to_json(uatSheet);
    assert.strictEqual(uatJson.length, 1);
    assert.strictEqual(uatJson[0]['Case Title'], 'Verify biometric authentication prompt');
    assert.strictEqual(uatJson[0]['Result'], 'Pass');

    // Validate Interfaces content
    const ifSheet = wb.Sheets['Interfaces'];
    const ifJson: any[] = XLSX.utils.sheet_to_json(ifSheet);
    assert.strictEqual(ifJson.length, 1);
    assert.strictEqual(ifJson[0]['Interface Name'], 'Core Banking Payment MQ');

    // Validate APIs content
    const apiSheet = wb.Sheets['API Catalog'];
    const apiJson: any[] = XLSX.utils.sheet_to_json(apiSheet);
    assert.strictEqual(apiJson.length, 1);
    assert.strictEqual(apiJson[0]['API Name'], 'Initiate Transfer Endpoint');
    assert.strictEqual(apiJson[0]['HTTP Method'], 'POST');

    // Validate Team Members content
    const teamSheet = wb.Sheets['Team Members'];
    const teamJson: any[] = XLSX.utils.sheet_to_json(teamSheet);
    assert.strictEqual(teamJson.length, 2);
    assert.strictEqual(teamJson[0]['Member Name'], 'John Doe');
  });

  test('successfully generates valid Excel workbook for products portfolio', async () => {
    const wb = await buildProductsPortfolioWorkbook([mockProduct], {
      currentUser: mockUser,
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
      }]
    });

    assert.ok(wb !== null, 'Portfolio workbook must be generated');
    assert.deepStrictEqual(
      wb.SheetNames,
      [
        'Products Portfolio',
        'Executive Summary',
        'Releases Roadmap',
        'Tasks Backlog'
      ],
      'Portfolio must contain 4 structured sheets'
    );

    const portfolioSheet = wb.Sheets['Products Portfolio'];
    const portfolioJson: any[] = XLSX.utils.sheet_to_json(portfolioSheet);
    assert.strictEqual(portfolioJson.length, 1);
    assert.strictEqual(portfolioJson[0]['Product Name'], 'Horizon Mobile Platform');

    const summarySheet = wb.Sheets['Executive Summary'];
    const summaryJson: any[] = XLSX.utils.sheet_to_json(summarySheet);
    const totalProdRow = summaryJson.find(r => r['Portfolio Metric'] === 'Total Portfolio Products');
    assert.strictEqual(totalProdRow?.Value, 1);
  });
});
