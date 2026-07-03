# Benchmarks — Control Families & Scanner Mapping

CIS Benchmarks and DISA STIGs are checklists, not scanners. `{skill:hs-harden}` orchestrates
external, purpose-built scanners against the relevant checklist rather than re-implementing
control logic. Select the scanner from platform detection during Recon; parse its native
output format during Verify.

## Linux / OS

| Control Family | Benchmark Source | Scanner | Invocation |
|---|---|---|---|
| Filesystem & partitioning | CIS Linux Benchmark §1 | lynis | `lynis audit system` |
| Boot & service hardening | CIS §1.1, §2 | lynis | `lynis audit system --tests-category boot_services` |
| Auditd & logging | CIS §4, DISA STIG | lynis, auditd | `lynis audit system --tests-category logging` |
| SSH configuration | CIS §5.2 | lynis, ssh-audit | `ssh-audit <host>` |
| User accounts & PAM | CIS §5, §6 | lynis | `lynis audit system --tests-category authentication` |
| Kernel hardening (sysctl) | CIS §1.5–1.6 | lynis | `lynis audit system --tests-category kernel` |
| Firewall | CIS §3 | lynis, ufw/firewalld status | `lynis audit system --tests-category firewalls` |
| DISA STIG profile (RHEL/Ubuntu) | DISA STIG | openscap | `oscap xccdf eval --profile stig --results results.xml <ssg-datastream.xml>` |

## Containers (Docker)

| Control Family | Benchmark Source | Scanner | Invocation |
|---|---|---|---|
| Docker daemon config | CIS Docker Benchmark §2 | docker bench security | `docker-bench-security` |
| Image build practices | CIS Docker §4 | docker bench security, trivy config | `trivy config <image>` |
| Container runtime | CIS Docker §5 | docker bench security | `docker-bench-security -c container_images` |
| Docker Swarm | CIS Docker §7 | docker bench security | `docker-bench-security -c docker_swarm` |

## Kubernetes

| Control Family | Benchmark Source | Scanner | Invocation |
|---|---|---|---|
| Control plane components | CIS Kubernetes Benchmark §1–2 | kube-bench | `kube-bench run --targets master` |
| Worker node config | CIS K8s §4 | kube-bench | `kube-bench run --targets node` |
| RBAC & policies | CIS K8s §5 | kube-bench, kubeaudit | `kubeaudit all` |
| Pod security standards | CIS K8s §5.2 | kube-bench, polaris | `polaris audit --audit-path .` |

## Cloud (AWS / GCP / Azure)

| Control Family | Benchmark Source | Scanner | Invocation |
|---|---|---|---|
| IAM & access management | CIS Foundations §1 | prowler, scoutsuite | `prowler aws --check iam` |
| Logging & monitoring | CIS Foundations §2–3 | prowler, scoutsuite | `prowler aws --check logging` |
| Network configuration | CIS Foundations §4–5 | prowler, scoutsuite | `prowler aws --check networking` |
| Storage encryption | CIS Foundations §2 | prowler, scoutsuite | `prowler aws --check storage` |
| Multi-cloud posture | CIS Foundations (per provider) | scoutsuite | `scout <aws|azure|gcp>` |

## Selecting a Scanner

Match `target` prefix to platform, then platform to scanner:

| Target shape | Platform | Scanner |
|---|---|---|
| bare hostname/IP | Linux host | lynis (+ openscap for STIG) |
| `docker://<name>` | Container | docker bench security |
| `k8s://<cluster>` | Kubernetes | kube-bench (+ kubeaudit, polaris) |
| `aws://`, `gcp://`, `azure://` | Cloud account | prowler or scoutsuite |

## Severity Mapping

Benchmarks classify controls by profile level, not a universal severity scale. Normalize
to the hailykit severity scale (Critical/High/Medium/Low/Info) for the hardening report:

| Benchmark Level | Meaning | Mapped Severity |
|---|---|---|
| CIS Level 1 (Scored), DISA CAT I | Baseline, high-impact | Critical / High |
| CIS Level 2 (Scored) | Defense-in-depth, moderate impact | Medium |
| DISA CAT II | Moderate risk | Medium |
| CIS Level 1/2 (Not Scored), DISA CAT III | Advisory, low impact | Low / Info |

Map exploitability and blast radius of the specific finding, not just the benchmark tier —
an internet-facing service failing a Level 1 control outranks an air-gapped host failing
the same control.
