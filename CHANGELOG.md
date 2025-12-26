# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-12-25

### Added
- Initial release of kling-api wrapper
- Text-to-video generation with 6 model variants (kling-v1, kling-v1-6, kling-v2-master, kling-v2-1-master, kling-v2-5-turbo, kling-v2-6)
- Image-to-video animation with 8 model variants
- Image generation with 5 model variants (kling-v1, kling-v1-5, kling-v2, kling-v2-new, kling-v2-1)
- Image expansion (outpainting) with directional control
- Avatar/talking head creation with audio support
- JWT authentication with automatic token management and 5-minute buffer
- Camera control support (presets and fine-grained 6-axis configuration)
- Comprehensive TypeScript type definitions (118+ exported types)
- 314 tests with 89.93% statement coverage
- Production security features:
  - API key redaction in logs
  - SSRF protection with IPv4-mapped IPv6 bypass prevention
  - HTTPS enforcement
  - Error sanitization in production mode
  - Parameter validation before API calls
- Auto-polling with animated spinner UI
- Retry logic with exponential backoff (2s, 4s, 8s)
- Organized data storage with timestamped files and metadata JSON
- Submodule exports for tree-shaking optimization
