/** The `kling` command tree (spec D15). Built here so tests can drive it in-process. */
import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { registerImage } from './image.js';
import { registerResources } from './resources.js';
import { registerTasks } from './tasks.js';
import { registerVideo } from './video.js';

export function buildProgram(): Command {
  let version = '0.0.0';
  try {
    version =
      (
        JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
          version?: string;
        }
      ).version ?? version;
  } catch (cause) {
    // AUDIT-OK(no_empty_catch): a corrupted install should still answer --help; --version reports
    // 0.0.0. The read is still named on stderr so the fallback is diagnosable (ship run #5).
    process.stderr.write(
      `[kling:warn] could not read the package manifest for --version: ${cause instanceof Error ? cause.message : String(cause)}\n`
    );
  }
  const program = new Command('kling')
    .description(
      'Kling AI from the command line — video (new API standard), image, elements, voices, avatar, TTS, tasks, account'
    )
    .version(version)
    .option('--api-key <key>', 'API Key (else KLING_API_KEY, ./.env, ~/.kling/.env)')
    .option('--output-dir <dir>', 'where --wait saves outputs', 'output')
    .option('--json', 'machine-readable output on stdout; logs on stderr')
    .option('--debug', 'debug logging on stderr (never the key)')
    .option('-q, --quiet', 'no human output, no spinner')
    .showHelpAfterError('(add --help for usage)');
  registerVideo(program);
  registerImage(program);
  registerResources(program);
  registerTasks(program);
  return program;
}
