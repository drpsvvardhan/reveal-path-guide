# CIE 3.3 dependency security review

Reviewed: 2026-09-18. Source checkout: `0bea5577895252b2ce26aebc49802003a9833926`.

**Status: findings remain open. This is not a clean security report.** The npm dependency review is separate from the Lovable managed application/database security scan, whose current result must be recorded separately. This review did not change dependency manifests, lockfiles, application code, or patient data.

## Evidence and scope

The fresh `npm audit --omit=dev --json` result contained **12 vulnerable package nodes: 10 high, 1 moderate, 1 low, 0 critical**. Nodes include inherited effects: the three Router package entries are not three independently demonstrated exploits. `package.json` and `package-lock.json` were unchanged from baseline `a180d024` when compared during this review. These findings therefore predate the clinician workflow changes.

The review inspected the lockfile, `npm explain`, application imports/navigation, relevant installed package source, current maintainer advisories, and registry metadata. It was a static applicability assessment, not an exploitation test or complete penetration test. Absence of an observed path is not proof that every deployment/runtime is unaffected.

`--omit=dev` does not mean every listed dependency executes in the deployed browser. Tailwind's peer dependency relationship through production dependency `tailwindcss-animate` brings build tooling into the production dependency graph. Edge functions also use separate URL imports (for example, shared authentication imports Supabase JS 2.45.0 from esm.sh); this npm audit does not cover that remote dependency graph or the managed hosting platform.

## Router, WebSocket, and Lodash applicability

| Component | Locked version | Observed application exposure | Remediation boundary |
| --- | --- | --- | --- |
| `react-router-dom`, `react-router`, `@remix-run/router` | 6.30.1, 6.30.1, 1.23.0 | `src/App.tsx` uses `BrowserRouter`; `src/main.tsx` uses `createRoot`, not SSR hydration. All observed navigation targets are fixed internal strings, plus `navigate(-1)`. The generic NavLink wrapper has no observed application callers. No loader/action redirects or attacker-controlled Router destinations were found. | Updating `react-router-dom` to 6.30.4 also resolves Router 6.30.4 and remix router 1.23.3, covering the recorded historical XSS/redirect fixes. It does **not** clear all current Router advisories: the backslash navigation and SSR constructor advisories list 7.18.0 as their patched release, requiring a deliberate major-version upgrade for that coverage. |
| `ws` | 8.20.0 | Transitive through Supabase Realtime and development `jsdom`. The installed Realtime factory selects native browser `WebSocket`; no application import or explicit `ws` transport was found. No Node WebSocket server is implemented in this app. Thus the npm `ws` receiver path was not established for the deployed browser. | 8.21.0 addresses the recorded memory-exhaustion advisory and supersedes the 8.20.1 disclosure fix. This is a same-major minor update satisfying the observed parent ranges; verify tests and any separate Node runtimes. |
| `lodash` | 4.17.21 | Transitive through Recharts 2.15.4. No application or Recharts `template` call was found. Recharts' observed `omit` calls use fixed paths (`children`, `width`), not attacker-supplied path arrays; the app uses line charts, with no Treemap/Funnel usage found. A vulnerable template/unset/omit call with attacker-controlled arguments was not established. | 4.18.0 is the maintainer's fixed version for the recorded template and array-path advisories. It is a same-major minor update compatible with Recharts' `^4.17.21` range, subject to normal regression checks. |

The Router maintainers explicitly exclude declarative `BrowserRouter` mode from the [high-severity redirect XSS](https://github.com/remix-run/react-router/security/advisories/GHSA-2w69-qvjg-hvjx), [same-origin loader redirect](https://github.com/remix-run/react-router/security/advisories/GHSA-2j2x-hqr9-3h42), and [SSR constructor injection](https://github.com/remix-run/react-router/security/advisories/GHSA-337j-9hxr-rhxg) advisories. The separate [backslash navigation bypass](https://github.com/remix-run/react-router/security/advisories/GHSA-wrjc-x8rr-h8h6) depends on attacker-supplied navigation paths; the static-path finding above is specific to this checkout.

The [ws memory-exhaustion advisory](https://github.com/websockets/ws/security/advisories/GHSA-96hv-2xvq-fx4p) concerns the package's receiver processing small fragments/chunks. Lodash's [template advisory](https://github.com/lodash/lodash/security/advisories/GHSA-r5fr-rjxr-66jc) concerns untrusted import-key names, and its [array-path advisory](https://github.com/lodash/lodash/security/advisories/GHSA-f23m-r3pf-42rh) concerns `unset`/`omit` paths. The exposure conclusions above follow from comparing those prerequisites with the observed code.

## Other recorded nodes and same-major update targets

These components were traced to the Tailwind/PostCSS build chain, rather than an application import processing patient uploads. No `glob --cmd` usage or browser-side CSS/YAML/glob processing was found. Build-time risk still matters when untrusted source files, CSS, configuration, or filenames enter that pipeline.

| Package | Locked affected version | Minimum target outside the recorded affected ranges | Relevant audit advisory |
| --- | --- | --- | --- |
| `glob` | 10.4.5 | 10.5.0 | [CLI command injection](https://github.com/advisories/GHSA-5j98-mcp5-4vw2) |
| `glob`'s `minimatch` | 9.0.5 | 9.0.7 | [Regular-expression denial of service](https://github.com/advisories/GHSA-23c5-xmqv-rm74) |
| `glob`'s `brace-expansion` | 2.0.2 | 2.1.4, if retaining this branch | [Expansion memory-exhaustion bypass](https://github.com/advisories/GHSA-rgw5-rvv9-x895) |
| `nanoid` | 3.3.11 | 3.3.18 | [Custom-generator infinite loop](https://github.com/advisories/GHSA-2v37-7h3g-55p8) |
| `postcss` | 8.5.6 | 8.5.23 | [Source-map file-read fix bypass](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) |
| `postcss-selector-parser` | 6.1.2 | 6.1.3 | [AST-recursion denial of service](https://github.com/advisories/GHSA-w9m9-85wc-3x92) |
| `yaml` | 2.6.0 | 2.8.3 | [Deeply nested collection stack overflow](https://github.com/advisories/GHSA-48c2-rrv3-qjmp) |

These targets were identified from the recorded advisory ranges, and their published versions were checked with read-only `npm view` queries. No updated lockfile has been installed or audited. Resolve transitives together: for example, registry metadata for minimatch 9.0.7 moves its brace-expansion dependency to `^5.0.2`, so blindly pinning every old nested path is inappropriate. Avoid `npm audit fix --force` as a substitute for an assessed Router migration.

## Completion requirements

1. Apply compatible patch/minor updates in a dedicated dependency change; keep the intentional Router major upgrade separately reviewable if required.
2. Run `npm ci`, relevant navigation/auth/chart tests, full suite, typecheck, and production build against the resulting lockfile.
3. Rerun the audit and record remaining findings and their actual deployment applicability. Do not report zero findings based on this desk review.
4. Record the separate fresh Lovable managed scan, and separately assess edge-function remote imports when doing a complete dependency review.
