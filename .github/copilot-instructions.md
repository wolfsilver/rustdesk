## 🧭 Overview
- RustDesk is a cross-platform remote desktop client; the Rust crate (`src/lib.rs`) exports shared logic that powers the native GUI (Sciter), Flutter frontend, and CLI entry points.
- Startup flow: `main.rs` delegates to `core_main::core_main()` for argument parsing, auto-install tasks, and launching the tray/server threads before handing control to the UI layer (`ui::start` for Sciter or `flutter` bridge when the feature is enabled).
- Session coordination lives under `flutter_ffi.rs` and `flutter/` where `Session` abstractions queue Rust-side events, texture updates, and clipboard sync back into Dart via `flutter_rust_bridge` streams.

## 🗂️ Code structure
- `src/server.rs` hosts the local service multiplexer: each `Service` implementation (audio, display, clipboard, terminal, etc.) registers with a shared `Server` that owns connections.
- `src/client.rs` encapsulates rendezvous negotiation, stream decoding, input replay, and clipboard/file transfer orchestration per session.
- `src/rendezvous_mediator.rs` manages connectivity to RustDesk rendezvous/relay servers, NAT traversal, and LAN discovery; it spins the background tokio tasks that keep the local server reachable.
- `src/platform/` holds platform shims (C++/Obj-C compiled by `build.rs`); keep OS-specific logic there and expose minimal Rust APIs.
- `libs/*` are git submodules (codec, capture, input, clipboard, virtual display); run `git submodule update --init --recursive` before touching anything inside.

## 🔄 Runtime flow
- `common::global_init()` boots logging, config (`libs/hbb_common/src/config.rs`), and rendezvous sanity checks before any UI starts.
- When a peer session starts, `client::start` establishes TCP/UDP channels, spins `io_loop` for packets, and registers with the `Server` so display/audio/input services can attach.
- Configuration updates and peer policies are synced through `flutter::sessions` helpers, which call back into `ui_session_interface` to persist options.

## 🛠️ Build & tooling
- Rust-only debug runs: `cargo run` (ensure the Sciter runtime is in `target/debug/` when using the legacy UI).
- Preferred desktop/mobile builds: `python3 build.py --flutter` (add `--release`, `--hwcodec`, `--unix-file-copy-paste`, etc. for feature flags); the script also patches generated Dart FFI signatures.
- VCPKG is mandatory for native deps (`libvpx`, `libyuv`, `opus`, `aom`); set `VCPKG_ROOT` or use the CI-pinned commit (`.github/workflows/ci.yml`).
- Always re-run `build.py` or `flutter_rust_bridge` codegen when editing `src/flutter_ffi.rs`, otherwise the Dart bridge (`flutter/lib/generated_bridge.dart`) will fall out of sync.

## 📱 Flutter bridge
- `flutter_ffi.rs` exposes synchronous and async functions to Dart; use the `SessionID` helpers and `StreamSink<EventToUI>` types instead of inventing new channels.
- Shared options funnel through `ui_interface` getters/setters so desktop and mobile stay in parity; avoid duplicating state in Dart when Rust already persists it.
- Mobile/desktop feature gating is handled by Cargo features (`flutter`, `mediacodec`, `unix-file-copy-paste`)—mirror those in Dart before toggling behavior.

## 🧪 Testing & QA
- Rust unit/integration tests: `cargo test` (requires submodules and vcpkg libs present).
- Flutter tests live under `flutter/test`; run `cd flutter && flutter test` after modifying shared session logic.
- For packaging regressions, `python3 build.py --flutter --skip-cargo` lets you validate Flutter assets without rebuilding Rust.

## 📦 Packaging & platform notes
- `build.rs` runs `hbb_common::gen_version()` and compiles `src/platform/windows.cc` / `macos.mm`; changing those files requires a clean rebuild.
- Platform services (tray, installer, virtual display, remote printer) wire through `core_main` CLI switches (`--tray`, `--install-service`, `--install-remote-printer`); reuse those flows instead of duplicating entry points.

## 📏 Conventions & tips
- Use `hbb_common::log` macros and `allow_err!` instead of `println!` to keep logs consistent across platforms and services.
- Session and service IDs are `i32` counters seeded in `server::new`; allocate new services via `Server::add_service` to integrate with the existing event loop.
- Long-running async work uses `hbb_common::tokio` re-exports; prefer spawning on that runtime instead of `std::thread` unless you need OS APIs.
- Configuration keys live in `libs/hbb_common/src/config/`; use helpers like `Config::get_option` and `config::option2bool` rather than ad-hoc env vars.

## ⚠️ Watch-outs
- Many crates (cpal, reqwest, scrap, enigo, clipboard) are pinned to forks in the `rustdesk-org` GitHub org; updating versions requires coordination with those repos.
- Linux builds expect a running display server; `scrap::is_x11()` gates certain services—test both X11 and Wayland code paths when altering capture/input logic.
- Windows installers rely on `platform::install_me`/`portable_service`; respect elevation checks before touching service startup code.
- When touching rendezvous flows, guard shared state with the existing `AtomicBool` flags (`SHOULD_EXIT`, `MANUAL_RESTARTED`) to avoid spawning duplicate mediators.
