/** `kling video …` (spec D15; flags mirror §6.1 in kebab-case). */
import type { Command } from 'commander';
import type {
  AspectRatio,
  AudioMode,
  MotionControlParams,
  OmniVideoParams,
  Resolution,
} from '../codecs/params.js';
import {
  DEFAULT_MOTION_CONTROL_MODEL,
  DEFAULT_OMNI_VIDEO_MODEL,
  DEFAULT_VIDEO_MODEL,
} from '../config/models.js';
import {
  collect,
  elementArgs,
  finishCreate,
  globalsOf,
  handler,
  idAlias,
  int,
  makeClient,
  mediaArg,
  triState,
  type CreateFlagOptions,
} from './shared.js';

interface T2vOptions extends CreateFlagOptions {
  prompt: string;
  model: string;
  resolution?: Resolution;
  aspectRatio?: AspectRatio;
  duration?: number;
  audio?: AudioMode;
  multiShot?: boolean;
}
interface I2vOptions extends Omit<T2vOptions, 'aspectRatio'> {
  firstFrame: string;
  lastFrame?: string;
  element?: string[];
  voice?: string[];
}
interface OmniOptions extends T2vOptions {
  firstFrame?: string;
  lastFrame?: string;
  referImage?: string[];
  featureVideo?: string;
  baseVideo?: string;
  element?: string[];
}
interface MotionOptions extends CreateFlagOptions {
  model: string;
  prompt?: string;
  image: string;
  video: string;
  characterOrientation: 'image' | 'video';
  element?: string;
  audio?: 'original' | 'off';
  resolution?: '720p' | '1080p';
}

function createFlags(cmd: Command): Command {
  return cmd
    .option('-w, --wait', 'poll until the task finishes (default: submit and print the id)')
    .option('--no-download', 'with --wait, do not save the outputs')
    .option('--with-watermark', 'with --wait, also save the watermarked variants')
    .option('--callback-url <url>', 'vendor callback (see `parseCallback`)')
    .option(
      '--external-task-id <id>',
      'your own id (default: a generated UUID — the recovery key)'
    );
}

const common = (o: CreateFlagOptions): CreateFlagOptions => ({
  wait: o.wait,
  download: o.download,
  withWatermark: o.withWatermark,
  callbackUrl: o.callbackUrl,
  externalTaskId: o.externalTaskId,
});

/** `file|url[:alias]` — the alias is the `@name` the prompt uses. A trailing `:word` on a URL with a port is not an alias risk: ports are digits after a host, aliases follow the whole path. */
function referImageArg(v: string): { source: ReturnType<typeof mediaArg>; id?: string } {
  // The regex is total today (the first group is optional-lazy), so `m` is never null — but the
  // fallbacks are real code, not decoration: an edit that makes it partial degrades to "the whole
  // value is the source" instead of crashing (ship run #5, type-safety PRA-DOC/L).
  const m = /^(.*?)(?::([A-Za-z_][A-Za-z0-9_-]*))?$/.exec(v);
  const source = mediaArg(m?.[1] ?? v);
  return { source, ...(m?.[2] ? { id: m[2] } : {}) };
}

