# Measure Command Library

Copy-paste `Measure:` commands for common optimization targets.
Each command must print a single number to stdout and exit 0 on success.

`Direction: higher` = more is better (coverage, score).
`Direction: lower` = less is better (errors, bytes, milliseconds).

---

## Test Coverage

**Jest (Node.js)**
```bash
Measure: npx jest --coverage --coverageReporters=json-summary 2>/dev/null | node -e "const s=require('./coverage/coverage-summary.json'); console.log(s.total.lines.pct)"
Direction: higher
Guard: npm test
```

**Vitest (Node.js)**
```bash
Measure: npx vitest run --coverage 2>/dev/null | grep 'All files' | awk '{print $NF}' | tr -d '%'
Direction: higher
Guard: npm test
```

**pytest (Python)**
```bash
Measure: python -m pytest --cov=src --cov-report=term-missing 2>/dev/null | grep 'TOTAL' | awk '{print $NF}' | tr -d '%'
Direction: higher
Guard: python -m pytest
```

---

## Bundle Size

**Vite**
```bash
Measure: npx vite build 2>/dev/null | grep 'dist/index' | awk '{print $2}' | sed 's/kB//'
Direction: lower
Guard: npx tsc --noEmit
```

**Webpack**
```bash
Measure: npx webpack --json 2>/dev/null | node -e "const s=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log((s.assets.find(a=>a.name.includes('main'))?.size||0)/1024)"
Direction: lower
Guard: npx tsc --noEmit
```

**Next.js page size**
```bash
Measure: npx next build 2>/dev/null | grep 'First Load' | head -1 | grep -o '[0-9.]* kB' | head -1 | tr -d ' kB'
Direction: lower
Guard: npx tsc --noEmit
```

---

## Lint & Type Errors

**ESLint error count**
```bash
Measure: npx eslint src --format=json 2>/dev/null | node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(r.reduce((a,f)=>a+f.errorCount,0))" || echo 999
Direction: lower
```

**TypeScript error count**
```bash
Measure: npx tsc --noEmit 2>&1 | grep -c 'error TS' || echo 0
Direction: lower
```

**Python (pylint score)**
```bash
Measure: python -m pylint src/ 2>/dev/null | grep 'rated at' | grep -o '[0-9.]*' | head -1
Direction: higher
```

---

## Performance

**Lighthouse score**
```bash
Measure: npx lighthouse http://localhost:3000 --output=json --quiet 2>/dev/null | node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(Math.round(r.categories.performance.score*100))"
Direction: higher
Guard: curl -sf http://localhost:3000 > /dev/null
```

**Test execution time (ms)**
```bash
Measure: npx jest --forceExit 2>&1 | grep 'Time:' | grep -o '[0-9.]*' | head -1 | awk '{print $1*1000}'
Direction: lower
```

---

## Code Health

**TODO/FIXME count**
```bash
Measure: grep -rn 'TODO\|FIXME' src/ | wc -l
Direction: lower
```

**Lines of code in scope**
```bash
Measure: find src -name '*.ts' | xargs wc -l | tail -1 | awk '{print $1}'
Direction: lower
```

---

## Memory Usage

**Node.js heap (MB) — requires `--expose-gc`**
```bash
Measure: node --expose-gc -e "gc(); const before=process.memoryUsage().heapUsed; require('./dist/index.js'); gc(); console.log(Math.round((process.memoryUsage().heapUsed-before)/1024/1024))"
Direction: lower
Guard: npm test
```

**Python memory peak (MB) — via tracemalloc**
```bash
Measure: python -c "import tracemalloc; tracemalloc.start(); import src; _, peak = tracemalloc.get_traced_memory(); print(round(peak/1024/1024,1))"
Direction: lower
Guard: pytest
```

