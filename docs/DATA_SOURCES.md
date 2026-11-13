# Data sources

No dataset is downloaded by this project. A real interaction dataset must be supplied by
the owner as a local file and imported with the import job.

| Source                  | Used for                      | Status in this repo                  | Licence status                                                            |
| ----------------------- | ----------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| MedMap demo set         | Tests, local demos, staging   | Bundled, invented names and pairs    | Not applicable: made up for this project, contains no medical information |
| RxNorm (NLM RxNav API)  | Matching names to ingredients | Called at run time, responses cached | UNVERIFIED: owner must confirm licence and terms before public deployment |
| DDInter 2.0 (candidate) | Real interaction pairs        | Not bundled, not downloaded          | UNVERIFIED: owner must confirm licence and terms before public deployment |

Notes:

- The NLM RxNav drug interaction API was discontinued in January 2024 and is not used.
- Any other source the owner chooses must be added to this table with the same wording
  until its licence and terms are confirmed.
- The import job records `licenceStatus` on the dataset; the API shows the dataset name,
  version and import date with every result.
