# Publishing 2.0.0

Everything below the line is done. The two steps above it need your npm account.

```bash
cd ~/uluops/misc/npm-packages/kling-api
git checkout main && git pull --ff-only          # should be a no-op: main is a7203dd, tagged v2.0.0

npm publish                                       # no --registry → npmjs

# AFTER the publish lands, not before — deprecating <2.0.0 while 1.0.0 is the only
# published version would leave installers with nothing:
npm deprecate kling-api@"<2.0.0" "1.x cannot reach the current Kling API — see https://github.com/aself101/kling-api#migration-from-1x"
```

### The artifact you are promoting

The tarball validated against a clean consumer has **shasum `fd0abffff7ce7d9b4ad9110ec4dc1fa08f53e190`**
(160 files, 785 KB unpacked). `npm pack --dry-run --json` from `main` reproduces exactly that
shasum, so publishing from `main` ships the bytes that were tested. After publishing:

```bash
npm view kling-api@2.0.0 dist.shasum   # → fd0abffff7ce7d9b4ad9110ec4dc1fa08f53e190
```

The `v2.0.0` tag points at `a7203dd`, one commit behind `main` — the extra commit adds this
file, which `package.json#files` does not ship. The tag marks the code that ships; the shasum
above is the proof that the difference is not in the artifact. The tag was not moved because
it is already pushed.

Then confirm the promotion actually happened — a Verdaccio validation says nothing about npmjs:

```bash
npm view kling-api version --prefer-online        # → 2.0.0
npm view kling-api@9.9.9 version                  # → must ERROR, or the check is inert
npm view kling-api deprecated                     # 1.x rows should carry the notice
```

npm publishes the packument ahead of CDN tarball propagation (~100 s observed elsewhere in
this workspace), so a consumer install in the first minutes can 404 on the tarball even
though `npm view` reports 2.0.0. That is propagation, not a failed publish. Wait it out
rather than republishing.

---

## What is already done

- `main` fast-forwarded to `a7203dd`, tagged `v2.0.0` (annotated), both pushed. CI green on
  Node 20 and 22.
- 514 tests, lint clean, no circular deps, clean rebuild from scratch.
- Version consistent across `package.json`, the CLI binary and the CHANGELOG entry.
- Lockfile free of `localhost:4873`; no stray `.npmrc` in the repo.
- The exact artifact was published to local Verdaccio and installed from the registry into a
  clean consumer: tree contains no `src/`, `test/`, `scripts/`, `docs/` or `.env`; `main`,
  `types` and `bin` all resolve; the bin runs; a strict TypeScript consumer compiles against
  it with `skipLibCheck` **off** and no explicit `@types/node`; 66 runtime exports resolve
  under ESM and CJS `require()` is refused, as intended.

## What is deliberately still open

- **Webhook envelope** — unverifiable without a public receiver. The HMAC is verified against
  the vendor's published test vector; header names and the `id`/`task_id` discriminator are
  documented-not-observed, and the README says so.
- **Duplicate `external_task_id` after a *failed* original** — every other scope is confirmed
  refused (`1201`/not-created), including across products. Forcing a failure means tripping
  moderation or paying for a task built to break.
- **What a failed task costs** — neither vendor-documented nor measured.
- **SSRF connection pinning** — not default; it needs a fourth runtime dependency to close a
  hole that requires controlling the vendor's own CDN DNS. A tested pinned-`fetch` recipe
  ships in the README instead.
