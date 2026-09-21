/** Resource rules (spec D8; App. C §7) — all [shape]. */
import { describe, expect, it } from 'vitest';
import { validateAvatarCreate, validateElementCreate, validatePage, validateTts, validateVoiceCreate } from '../../../../src/config/validators/resources.js';

const IMG = 'https://cdn.example/i.png';

describe('validateElementCreate', () => {
  const base = { name: 'n', description: 'd', referenceType: 'image_refer' as const, frontalImage: IMG, referImages: [IMG] };
  it('name ≤ 20, description ≤ 100, referenceType enum', () => {
    expect(() => validateElementCreate({ ...base, name: 'x'.repeat(21) })).toThrow(/not exceed 20/);
    expect(() => validateElementCreate({ ...base, description: 'x'.repeat(101) })).toThrow(/not exceed 100/);
    expect(() => validateElementCreate({ ...base, referenceType: 'audio_refer' as never })).toThrow(/referenceType/);
    expect(() => validateElementCreate(base)).not.toThrow();
  });
  it('image_refer: frontalImage + 1–3 referImages required, no videos', () => {
    expect(() => validateElementCreate({ ...base, frontalImage: undefined })).toThrow(/frontalImage is required/);
    expect(() => validateElementCreate({ ...base, referImages: [] })).toThrow(/1–3 images/);
    expect(() => validateElementCreate({ ...base, referImages: [IMG, IMG, IMG, IMG] })).toThrow(/1–3 images/);
    expect(() => validateElementCreate({ ...base, referVideos: ['https://v/x.mp4'] })).toThrow(/invalid with referenceType 'image_refer'/);
  });
  it('video_refer: exactly one video URL, no images', () => {
    const v = { name: 'n', description: 'd', referenceType: 'video_refer' as const };
    expect(() => validateElementCreate({ ...v })).toThrow(/exactly one video URL/);
    expect(() => validateElementCreate({ ...v, referVideos: ['https://v/a.mp4', 'https://v/b.mp4'] })).toThrow(/exactly one video URL/);
    expect(() => validateElementCreate({ ...v, referVideos: ['https://v/a.mp4'], frontalImage: IMG })).toThrow(/for 'image_refer'/);
    expect(() => validateElementCreate({ ...v, referVideos: [{ url: 'https://v/a.mp4' }] })).not.toThrow();
  });
  it('tags must be vendor ids', () => {
    expect(() => validateElementCreate({ ...base, tags: ['o_109' as never] })).toThrow(/tags\[0\] must be one of o_101/);
    expect(() => validateElementCreate({ ...base, tags: ['o_101', 'o_108'] })).not.toThrow();
  });
});

describe('validateVoiceCreate / validateAvatarCreate / validateTts / validatePage', () => {
  it('voice: name ≤ 20; exactly one of voiceUrl (https) / videoId', () => {
    expect(() => validateVoiceCreate({ name: 'x'.repeat(21), voiceUrl: 'https://a/v.mp3' })).toThrow(/not exceed 20/);
    expect(() => validateVoiceCreate({ name: 'v' })).toThrow(/exactly one of voiceUrl \/ videoId/);
    expect(() => validateVoiceCreate({ name: 'v', voiceUrl: 'https://a/v.mp3', videoId: 'x' })).toThrow(/exactly one/);
    expect(() => validateVoiceCreate({ name: 'v', voiceUrl: 'http://a/v.mp3' })).toThrow(/https URL/);
    expect(() => validateVoiceCreate({ name: 'v', voiceUrl: 'https://a/v.mp3' })).not.toThrow();
    expect(() => validateVoiceCreate({ name: 'v', videoId: '930831534075682845' })).not.toThrow();
  });
  it('avatar: image required; exactly one of audioId / soundFile; prompt ≤ 2500; mode enum', () => {
    expect(() => validateAvatarCreate({ image: IMG })).toThrow(/exactly one of audioId \/ soundFile/);
    expect(() => validateAvatarCreate({ image: IMG, audioId: 'a', soundFile: 'https://a/s.mp3' })).toThrow(/exactly one/);
    expect(() => validateAvatarCreate({ image: IMG, audioId: 'a', mode: 'ultra' as never })).toThrow(/mode/);
    expect(() => validateAvatarCreate({ image: IMG, audioId: 'a', prompt: 'x'.repeat(2501) })).toThrow(/2500/);
    expect(() => validateAvatarCreate({ image: IMG, soundFile: 'https://a/s.mp3', mode: 'pro' })).not.toThrow();
  });
  it('tts: text ≤ 1000, voiceId, voiceLanguage required, voiceSpeed ∈ [0.8, 2.0]', () => {
    expect(() => validateTts({ text: 'x'.repeat(1001), voiceId: 'oversea_male1', voiceLanguage: 'en' })).toThrow(/1000/);
    expect(() => validateTts({ text: 'hi', voiceId: '', voiceLanguage: 'en' })).toThrow(/Voice Guide/);
    expect(() => validateTts({ text: 'hi', voiceId: 'v', voiceLanguage: 'fr' as never })).toThrow(/voiceLanguage/);
    expect(() => validateTts({ text: 'hi', voiceId: 'v', voiceLanguage: 'zh', voiceSpeed: 2.1 })).toThrow(/\[0\.8, 2\.0\]/);
    expect(() => validateTts({ text: 'hi', voiceId: 'v', voiceLanguage: 'zh', voiceSpeed: 0.8 })).not.toThrow();
  });
  it('page bounds: pageNum 1–1000; pageSize 1–max', () => {
    expect(() => validatePage(0, 1, 500)).toThrow(/pageNum/);
    expect(() => validatePage(1, 501, 500)).toThrow(/pageSize must be an integer in 1–500/);
    expect(() => validatePage(1, 1000, 1000)).not.toThrow();
  });
});
