# OS authentication for network connections — possible future feature

Recorded: 2026-11-02. Status: proposed and deferred at the user's request; not approved for implementation. Related features: DEV-02, SEC-01, SEC-03.

## Intent

Integrate desktop-session authentication and OS credential storage with network connections through GIO/GVFS, preserving the existing connection form and encrypted saved credentials.

## Proposed investigation and implementation

1. Inspect native authentication handling. The addon currently supplies credentials through GMountOperation but aborts when a required password is missing. Determine how interactive prompts can be supported without blocking Electron.
2. Investigate reuse of credentials available through the desktop session/keyring and desktop authentication agents. Confirm what the installed GVFS stack actually supports before choosing the primary authentication path.
3. If desktop-managed prompting is unavailable, provide an accessible app credential prompt for the fields GIO requests: username, domain, password, or anonymous access. Support retries and cancellation.
4. Define credential-storage ownership. Consider session-only authentication and OS-keyring storage where supported. Preserve existing saved connections; do not silently migrate or duplicate encrypted passwords.
5. Preserve protocol behavior: NFS system identity, SMB domains, and existing SSH-key connections. Investigate SSH-agent and password authentication separately. Never automatically approve certificate or host-identity warnings.
6. Tie prompts to the initiating connection/window. Cancel pending authentication when its owner closes or navigates away. Keep secrets out of general renderer metadata and logs; expose only what an authentication prompt needs through narrow, validated IPC.
7. Prepare coverage and manual verification for cached credentials, first-time prompts, incorrect-password retry, cancellation, unavailable keyrings, and reconnect. The user runs tests manually unless explicitly requested otherwise.

## Open questions

- Can desktop-managed prompting work reliably from this native addon and Electron's event loop?
- Which desktop agents/keyrings and platforms can be supported?
- How should existing app-encrypted credentials coexist with OS-managed storage?
- What authentication is available during opt-in startup reconnect when interaction or keyring unlocking is required?

This is a proposal, not a claim of available backend capabilities. No implementation, migration, service changes, or test execution is authorized by this record alone.