export function registerVideo(program: Command): void {
  const video = program.command('video').description('video generation on the new API standard');

  createFlags(
    video
      .command('t2v')
      .description('text to video')
      .requiredOption(
        '-p, --prompt <text>',
        'prompt (≤ 3072 chars on 3.0-era models, ≤ 2500 on 2.x)'
      )
      .option(
        '-m, --model <id>',
        'kling-3.0-turbo | kling-3.0 | kling-2.6 | kling-2.5-turbo',
        DEFAULT_VIDEO_MODEL
      )
      .option('-r, --resolution <res>', '720p | 1080p | 4k (3.0 only)')
      .option('-a, --aspect-ratio <ratio>', '16:9 | 9:16 | 1:1')
      .option('-d, --duration <seconds>', '3–15 (3.0-era) | 5, 10 (2.x)', int('duration'))
      .option('--audio <mode>', 'native | off (not on kling-3.0-turbo: always on)')
      .option('--multi-shot', 'settings.multi_shot = true (kling-3.0)')
      .option('--no-multi-shot', 'settings.multi_shot = false (kling-3.0)')
  ).action(
    handler<T2vOptions>(async (o, cmd) => {
      const g = globalsOf(cmd);
      const client = makeClient(g);
      const handle = await client.video.textToVideo({
        model: o.model,
        prompt: o.prompt,
        resolution: o.resolution,
        aspectRatio: o.aspectRatio,
        duration: o.duration,
        audio: o.audio,
        multiShot: triState(o.multiShot),
        callbackUrl: o.callbackUrl,
        externalTaskId: o.externalTaskId,
      });
      await finishCreate(client, handle, g, common(o));
    })
  );

  createFlags(
    video
      .command('i2v')
      .description('image to video (first frame, optional last frame)')
      .requiredOption('-p, --prompt <text>', 'prompt')
      .requiredOption('--first-frame <file|url>', 'first frame image')
      .option(
        '--last-frame <file|url>',
        'last frame image (not on kling-3.0-turbo; 1080p only on 2.x)'
      )
      .option(
        '-m, --model <id>',
        'kling-3.0-turbo | kling-3.0 | kling-2.6 | kling-2.5-turbo',
        DEFAULT_VIDEO_MODEL
      )
      .option('-r, --resolution <res>', '720p | 1080p | 4k (3.0 only)')
      .option('-d, --duration <seconds>', '3–15 (3.0-era) | 5, 10 (2.x)', int('duration'))
      .option('--audio <mode>', 'native | off')
      .option('--multi-shot', 'settings.multi_shot = true (kling-3.0)')
      .option('--no-multi-shot', 'settings.multi_shot = false (kling-3.0)')
      .option('--element <id[:alias]>', 'element reference, repeatable (kling-3.0, ≤ 3)', collect)
      .option('--voice <id[:alias]>', 'voice reference, repeatable (kling-2.6, ≤ 2)', collect)
  ).action(
    handler<I2vOptions>(async (o, cmd) => {
      const g = globalsOf(cmd);
      const client = makeClient(g);
      const handle = await client.video.imageToVideo({
        model: o.model,
        prompt: o.prompt,
        firstFrame: mediaArg(o.firstFrame),
        lastFrame: o.lastFrame ? mediaArg(o.lastFrame) : undefined,
        resolution: o.resolution,
        duration: o.duration,
        audio: o.audio,
        multiShot: triState(o.multiShot),
        elements: elementArgs(o.element),
        voices: idAlias('voiceId', o.voice),
        callbackUrl: o.callbackUrl,
        externalTaskId: o.externalTaskId,
      });
      await finishCreate(client, handle, g, common(o));
    })
  );

  createFlags(
    video
      .command('omni')
      .description('omni video: frames, reference images, a reference video, elements')
      .requiredOption('-p, --prompt <text>', 'prompt (@image_1, @video_1, @element_1 …)')
      .option('-m, --model <id>', 'kling-3.0-omni | kling-o1', DEFAULT_OMNI_VIDEO_MODEL)
      .option('--first-frame <file|url>', 'first frame (auto id image_1)')
      .option('--last-frame <file|url>', 'last frame')
      .option('--refer-image <file|url[:alias]>', 'reference image, repeatable', collect)
      .option(
        '--feature-video <url>',
        'reference video for motion/shots (URL only; forces audio off)'
      )
      .option(
        '--base-video <url>',
        'video to edit (URL only; no frames, no multi-shot, audio ≠ native)'
      )
      .option('--element <id[:alias]>', 'element reference, repeatable', collect)
      .option('-r, --resolution <res>', '720p | 1080p | 4k (3.0-omni)')
      .option(
        '-a, --aspect-ratio <ratio>',
        '16:9 | 9:16 | 1:1 (needed without a first frame / reference video)'
      )
      .option('-d, --duration <seconds>', '3–15 (3.0-omni) | 3–10 (o1)', int('duration'))
      .option('--audio <mode>', 'native | original | off')
      .option('--multi-shot', 'settings.multi_shot = true (3.0-omni)')
      .option('--no-multi-shot', 'settings.multi_shot = false (3.0-omni)')
  ).action(
    handler<OmniOptions>(async (o, cmd) => {
      const g = globalsOf(cmd);
      const client = makeClient(g);
      const params: OmniVideoParams = {
        model: o.model,
        prompt: o.prompt,
        firstFrame: o.firstFrame ? mediaArg(o.firstFrame) : undefined,
        lastFrame: o.lastFrame ? mediaArg(o.lastFrame) : undefined,
        referImages: o.referImage?.map(referImageArg),
        featureVideo: o.featureVideo ? { url: o.featureVideo } : undefined,
        baseVideo: o.baseVideo ? { url: o.baseVideo } : undefined,
        elements: elementArgs(o.element),
        resolution: o.resolution,
        aspectRatio: o.aspectRatio,
        duration: o.duration,
        audio: o.audio,
        multiShot: triState(o.multiShot),
        callbackUrl: o.callbackUrl,
        externalTaskId: o.externalTaskId,
      };
      await finishCreate(client, await client.video.omni(params), g, common(o));
    })
  );

  createFlags(
    video
      .command('motion-control')
      .description('animate a character image with the motion of a reference video')
      .requiredOption('--image <file|url>', 'appearance reference image')
      .requiredOption(
        '--video <url>',
        'motion reference video (URL only; ≤ 10 s with image orientation, ≤ 30 s with video)'
      )
      .requiredOption('--character-orientation <image|video>', 'follow the image or the video')
      .option('-m, --model <id>', 'kling-3.0 | kling-2.6', DEFAULT_MOTION_CONTROL_MODEL)
      .option('-p, --prompt <text>', 'prompt')
      .option('--element <id[:alias]>', 'one element (kling-3.0)')
      .option('--audio <mode>', 'original | off')
      .option('-r, --resolution <res>', '720p | 1080p')
  ).action(
    handler<MotionOptions>(async (o, cmd) => {
      const g = globalsOf(cmd);
      const client = makeClient(g);
      const params: MotionControlParams = {
        model: o.model,
        prompt: o.prompt,
        image: mediaArg(o.image),
        video: o.video,
        characterOrientation: o.characterOrientation,
        element: o.element ? elementArgs([o.element])?.[0] : undefined,
        audio: o.audio,
        resolution: o.resolution,
        callbackUrl: o.callbackUrl,
        externalTaskId: o.externalTaskId,
      };
      await finishCreate(client, await client.video.motionControl(params), g, common(o));
    })
  );
}
