# Script Overlay

Script Overlay is a private, offline teleprompter for Windows and macOS. Write or paste scripts in the editor, then open them in a transparent always-on-top window that can be locked so clicks pass through to the app underneath.

## Features

- Local script library with search, duplicate, delete, and autosave
- Smooth timed scrolling with saved progress
- Transparent, resizable, always-on-top overlay
- Click-through lock mode with tray and global-shortcut recovery
- Font, color, opacity, alignment, width, and speed controls
- Optional best-effort screen-capture protection
- No accounts, analytics, cloud storage, or runtime network requests

## Development

Requirements: Node.js 20 or newer and npm.

```sh
npm install
npm run dev
```

Quality checks:

```sh
npm run typecheck
npm test
npm run build
```

## Packaging

Build unsigned installers on the target operating system:

```sh
npm run dist
```

Windows produces an NSIS installer. macOS produces DMG and ZIP artifacts for Intel and Apple Silicon. macOS artifacts must be built on a Mac. Because these local builds are unsigned, Windows SmartScreen or macOS Gatekeeper may show a warning.

## Global shortcuts

| Action | Shortcut |
| --- | --- |
| Play / pause | `Ctrl/Cmd + Shift + Space` |
| Lock / unlock | `Ctrl/Cmd + Shift + L` |
| Rewind five seconds | `Ctrl/Cmd + Shift + Left` |
| Increase speed | `Ctrl/Cmd + Shift + Up` |
| Decrease speed | `Ctrl/Cmd + Shift + Down` |

If another app already owns a shortcut, Script Overlay reports the conflict. The tray menu always remains available to unlock the overlay.

## Privacy note

“Hide from screen capture” uses Electron's operating-system content-protection API. It is best-effort and cannot guarantee exclusion from every capture or recording tool.
