# Kural website

Single-page product website for the Kural modular mobile manipulator.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

The page renders without Clerk credentials for design review, but the early-access
form remains disabled until Clerk is configured.

## Clerk waitlist

1. Add Clerk to the Vercel project through the Vercel Marketplace.
2. Enable **Waitlist mode** and email in the Clerk Dashboard.
3. Provide `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` for local,
   preview, and production environments.
4. Rebuild the site and submit a test reservation before promoting production.

Clerk stores and confirms reservations. The site does not collect payment details
or maintain a separate signup database.

## Production

The canonical URL is `https://kural.website`. Vercel should serve the apex domain
and redirect `www.kural.website` to it. Run `npm run build` and `npm run lint`
before deployment.
