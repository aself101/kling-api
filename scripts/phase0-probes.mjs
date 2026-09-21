#!/usr/bin/env node
// Phase 0 gate probes (spec v0.4.2 §9 Phase 0, checklist "Live gate probes").
// One paid WRITE per legacy product family 2.0 ships, all with the API Key:
//   image generate → TTS → voice create/delete → element create/delete → avatar create.
// Read-only calls are used to poll. Every spend is printed so it can be recorded in the checklist.
// Usage: source ~/.zshrc; node scripts/phase0-probes.mjs [--skip avatar,element,...]
const key = process.env.KLING_API_KEY;
if (!key) { console.error('KLING_API_KEY not set'); process.exit(2); }
const base = 'https://api-singapore.klingai.com';
const skip = new Set((process.argv.find(a => a.startsWith('--skip='))?.slice(7) ?? '').split(',').filter(Boolean));
const results = {};

async function call(method, path, body) {
  const r = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  return { status: r.status, json };
}
function show(label, res) {
  const j = res.json;
  console.log(`\n## ${label}\nHTTP ${res.status} code=${j.code} ${j.message ?? ''}${j.request_id ? ' req=' + j.request_id : ''}`);
  return j;
}
async function pollLegacy(path, id, { every = 4000, max = 300_000 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const j = (await call('GET', `${path}/${id}`)).json;
    const st = j.data?.task_status;
    process.stdout.write(`  poll ${st} (${Math.round((Date.now() - t0) / 1000)}s)\r`);
    if (st === 'succeed' || st === 'failed') { console.log(); return j; }
    if (Date.now() - t0 > max) throw new Error(`poll timeout on ${path}/${id}`);
    await new Promise(r => setTimeout(r, every));
  }
}
const ded = (j) => `unit=${j.data?.final_unit_deduction ?? '-'} cash=${j.data?.final_balance_deduction?.quota ?? '-'}`;

// 1. image generate (kling-v3, n=1, 1k) — the portrait is reused by the element and avatar probes
let imageUrl;
if (!skip.has('image')) {
  const j = show('image generate', await call('POST', '/v1/images/generations', {
    model_name: 'kling-v3', prompt: 'studio portrait photo of a smiling woman, front-facing, looking at camera, plain grey background, soft light',
    n: 1, resolution: '1k', aspect_ratio: '1:1',
  }));
  if (j.code === 0) {
    const done = await pollLegacy('/v1/images/generations', j.data.task_id);
    imageUrl = done.data?.task_result?.images?.[0]?.url;
    console.log(`  task_id=${j.data.task_id} status=${done.data?.task_status} ${ded(done)}\n  image=${imageUrl?.slice(0, 90)}…`);
    results.image = { task_id: j.data.task_id, status: done.data?.task_status, deduction: ded(done) };
  } else results.image = j;
}

// 2. TTS (synchronous). ~6 s of speech so the same clip qualifies as a voice sample (5–30 s) and avatar audio.
let audioId, audioUrl;
if (!skip.has('tts')) {
  const voices = (await call('GET', '/v1/general/presets-voices')).json;
  const preset = voices.data?.[0]?.task_result?.voices?.find(v => /en|Owen|Emma/i.test(v.voice_name)) ?? voices.data?.[0]?.task_result?.voices?.[0];
  const j = show('tts', await call('POST', '/v1/audio/tts', {
    text: 'Hello there. This is a short voice sample recorded to test the Kling text to speech endpoint for the two point zero migration probes.',
    voice_id: 'oversea_male1', voice_language: 'en', voice_speed: 1.0,  // TTS has its own voice catalogue (Voice Guide), NOT /v1/general/presets-voices
  }));
  const a = j.data?.task_result?.audios?.[0];
  audioId = a?.id; audioUrl = a?.url;
  console.log(`  voice_id=oversea_male1 audio_id=${audioId} duration=${a?.duration} ${ded(j)}`);
  results.tts = { code: j.code, audio_id: audioId, duration: a?.duration, deduction: ded(j) };
}

// 3. voice create from the TTS clip, then delete
if (!skip.has('voice') && audioUrl) {
  const j = show('voice create', await call('POST', '/v1/general/custom-voices', { voice_name: 'probe-2026-09-20', voice_url: audioUrl }));
  if (j.code === 0) {
    const done = await pollLegacy('/v1/general/custom-voices', j.data.task_id);
    const v = done.data?.task_result?.voices?.[0];
    console.log(`  task_id=${j.data.task_id} status=${done.data?.task_status} voice_id=${v?.voice_id} ${ded(done)}`);
    const del = show('voice delete', await call('POST', '/v1/general/delete-voices', { voice_id: v?.voice_id }));
    results.voice = { task_id: j.data.task_id, status: done.data?.task_status, voice_id: v?.voice_id, deduction: ded(done), delete_code: del.code };
  } else results.voice = j;
}

// 4. element create (image_refer) from the portrait, then delete via the VIDEO delete path
if (!skip.has('element') && imageUrl) {
  const j = show('element create', await call('POST', '/v1/general/advanced-custom-elements', {
    element_name: 'probe-woman', element_description: 'smiling woman, grey background', reference_type: 'image_refer',
    element_image_list: { frontal_image: imageUrl, refer_images: [{ image_url: imageUrl }] },
  }));
  if (j.code === 0) {
    const done = await pollLegacy('/v1/general/advanced-custom-elements', j.data.task_id);
    const e = done.data?.task_result?.elements?.[0];
    console.log(`  task_id=${j.data.task_id} status=${done.data?.task_status} msg=${done.data?.task_status_msg ?? ''} element_id=${e?.element_id} ${ded(done)}`);
    const del = show('element delete (video path)', await call('POST', '/v1/general/delete-advanced-elements', { element_id: e?.element_id }));
    results.element = { task_id: j.data.task_id, status: done.data?.task_status, element_id: e?.element_id, deduction: ded(done), delete_code: del.code };
  } else results.element = j;
}

// 5. avatar create: portrait + TTS audio_id, std
if (!skip.has('avatar') && imageUrl && audioId) {
  const j = show('avatar create', await call('POST', '/v1/videos/avatar/image2video', { image: imageUrl, audio_id: audioId, mode: 'std' }));
  if (j.code === 0) {
    const done = await pollLegacy('/v1/videos/avatar/image2video', j.data.task_id, { every: 8000, max: 900_000 });
    const v = done.data?.task_result?.videos?.[0];
    console.log(`  task_id=${j.data.task_id} status=${done.data?.task_status} msg=${done.data?.task_status_msg ?? ''} duration=${v?.duration} ${ded(done)}`);
    results.avatar = { task_id: j.data.task_id, status: done.data?.task_status, duration: v?.duration, deduction: ded(done) };
  } else results.avatar = j;
}

console.log('\n## summary'); console.log(JSON.stringify(results, null, 1));
