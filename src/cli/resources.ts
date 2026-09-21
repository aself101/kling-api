/** `kling elements|voices|avatar|audio …` (spec D15, D8). */
import type { Command } from 'commander';
import type { ElementTag } from '../codecs/params.js';
import type { Task } from '../codecs/task.js';
import { collect, finishCreate, globalsOf, int, makeClient, mediaArg, num, print, type CreateOptions, type GlobalOptions } from './shared.js';

const common = (o: Record<string, unknown>): CreateOptions => ({ wait: o.wait as boolean | undefined, download: false, callbackUrl: o.callbackUrl as string | undefined, externalTaskId: o.externalTaskId as string | undefined });

function printTasks(g: GlobalOptions, tasks: Task[]): void {
  const rows = tasks.flatMap((t) => t.outputs.map((o) => ({ taskId: t.id, status: t.status, ...(o.type === 'element' || o.type === 'voice' ? { id: o.id, name: o.name, ownedBy: 'ownedBy' in o ? o.ownedBy : undefined, itemStatus: o.status } : { type: o.type }) })));
  print(g, rows.length === 0 ? '(no entries)' : rows.map((r) => `${r.taskId}\t${r.status}\t${'id' in r ? `${r.id}\t${r.name}\t${r.ownedBy ?? ''}\t${r.itemStatus}` : r.type}`).join('\n'), { tasks });
}

const page = (cmd: Command) => cmd.option('--page <n>', 'page number, 1–1000', int('pageNum')).option('--page-size <n>', 'items per page', int('pageSize'));

