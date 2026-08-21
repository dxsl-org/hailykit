import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PiProvider } from '../installer/providers/pi';

const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'haily-pi-prov3-'));

test('Phase 3 PiProvider converts agent refs and Task() allowlists into task contract', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  const target = path.join(root, '.pi');
  fs.mkdirSync(path.join(kit, 'agents'), { recursive: true });
  fs.writeFileSync(
    path.join(kit, 'agents', 'haily-planner.md'),
    '---\nname: haily-planner\ndescription: planner\ntools: Read, Task(Explore)\n---\n\nDelegate with {agent:haily-reviewer}. Bridge {agent-result:haily-reviewer}.',
  );
  const result = new PiProvider().installAgents!(kit, target);
  assert.equal(result.installed, 1);
  const agent = fs.readFileSync(path.join(target, 'agents', 'haily-planner.md'), 'utf8');
  assert.match(agent, /^spawns: Explore$/m);
  assert.match(agent, /^tools: read, task$/m);
  assert.match(agent, /Pi's `task` tool with \{"agent":"haily-reviewer","task":"\.\.\."\}/);
  assert.match(agent, /Using the haily-reviewer result from the prior Pi `task` call above/);
  assert.match(agent, /isolated conversation context\. This is not an OS sandbox/i);
});
