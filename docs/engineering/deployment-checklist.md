# Website deployment checklist

Before a production deployment:

1. Run `npm ci`, `npm run lint`, and `npm run build` from the repository root.
2. Confirm Clerk Preview and Production credentials are configured in the Vercel project; do not place secret values in the repository.
3. Check the canonical domain and `www` redirect in Vercel, then follow the project-specific DNS values shown by Vercel.
4. Smoke-test the homepage, `/sim`, and early-access form after deployment.
5. Verify an unconfigured form is disabled and a configured test reservation reaches the Clerk waitlist without collecting payment.

The production hostname documented by the project is `https://kural.website`. DNS and deployment settings can change; verify their live state rather than relying on copied values.