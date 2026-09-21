/** Fixture loader shared by the codec tests. Paths are relative to `test/2.0/fixtures/`. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

export function fixture(rel: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, rel), 'utf8'));
}

export const NEW_FIXTURES = ['new/t2v-create.json', 'new/tasks-get.json', 'new/tasks-cursor.json', 'new/callback.json'] as const;
export const LEGACY_FIXTURES = [
  'legacy/image-generation-create.json',
  'legacy/image-generation-query.json',
  'legacy/image-generation-list.json',
  'legacy/omni-image-query.json',
  'legacy/subject-completion-query.json',
  'legacy/avatar-query.json',
  'legacy/tts-create.json',
  'legacy/text-to-audio-query.json',
  'legacy/element-list.json',
  'legacy/voice-list.json',
  'legacy/callback.json',
] as const;
export const REQUEST_FIXTURES = [
  'requests/t2v-kling-3.0-turbo.json',
  'requests/t2v-kling-3.0.json',
  'requests/t2v-kling-2.6.json',
  'requests/t2v-kling-2.5-turbo.json',
  'requests/i2v-kling-3.0-turbo.json',
  'requests/i2v-kling-3.0.json',
  'requests/i2v-kling-2.6.json',
  'requests/i2v-kling-2.5-turbo.json',
] as const;
