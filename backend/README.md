# Backend — NAS Terminal Server Agent

**Status:** Planned (Sub-project 2)

This directory will contain a lightweight Linux service that exposes:

- REST endpoints: system stats (CPU, RAM, disk, network), Docker management, media API proxy (Emby, Radarr, Sonarr)
- WebSocket endpoint: real terminal session (node-pty or similar)

## Target platforms
Ubuntu, Fedora, and other systemd-based Linux distros.

## Design spec
See `docs/superpowers/specs/` for the Sub-project 2 spec (written after Sub-project 1 is complete).
