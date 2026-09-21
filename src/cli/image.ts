/** `kling image …` (spec D15, D7). */
import type { Command } from 'commander';
import { DEFAULT_IMAGE_MODEL, DEFAULT_OMNI_IMAGE_MODEL } from '../config/models.js';
import { collect, finishCreate, globalsOf, int, makeClient, mediaArg, num, type CreateOptions } from './shared.js';

function createFlags(cmd: Command): Command {
  return cmd
    .option('-w, --wait', 'poll until the task finishes')
    .option('--no-download', 'with --wait, do not save the outputs')
    .option('--with-watermark', 'with --wait, also save the watermarked variants')
    .option('--callback-url <url>', 'vendor callback')
    .option('--external-task-id <id>', 'your own id (default: a generated UUID)');
}
const common = (o: Record<string, unknown>): CreateOptions => ({ wait: o.wait as boolean | undefined, download: o.download as boolean | undefined, withWatermark: o.withWatermark as boolean | undefined, callbackUrl: o.callbackUrl as string | undefined, externalTaskId: o.externalTaskId as string | undefined });
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
      .option('--human-fidelity <0-1>', 'facial similarity (kling-v2-1; effective with --image-reference subject)', num('humanFidelity'))
      .option('--element <id>', 'element id, repeatable', collect)
      .option('-r, --resolution <res>', '1k | 2k')
      .option('-n, --count <n>', 'images to generate, 1–9', int('n'))
      .option('-a, --aspect-ratio <ratio>', '16:9 | 9:16 | 1:1 | 4:3 | 3:4 | 3:2 | 2:3 | 21:9')
  ).action(async (o, cmd: Command) => {
    const g = globalsOf(cmd);
    const client = makeClient(g);
    const handle = await client.image.generate({
      model: o.model, prompt: o.prompt, negativePrompt: o.negativePrompt, image: o.image ? mediaArg(o.image) : undefined, imageReference: o.imageReference,
      imageFidelity: o.imageFidelity, humanFidelity: o.humanFidelity, elements: elements(o.element), resolution: o.resolution, n: o.count, aspectRatio: o.aspectRatio,
      callbackUrl: o.callbackUrl, externalTaskId: o.externalTaskId,
    });
    await finishCreate(client, handle, g, common(o));
  });

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
  ).action(async (o, cmd: Command) => {
    const g = globalsOf(cmd);
    const client = makeClient(g);
    const handle = await client.image.omni({
      model: o.model, prompt: o.prompt, images: o.image ? (o.image as string[]).map(mediaArg) : undefined, elements: elements(o.element), resolution: o.resolution,
      resultType: o.resultType, seriesAmount: o.seriesAmount === undefined ? undefined : o.seriesAmount === 'auto' ? 'auto' : int('seriesAmount')(o.seriesAmount),
      n: o.count, aspectRatio: o.aspectRatio, callbackUrl: o.callbackUrl, externalTaskId: o.externalTaskId,
    });
    await finishCreate(client, handle, g, common(o));
  });

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
  ).action(async (o, cmd: Command) => {
    const g = globalsOf(cmd);
    const client = makeClient(g);
    const handle = await client.image.multiImageToImage({
      prompt: o.prompt, subjectImages: (o.subject as string[]).map(mediaArg), sceneImage: o.scene ? mediaArg(o.scene) : undefined, styleImage: o.style ? mediaArg(o.style) : undefined,
      n: o.count, aspectRatio: o.aspectRatio, callbackUrl: o.callbackUrl, externalTaskId: o.externalTaskId,
    });
    await finishCreate(client, handle, g, common(o));
  });

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
  ).action(async (o, cmd: Command) => {
    const g = globalsOf(cmd);
    const client = makeClient(g);
    const handle = await client.image.outpaint({ image: mediaArg(o.image), up: o.up, down: o.down, left: o.left, right: o.right, prompt: o.prompt, n: o.count, callbackUrl: o.callbackUrl, externalTaskId: o.externalTaskId });
    await finishCreate(client, handle, g, common(o));
  });

  createFlags(
    image
      .command('subject-completion')
      .description('three views of a subject from one frontal image (feeds element creation)')
      .requiredOption('--frontal-image <file|url>', 'frontal image')
  ).action(async (o, cmd: Command) => {
    const g = globalsOf(cmd);
    const client = makeClient(g);
    await finishCreate(client, await client.image.subjectCompletion({ frontalImage: mediaArg(o.frontalImage), callbackUrl: o.callbackUrl, externalTaskId: o.externalTaskId }), g, common(o));
  });
}
