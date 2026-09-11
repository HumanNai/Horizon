<div align=center>

# 🚀 Horizon PM

### *Enterprise Product Management Platform — Clarity to Impact.*

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Electron](https://img.shields.io/badge/Electron-31.x-47848F?logo=electron&logoColor=white)](https://electronjs.org/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/Storage-SQLite%20WAL-003B57?logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Offline First](https://img.shields.io/badge/Architecture-Offline--First-success)]()

<p align=center>
  <strong>An offline-first, cryptographic, multi-cloud desktop application for high-performing engineering organizations and Product Owners.</strong>
</p>

</div>

---

## 🌟 Overview

**Horizon PM** bridges high-level product strategy and low-level engineering execution. Built on an **offline-first local SQLite WAL architecture**, Horizon delivers sub-millisecond responsiveness with background delta-synchronization to enterprise cloud storage backends: **MongoDB Atlas**, **Google Drive**, **Microsoft SharePoint**, **Microsoft OneDrive**, and **Azure Key Vault**.

Whether you are operating behind restrictive air-gapped corporate firewalls, on flights with no Wi-Fi, or in distributed remote teams, Horizon PM guarantees complete operational continuity with zero downtime.

---

## ✨ Key Features

### 1. 🎯 Product Strategy & Portfolio Architecture
* **Portfolio Health Overview**: Real-time product health classification (Healthy, Needs Attention, Staging).
* **Flexible Application Scoping**: Classify products across customizable scopes (Internal, External, Partner API, SaaS).
* **Custom Workspace Sections**: Add Markdown-powered RFCs, architecture guides, and technical runbooks directly inside product workspaces.
* **Lead Portfolios**: Executive visibility mapping product leads, team capacity, active releases, and blocker tallies.

### 2. 🚢 Release Engineering & UAT Sign-Off Gates
* **Lifecycle Pipeline**: Visual tracking across 6 delivery gates: Planning → Development → QA → UAT → SignOff → Released.
* **Automated UAT Test Suites**: Track functional, integration, and security test cases with pass/fail/blocked states and binary attachment evidence.
* **Executive Quality Gates**: Cryptographic sign-off logging preventing premature releases until 100% test case criteria are satisfied.

### 3. 📋 Agile Task Management & Kanban
* **Interactive Kanban Board**: Drag-and-drop workflow (Todo, InProgress, Blocked, Done).
* **Smart Filter Matrices**: Filter by product, target release, priority (Critical, High, Medium, Low), and team assignee.
* **Proactive Blocker Escalation**: Surfaces critical blocked tasks directly on executive oversight dashboards.

### 4. 🔐 Cryptographic Secrets Vault
* **Military-Grade Encryption**: Local credentials and API keys are protected using **AES-256-GCM** with **PBKDF2-SHA256 (210,000 iterations)**.
* **Zero Plaintext Storage**: Plaintext secrets never touch disk or persistent database columns.
* **Independent Master Key**: Vault master password is decoupled from user login passwords—preventing accidental credential exposure when account passwords change.
* **Zero-Downtime Passphrase Rotation**: Rotate master passphrases at any time with automatic in-memory decryption and batch re-encryption of all stored secrets.
* **Cloud HSM Integration**: Seamlessly connect to **Azure Key Vault** to browse, reveal, and rotate hardware-secured cloud secrets inline.

### 5. ☁️ Multi-Cloud Hybrid Storage & Synchronization
Horizon provides pluggable, unified cloud synchronization with automatic delta-tracking:
* **MongoDB Enterprise / Atlas**: Full document collections synchronization with GridFS binary document storage.
* **Google Drive**: Personal (@gmail.com) and Google Workspace synchronization with zero-dependency loopback OAuth 2.0 (http://127.0.0.1:8585).
* **Microsoft SharePoint Online**: Syncs domain entities with enterprise SharePoint Lists and Shared Document Libraries.
* **Microsoft OneDrive for Business**: Standard organization folder sync (/HorizonPM/Documents).
* **Automated Delta Sync Agent**: Runs background sync cycles every 3 minutes, resolving conflicts via deterministic last-write-wins with audit logging.

### 6. 👥 Team Availability, HR & Scheduling
* **Availability Legend**: Live team roster tracking (Available, WFH / Remote, On Leave, Partial).
* **Emergency Contacts & Skill Tags**: Centralized technical expertise directory.
* **Configurable Notification Windows**: Customizable lookahead lead time for release milestones and cutover alerts.

### 7. 🛡️ Role-Based Access Control (RBAC)
* **Product Owner (ProductOwner)**: Full administrative governance, credential management, plugin configuration, and audit log inspection.
* **Management (Management)**: Executive dashboard metrics, release roadmaps, and blocker oversight.
* **Team Member (TeamMember)**: Focused access to assigned tasks, product specifications, and test cases.

---

## 🏗️ Architecture

`
┌────────────────────────────────────────────────────────┐
│                   React 18 Renderer                    │
│   (Zustand Stores · Tailwind CSS · Lucide · Recharts)  │
└───────────────────────────┬────────────────────────────┘
                            │ ContextBridge (Typed IPC)
┌───────────────────────────▼────────────────────────────┐
│                  Electron Main Process                 │
├────────────────────────────────────────────────────────┤
│ • Local SQLite (WAL Mode · Memory Temp Store)          │
│ • PBKDF2 / AES-256-GCM Cryptographic Vault             │
│ • Background Delta Sync Agent (Mutation Queue)         │
│ • Pluggable Cloud Adapters                             │
└───────┬────────────┬─────────────┬─────────────┬───────┘
        │            │             │             │
        ▼            ▼             ▼             ▼
    [MongoDB]  [Google Drive] [SharePoint]  [Azure KV]
`

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* **Git**: Installed and configured

### Installation & Development

1. **Clone the repository:**
   `ash
   git clone https://github.com/HumanNai/Horizon.git
   cd Horizon
   `

2. **Install dependencies:**
   `ash
   npm install
   `

3. **Start in development mode:**
   `ash
   npm run dev
   `

### Default Bootstrap Credentials
Upon fresh initialization, Horizon creates an offline bootstrap administrator account:
* **Username**: dmin
* **Password**: horizon123
*(Make sure to change this password in the Access / Settings section upon first login).*

---

## 📦 Building & Packaging

To compile and package self-contained, production-ready Windows installers and portable executables:

`ash
# Build the Vite renderer and Electron main bundles
npm run build

# Package portable executable and NSIS installer
npm run package
`

Packaged outputs will be generated in elease/:
* Horizon-Setup-1.0.0.exe (NSIS Installer)
* Horizon-1.0.0-portable.exe (Standalone Portable Executable)
* Horizon.exe (Convenience launcher)

---

## 📁 Project Structure

`
├── build/               # Icons and packaging assets
├── electron/            # Electron main process source
│   ├── db/              # SQLite schema, migrations, and table definitions
│   ├── ipc/             # Typed IPC handlers (auth, db, secrets, sync, notify)
│   ├── plugins/         # Multi-cloud storage adapters
│   │   ├── azure-keyvault/
│   │   ├── google-drive/
│   │   ├── mongodb/
│   │   ├── onedrive/
│   │   └── sharepoint/
│   ├── main.ts          # Main process bootstrap & lifecycle
│   └── preload.ts       # Secure context bridge API
├── src/                 # React 18 frontend
│   ├── components/      # Reusable UI component library & layouts
│   ├── hooks/           # Custom React hooks (sync, notifications)
│   ├── pages/           # Application views (Dashboard, Products, Releases, Secrets...)
│   ├── store/           # Zustand state management stores
│   └── types/           # Shared TypeScript domain contracts
├── LICENSE              # Apache License 2.0
├── NOTICE               # Attribution and third-party notices
└── package.json
`

---

## 🤝 Contributing

We welcome contributions from the community! Please check our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting pull requests.

1. Fork the Project
2. Create your Feature Branch (git checkout -b feature/AmazingFeature)
3. Commit your Changes (git commit -m 'feat: Add AmazingFeature')
4. Push to the Branch (git push origin feature/AmazingFeature)
5. Open a Pull Request

---

## 🔒 Security

For vulnerability disclosure and security reporting guidelines, please consult our [Security Policy](SECURITY.md).

---

## 📄 License

Horizon PM is open-source software licensed under the **[Apache License, Version 2.0](LICENSE)**.

`
Copyright 2024-2026 Horizon Contributors

Licensed under the Apache License, Version 2.0 (the License);
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
`
