/**
 * prompt.ts — line-input layer for the interactive CLIs.
 *
 * Why not rl.question()? readline/promises' question() attaches a one-time
 * 'line' listener per call, and readline does NOT queue lines emitted while
 * no question is pending: any line that arrives before the next question()
 * runs is silently dropped. A human on a raw-mode TTY never triggers this
 * (keys are delivered one by one), but every buffered-stdin channel does —
 * pipes, AI-agent shells, pasted multi-line answers, CI runners: lines
 * arrive faster than prompts are issued, the surplus vanishes, prompts
 * stall, and pressing Enter appears to "do nothing" (issue #12).
 *
 * LinePrompt keeps a FIFO of every line ever received, so no input is lost
 * regardless of timing. EOF is treated as an endless supply of bare Enters:
 * ask() then yields the question's fallback and askBool() its default — so
 * `printf '' | pnpm apply-template --dry-run` completes with defaults
 * instead of hanging, while a "Proceed?" gate (default false) still aborts.
 *
 * The readline.Interface is injected so tests can drive a PassThrough
 * stream; createLinePrompt() wires the real process stdin/stdout.
 */
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export class LinePrompt {
  private queue: string[] = [];
  private waiter: ((line: string) => void) | null = null;
  private eof = false;
  readonly rl: readline.Interface;

  constructor(rl: readline.Interface) {
    this.rl = rl;
    rl.on('line', (line: string) => {
      const w = this.waiter;
      if (w) {
        this.waiter = null;
        w(line);
      } else {
        this.queue.push(line);
      }
    });
    rl.on('close', () => {
      this.eof = true;
      // Wake a pending reader with '' (reads as bare Enter → default);
      // later asks short-circuit on the eof flag.
      const w = this.waiter;
      if (w) {
        this.waiter = null;
        w('');
      }
    });
  }

  /** Print the prompt, then resolve with the next line (queued lines first). */
  async ask(question: string): Promise<string> {
    output.write(question);
    if (this.queue.length > 0) return this.queue.shift() as string;
    if (this.eof) return '';
    return new Promise<string>((resolve) => {
      this.waiter = resolve;
    });
  }

  close(): void {
    this.rl.close();
  }
}

export function createLinePrompt(): LinePrompt {
  return new LinePrompt(readline.createInterface({ input, output }));
}
