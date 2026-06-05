#!/usr/bin/env python3
"""
Migrate proprietary top-level SKILL.md frontmatter fields into a metadata: block.

Fields moved: category, keywords, providers
Skills with an existing metadata: block get the fields appended to it.
"""

import os
import re
import sys

SKILLS_DIR = os.path.join(os.path.dirname(__file__), '..', 'kit', 'skills')
FIELDS_TO_MOVE = ('category', 'keywords', 'providers')


def migrate_skill(path: str) -> bool:
    """
    Returns True if the file was modified.
    """
    with open(path, encoding='utf-8') as f:
        content = f.read()

    # Normalize CRLF
    content = content.replace('\r\n', '\n')

    # Must start with frontmatter
    if not content.startswith('---\n'):
        return False

    end = content.find('\n---\n', 4)
    if end == -1:
        return False

    fm_block = content[4:end]          # between the two ---
    body_rest = content[end + 5:]      # everything after closing ---\n

    lines = fm_block.split('\n')
    kept: list[str] = []
    extracted: dict[str, str] = {}     # field → raw value line suffix
    meta_lines: list[str] = []         # existing "  key: val" lines inside metadata:
    in_meta = False

    for line in lines:
        if line == 'metadata:':
            in_meta = True
            continue
        if in_meta:
            if line.startswith('  '):
                meta_lines.append(line)
                continue
            else:
                in_meta = False

        m = re.match(r'^([a-zA-Z_-]+):\s*(.+)$', line)
        if m and m.group(1) in FIELDS_TO_MOVE:
            extracted[m.group(1)] = m.group(2).strip()
        else:
            kept.append(line)

    if not extracted:
        return False  # nothing to migrate

    # Build updated metadata block
    new_meta: list[str] = list(meta_lines)
    for field in FIELDS_TO_MOVE:
        if field in extracted:
            new_meta.append(f'  {field}: {extracted[field]}')

    new_fm = '\n'.join(kept)
    if new_meta:
        new_fm += '\nmetadata:\n' + '\n'.join(new_meta)

    new_content = f'---\n{new_fm}\n---\n{body_rest}'

    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    return True


def main() -> None:
    if not os.path.isdir(SKILLS_DIR):
        print(f'ERROR: skills dir not found: {SKILLS_DIR}', file=sys.stderr)
        sys.exit(1)

    changed = 0
    for skill_dir in sorted(os.listdir(SKILLS_DIR)):
        skill_md = os.path.join(SKILLS_DIR, skill_dir, 'SKILL.md')
        if not os.path.isfile(skill_md):
            continue
        if migrate_skill(skill_md):
            print(f'  migrated: {skill_dir}/SKILL.md')
            changed += 1

    print(f'\n{changed} file(s) updated.')


if __name__ == '__main__':
    main()
