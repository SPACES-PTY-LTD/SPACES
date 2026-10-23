# Node.js runtime

Use **Node.js 22.23.4 LTS** for the Laravel Vite assets, `website` Next.js server/build, and `mobile_app` Expo tooling. Each package has an `.nvmrc` and an engine range `>=22.23.4 <23`; each lockfile mirrors that root metadata without dependency upgrades. EAS development, preview and production profiles pin 22.23.4; simulator and APK profiles inherit it. No tracked CI workflow, Docker image or hosting runtime configuration was found.

## Local setup

With nvm installed, run `nvm install` then `nvm use` from the root or either app directory. Do not change the nvm default alias. These commands select Node for the current shell; existing processes keep their runtime.

On Leroy's Mac, a verified official binary is installed only at `.local/node/node-v22.23.4-darwin-arm64` (ignored by Git). To use it from the repository root without changing shell defaults:

```sh
export PATH="$PWD/.local/node/node-v22.23.4-darwin-arm64/bin:$PATH"
node --version # v22.23.4
npm --version  # 10.9.9 bundled with this binary
```

Then run `npm ci` and the relevant package scripts. The `.nvmrc` does not automatically switch an already-running terminal or server. Restart only this project's development processes when convenient. No processes were restarted during this update.

## Security scope (2026-10-23)

The previous local Node was 22.13.1. The [October 21 official advisory](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) identifies Node 22 as affected. The [22.23.4 release](https://nodejs.org/en/blog/release/v22.23.4) fixes CVE-2026-105482 (DNS), CVE-2026-106069 and CVE-2026-106072 (TLS), CVE-2026-111497 (Brotli), CVE-2026-105481 (HTTP), CVE-2026-106074 (entropy caches), and CVE-2026-106073 (permissions). These are runtime exposure findings, not proof that this application exercises each vulnerable path. The advisory's CVE-2026-105483 affects 24/26; CVE-2026-106070 and CVE-2026-106071 affect 26, not this Node 22 line.

Node 22 remains [supported LTS](https://nodejs.org/en/about/previous-releases). Staying on that major avoids an unnecessary major migration; every locked dependency's declared Node engine accepts 22.23.4. The official macOS arm64 tarball SHA-256 was verified as `c9e1dbc748b33ed2d14f42445191ecaf14c56259c7a9a26d0042c49ec2b66428` before extraction.

These local files do not patch a deployed Next.js process or remote build environment. Before the next deployment, verify the hosting provider's effective build and server Node versions are at least this patched 22.x version, rebuild and deploy through the normal release process. EAS pins take effect on future builds; no EAS build was submitted. Expo device applications use their native JavaScript runtime, not the Mac's Node binary. Laravel PHP is a separate runtime. Laravel Cloud automatic-patching notices do not establish this checkout's or another host's running Node version. No remote runtime was inspected or changed.

## Validation

Validated with Node 22.23.4 and bundled npm 10.9.9. Root and Expo `npm ci`, root and website `npm run build`, and website/Expo `tsc --noEmit --incremental false` pass. All three lockfile dependency graphs are unchanged, all declared dependency engines accept the runtime, and all five EAS profiles resolve to 22.23.4.

Full lint currently fails in unchanged files:
- Website: `tests/admin-run-actions.test.mjs:101` (`react-hooks/rules-of-hooks`), plus 20 warnings.
- Expo: `app/(tabs)/index.tsx:69,87`, `app/shipments/imports/[import_id].tsx:152`, `app/shipments/load.tsx:175`, and `src/components/dashboard/RunMap.tsx:157` (`set-state-in-effect`); `app/shipments/[shipment_id]/scan.tsx:37` (memoization); `src/components/dashboard/RunMap.tsx:331` (`purity`). Seven errors total.

No native iOS/Android build, EAS/cloud build, deployment, server restart, PHP test suite, or full application regression suite was run for this runtime-only change. Website validation uses the existing installed dependencies; root and Expo dependencies were installed from their unchanged locks.
