import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';

/**
 * 2.0 import graph (spec §5), transcribed as `import-x/no-restricted-paths` zones.
 *
 * Each zone names a TARGET directory (the importer) and the paths it may NOT import
 * from; `except` carves out the allowed files inside a forbidden directory. Zones are
 * scoped to every `src/` tree except `src/cli/`. During Phase 1 they covered only the
 * new directories — 1.x files under `src/config`, `src/utils`, `src/operations`, … lived
 * beside the new code until the 2a₀ removal commit and were not linted against rules
 * written for their replacements (run #3 A44); `src/config` and `src/utils` gained their
 * zones at 2a₀.
 *
 * `node:*` built-ins are unrestricted everywhere. A test (`test/2.0/lint-control.test.ts`)
 * lints a virtual file INSIDE a zone against this very config and asserts the rule fires —
 * a `no-restricted-paths` whose resolver is misconfigured is silently inert (run #3 A39).
 */
const SRC = './src';
const NOT_FROM_APP_LAYERS = [
  { target: `${SRC}/codecs`, from: `${SRC}/client.ts`, message: 'codecs must not import the client' },
  { target: `${SRC}/codecs`, from: `${SRC}/index.ts`, message: 'codecs must not import the barrel' },
  { target: `${SRC}/codecs`, from: `${SRC}/cli`, message: 'codecs must not import the CLI' },
];
const zones = [
  // codecs: codecs/task, http/errors, config/constants only
  { target: `${SRC}/codecs`, from: `${SRC}/http`, except: ['./errors.ts'], message: 'codecs may import http/errors only (spec §5)' },
  { target: `${SRC}/codecs`, from: `${SRC}/config`, except: ['./constants.ts'], message: 'codecs may import config/constants only (spec §5)' },
  { target: `${SRC}/codecs`, from: `${SRC}/products`, message: 'codecs must not import products (spec §5)' },
  { target: `${SRC}/codecs`, from: `${SRC}/media`, message: 'codecs must not import media (spec §5)' },
  { target: `${SRC}/codecs`, from: `${SRC}/handlers`, message: 'codecs must not import handlers (spec §5)' },
  { target: `${SRC}/codecs`, from: `${SRC}/utils`, message: 'codecs must not import utils (spec §5)' },
  { target: `${SRC}/codecs`, from: `${SRC}/webhooks.ts`, message: 'codecs must not import webhooks (spec §5)' },
  ...NOT_FROM_APP_LAYERS,

  // http: http/*, codecs (types), config/constants, utils/*
  { target: `${SRC}/http`, from: `${SRC}/config`, except: ['./constants.ts'], message: 'http may import config/constants only (spec §5)' },
  { target: `${SRC}/http`, from: `${SRC}/products`, message: 'http must not import products (spec §5)' },
  { target: `${SRC}/http`, from: `${SRC}/media`, message: 'http must not import media (spec §5)' },
  { target: `${SRC}/http`, from: `${SRC}/handlers`, message: 'http must not import handlers (spec §5)' },
  { target: `${SRC}/http`, from: `${SRC}/webhooks.ts`, message: 'http must not import webhooks (spec §5)' },
  { target: `${SRC}/http`, from: `${SRC}/client.ts`, message: 'http must not import the client (spec §5)' },
  { target: `${SRC}/http`, from: `${SRC}/index.ts`, message: 'http must not import the barrel (spec §5)' },
  { target: `${SRC}/http`, from: `${SRC}/cli`, message: 'http must not import the CLI (spec §5)' },

  // media: http/errors, utils/security, config/constants
  { target: `${SRC}/media`, from: `${SRC}/http`, except: ['./errors.ts'], message: 'media may import http/errors only (spec §5)' },
  { target: `${SRC}/media`, from: `${SRC}/config`, except: ['./constants.ts'], message: 'media may import config/constants only (spec §5)' },
  { target: `${SRC}/media`, from: `${SRC}/codecs`, except: ['./params.ts', './task.ts'], message: 'media may import codecs/params and codecs/task (types) only (spec §5)' },
  { target: `${SRC}/media`, from: `${SRC}/products`, message: 'media must not import products (spec §5)' },
  { target: `${SRC}/media`, from: `${SRC}/handlers`, message: 'media must not import handlers (spec §5)' },
  { target: `${SRC}/media`, from: `${SRC}/webhooks.ts`, message: 'media must not import webhooks (spec §5)' },
  { target: `${SRC}/media`, from: `${SRC}/client.ts`, message: 'media must not import the client (spec §5)' },
  { target: `${SRC}/media`, from: `${SRC}/index.ts`, message: 'media must not import the barrel (spec §5)' },
  { target: `${SRC}/media`, from: `${SRC}/cli`, message: 'media must not import the CLI (spec §5)' },

  // handlers: codecs/task, http/errors, config/constants, media/download, utils/*
  { target: `${SRC}/handlers`, from: `${SRC}/http`, except: ['./errors.ts'], message: 'handlers may import http/errors only (spec §5)' },
  { target: `${SRC}/handlers`, from: `${SRC}/config`, except: ['./constants.ts'], message: 'handlers may import config/constants only (spec §5)' },
  { target: `${SRC}/handlers`, from: `${SRC}/products`, message: 'handlers must not import products (spec §5)' },
  { target: `${SRC}/handlers`, from: `${SRC}/webhooks.ts`, message: 'handlers must not import webhooks (spec §5)' },
  { target: `${SRC}/handlers`, from: `${SRC}/client.ts`, message: 'handlers must not import the client (spec §5)' },
  { target: `${SRC}/handlers`, from: `${SRC}/index.ts`, message: 'handlers must not import the barrel (spec §5)' },
  { target: `${SRC}/handlers`, from: `${SRC}/cli`, message: 'handlers must not import the CLI (spec §5)' },

  // products: http/*, codecs/*, config/*, media/*, handlers/{poller,coalescer}, products/*
  //
  // `coalescer.ts` joined `poller.ts` in this exception in ship run #6. Both are polling
  // mechanism with no product knowledge — the poller says WHEN to read, the coalescer says how
  // many reads share a request — and `saver.ts`, the other handler, stays excluded because it
  // is an application-level concern that products must not reach into (spec §5's actual point).
  { target: `${SRC}/products`, from: `${SRC}/handlers`, except: ['./poller.ts', './coalescer.ts'], message: 'products may import handlers/poller and handlers/coalescer only (spec §5)' },
  { target: `${SRC}/products`, from: `${SRC}/webhooks.ts`, message: 'products must not import webhooks (spec §5)' },
  { target: `${SRC}/products`, from: `${SRC}/client.ts`, message: 'products must not import the client (spec §5)' },
  { target: `${SRC}/products`, from: `${SRC}/index.ts`, message: 'products must not import the barrel (spec §5)' },
  { target: `${SRC}/products`, from: `${SRC}/cli`, message: 'products must not import the CLI (spec §5)' },

  // webhooks.ts: codecs/*, http/errors
  { target: `${SRC}/webhooks.ts`, from: `${SRC}/http`, except: ['./errors.ts'], message: 'webhooks may import http/errors only (spec §5)' },
  { target: `${SRC}/webhooks.ts`, from: `${SRC}/config`, message: 'webhooks must not import config (spec §5)' },
  { target: `${SRC}/webhooks.ts`, from: `${SRC}/products`, message: 'webhooks must not import products (spec §5)' },
  { target: `${SRC}/webhooks.ts`, from: `${SRC}/media`, message: 'webhooks must not import media (spec §5)' },
  { target: `${SRC}/webhooks.ts`, from: `${SRC}/handlers`, message: 'webhooks must not import handlers (spec §5)' },
  { target: `${SRC}/webhooks.ts`, from: `${SRC}/utils`, message: 'webhooks must not import utils (spec §5)' },
  { target: `${SRC}/webhooks.ts`, from: `${SRC}/client.ts`, message: 'webhooks must not import the client (spec §5)' },
  { target: `${SRC}/webhooks.ts`, from: `${SRC}/index.ts`, message: 'webhooks must not import the barrel (spec §5)' },
  { target: `${SRC}/webhooks.ts`, from: `${SRC}/cli`, message: 'webhooks must not import the CLI (spec §5)' },

  // client.ts: products/*, handlers/saver, http/*, config/*
  { target: `${SRC}/client.ts`, from: `${SRC}/handlers`, except: ['./saver.ts'], message: 'client may import handlers/saver only (spec §5)' },
  { target: `${SRC}/client.ts`, from: `${SRC}/cli`, message: 'client must not import the CLI (spec §5)' },
  { target: `${SRC}/client.ts`, from: `${SRC}/index.ts`, message: 'client must not import the barrel (spec §5)' },

  // config/{constants,loaders,models}.ts: codecs/task (types) only. config/validators/*:
  // config/models, config/constants, http/errors, codecs/task. Zones added at 2a₀ once the
  // 1.x config files were gone (the 1.x validators imported types.ts and the operations).
  { target: `${SRC}/config`, from: `${SRC}/codecs`, except: ['./task.ts', './params.ts'], message: 'config may import codecs/task and codecs/params (types) only (spec §5)' },
  { target: `${SRC}/config`, from: `${SRC}/http`, except: ['./errors.ts'], message: 'config may import http/errors only (spec §5)' },
  { target: `${SRC}/config`, from: `${SRC}/products`, message: 'config must not import products (spec §5)' },
  { target: `${SRC}/config`, from: `${SRC}/media`, message: 'config must not import media (spec §5)' },
  { target: `${SRC}/config`, from: `${SRC}/handlers`, message: 'config must not import handlers (spec §5)' },
  { target: `${SRC}/config`, from: `${SRC}/utils`, message: 'config must not import utils (spec §5)' },
  { target: `${SRC}/config`, from: `${SRC}/webhooks.ts`, message: 'config must not import webhooks (spec §5)' },
  { target: `${SRC}/config`, from: `${SRC}/client.ts`, message: 'config must not import the client (spec §5)' },
  { target: `${SRC}/config`, from: `${SRC}/index.ts`, message: 'config must not import the barrel (spec §5)' },
  { target: `${SRC}/config`, from: `${SRC}/cli`, message: 'config must not import the CLI (spec §5)' },

  // utils/*: config/constants and sibling utils only
  { target: `${SRC}/utils`, from: `${SRC}/config`, except: ['./constants.ts'], message: 'utils may import config/constants only (spec §5)' },
  { target: `${SRC}/utils`, from: `${SRC}/codecs`, message: 'utils must not import codecs (spec §5)' },
  { target: `${SRC}/utils`, from: `${SRC}/http`, message: 'utils must not import http (spec §5)' },
  { target: `${SRC}/utils`, from: `${SRC}/products`, message: 'utils must not import products (spec §5)' },
  { target: `${SRC}/utils`, from: `${SRC}/media`, message: 'utils must not import media (spec §5)' },
  { target: `${SRC}/utils`, from: `${SRC}/handlers`, message: 'utils must not import handlers (spec §5)' },
  { target: `${SRC}/utils`, from: `${SRC}/webhooks.ts`, message: 'utils must not import webhooks (spec §5)' },
  { target: `${SRC}/utils`, from: `${SRC}/client.ts`, message: 'utils must not import the client (spec §5)' },
  { target: `${SRC}/utils`, from: `${SRC}/index.ts`, message: 'utils must not import the barrel (spec §5)' },
  { target: `${SRC}/utils`, from: `${SRC}/cli`, message: 'utils must not import the CLI (spec §5)' },
];

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  prettierConfig,
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'datasets/**'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',

      // General rules
      'no-console': 'off', // We use console for logging
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // 2.0 import graph enforcement (spec §5). Every src/ directory since 2a₀ removed the
    // 1.x files; `src/cli/**` is the one tree with no zone (it may import anything).
    files: [
      'src/codecs/**/*.ts',
      'src/config/**/*.ts',
      'src/utils/**/*.ts',
      'src/http/**/*.ts',
      'src/media/**/*.ts',
      'src/handlers/**/*.ts',
      'src/products/**/*.ts',
      'src/webhooks.ts',
      'src/client.ts',
    ],
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({ project: './tsconfig.json', alwaysTryTypes: true }),
      ],
    },
    rules: {
      'import-x/no-restricted-paths': ['error', { basePath: '.', zones }],
      // Zones cannot judge an import the resolver cannot resolve — so an unresolvable path
      // must be an error in its own right, or a typo would bypass the graph silently.
      'import-x/no-unresolved': ['error', { ignore: ['^node:'] }],
    },
  },
  {
    // Node ESM scripts under test/ (the fixture extractor). Only the globals they use.
    files: ['test/**/*.mjs', 'scripts/**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } },
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      // Relax rules for tests - no type-aware linting
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
    },
  }
);
