/**
 * Image parameter rules (spec D7, D9; App. B §4.2; spec §2.3). Legacy bodies are flat, so
 * `extraSettings` merges at the top level and is checked against MODELED_LEGACY_FIELDS.
 */
import type { ImageGenerateParams, KnownImageModel, MultiImageToImageParams, OmniImageParams, OutpaintParams, SubjectCompletionParams } from '../../codecs/params.js';
import { MODELED_LEGACY_FIELDS } from '../constants.js';
import { IMAGE_MODELS, type ImageModelCaps } from '../models.js';
import { KlingValidationError } from '../../http/errors.js';
import { capability, isInteger, rejectModeledExtras, shape, type ValidationPolicy } from './helpers.js';

const MAX_PROMPT_IMAGE = 2500;
const IMAGE_RATIOS = new Set(['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3', '21:9']);
/** `kling-image-omni-3.0-image-omni.md`: "The sum of reference elements and reference images must not exceed 10". */
const OMNI_IMAGE_REFS_MAX = 10;
/** `kling-image-common-outpainting.md` (1.x MAX_TOTAL_EXPANSION retained): the expanded area may not exceed 3× the source. */
export const MAX_TOTAL_EXPANSION = 3;

/** Capability row for an image model id, or undefined for an unknown id under passthrough (with a warning). */
export function resolveImageCaps(model: string, policy: ValidationPolicy): ImageModelCaps | undefined {
  if (Object.prototype.hasOwnProperty.call(IMAGE_MODELS, model)) return IMAGE_MODELS[model as KnownImageModel];
  if (policy.unknownModels === 'reject') {
    throw new KlingValidationError('model', `unknown image model ${JSON.stringify(model)}; known: ${Object.keys(IMAGE_MODELS).join(', ')} (unknownModels: 'reject')`);
  }
  policy.warn(`model ${JSON.stringify(model)} is not in this library's capability registry — sent with shape-only validation (unknownModels: 'passthrough')`);
  return undefined;
}

