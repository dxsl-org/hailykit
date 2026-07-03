# Remediation Playbook — Guarded Config Changes

Every remediation `{skill:hs-harden}` applies in `--fix` mode follows the same contract:
snapshot current state, apply the change, run a guard, and roll back immediately on guard
failure. Halting on failure and reporting is always preferred over forcing a change through.

## Guard-Before-Apply Contract

1. **Snapshot** — capture the pre-change state (config file copy, IaC state, policy version, image tag) before touching anything.
2. **Apply** — make the single, scoped config change tied to one finding.
3. **Guard** — run a config validator, health check, or scanner re-run specific to the change. A guard that only checks "did the command exit 0" is insufficient — it must verify the target still functions.
4. **Decide** — guard passes: log the change, continue to the next finding. Guard fails: roll back from the snapshot immediately, halt the fix loop, report which control failed and why.

## Remediation Patterns by Control Family

| Finding | Remediation Pattern | Guard | Rollback |
|---|---|---|---|
| Weak SSH config (`PermitRootLogin yes`) | Set `PermitRootLogin no`, `PasswordAuthentication no` in `sshd_config` | `sshd -t` config test, then verify reconnect on a second session before closing the first | Restore backed-up `sshd_config`, reload sshd |
| Overly permissive firewall rule | Close the port via ufw/firewalld/security group rule | Health-check dependent services that use the port | Revert the rule from snapshot |
| World-writable file permissions | `chmod` to CIS baseline mode | File integrity check post-change (no app breakage) | Restore original permission bits from snapshot |
| Container running as root | Set `USER` in Dockerfile or `--user` at runtime; rebuild image | New container starts + app health-check passes | Redeploy previous image tag |
| Privileged pod / missing Pod Security | Apply Pod Security admission policy or patch `securityContext` | `kubectl rollout status`, pod health-check | `kubectl rollout undo` |
| Overly broad IAM policy | Scope policy to least privilege | Re-run policy simulator + smoke-test the critical workflow that depends on it | Restore previous IAM policy version |
| Missing encryption at rest | Enable encryption on the storage resource | Verify resource health, read/write still succeed | Often not reversible in place — treat as high-risk, require a maintenance window, do not auto-apply |
| Unpatched OS package with known CVE | Halt — this is a code/dependency-layer fix, not a config change | — | Delegate to `{skill:hc-fix}` |

## Rollback Mechanics by Platform

- **Linux host** — copy the config file to `<file>.bak.<timestamp>` before editing; restore by copying back and restarting the affected service.
- **Containers** — never patch a running container in place; rebuild the image and redeploy the previous tag if the guard fails.
- **Kubernetes** — apply changes via manifests under version control; roll back with `kubectl rollout undo` or by re-applying the prior manifest.
- **Cloud (IaC-managed)** — apply through Terraform/equivalent so the previous state is a `plan`/`apply` away; for IaC-unmanaged resources, capture the prior policy/config version before changing it.

## When to Halt Instead of Fix

- The guard fails twice for the same control.
- The remediation is irreversible (encryption migration, data deletion, schema change).
- The change would affect production traffic and no maintenance window has been confirmed.
- The finding traces to application code or a vulnerable dependency baked into an image — stop and delegate to `{skill:hc-fix}` rather than patching the running artifact.

In every halt case, report the finding, the attempted change, and the reason for stopping —
do not silently skip it.
