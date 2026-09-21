/** `kling image …` (spec D15, D7). */
import type { Command } from 'commander';
import { DEFAULT_IMAGE_MODEL, DEFAULT_OMNI_IMAGE_MODEL } from '../config/models.js';
import type { ImageAspectRatio, ImageResolution } from '../codecs/params.js';
import {
  collect,
  finishCreate,
  globalsOf,
  handler,
  int,
  makeClient,
  mediaArg,
  num,
  type CreateFlagOptions,
} from './shared.js';

interface GenerateOptions extends CreateFlagOptions {
  prompt: string;
  model: string;
  negativePrompt?: string;
  image?: string;
  imageReference?: 'subject' | 'face';
  imageFidelity?: number;
  humanFidelity?: number;
  element?: string[];
  resolution?: '1k' | '2k';
  count?: number;
  aspectRatio?: ImageAspectRatio;
}
interface OmniImageOptions extends CreateFlagOptions {
  prompt: string;
  model: string;
  image?: string[];
  element?: string[];
  resolution?: ImageResolution;
  resultType?: 'single' | 'series';
  seriesAmount?: string;
  count?: number;
  aspectRatio?: ImageAspectRatio | 'auto';
}
interface MultiOptions extends CreateFlagOptions {
  subject: string[];
  prompt?: string;
  scene?: string;
  style?: string;
  count?: number;
  aspectRatio?: ImageAspectRatio;
}
interface OutpaintOptions extends CreateFlagOptions {
  image: string;
  up: number;
  down: number;
  left: number;
  right: number;
  prompt?: string;
  count?: number;
}
interface SubjectOptions extends CreateFlagOptions {
  frontalImage: string;
}

function createFlags(cmd: Command): Command {
  return cmd
    .option('-w, --wait', 'poll until the task finishes')
    .option('--no-download', 'with --wait, do not save the outputs')
    .option('--with-watermark', 'with --wait, also save the watermarked variants')
    .option('--callback-url <url>', 'vendor callback')
    .option('--external-task-id <id>', 'your own id (default: a generated UUID)');
}
const common = (o: CreateFlagOptions): CreateFlagOptions => ({
  wait: o.wait,
  download: o.download,
  withWatermark: o.withWatermark,
  callbackUrl: o.callbackUrl,
  externalTaskId: o.externalTaskId,
});
const elements = (ids: string[] | undefined) => ids?.map((elementId) => ({ elementId }));

