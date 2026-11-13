# @medmap/api

Express REST API for MedMap.

## Scripts

| Script            | What it does                              |
| ----------------- | ----------------------------------------- |
| `npm run dev`     | Watch mode with `tsx`, reads `../../.env` |
| `npm run build`   | Compiles to `dist/`                       |
| `npm start`       | Runs the compiled server                  |
| `npm test`        | Unit and integration tests                |
| `npm run openapi` | Writes `docs/openapi.json`                |

Run them from the repository root with `-w @medmap/api`, after `npm run build:shared`.

## Folder map

```text
src/
  config/        environment validation and constants
  routes/        route table and router builder
  controllers/   thin HTTP handlers
  services/      business rules and authorisation
  repositories/  all database access
  models/        Mongoose schemas
  dto/           entity -> JSON mappers
  middleware/    auth, validation, rate limits, errors, request ids
  integrations/  ports and adapters (RxNorm, label extractor, email)
  engine/        pure interaction logic
  jobs/          command-line jobs
  utils/         helpers
tests/           unit/ and integration/
```

## Layer rules

- Dependencies point one way: routes, controllers, services, repositories, models.
- Controllers contain no business logic and return DTOs, never database documents.
- Services take and return plain objects and throw `AppError` subclasses.
- Only `repositories/` and `models/` import Mongoose.
- The user id always comes from the verified access token.
