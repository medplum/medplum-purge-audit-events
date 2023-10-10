# medplum-purge-audit-events

Utility to systematically delete `AuditEvent` resources from a Medplum cluster.

Usage:

```bash
npm run purge -- <your config identifier>
```

Example: use a local config file:

```bash
npm run purge -- file:medplum.my-config.json
```

Example: use a local config file:

```bash
npm run purge -- aws:us-east-1:/medplum/staging/
```
