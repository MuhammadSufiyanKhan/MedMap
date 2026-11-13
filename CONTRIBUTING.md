# Contributing

## Workflow

1. Branch from `main`: `feat/...`, `fix/...`, `chore/...`, `docs/...` or `test/...`.
2. Make small commits that follow [Conventional Commits](https://www.conventionalcommits.org/).
   The subject is imperative and at most 72 characters. The body says why.
3. Run `npm run lint`, `npm run typecheck` and `npm test` before pushing.
4. Open a pull request and fill in the template, including the safety checklist.
5. Pull requests are squash-merged once CI is green. `main` must always be releasable.

## Rules that are not negotiable

- Read "Safety and limits" in the [README](README.md). No change may weaken those rules.
- Fixed safety wording lives in `packages/shared/src/safety.ts`. Changing it needs a human
  review; never generate or paraphrase it with a language model.
- No real patient data in tests or fixtures. No secrets in the repository.
- TypeScript only. No `any`, no non-null assertions, no `@ts-ignore`.
- Respect the layers. ESLint fails the build when an import crosses them the wrong way.
- Update the README and docs in the same pull request as the code they describe.

## Layers

- API: `routes -> controllers -> services -> repositories -> models`.
- Web: `presentation -> application -> services -> domain`.

Details are in each workspace README and in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
