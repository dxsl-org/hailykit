# Contributing to HailyKit

Thank you for helping improve HailyKit.

## License

HailyKit is licensed under **GPL-3.0-only**. By submitting a pull request or
patch, you confirm that:

1. You have the right to submit the contribution (you wrote it or have
   permission from the original author).
2. Your contribution is submitted under GPL-3.0.
3. You grant DXSL the right to sublicense your contribution under commercial
   terms alongside the GPL-3.0 license, for the purpose of issuing commercial
   licenses to organizations that cannot accept copyleft obligations.

This grant does not transfer copyright — you retain ownership of your
contribution. It only allows DXSL to include your code in commercial license
grants to third parties.

## Before you contribute

- Check existing issues and pull requests to avoid duplicate work.
- For significant changes, open an issue first to discuss the approach.
- Ship rules, hooks, agents, and settings from `kit/`; edits under `~/.claude/` are machine-local.
- Follow the code standards in [`docs/code-standards.md`](docs/code-standards.md).
- Run `npm run check:skills` before pushing skill changes.
- Run `npm test` before submitting any code change.

## Skill authoring

Custom `SKILL.md` files you write for use with HailyKit are **independent
works** — they are not derivative works of HailyKit's skill catalog, even if
they follow the same format. You may license your own skills under any terms
you choose.

## Pull request checklist

- [ ] `npm test` passes
- [ ] `npm run check:skills` passes (if skills changed)
- [ ] No secrets or credentials committed
- [ ] Conventional commit message format
