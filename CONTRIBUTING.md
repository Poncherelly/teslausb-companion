# Contributing / workflow

This is a small project with a single maintainer, so the workflow is
intentionally lightweight.

## Branching model

- `main` is always the deployable/stable line. Nothing broken gets
  committed directly to it.
- All work happens on a **feature branch**, named
  `type/short-description`, e.g.:
  - `feat/ble-pairing-service`
  - `fix/clip-deletion-race`
  - `docs/update-api-spec`
- When a feature branch is ready, open a Pull Request into `main`,
  review the diff, then merge and delete the branch.

## Day-to-day loop

```
git checkout main
git pull
git checkout -b feat/my-change
# ... make changes ...
git add <files>
git commit -m "Short, present-tense summary"
git push -u origin feat/my-change
# open a PR on GitHub, merge when happy
git checkout main
git pull
git branch -d feat/my-change
```

## Commit messages

- Present tense, short first line ("Add BLE pairing state machine",
  not "Added" or "Adding").
- Explain *why* in the body if the reason isn't obvious from the diff.

## Docs

Design docs live in [docs/](docs/) and are the source of truth for
product decisions until code exists to override them (see
[CLAUDE.md](CLAUDE.md)). Update the relevant doc in the same PR as any
code change that contradicts it.

## Changelog

User/developer-visible changes are logged in
[CHANGELOG.md](CHANGELOG.md) under an "Unreleased" section, following
[Keep a Changelog](https://keepachangelog.com/) conventions.
