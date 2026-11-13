# Repository settings

The session that built this project cannot change repository settings, so apply these by
hand. Each `gh` command needs the GitHub CLI logged in as the repository owner.

## Branch protection for `main`

- Require a pull request before merging. Required approvals: 0 (solo project).
- Require status checks to pass: `Lint, typecheck, test, build`, `Docs checks`, `Secret scan`.
  Add `End-to-end tests`, `Docker build` and `Lighthouse` once those jobs exist.
- Require linear history.
- Block force pushes and deletions.

```bash
gh api -X PUT repos/MuhammadSufiyanKhan/MedMap/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Lint, typecheck, test, build", "Docs checks", "Secret scan"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

## Merge settings

- Allow squash merging only. Default the squash message to the pull request title.
- Automatically delete head branches.

```bash
gh api -X PATCH repos/MuhammadSufiyanKhan/MedMap \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true -F squash_merge_commit_title=PR_TITLE
```

## Security features

- Enable private vulnerability reporting, Dependabot alerts and secret scanning with push
  protection (Settings, then Code security).

## Default branch

- Make sure the default branch is `main`.

## Labels

```bash
for label in milestone security a11y; do gh label create "$label" --force; done
```
