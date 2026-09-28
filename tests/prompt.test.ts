/**
 * LinePrompt unit tests — the input layer behind the interactive CLIs.
 *
 * Regression for issue #12: readline/promises' question() attaches a one-time
 * 'line' listener per call and drops any line arriving while no question is
 * pending. Buffered stdin (pipes, AI-agent shells, pasted answers) hits this
 * constantly — prompts stall and bare Enter "does nothing". LinePrompt must
 * deliver EVERY line ever received, in order, regardless of timing, and
 * treat EOF as a bare Enter ('') so default-accepting runs complete.
 */
import { PassThrough } from 'node:stream';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as readline from 'node:readline/promises';
import { describe, expect, test } from 'vitest';
import { LinePrompt } from '../scripts/lib/prompt';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function makePrompt(): { prompt: LinePrompt; input: PassThrough } {
  const input = new PassThrough();
  const rl = readline.createInterface({ input, terminal: false, output: new PassThrough() });
  return { prompt: new LinePrompt(rl), input };
}

/** Ask n questions sequentially and collect the answers. */
async function collect(prompt: LinePrompt, n: number): Promise<string[]> {
  const answers: string[] = [];
  for (let i = 0; i < n; i++) answers.push(await prompt.ask(`Q${i + 1}: `));
  return answers;
}

describe('LinePrompt', () => {
  test('delivers all lines of one instantly-buffered chunk, in order', async () => {
    const { prompt, input } = makePrompt();
    const pending = collect(prompt, 5);
    input.write('a\nb\nc\nd\ne\n'); // single chunk — the pipe/agent-shell pattern
    expect(await pending).toEqual(['a', 'b', 'c', 'd', 'e']);
    prompt.close();
  });

  test('buffers lines that arrive before any question is asked', async () => {
    const { prompt, input } = makePrompt();
    input.write('x\ny\nz\n'); // all lines land before the first ask()
    expect(await collect(prompt, 3)).toEqual(['x', 'y', 'z']);
    prompt.close();
  });

  test('keeps working when empty lines (bare Enters) are interleaved', async () => {
    const { prompt, input } = makePrompt();
    const pending = collect(prompt, 4);
    input.write('\n\nanswer\n\n');
    expect(await pending).toEqual(['', '', 'answer', '']);
    prompt.close();
  });

  test('EOF resolves pending and future asks with "" (bare Enter → default)', async () => {
    const { prompt, input } = makePrompt();
    input.end(); // stdin closes with no lines at all
    // First ask wakes via the close event, later asks short-circuit on eof.
    expect(await collect(prompt, 3)).toEqual(['', '', '']);
    prompt.close();
  });

  test('EOF after queued lines: queue drains first, then ""', async () => {
    const { prompt, input } = makePrompt();
    input.write('only\n');
    input.end();
    expect(await collect(prompt, 3)).toEqual(['only', '', '']);
    prompt.close();
  });
});

describe('interactive CLIs use the line queue (issue #12 contract)', () => {
  // The LinePrompt unit tests above pass even if the CLIs themselves regress
  // to rl.question() — a revert would reintroduce the #12 drop silently.
  // Pin the wiring: no interactive CLI may call rl.question() again.
  const cliScripts = ['scripts/apply-template.ts', 'scripts/new-post.ts', 'scripts/new-locale.ts'];

  test('no CLI script calls rl.question() directly', () => {
    for (const rel of cliScripts) {
      const src = readFileSync(join(repoRoot, rel), 'utf8');
      expect(src, `${rel} must go through LinePrompt.ask (see scripts/lib/prompt.ts)`).not.toMatch(
        /\brl\.question\(/,
      );
    }
  });

  test('each CLI script imports LinePrompt', () => {
    for (const rel of cliScripts) {
      const src = readFileSync(join(repoRoot, rel), 'utf8');
      expect(src, `${rel} must import from scripts/lib/prompt`).toMatch(/lib\/prompt/);
    }
  });
});
