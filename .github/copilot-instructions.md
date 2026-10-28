# HawkerWatch development instructions

- Use plain JavaScript only. Do not add TypeScript, JSX, React, or Tailwind.
- Keep frontend API access behind backend REST endpoints; do not call MongoDB, OneMap, or data.gov.sg directly from Vue.
- Keep official NEA information distinct from time-stamped community reports.
- Never commit credentials, tokens, real personal data, or `.env` files.
- Run `pnpm build` and `pnpm test` before submitting changes.
