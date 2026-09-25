# Local development

The marketing site is a Next.js application at the repository root. Use Node.js with the checked-in lockfile so local installs match CI/deployment dependency resolution.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The homepage can render without Clerk credentials for design review; the reservation control remains disabled until `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set. Never commit `.env.local` or production secrets. Use `npm run lint` and `npm run build` before publishing changes.