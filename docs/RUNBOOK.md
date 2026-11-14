# Runbook

This file grows with each milestone. Deployment sections arrive with M8.

## Run locally

```bash
npm ci
cp .env.example .env
docker compose up -d mongo
npm run migrate
npm run seed:demo
npm run dev
```

`npm run migrate` creates the indexes. `npm run seed:demo` loads the made-up demo dataset
and makes it active. Without a dataset, interaction checks answer 503.

## Import a real interaction dataset

MedMap never downloads a dataset. Get the file yourself, read its licence and terms, and
only then import it.

1. Record the source in [DATA_SOURCES.md](DATA_SOURCES.md).
2. Import without activating and read the report:

   ```bash
   npm run import:interactions -- --file /path/to/file.csv --name "Source name" --version "2026-01"
   ```

3. When the licence is confirmed, import again with activation:

   ```bash
   npm run import:interactions -- --file /path/to/file.csv --name "Source name" --version "2026-01" \
     --licence-status confirmed --activate
   ```

Formats (`--format`):

- `medmap` (default): columns `ingredient_a_rxcui`, `ingredient_b_rxcui`, `severity`
  (`serious`, `moderate` or `minor`), `source_ref`, and optionally `mechanism`, `name_a`,
  `name_b`.
- `ddinter`: columns `DDInterID_A`, `Drug_A`, `DDInterID_B`, `Drug_B`, `Level`. Names are
  matched to RxNorm ingredients (this needs network access to RxNorm). Rows whose level is
  "Unknown" or whose names do not match exactly one ingredient are skipped and listed.
  Check the column layout against your file first: the mapping was written from the public
  description of the format and has not been run against the real file.

Rules the job enforces: `--activate` needs `--licence-status confirmed`; severity and
mechanism are stored exactly as in the file; pairs are stored once, sorted; importing the
same name and version again replaces the earlier import.

Check what is active:

```bash
npm run check:dataset
```

It fails unless the active dataset is real and its licence is confirmed. The production
pipeline runs it as a release gate.

## Demo-data guard

In `NODE_ENV=production` the API exits at startup when the active dataset is the demo set,
unless `ALLOW_DEMO_DATA=true`. Staging sets that flag and shows the demo banner.
