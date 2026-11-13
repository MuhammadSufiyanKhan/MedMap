# @medmap/shared

zod schemas, inferred types, enums and the fixed safety wording shared by the API and the
web app. It depends on zod only and imports from neither app.

## Scripts

| Script          | What it does          |
| --------------- | --------------------- |
| `npm run build` | Compiles to `dist/`   |
| `npm test`      | Schema and text tests |

## Folder map

```text
src/
  enums.ts         roles, kinds, severities, audit actions
  common.ts        ids, pagination, problem documents
  auth.ts          accounts and sessions
  profiles.ts      profiles, members, invites
  medications.ts   medicines and name lookup
  interactions.ts  datasets and check results
  extraction.ts    label reading
  account.ts       export, audit log, app config
  safety.ts        fixed safety wording
fixtures/          demo data and synthetic labels
```

## Rules

- Request and response types are inferred from the schemas (`z.infer`). Do not hand-write
  a type that a schema already describes.
- `safety.ts` is reviewed wording. Do not change it without a human review, and never
  generate it.
