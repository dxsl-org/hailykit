# Quality Workflow

Apply this order to implementation work:

1. **Plan** — delegate non-trivial implementation planning to `haily-planner`; save TODO-bearing plans in `.agents/`. Use `haily-researcher` only for distinct uncertain topics.
2. **Build** — follow the approved plan and public contracts. Compile/typecheck each changed code file.
3. **Test** — delegate final-code verification to `haily-tester`. Never suppress failures or use fake behavior to turn CI green; fix and rerun.
4. **Debug** — for a reported bug or failed verification, delegate root-cause analysis to `haily-debugger`, apply the fix, then return to Test.
5. **Review** — after tests pass, delegate production-readiness review to `haily-reviewer`; resolve evidenced findings and reverify affected paths.
6. **Integrate** — use `haily-project-manager` to sync plan state and `haily-docs-writer` when documentation triggers apply.

For explanations with three or more interacting components, route to `{skill:hl-visualize}`.
