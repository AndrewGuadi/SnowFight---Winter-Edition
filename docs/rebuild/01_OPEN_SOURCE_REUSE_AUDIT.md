# 01 — Open-Source Reuse Audit and Fork/Build Decision

**Status:** RESEARCHED CANDIDATES ONLY. No third-party source or art has been imported, executed locally, benchmarked, or legally approved for inclusion by creating this document.  
**Decision owner:** Andrew; technical due diligence: GPT-6 + GPT-6.1-Sol; art license review: Kimi; usability audit: Muse.

## The policy

**Do not reinvent a system when a proven, legally reusable one can be integrated faster and more reliably.** This is a directive to research and benchmark, not a directive to copy attractive demos.

"Free to play" != "open source" != "licensed for modification and redistribution." A public GitHub repository with no license generally has no broad grant of reuse rights. An MIT or Apache-2.0 license for code may not cover bundled art, fonts, models, music, trademarks, user content, or third-party dependencies.

There are three valid outcomes:
- **Reuse component/pattern:** adopt a well-scoped library or architecture with notices and compatibility tests.
- **Fork foundation:** adopt a whole game under an applicable license only if its mechanics, network model, assets, originality, architecture, and modification effort are genuinely closer to SnowFight's contest needs than our existing game.
- **Retain/build:** use existing SnowFight modules or implement missing behavior when importing another system costs more, carries legal uncertainty, or requires breaking our production baseline.

## Candidate register (research as of 2026-10-30)

| Candidate | Public evidence | Reuse/license assessment | Fit | Disposition |
| --- | --- | --- | --- | --- |
| **Current SnowFight** — https://github.com/AndrewGuadi/SnowFight---Winter-Edition | Working original Node/Socket.IO authoritative snowball game, room codes, bots, 60 Hz sim; current docs/code reviewed. | Owned project; no external import required. Preserve user rights and audit any prior imported assets. | Best proven contest starting point. | **DEFAULT FOUNDATION** pending first-hour evaluation. |
| **Claude of Legends** — https://github.com/killian01/claude-of-legends | Browser 5v5 MOBA, deterministic TypeScript sim, authoritative server and bot policies; repository describes tests and online lobbies. GitHub repository declares MIT code. | Check LICENSE, CREDITS, individual art/model licenses, deps and originality before copying. | Excellent source for architecture, simulation/testing and bots; MOBA complexity may make wholesale adaptation slower. | **HIGH-PRIORITY ARCHITECTURE STUDY; FORK CANDIDATE ONLY IF BUILDS FAST.** |
| **open-games / Arena Champions** — https://github.com/savagemanage/open-games | Public monorepo including a Phaser 3.80 5v5 arena/MOBA under packages/champs; README declares Apache-2.0. | Apache attribution/NOTICE obligations; independently inspect dependency and asset provenance. Phaser 3 -> Phaser 4 not copy-and-paste. | Client/rendering and modular game organization. | **STUDY, POSSIBLE LICENSED MODULE SOURCE.** |
| **VOIDSTRIKE** — https://github.com/braedonsaunders/voidstrike | Browser RTS; repo describes Recast navmesh, formations, flocking, crowd steering; GitHub declares MIT. | Verify source module/third-party WASM licenses, SIMD requirements, asset provenance and build size. | Excellent AI navigation and performance reference, whole-game integration heavy. | **STUDY NAVIGATION PATTERNS, NOT WHOLE FORK.** |
| **Skirmio** — https://github.com/SwapCodesDev/skirmio | Phaser 3 + Node/Socket.IO browser action game with lobbies, avatars and bots. | Public repository did not declare a license in GitHub metadata on review; confirm explicit license or author permission before importing any code. | Strong conceptual match. | **REFERENCE ONLY UNTIL RIGHTS CONFIRMED.** |
| **p2p-maze-shooter** — https://github.com/arifulislamat/p2p-maze-shooter | Browser shooter with MIT license and peer-to-peer model. | MIT code; verify individual assets. Its P2P authority is a mismatch for large competitive rooms. | Controls and small-arena design inspiration. | **REFERENCE / SMALL MODULE CANDIDATE.** |
| **Phaser 4** — https://phaser.io/download/phaser4 | Official v4.2.1 (2026-07-09) JavaScript 2D game framework and browser examples. | Check official license and notices; pin the exact tested package version. Existing Phaser 3 snippets may need migration. | Good strategic client engine POC, not automatically required for contest. | **POST-CONTEST CLIENT PROTOTYPE unless contest foundation gate explicitly changes.** |
| **Ottermind Astra explorer** — https://ottermind.ai/explore/gpt-6-astra | Catalog of playable demos, prompts and sometimes source, not itself a single OSS repository. | License/status is **per project**; "With source" is not a license. | Useful discovery channel for art/control/test references. | **DISCOVERY RESOURCE.** |
| **Aster browser space exploration** — https://aster.barendemmerzaal.com/ | User-supplied playable example; website retrieval was blocked during this review. | Source, license, implementation and claimed device compatibility **unverified**. | Possible browser optimization and presentation reference. | **DO NOT IMPORT pending source+license+tests.** |
| **Emberfall 5v5 MOBA** | User description names MOBA with lanes, minions and towers; the exact repository was not identified. An unrelated GitHub Emberfall is an arcade space shooter. | **Unknown** until exact URL is obtained; do not conflate projects sharing title. | Potentially useful if source and rights are found. | **IDENTITY UNRESOLVED.** |
| **Eye of the Fallen God / Nova Celestus 07 / WoW-RuneScape-inspired browser RPG** | Demos and descriptions have circulated; exact source repositories were not verified. | Unknown permissions, builds and deployability. | Art/camera/physics/interaction references only at this time. | **UNVERIFIED; NO IMPORT.** |
| **ZOVserver** — https://github.com/replica0909xx/ZOVserver | Brawl Stars V24 private-server emulator built on .NET/Orleans, not a client game engine. Repository metadata did not declare a license on review. | Proprietary-game protocol/IP and no verified permission for reuse. | Wrong foundation for original SnowFight. | **REJECT.** |

