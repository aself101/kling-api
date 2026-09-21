# Vendor documentation snapshot — Kling AI API

**Fetched:** 2026-09-20
**Index:** `https://kling.ai/document-api/llms.txt` — every page there is served as raw Markdown at `<page-url>.md`.
**Purpose:** the pinned source from which the `kling-api` 2.0 surface was derived
(`docs/specs/kling-api-2.0-migration-spec-v0_4_3.md`). Diff this directory against a fresh
fetch to see what the vendor changed.

## Coverage

| `llms.txt` section | Fetched | Notes |
|---|---|---|
| Docs (guides + get-started) | all 8 | `kling-guide-*`, `kling-get-started-*` |
| Video APIs | all 26 | model-family pages plus the shared resource pages (avatar, lip-sync, audio, elements, voices, multi-elements, recognition) |
| Image APIs | all 9 | `kling-image-*` — all still legacy `/v1/` endpoints |
| Effects & Solutions | `video-effects` only | the four e-commerce pages (apparel, goods studio, video commerce, virtual try-on) were not fetched — out of scope |
| Assets & Billing | all 3 | `kling-assets-*` |
| Pricing | `base/video`, `base/image` | `kling-pricing-*` — the two solutions-pricing pages (effects, ecommerce) were not fetched |
| Updates | `api` | `kling-updates-api.md` — the vendor's change log; the only place deprecations are announced |

50 files (48 fetched 2026-09-20 morning; the two pricing pages added the same day during spec revision v0.3.0). The vendor mounts several pages under more than one navigation path; each such
page was fetched once. Known multi-mount pairs whose bodies were verified byte-identical on
2026-09-20 (only the `> Source:` / `Current Tab` header lines differ) and which are both kept
because their `Source:` URLs differ: `kling-2.6-motion-control.md` ≡ `kling-motion-control-2.6.md`,
`kling-omni-3.0-motion-control.md` ≡ `kling-motion-control-3.0.md`,
`kling-o1-element-mgt.md` ≡ `kling-omni-3.0-element-mgt.md`,
`kling-2.6-voice-mgt.md` ≡ `kling-omni-3.0-voice-mgt.md`,
`kling-image-omni-3.0-image-omni.md` ≡ `kling-image-o1-generation.md`,
`kling-image-omni-3.0-generation.md` ≡ `kling-image-2.1-generation.md`.

## Naming

Files fetched on 2026-09-20 by script are named `kling-<section>-<slug>.md` after the URL path.
The earlier hand-copied files keep their original names (`kling-3.0-turbo-t2v.md`, …). The
"omni-3.0" prefix on `kling-omni-3.0-t2v.md`, `-i2v.md`, `-motion-control.md` follows the
vendor's *3-0-omni* nav tab; the endpoints on those pages target path model `kling-3.0`, not
`kling-3.0-omni` (only `kling-omni-3.0-ovg.md` does).

## Refresh

```bash
cd docs/api
curl -sfL https://kling.ai/document-api/llms.txt | grep -oE 'https://[^ ]+\.md' \
  | while read -r u; do
      p=${u#https://kling.ai/document-api/}; p=${p%.md}
      curl -sfL "$u" -o "fetched/$(echo "$p" | tr '/' '-').md"
    done
# then diff fetched/ against the committed files and update the snapshot deliberately
```

Do not hand-edit these files; they are vendor text.
