> ## Documentation Index
>
> Fetch the complete documentation index at: https://kling.ai/document-api/llms.txt
> Use this file to discover all available pages before exploring further.

# Image Capability Map

> Source: https://kling.ai/document-api/guides/capability-map/image
> Locale: en
> Updated At: 2026-05-19
> This content is optimized for LLMs. UI-only controls are omitted.

Organized from the existing Image Models document, showing model, aspect ratio, and capability support for image APIs.

## Models

| Model | Description | Input | Generation Range | Resolution |
| --- | --- | --- | --- | --- |
| Kling Image 3.0 | Strengthen consistency, free multi-reference images, comprehensive effect upgrade | Text, Image | 16:9, 9:16, 1:1, 4:3, 3:4, 3:2, 2:3, 21:9 | 1K, 2K |
| Kling Image 3.0 Omni | Enhanced narrative expression, native 2K/4K ultra-high definition output, and image series generation | Text, Image | 16:9, 9:16, 1:1, 4:3, 3:4, 3:2, 2:3, 21:9, auto | 1K, 2K, 4K |
| Kling Image O1 | High feature consistency with precise detail editing and accurate style transfer. | Text, Image | 16:9, 9:16, 1:1, 4:3, 3:4, 3:2, 2:3, 21:9, auto | 1K, 2K |
| Kling Image 2.1 | Superb prompt adherence & reliable output | Text, Image | 16:9, 9:16, 1:1, 4:3, 3:4, 3:2, 2:3, 21:9 | 1K, 2K |

## Global Capabilities

| Capability | Value | Description |
| --- | --- | --- |
| Outpainting | All model versions | Supports expand content based on existing images |

## Text to Image

| Capability | Description | Kling Image 3.0 | Kling Image 3.0 Omni | Kling Image O1 | Kling Image 2.1 |
| --- | --- | --- | --- | --- | --- |
| Single Image Generation | - | Supported | Supported: Auto ratio is not supported | Supported | Supported |

## Image to Image

| Capability | Description | Kling Image 3.0 | Kling Image 3.0 Omni | Kling Image O1 | Kling Image 2.1 |
| --- | --- | --- | --- | --- | --- |
| Single Image Generation | - | Supported | Supported | Supported | Supported |
| Series Image Generation | - | Not Supported | Supported | Not Supported | Supported |
| Multi-image to Image | - | Not Supported | Supported | Supported | Supported |
| Character Feature Reference | - | Not Supported | Not Supported | Not Supported | Supported |
| Face Feature Reference | - | Not Supported | Not Supported | Not Supported | Supported |
| Style Training | - | Not Supported | Not Supported | Not Supported | Not Supported |
| Subject Control | - | Supported: Multi-image main image only | Supported: Multi-image main image only | Supported: Multi-image main image only | Not Supported |
