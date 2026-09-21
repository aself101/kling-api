/** The `kling` command tree (spec D15). Built here so tests can drive it in-process. */
import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { registerImage } from './image.js';
import { registerResources } from './resources.js';
import { registerTasks } from './tasks.js';
import { registerVideo } from './video.js';

export function buildProgram(): Command {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  const program = new Command('kling')
    .description(
      'Kling AI from the command line — video (new API standard), image, elements, voices, avatar, TTS, tasks, account'
    )
    .version(pkg.version)
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
