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
and redirect `www.kural.website` to it.

1. Import this repository in Vercel with the repository root as the project root.
   Vercel detects Next.js automatically; use `npm ci` and `npm run build` for the
   install and build commands.
2. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from the Kural
   Clerk application to the Vercel Preview and Production environments. Do not
   commit those values.
3. Add `kural.website` and `www.kural.website` in Vercel Project Settings >
   Domains, set the apex as primary, and redirect `www` to the apex.
4. At the DNS provider, initially point `@` to `76.76.21.21` with an A record and
   `www` to `cname.vercel-dns-0.com` with a CNAME record. After adding the domain,
   use `vercel domains inspect kural.website` or the Vercel domain card as the
   source of truth because Vercel may provide a project-specific value or require
   a TXT ownership-verification record.

Run `npm run build` and `npm run lint` before deployment.