export function registerImage(program: Command): void {
  const image = program.command('image').description('image generation on the legacy /v1 standard');

  createFlags(
    image
      .command('generate')
      .description('text (and optional reference image) to image')
      .requiredOption('-p, --prompt <text>', 'prompt (≤ 2500)')
      .option('-m, --model <id>', 'kling-v3 | kling-v2-1', DEFAULT_IMAGE_MODEL)
      .option('--negative-prompt <text>', 'negative prompt')
      .option('--image <file|url>', 'reference image')
      .option('--image-reference <subject|face>', 'reference type (kling-v2-1 only)')
      .option('--image-fidelity <0-1>', 'reference strength', num('imageFidelity'))
      .option(
        '--human-fidelity <0-1>',
        'facial similarity (kling-v2-1; effective with --image-reference subject)',
        num('humanFidelity')
      )
      .option('--element <id>', 'element id, repeatable', collect)
      .option('-r, --resolution <res>', '1k | 2k')
      .option('-n, --count <n>', 'images to generate, 1–9', int('n'))
      .option('-a, --aspect-ratio <ratio>', '16:9 | 9:16 | 1:1 | 4:3 | 3:4 | 3:2 | 2:3 | 21:9')
  ).action(
    handler<GenerateOptions>(async (o, cmd) => {
      const g = globalsOf(cmd);
      const client = makeClient(g);
      const handle = await client.image.generate({
        model: o.model,
        prompt: o.prompt,
        negativePrompt: o.negativePrompt,
        image: o.image ? mediaArg(o.image) : undefined,
        imageReference: o.imageReference,
        imageFidelity: o.imageFidelity,
        humanFidelity: o.humanFidelity,
        elements: elements(o.element),
        resolution: o.resolution,
        n: o.count,
        aspectRatio: o.aspectRatio,
        callbackUrl: o.callbackUrl,
        externalTaskId: o.externalTaskId,
      });
      await finishCreate(client, handle, g, common(o));
    })
  );

  createFlags(
    image
      .command('omni')
      .description('omni image: prompt + reference images/elements, single or series')
      .requiredOption('-p, --prompt <text>', 'prompt (<<image_1>> references)')
      .option('-m, --model <id>', 'kling-v3-omni | kling-image-o1', DEFAULT_OMNI_IMAGE_MODEL)
      .option('--image <file|url>', 'reference image, repeatable (images + elements ≤ 10)', collect)
      .option('--element <id>', 'element id, repeatable', collect)
      .option('-r, --resolution <res>', '1k | 2k | 4k (kling-v3-omni)')
      .option('--result-type <single|series>', 'one image or a series')
      .option('--series-amount <2-9|auto>', 'with --result-type series')
      .option('-n, --count <n>', 'images, 1–9 (ignored for series)', int('n'))
      .option('-a, --aspect-ratio <ratio>', '16:9 … 21:9 | auto')
  ).action(
    handler<OmniImageOptions>(async (o, cmd) => {
      const g = globalsOf(cmd);
      const client = makeClient(g);
      const handle = await client.image.omni({
        model: o.model,
        prompt: o.prompt,
        images: o.image?.map(mediaArg),
        elements: elements(o.element),
        resolution: o.resolution,
        resultType: o.resultType,
        seriesAmount:
          o.seriesAmount === undefined
            ? undefined
            : o.seriesAmount === 'auto'
              ? 'auto'
              : int('seriesAmount')(o.seriesAmount),
        n: o.count,
        aspectRatio: o.aspectRatio,
        callbackUrl: o.callbackUrl,
        externalTaskId: o.externalTaskId,
      });
      await finishCreate(client, handle, g, common(o));
    })
  );

  createFlags(
    image
      .command('multi')
      .description('multi-image to image (kling-v2-1): subjects + optional scene/style')
      .requiredOption('--subject <file|url>', 'subject image, repeatable (1–4)', collect)
      .option('-p, --prompt <text>', 'prompt')
      .option('--scene <file|url>', 'scene reference')
      .option('--style <file|url>', 'style reference')
      .option('-n, --count <n>', 'images, 1–9', int('n'))
      .option('-a, --aspect-ratio <ratio>', '16:9 … 21:9')
  ).action(
    handler<MultiOptions>(async (o, cmd) => {
      const g = globalsOf(cmd);
      const client = makeClient(g);
      const handle = await client.image.multiImageToImage({
        prompt: o.prompt,
        subjectImages: o.subject.map(mediaArg),
        sceneImage: o.scene ? mediaArg(o.scene) : undefined,
        styleImage: o.style ? mediaArg(o.style) : undefined,
        n: o.count,
        aspectRatio: o.aspectRatio,
        callbackUrl: o.callbackUrl,
        externalTaskId: o.externalTaskId,
      });
      await finishCreate(client, handle, g, common(o));
    })
  );

  createFlags(
    image
      .command('outpaint')
      .description('expand an image outward (renamed from 1.x expand)')
      .requiredOption('--image <file|url>', 'source image')
      .option('--up <ratio>', 'multiple of the height, 0–2', num('up'), 0)
      .option('--down <ratio>', 'multiple of the height, 0–2', num('down'), 0)
      .option('--left <ratio>', 'multiple of the width, 0–2', num('left'), 0)
      .option('--right <ratio>', 'multiple of the width, 0–2', num('right'), 0)
      .option('-p, --prompt <text>', 'prompt')
      .option('-n, --count <n>', 'images, 1–9', int('n'))
  ).action(
    handler<OutpaintOptions>(async (o, cmd) => {
      const g = globalsOf(cmd);
      const client = makeClient(g);
      const handle = await client.image.outpaint({
        image: mediaArg(o.image),
        up: o.up,
        down: o.down,
        left: o.left,
        right: o.right,
        prompt: o.prompt,
        n: o.count,
        callbackUrl: o.callbackUrl,
        externalTaskId: o.externalTaskId,
      });
      await finishCreate(client, handle, g, common(o));
    })
  );

  createFlags(
    image
      .command('subject-completion')
      .description('three views of a subject from one frontal image (feeds element creation)')
      .requiredOption('--frontal-image <file|url>', 'frontal image')
  ).action(
    handler<SubjectOptions>(async (o, cmd) => {
      const g = globalsOf(cmd);
      const client = makeClient(g);
      await finishCreate(
        client,
        await client.image.subjectCompletion({
          frontalImage: mediaArg(o.frontalImage),
          callbackUrl: o.callbackUrl,
          externalTaskId: o.externalTaskId,
        }),
        g,
        common(o)
      );
    })
  );
}
