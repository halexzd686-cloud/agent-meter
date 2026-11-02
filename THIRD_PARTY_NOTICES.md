# Third-party notices

The Agent Meter application source is licensed under the root MIT LICENSE. That license does not replace upstream licenses or grant trademark rights.

- Brand SVGs: Lobe Icons, MIT. The retained license is assets/icons/LICENSE.txt; recorded sources are in assets/icons/sources.json. Brand names and marks remain with their respective owners. The UI includes Claude and Cursor marks as reserved integration entries.
- Electron: MIT, with Chromium, Node.js and other bundled components under their upstream licenses. Release bundles retain the runtime LICENSE and LICENSES.chromium.html files supplied by Electron. See https://github.com/electron/electron/blob/main/LICENSE .
- electron-builder and its transitive packages are development/build tools. Their versions and integrity values are recorded in package-lock.json; package-specific licenses remain in their npm distributions.
- The optional Go DMG tool imports github.com/leaanthony/dmg. Its source dependency is pinned in build/dmg-tool/go.mod and go.sum and retains its upstream license: https://github.com/leaanthony/dmg . It is not a runtime dependency of the widget.
- Codenotch is a product reference, not a bundled dependency or a source module in this implementation.

When distributing modified runtimes or adding resources, review their upstream licenses and include all required notices. Do not strip Electron's runtime notices from installers.