### Source notes for next reviewers

- Source links above point to primary project locations. Inspect the exact revision, LICENSE and dependency manifest yourself before adoption.
- Claude of Legends code is presented as MIT, while art assets have separate credits. Those are distinct obligations.
- open-games states Apache-2.0 at the repository root and uses Phaser **3**, not Phaser 4.
- VOIDSTRIKE has sophisticated WebGPU/WebGL and navigation, but its renderer/network stack is a different scale and should not be ported wholesale.
- Skirmio's publicly readable README and GitHub metadata do **not** establish a grant to copy or modify; seek license or permission.
- The Aster URL could not be fetched here; do not claim its performance was independently measured.
- Ottermind's own page warns that prompts alone may omit assets and environment. Reproduction is not guaranteed.
- GitHub popularity, a demo video, or an AI-generated project description are not build-test evidence.

## Required evidence before a full-game fork

Create a candidate audit record containing:
1. Canonical repo URL, immutable commit SHA, maintainer, last push date.
2. Code LICENSE and exact permission obligations; per-asset and dependency licenses, licenses copied into our output where required.
3. Local install/build/test commands, versions and exact environment.
4. Clean build result on a fresh checkout, with log and dependency audit.
5. One working browser on desktop and one real phone; screenshots and basic timing.
6. Existing multiplayer support: at least two separate browsers can join with the same link/code, complete a round and agree on the result.
7. How many changes are needed to replace gameplay, art, maps, controls, lobby and networking while retaining originality.
8. What would have to be discarded (minions, towers, shop, classes, accounts, AI automation, 3D assets).
9. An owner-approved provenance/attribution plan.
10. A rollback strategy retaining existing SnowFight.

### Timeboxed option scoring

Use scores 0–5 and **show observed evidence**, with weighting:

| Criterion | Weight |
| --- | ---: |
| Legal clarity including assets | **Pass/fail gate** |
| Two-client multiplayer already works | **Pass/fail gate** |
| Install/build reliability | 20 |
| Match with SnowFight's 90-second move/throw loop | 25 |
| Adaptation effort inside contest window | 25 |
| Mobile and desktop performance/playability | 15 |
| Test coverage + maintainability | 10 |
| Originality/contest compliance | 5 |

If a candidate fails either hard gate, it cannot be adopted for contest. For scored candidates, a fork should only displace the SnowFight baseline if it demonstrably reduces the path to an original, working, tested submission within the available window. No score is valid until measured.

## Reuse workflow

Research -> inspect license + files -> build in clean sandbox -> compare architecture and timing -> choose smallest reusable unit -> record provenance -> isolate in branch -> integration tests -> owner review -> import if authorized.

Keep a THIRD_PARTY_NOTICES file for every imported module and asset license; preserve required attribution and copyright notices.

## Foundation gate: decision required

**Provisional recommendation:** preserve SnowFight's own server + game for the contest. Reuse patterns from Claude of Legends for bot policy/testing, VOIDSTRIKE for separation/navigation concepts, open-games for project organization, and vetted Phaser 4 code in a **separate later POC**.

**Contingency:** if a licensed prebuilt candidate passes both hard gates and proves substantially faster to customize during the first 45–60 minutes, propose a fork to Andrew with a measured comparison. Do not silently switch codebases.

## Audit checklist to maintain

- [ ] Clone the top three candidates at pinned revisions and record exact commits.
- [ ] Inspect root code license plus all non-code asset licenses.
- [ ] Identify mandatory third-party services, API keys, paid endpoints, and external CDNs.
- [ ] Build each on a clean environment, record success/fail and time.
- [ ] Run two-client multiplayer tests where available.
- [ ] Record source files considered for reuse, exact provenance, and modified-file obligations.
- [ ] Compare with current SnowFight baseline; sign decision in 10_DECISION_LOG_AND_RISKS.md.
- [ ] Receive owner approval before importing third-party files.

**Current result:** candidate research completed at a repository-description/license-metadata level for several projects. Full source audits, builds, mobile tests, and legal approval are NOT complete.