**RSS at steady state (Node.js — after 10 requests)**
```bash
Measure: node -e "const http=require('http'); let rss=0; for(let i=0;i<10;i++){http.get('http://localhost:3000',()=>{})}; setTimeout(()=>{rss=process.memoryUsage().rss; console.log(Math.round(rss/1024/1024))},2000)" 2>/dev/null
Direction: lower
Guard: npm test
```

---

## Database Query Performance

**PostgreSQL — total query time for a workload (ms)**
```bash
Measure: psql $DATABASE_URL -c "EXPLAIN (ANALYZE, FORMAT JSON) SELECT ..." 2>/dev/null | node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(Math.round(r[0]['Execution Time']))"
Direction: lower
Guard: npm test
```

**SQLite — query count for a test scenario**
```bash
Measure: node -e "const db=require('better-sqlite3')('./test.db'); let n=0; const orig=db.prepare.bind(db); db.prepare=(...a)=>{n++;return orig(...a)}; require('./src/scenario.js')(db); console.log(n)"
Direction: lower
Guard: npm test
```

**ORM N+1 detection (Prisma — query count)**
```bash
Measure: node -e "let n=0; const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient({log:[{emit:'event',level:'query'}]}); p.\$on('query',()=>n++); require('./src/seed-scenario.js')(p).then(()=>{console.log(n);process.exit()})"
Direction: lower
Guard: npx prisma migrate deploy && npm test
```

---

## API Latency

**wrk — median latency (ms)**
```bash
Measure: wrk -t2 -c10 -d10s http://localhost:3000/api/target 2>/dev/null | grep 'Latency' | awk '{print $2}' | sed 's/ms//'
Tolerance: high
Direction: lower
Guard: npm test
```

**k6 — p95 latency (ms) from inline script**
```bash
Measure: k6 run --quiet --out json=/tmp/k6-result.json - <<'EOF' 2>/dev/null; node -e "const lines=require('fs').readFileSync('/tmp/k6-result.json','utf8').split('\n').filter(Boolean).map(JSON.parse); const p95=lines.find(l=>l.type==='Point'&&l.metric==='http_req_duration'&&l.data?.tags?.percentile==='p(95)'); console.log(Math.round(p95?.data?.value||9999))"
import http from 'k6/http'; export default () => { http.get('http://localhost:3000/api/target'); }
EOF
Tolerance: high
Direction: lower
Guard: npm test
```

**curl — single request time (ms)**
```bash
Measure: curl -s -o /dev/null -w "%{time_total}" http://localhost:3000/api/health 2>/dev/null | awk '{print int($1*1000)}'
Tolerance: medium
Direction: lower
Guard: curl -sf http://localhost:3000 > /dev/null
```

---

## Startup Time

**Node.js process startup (ms)**
```bash
Measure: node -e "const s=Date.now(); require('./dist/index.js'); console.log(Date.now()-s)"
Direction: lower
Guard: npm test
```

**CLI tool startup (ms) — first meaningful output**
```bash
Measure: { start=$(date +%s%N); node ./dist/cli.js --version 2>/dev/null; echo $(( ($(date +%s%N) - start) / 1000000 )); }
Direction: lower
Guard: npm test
```

**Next.js cold start (ms) — via playwright or curl**
```bash
Measure: { start=$(date +%s%N); curl -sf http://localhost:3000 > /dev/null; echo $(( ($(date +%s%N) - start) / 1000000 )); }
Tolerance: high
Direction: lower
Guard: npx tsc --noEmit
```

---

## Tips

- Test the `Measure` command manually before starting — must print exactly one number
- If the command takes >10s, the loop will be expensive; narrow the scope
- Wrap unreliable commands with `|| echo 999` so failures return a bad-but-numeric value instead of crashing the loop
- For `Direction: lower`, set `Min-Gain: 1` to avoid keeping changes that save only a fraction of a unit
- For high-variance metrics (latency, memory), set `Tolerance: high` and `Min-Gain` to 3–5% of baseline
- See `guard-and-noise.md` for noise-aware verification strategies by tolerance level
