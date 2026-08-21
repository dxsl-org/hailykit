# Attribution

This HailyKit Pi task runtime adapts concepts and API shape from the official MIT-licensed Pi subagent example:

- `earendil-works/pi` — `packages/coding-agent/examples/extensions/subagent/index.ts`
- `earendil-works/pi` — `packages/coding-agent/examples/extensions/subagent/agents.ts`
- `earendil-works/pi` — `packages/coding-agent/examples/extensions/subagent/README.md`

Adapted concepts include:

- single / parallel / chain task modes
- fresh agent discovery with project override precedence
- official `pi` subprocess delegation with isolated context
- bounded parallel execution and per-task output caps

HailyKit rewrites the implementation for its own task contract, trust gates, policy intersection, and test seams. No OMP or DeepSeek source is included here.
