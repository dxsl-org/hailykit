- Build: `npm run build` — tsc → dist/ + postbuild copies cli/tools/ → dist/tools/
- Test: `npm test` — pretest compiles to .test-build/ first; delete .test-build/ after removing source test files
- Release: `npm run release:pack`

Read before acting on a relevant task:
- docs/engineering-standards.md - creating or rewriting skills - full terminology, pipeline vocab, writing voice, banned phrases
- docs/skill-template.md - creating or rewriting skills - canonical skill section order and constraint callout syntax
- docs/system-architecture.md - architecture + directory map
- docs/tech-stack.md - NDJSON stdio protocol, tool wire format
- docs/token-overhead.md - kit content injection cost by class, measured before/after compression, reproduce command
