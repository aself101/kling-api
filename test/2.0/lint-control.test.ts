/**
 * The import-graph rule must be able to FAIL (spec D20, run #3 A39).
 *
 * A fixture on disk under test/ would sit outside every zone and prove nothing. Instead we
 * lint source text at a VIRTUAL path inside a zone, against the production
 * eslint.config.js, and assert the rule fires — then lint the same import at a path where
 * it is allowed and assert it does not. Type-aware parsing is disabled for the virtual
 * file (it is not in the tsconfig program); the zones rule needs only the resolver.
 */
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({
  cwd: new URL('../../', import.meta.url).pathname,
  overrideConfigFile: 'eslint.config.js',
  overrideConfig: [
    {
      files: ['src/**/*.ts'],
      languageOptions: { parserOptions: { project: null, projectService: false } },
      // The virtual file is not in the tsconfig program, so the two type-aware style rules
      // cannot run on it. Everything else — including the zones — is the production config.
      rules: { '@typescript-eslint/prefer-nullish-coalescing': 'off', '@typescript-eslint/prefer-optional-chain': 'off' },
    },
  ],
});

const RULE = 'import-x/no-restricted-paths';
const lint = async (code: string, filePath: string) => {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === RULE);
};

describe('import-graph zones (production config)', () => {
  it('CONTROL — a codec importing http/core is rejected', async () => {
    const msgs = await lint(`import { HttpCore } from '../http/core.js';\nexport const x = HttpCore;\n`, 'src/codecs/illegal.ts');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].message).toContain('codecs may import http/errors only');
  });

  it('a codec importing http/errors is allowed (the except carve-out works)', async () => {
    expect(await lint(`export { KlingCodecError } from '../http/errors.js';\n`, 'src/codecs/legal.ts')).toHaveLength(0);
  });

  it('a product importing http/core is allowed', async () => {
    expect(await lint(`export { HttpCore } from '../http/core.js';\n`, 'src/products/legal.ts')).toHaveLength(0);
  });

  it('a product importing a handler other than poller is rejected (using the existing 1.x result-poller as the forbidden file)', async () => {
    expect(await lint(`export * from '../handlers/result-poller.js';\n`, 'src/products/x.ts')).toHaveLength(1);
  });

  it('an UNRESOLVABLE import is invisible to the zones rule — so no-unresolved must catch it', async () => {
    // handlers/saver.ts does not exist until 2c. Without no-unresolved a typo would bypass the graph.
    const [result] = await eslint.lintText(`export * from '../handlers/saver.js';\n`, { filePath: 'src/products/x.ts' });
    expect(result.messages.filter((m) => m.ruleId === RULE)).toHaveLength(0);
    expect(result.messages.filter((m) => m.ruleId === 'import-x/no-unresolved')).toHaveLength(1);
  });

  it('nothing under a zone may import client.ts or the barrel', async () => {
    expect(await lint(`export * from '../client.js';\n`, 'src/http/x.ts')).toHaveLength(1);
    expect(await lint(`export * from '../index.js';\n`, 'src/media/x.ts')).toHaveLength(1);
  });

  it('node built-ins are unrestricted everywhere', async () => {
    expect(await lint(`import { randomUUID } from 'node:crypto';\nexport const id = randomUUID();\n`, 'src/codecs/x.ts')).toHaveLength(0);
  });

  it('files outside the zones (1.x during the additive window) are not subject to the rule', async () => {
    expect(await lint(`export * from '../http/core.js';\n`, 'src/config/whatever.ts')).toHaveLength(0);
  });
});
