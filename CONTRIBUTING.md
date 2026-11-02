# Contributing

Use Node 24.18.0 and npm ci. Keep package-lock.json and official registry integrity values. Do not commit node_modules, profiles, caches, installers, private keys, real account responses or conversation contents.

Run npm test, npm run test:clean, npm run check:release and npm run audit:check. On a desktop test host also run npm run test:renderer. Windows and Mac packages must be built on the corresponding OS. Native UI, notification, wake and multi-screen behavior require manual checks even after automated tests pass.

Preserve the approved sand-white visual system: 50 DIP edge rail, 20 px brand marks, small status glyphs, unfilled waiting/task controls. Do not add a second theme or turn reply endings into whole-task completion notifications.

Adapters must return unknown when data is absent, distinguish subscription quota from API balance, avoid copying tokens and project metadata only. New native adapters need versioned compatibility notes and fixtures with invented identifiers. Never include raw private logs as fixtures.

A dependency change must re-run packaging and review docs/DEPENDENCY_SECURITY.md. Do not silence unknown advisories or renew an exception without recording new evidence. Keep pull-request jobs read-only and free of signing/release credentials.

Describe the behavior changed, validation performed and remaining platform limits in a pull request. A new integration should document both quota and state capabilities; neither implies the other.
