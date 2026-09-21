#!/usr/bin/env node
/** `kling` CLI entry (spec D15) → `dist/cli/index.js`, `package.json#bin`. */
import { buildProgram } from './program.js';
import { reportError, type GlobalOptions } from './shared.js';

const program = buildProgram();
program.parseAsync(process.argv).catch((err: unknown) => reportError(err, program.opts() as GlobalOptions));
