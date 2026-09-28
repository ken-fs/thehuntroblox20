import { describe, expect, it } from 'vitest';
import { runAcrossSites } from '../src/cli/run-all.js';
import type { ListedSite } from '../src/core/sites.js';
import { OpsError } from '../src/core/errors.js';

function site(name: string, path: string, missing = false): ListedSite {
  return { name, path, missing };
}

function collector(): { out: string; write: (s: string) => void } {
  let out = '';
  return { get out() { return out; }, write: (s: string) => { out += s; } };
}

describe('runAcrossSites', () => {
  it('prints one == name (path) == section per site and a summary', async () => {
    const c = collector();
    const code = await runAcrossSites(
      [site('a', '/tmp/a'), site('b', '/tmp/b')],
      async (s) => {
        c.write(`ran ${s.name}\n`);
        return 0;
      },
      c.write,
    );
    expect(code).toBe(0);
    expect(c.out).toContain('== a (/tmp/a) ==');
    expect(c.out).toContain('== b (/tmp/b) ==');
    expect(c.out).toContain('ran a');
    expect(c.out).toContain('ran b');
    expect(c.out).toContain('2/2 site(s) ok.');
  });

  it('a failing site does not abort the loop; exit code 1 and X/Y summary', async () => {
    const c = collector();
    const visited: string[] = [];
    const code = await runAcrossSites(
      [site('a', '/tmp/a'), site('b', '/tmp/b')],
      async (s) => {
        visited.push(s.name);
        return s.name === 'a' ? 1 : 0;
      },
      c.write,
    );
    expect(code).toBe(1);
    expect(visited).toEqual(['a', 'b']);
    expect(c.out).toContain('1/2 site(s) ok.');
  });

  it('OpsError thrown by one site is printed with its fix, others still run', async () => {
    const c = collector();
    const code = await runAcrossSites(
      [site('bad', '/tmp/bad'), site('good', '/tmp/good')],
      async (s) => {
        if (s.name === 'bad') throw new OpsError('no site config found', 'run inside a fork');
        return 0;
      },
      c.write,
    );
    expect(code).toBe(1);
    expect(c.out).toContain('Error: no site config found');
    expect(c.out).toContain('Fix: run inside a fork');
    expect(c.out).toContain('== good (/tmp/good) ==');
  });

  it('missing-path sites are reported as failures without invoking the command', async () => {
    const c = collector();
    let ran = 0;
    const code = await runAcrossSites(
      [site('gone', '/gone', true), site('here', '/tmp/here')],
      async () => {
        ran++;
        return 0;
      },
      c.write,
    );
    expect(code).toBe(1);
    expect(ran).toBe(1);
    expect(c.out).toContain('path does not exist');
    expect(c.out).toContain('sites remove gone');
    expect(c.out).toContain('1/2 site(s) ok.');
  });

  it('empty registry-style input: 0/0 summary, exit 0', async () => {
    const c = collector();
    const code = await runAcrossSites([], async () => 0, c.write);
    expect(code).toBe(0);
    expect(c.out).toContain('0/0 site(s) ok.');
  });
});
