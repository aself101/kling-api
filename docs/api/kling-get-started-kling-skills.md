> ## Documentation Index
>
> Fetch the complete documentation index at: https://kling.ai/document-api/llms.txt
> Use this file to discover all available pages before exploring further.

# Kling Skills

> Source: https://kling.ai/document-api/api/get-started/kling-skills
> Locale: en
> Current Tab: Kling Skills
> This content is optimized for LLMs. In-page tabs are expanded and UI-only controls are omitted.

<p style="color: var(--color-text-3); font-size: 13px; margin-top: -4px;">Last updated: 2026/04/01 16:02</p>

---

::: info-box

KlingAI API Official Skill. Developers can leverage Kling AI Skill in third-party Agents to perform video generation, image generation, element management and other operations, with support for tools including Openclaw, Claude Code, Cursor, Codex, Copilot and Opencode. The system automatically selects subcommands (video / image / element) based on user intent and intelligently routes requests to the corresponding API endpoints.

<SkillCard icon="K" color="#2261f5" title="Kling AI Skill" clawHubButton="true" clawHubUrl="https://clawhub.ai/klingai-dev/klingai" buyButton="true" buyUrl="https://kling.ai/dev/pricing?scrollTo=video-package" buyText="Buy Resource Pack">
    <ul style="font-size: 12px !important;">
        <li style="font-size: 12px !important;">Video Generation (Text-to-Video, Image-to-Video, Video Editing Omni 3.0) — Supported models: kling-v3 / kling-v2-6 / kling-v3-omni / kling-video-o1</li>
        <li style="font-size: 12px !important;">Image Generation (Text-to-Image, Image-to-Image, 4K Image) —Supported models: kling-v3 / kling-v3-omni / kling-image-o1</li>
        <li style="font-size: 12px !important;">Element/Character Management — Create reusable characters and maintain character consistency across videos</li>
    </ul>
</SkillCard>

---

## User Guide

<div style="width: 60%; min-width: 600px;">
<video src="https://s15-kling.klingai.com/kos/s101/nlav112918/api-doc/videos/kling_skill_en.76195d45c9b98cc4.mp4" controls width="100%"></video>
</div>

## Skill Instructions

---

### Installation URL:

[https://clawhub.ai/klingai-dev/klingai](https://clawhub.ai/klingai-dev/klingai)

### Environment Requirements:

\*Node.js 18+, no other dependencies.

### Authentication Methods:

- When installing a skill, a URL will be provided for one‑click binding using your Kling account (recommended).
- To bind manually by obtaining AK/SK, run the following command:
  `node kling.mjs account --import-credentials --access_key_id <ak> --secret_access_key <sk>`
- Unable to access through API Key temporarily, expected to support within June

### Regions:

If KLING_API_BASE is not set, the script automatically detects and caches the China/Global endpoint. The region can be forcibly specified by setting KLING_API_BASE.

## Notes

- Fees are incurred for each submission. Please confirm before submitting if your intent is unclear.
- Video generation typically takes 1–5 minutes, image generation about 20–60 seconds, and element creation around 30 seconds–2 minutes.
- Generated assets are retained for 30 days; please download and save them in a timely manner.
- Bilingual interaction (Chinese & English) is supported, with automatic user language detection.