function commonShape(params: { prompt?: string; n?: number; callbackUrl?: string; extraSettings?: Record<string, unknown> }, promptRequired: boolean): void {
  if (promptRequired) shape(typeof params.prompt === 'string' && params.prompt.trim().length > 0, 'prompt', 'prompt is required and must be a non-empty string');
  if (params.prompt !== undefined) shape(params.prompt.length <= MAX_PROMPT_IMAGE, 'prompt', `prompt is ${params.prompt.length} characters; image endpoints allow at most ${MAX_PROMPT_IMAGE}`);
  // [shape] n: "Value range: [1, 9]" on every image page that has it.
  shape(params.n === undefined || (isInteger(params.n) && params.n >= 1 && params.n <= 9), 'n', 'n must be an integer in 1–9');
  shape(params.callbackUrl === undefined || /^https?:\/\//.test(params.callbackUrl), 'callbackUrl', 'callbackUrl must be an http(s) URL');
  rejectModeledExtras(params.extraSettings, MODELED_LEGACY_FIELDS, 'extraSettings');
}

const unit = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

export function validateImageGenerate(params: ImageGenerateParams, caps: ImageModelCaps | undefined, policy: ValidationPolicy): void {
  const product = 'image-generation';
  const model = params.model ?? caps?.id ?? '(unknown)';
  commonShape(params, true);
  // [shape] fidelities ∈ [0, 1] (kling-image-2.1-generation.md "Value range: [0, 1]").
  shape(params.imageFidelity === undefined || unit(params.imageFidelity), 'imageFidelity', 'imageFidelity must be a number in [0, 1]');
  shape(params.humanFidelity === undefined || unit(params.humanFidelity), 'humanFidelity', 'humanFidelity must be a number in [0, 1]');
  shape(params.imageReference === undefined || params.imageReference === 'subject' || params.imageReference === 'face', 'imageReference', "imageReference must be 'subject' or 'face'");
  // [shape] imageReference / fidelities describe the reference image — without one they are meaningless.
  shape(params.imageReference === undefined || params.image !== undefined, 'imageReference', 'imageReference requires image');
  params.elements?.forEach((e, i) => shape(typeof e.elementId === 'string' && e.elementId.length > 0, `elements[${i}].elementId`, `elements[${i}].elementId is required`));
  shape(params.aspectRatio === undefined || IMAGE_RATIOS.has(params.aspectRatio), 'aspectRatio', `aspectRatio must be one of ${[...IMAGE_RATIOS].join(', ')} (no auto on /v1/images/generations)`);
  // humanFidelity "only takes effect when image_reference is subject" — a warning, not an error (the vendor accepts and ignores it).
  if (params.humanFidelity !== undefined && params.imageReference !== 'subject') {
    policy.warn(`humanFidelity is set but imageReference is ${params.imageReference === undefined ? 'unset' : `'${params.imageReference}'`} — the vendor says it "only takes effect when image_reference is subject"`);
  }
  if (!caps) return;
  capability(caps.products.includes(product), 'model', `${model} has no /v1/images/generations endpoint (products: ${caps.products.join(', ')})`, policy);
  const resolutions = caps.resolutions[product] ?? [];
  if (params.resolution !== undefined) capability(resolutions.includes(params.resolution), 'resolution', `${model} accepts resolution ${resolutions.join(' | ')}, not ${params.resolution}`, policy);
  // [capability] image_reference / human_fidelity are kling-v2-1 only (spec §2.3; capability map: Character / Face Feature Reference).
  if (params.imageReference !== undefined) capability(caps.featureReference, 'imageReference', `imageReference is supported by kling-v2-1 only, not ${model}`, policy);
  if (params.humanFidelity !== undefined) capability(caps.featureReference, 'humanFidelity', `humanFidelity is supported by kling-v2-1 only, not ${model}`, policy);
}

export function validateOmniImage(params: OmniImageParams, caps: ImageModelCaps | undefined, policy: ValidationPolicy): void {
  const product = 'omni-image';
  const model = params.model ?? caps?.id ?? '(unknown)';
  commonShape(params, true);
  shape(params.images === undefined || Array.isArray(params.images), 'images', 'images must be an array of MediaSources');
  params.elements?.forEach((e, i) => shape(typeof e.elementId === 'string' && e.elementId.length > 0, `elements[${i}].elementId`, `elements[${i}].elementId is required`));
  const refs = (params.images?.length ?? 0) + (params.elements?.length ?? 0);
  // [shape] "The sum of reference elements and reference images must not exceed 10".
  shape(refs <= OMNI_IMAGE_REFS_MAX, 'images', `reference images + elements must total at most ${OMNI_IMAGE_REFS_MAX} (got ${refs})`);
  shape(params.resultType === undefined || params.resultType === 'single' || params.resultType === 'series', 'resultType', "resultType must be 'single' or 'series'");
  shape(params.seriesAmount === undefined || params.seriesAmount === 'auto' || (isInteger(params.seriesAmount) && params.seriesAmount >= 2 && params.seriesAmount <= 9), 'seriesAmount', "seriesAmount must be an integer in 2–9 or 'auto'");
  // [shape] series_amount "When result_type is single, this parameter is invalid" — sending it with single is a caller mistake.
  shape(params.seriesAmount === undefined || params.resultType === 'series', 'seriesAmount', "seriesAmount is only meaningful with resultType: 'series'");
  shape(params.aspectRatio === undefined || params.aspectRatio === 'auto' || IMAGE_RATIOS.has(params.aspectRatio), 'aspectRatio', `aspectRatio must be one of ${[...IMAGE_RATIOS].join(', ')} or auto`);
  if (!caps) return;
  capability(caps.products.includes(product), 'model', `${model} has no /v1/images/omni-image endpoint (products: ${caps.products.join(', ')})`, policy);
  const resolutions = caps.resolutions[product] ?? [];
  if (params.resolution !== undefined) capability(resolutions.includes(params.resolution), 'resolution', `${model} accepts resolution ${resolutions.join(' | ')}, not ${params.resolution} (capability map: 4K is Kling Image 3.0 Omni only)`, policy);
  if (params.resultType === 'series') capability(caps.series, 'resultType', `${model} does not support series generation (capability map: "Series Image Generation — Not Supported")`, policy);
}

export function validateMultiImageToImage(params: MultiImageToImageParams, policy: ValidationPolicy): void {
  commonShape(params, false);
  // [shape] subject_image_list required, 1–4 (kling-image-2.1-multi-image-to-image.md).
  shape(Array.isArray(params.subjectImages) && params.subjectImages.length >= 1 && params.subjectImages.length <= 4, 'subjectImages', 'subjectImages must hold 1–4 images');
  shape(params.aspectRatio === undefined || IMAGE_RATIOS.has(params.aspectRatio), 'aspectRatio', `aspectRatio must be one of ${[...IMAGE_RATIOS].join(', ')}`);
  void policy;
}

export function validateOutpaint(params: OutpaintParams): void {
  commonShape(params, false);
  shape(params.image !== undefined && params.image !== null, 'image', 'image is required');
  for (const side of ['up', 'down', 'left', 'right'] as const) {
    const v = params[side];
    shape(typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 2, side, `${side} must be a number in [0, 2] (a multiple of the source ${side === 'up' || side === 'down' ? 'height' : 'width'})`);
  }
  const area = (1 + params.up + params.down) * (1 + params.left + params.right);
  shape(area <= MAX_TOTAL_EXPANSION, 'up', `the expanded image would be ${area.toFixed(2)}× the source area; the vendor allows at most ${MAX_TOTAL_EXPANSION}×`);
}

export function validateSubjectCompletion(params: SubjectCompletionParams): void {
  shape(params.frontalImage !== undefined && params.frontalImage !== null, 'frontalImage', 'frontalImage is required');
  shape(params.callbackUrl === undefined || /^https?:\/\//.test(params.callbackUrl), 'callbackUrl', 'callbackUrl must be an http(s) URL');
}
