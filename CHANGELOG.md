# Changelog

All notable changes to Agent Rules Hub are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-26

### Added
- local dashboard for inspecting supported CLI health, sources, configs, and managed files
- auto-discovery for common rule files and skill files across the 4 supported CLIs
- guarded local actions for Codex and OpenCode flows
- screenshot-backed README and launch-oriented documentation
- issue templates for open-source use

### Changed
- removed machine-specific paths from shareable files and scripts
- moved generated instruction outputs to local `generated/` build artifacts instead of versioned root dot-directories
- tightened public docs to match the actual 4-CLI scope
- removed internal-only repo artifacts from the publish snapshot

### Fixed
- corrected path portability for workspace, superpowers, and XDG config resolution
- aligned tests and scripts with the generated-output refactor
