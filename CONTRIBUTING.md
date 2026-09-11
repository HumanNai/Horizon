# Contributing to Horizon PM

Thank you for your interest in contributing to **Horizon PM**! We appreciate all community contributions, whether they are bug reports, feature suggestions, code enhancements, or documentation improvements.

---

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all contributors with respect and kindness.

---

## How to Contribute

### 1. Reporting Bugs
* Check existing [GitHub Issues](https://github.com/horizon-pm/horizon/issues) to ensure the problem has not already been reported.
* Use the **Bug Report** issue template.
* Include clear reproduction steps, screenshots/logs (ensure no credentials or secrets are present), and your OS/Node version.

### 2. Suggesting Enhancements
* Open a discussion or issue using the **Feature Request** template.
* Clearly describe the problem your feature solves and proposed implementation ideas.

### 3. Submitting Code Changes

#### Workflow
1. **Fork the repository** on GitHub.
2. **Clone your fork locally**:
   `ash
   git clone https://github.com/<your-username>/horizon.git
   cd horizon
   `
3. **Create a topic branch**:
   `ash
   git checkout -b feature/my-feature-name
   # or
   git checkout -b fix/issue-description
   `
4. **Install dependencies**:
   `ash
   npm install
   `
5. **Make your changes**:
   * Adhere to the existing TypeScript, React, and Tailwind CSS conventions.
   * Do not commit sensitive keys, credentials, or personal configuration files.
6. **Verify your code**:
   `ash
   npm run build
   `
7. **Commit using Conventional Commits**:
   `ash
   git commit -m feat: implement export functionality for audit logs
   `
8. **Push to your fork**:
   `ash
   git push origin feature/my-feature-name
   `
9. **Open a Pull Request** against the main branch of the upstream repository.

---

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

* eat: A new user-facing feature or capability
* ix: A bug fix
* docs: Documentation updates or additions
* efactor: Code changes that neither fix bugs nor add features
* perf: Performance improvements
* 	est: Adding or improving tests
* chore: Build process, dependency updates, or auxiliary tool changes

---

## Pull Request Checklist

Before submitting your PR, please verify:
- [ ] Code compiles cleanly with 
pm run build.
- [ ] No secrets, keys, or personal credentials are included in the commit history.
- [ ] All new UI components follow the navy theme palette and responsive styling.
- [ ] Documentation has been updated where relevant.

Thank you for helping make Horizon PM better!