export function registerResources(program: Command): void {
  const elements = program.command('elements').description('element library (characters / subjects for video and image)');
  elements
    .command('create')
    .description('create an element from images (image_refer) or one video (video_refer)')
    .requiredOption('--name <text>', '≤ 20 characters')
    .requiredOption('--description <text>', '≤ 100 characters')
    .requiredOption('--reference-type <image_refer|video_refer>', 'how the element is defined')
    .option('--frontal-image <file|url>', 'frontal image (image_refer)')
    .option('--refer-image <file|url>', 'additional angle/close-up, repeatable 1–3 (image_refer)', collect)
    .option('--refer-video <url>', 'one 3–8 s 1080p clip (video_refer; URL only)')
    .option('--voice-id <id>', 'bind an existing voice')
    .option('--tag <o_1xx>', 'tag id, repeatable (o_101 Hottest … o_108 Others)', collect)
    .option('-w, --wait', 'poll until the element exists')
    .option('--callback-url <url>', 'vendor callback')
    .option('--external-task-id <id>', 'your own id')
    .action(async (o, cmd: Command) => {
      const g = globalsOf(cmd);
      const client = makeClient(g);
      const handle = await client.elements.create({
        name: o.name, description: o.description, referenceType: o.referenceType,
        frontalImage: o.frontalImage ? mediaArg(o.frontalImage) : undefined, referImages: o.referImage ? (o.referImage as string[]).map(mediaArg) : undefined,
        referVideos: o.referVideo ? [o.referVideo] : undefined, voiceId: o.voiceId, tags: o.tag as ElementTag[] | undefined,
        callbackUrl: o.callbackUrl, externalTaskId: o.externalTaskId,
      });
      await finishCreate(client, handle, g, common(o));
    });
  elements.command('get <taskId>').description('one creation task (the element id is in its output)').action(async (taskId, _o, cmd: Command) => {
    const g = globalsOf(cmd);
    printTasks(g, [await makeClient(g).elements.get(taskId)]);
  });
  page(elements.command('list').description('your custom elements')).action(async (o, cmd: Command) => {
    const g = globalsOf(cmd);
    printTasks(g, await makeClient(g).elements.list({ pageNum: o.page, pageSize: o.pageSize }));
  });
  page(elements.command('presets').description('the official element library')).action(async (o, cmd: Command) => {
    const g = globalsOf(cmd);
    printTasks(g, await makeClient(g).elements.presets({ pageNum: o.page, pageSize: o.pageSize }));
  });
  elements
    .command('delete <elementId>')
    .description('delete a custom element by ELEMENT id')
    .option('--kind <video|image>', 'which of the two vendor delete paths to call (same store)', 'video')
    .action(async (elementId, o, cmd: Command) => {
      const g = globalsOf(cmd);
      const r = await makeClient(g).elements.delete(elementId, { kind: o.kind });
      print(g, `deleted element ${elementId}${r.requestId ? ` (request ${r.requestId})` : ''}`, r);
    });

  const voices = program.command('voices').description('voice library');
  voices
    .command('create')
    .description('create a custom voice from an audio/video URL or a generated video id')
    .requiredOption('--name <text>', '≤ 20 characters')
    .option('--voice-url <url>', '.mp3/.wav/.mp4/.mov, one clean voice, 5–30 s (URL only)')
    .option('--video-id <id>', 'a 2.6-with-sound / avatar / lip-sync output')
    .option('-w, --wait', 'poll until the voice exists')
    .option('--callback-url <url>', 'vendor callback')
    .option('--external-task-id <id>', 'your own id')
    .action(async (o, cmd: Command) => {
      const g = globalsOf(cmd);
      const client = makeClient(g);
      await finishCreate(client, await client.voices.create({ name: o.name, voiceUrl: o.voiceUrl, videoId: o.videoId, callbackUrl: o.callbackUrl, externalTaskId: o.externalTaskId }), g, common(o));
    });
  voices.command('get <taskId>').description('one creation task').action(async (taskId, _o, cmd: Command) => {
    const g = globalsOf(cmd);
    printTasks(g, [await makeClient(g).voices.get(taskId)]);
  });
  page(voices.command('list').description('your custom voices')).action(async (o, cmd: Command) => {
    const g = globalsOf(cmd);
    printTasks(g, await makeClient(g).voices.list({ pageNum: o.page, pageSize: o.pageSize }));
  });
  page(voices.command('presets').description('the official voice library (not the TTS catalogue)')).action(async (o, cmd: Command) => {
    const g = globalsOf(cmd);
    printTasks(g, await makeClient(g).voices.presets({ pageNum: o.page, pageSize: o.pageSize }));
  });
  voices.command('delete <voiceId>').description('delete a custom voice by VOICE id').action(async (voiceId, _o, cmd: Command) => {
    const g = globalsOf(cmd);
    const r = await makeClient(g).voices.delete(voiceId);
    print(g, `deleted voice ${voiceId}`, r);
  });

  const avatar = program.command('avatar').description('talking-head video from an image and a sound');
  avatar
    .command('create')
    .requiredOption('--image <file|url>', 'portrait image')
    .option('--audio-id <id>', 'a TTS / voice output id (XOR --sound-file)')
    .option('--sound-file <file|url>', '.mp3/.wav/.m4a/.aac ≤ 5 MB, 2–300 s (XOR --audio-id)')
    .option('-p, --prompt <text>', 'actions, emotions, camera (≤ 2500)')
    .option('--mode <std|pro>', 'quality tier', 'std')
    .option('-w, --wait', 'poll until done')
    .option('--no-download', 'with --wait, do not save')
    .option('--with-watermark', 'with --wait, also save the watermarked variant')
    .option('--callback-url <url>', 'vendor callback')
    .option('--external-task-id <id>', 'your own id')
    .action(async (o, cmd: Command) => {
      const g = globalsOf(cmd);
      const client = makeClient(g);
      const handle = await client.avatar.create({ image: mediaArg(o.image), audioId: o.audioId, soundFile: o.soundFile ? mediaArg(o.soundFile) : undefined, prompt: o.prompt, mode: o.mode, callbackUrl: o.callbackUrl, externalTaskId: o.externalTaskId });
      await finishCreate(client, handle, g, { wait: o.wait, download: o.download, withWatermark: o.withWatermark });
    });

  const audio = program.command('audio').description('text to speech (synchronous)');
  audio
    .command('tts')
    .requiredOption('-t, --text <text>', '≤ 1000 characters')
    .requiredOption('--voice-id <id>', "from the vendor's TTS Voice Guide (e.g. oversea_male1) — not a presets-voices id")
    .requiredOption('--voice-language <zh|en>', 'language of the voice')
    .option('--voice-speed <0.8-2.0>', 'speech rate', num('voiceSpeed'))
    .action(async (o, cmd: Command) => {
      const g = globalsOf(cmd);
      const outputs = await makeClient(g).audio.tts({ text: o.text, voiceId: o.voiceId, voiceLanguage: o.voiceLanguage, voiceSpeed: o.voiceSpeed });
      print(g, outputs.map((a) => (a.type === 'audio' ? `audio ${a.id}${a.mp3DurationSeconds ? ` ${a.mp3DurationSeconds} s` : ''} ${a.mp3Url ?? ''}` : a.type)).join('\n'), { outputs });
    });
}
