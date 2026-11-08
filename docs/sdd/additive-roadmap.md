# Additive roadmap: adding a batch of new features to a project without breaking it

Use this when the owner wants a group of new features (for example, ideas taken from reference games) documented as specs "de forma que no se destruya lo ya conformado": what gets added, how it is built and how it fits.

## Procedure
1. **Map what already exists before writing anything.** This is read-only, takes a few greps and does not need an explorer.
   - For each new idea, find the code, tables, config keys and tests it would touch. In KH that means the sim, the service, the store, the `gameConfig` keys, the migrations and the test files.
   - Write a "Punto de partida" table: current piece → file → what it does today. Add the tests that fix the current contract, and mark them as untouchable.
   - Copy the current SDD queue as "intacta".
2. **Write the non-destruction rules once, numbered `R-ND1..n`.** Every feature spec in the batch copies them as requirements with evidence, and the reviewer rejects a spec that is missing any. The set that worked:
   - **Additive only.** No delete or rename of code, tables, columns, config keys or endpoints. Old code only gets hook points.
   - **The old engine stays alive.** The new logic goes in a new module, picked per record (`state.engine`). Records without the field keep the old path, so in-flight saved state never breaks.
   - **A config switch for rollback.** `engineVersion = 1` by default; the owner approves moving it to 2 in its own commit.
   - **A stable response contract.** New fields are optional, and old fields stay as aliases.
   - **Migrations only add** (`createTable`/`addColumn` with a default, plus `down`).
   - **Existing tests are untouched.** Balance tests are also re-run with the new engine. If they fail, tune the new data, never the test.
   - **Determinism.** A seeded RNG per run, never `Math.random`.
   - **Data, not code.** New config keys sit next to the old ones; for example a text passive keeps its text and gains `passiveFx`.
   - **Isolated branches**, with surgical edits to the shared files.
   - **Canon and art gates still apply.**
3. **One card per feature, not full EARS.**
   - Each card has: what it adds, how it fits (the exact hook point), its tests (always including "without the new thing, the result is identical to today") and its files.
   - The full specs are written by spec-author when each feature's turn comes. Specs written months ahead go stale.
4. **Interleave with the current queue** in an order table with a one-line "why" for each row.
   - Call out the hard dependencies between new and old work. For example, a new event log must come before the scene that replays it, or the scene gets built twice.
   - Mark server-only, no-art features as parallel to queued art features, within the cap of 2 Sonnet workers.
   - Optional features go last, with "se decide después de jugar X".
5. **Commit it as its own docs branch.**
   - Create a worktree `docs/roadmap_<tema>` from the integration branch.
   - The doc goes in `docs/ROADMAP_<tema>.md`, with "Estado: PROPUESTA" at the top.
   - New entries are appended to `feature_list.json` as `pending`, each with `acceptance` that includes the R-ND line. Append them by parsing the file and splicing text before the closing `]`; keep the file's CRLF and indentation, and run `json.loads` to validate before writing.
   - Add a pointer line to the project `PAQUETE.md` and to `ESTADO.md`.
6. **Reply to the owner** with:
   - how breakage is avoided (3-5 bullets);
   - what each feature adds (one line each);
   - how it mixes with the queue, including the single hard dependency;
   - one question: approve the order?

   On approval, change the status line to "ORDEN APROBADO (cada feature sigue necesitando su spec)" and merge the docs branch together with whatever else was approved. Then dispatch the next two chains (explorer brief → spec → [GATE] impl) right away.

## Pitfalls
- Pick feature ids after the highest id already in `feature_list.json`, including features marked done that come from other branches. Never reuse an id.
- A rule that only says "don't break anything" is unverifiable. Each R-ND needs a concrete check, such as a test name, a grep that must find nothing, or a default value.
- Features that only add a multiplier or a protected amount must default to the neutral value (1.0 or 0), so that a player who does not use them gets exactly today's numbers. State that in the card and test it.
