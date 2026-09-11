# Security Policy

The Horizon PM maintainers and community take the security of our application and user data extremely seriously. We appreciate the responsible disclosure of any discovered vulnerabilities.

---

## Supported Versions

Security patches and updates are applied to the latest release of Horizon PM:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you believe you have found a security vulnerability in Horizon PM, please disclose it responsibly via email to:

📧 **horizon@humannai.in**

### What to Include in Your Report
To help us triage and resolve the issue quickly, please include:
1. **Description**: Clear description of the vulnerability and its potential impact.
2. **Reproduction Steps**: Step-by-step instructions or proof-of-concept code.
3. **Environment**: Operating System, Node.js version, Electron version, and active cloud backend.
4. **Proposed Fix**: (Optional) Suggestions or patches to address the issue.

### Our Commitment
* We will acknowledge receipt of your vulnerability report within **48 hours**.
* We will provide an estimated timeline for remediation and keep you informed of our progress.
* Once resolved, we will publish a patch release and credit you (if desired) in the release notes.

---

## Cryptographic Security Model

Horizon PM enforces strict zero-knowledge and defense-in-depth principles:

1. **Secrets Vault**:
   - Master passphrase derives a 256-bit key via **PBKDF2-SHA256** with **210,000 iterations** (OWASP 2023 guideline).
   - Secret payloads are encrypted with **AES-256-GCM** (12-byte IV, 16-byte authentication tag).
   - The master passphrase and derived encryption keys are held strictly in transient process memory and are **never written to disk or database**.
2. **Account Passwords**:
   - User account passwords are encrypted using **bcrypt** (10 salt rounds).
   - Account passwords are decoupled from the cryptographic secrets vault.
3. **Cloud Backend Credentials**:
   - Cloud tokens, OAuth refresh keys, and connection URIs can be removed or locked from the login interface to prevent local tampering or shoulder-surfing.
