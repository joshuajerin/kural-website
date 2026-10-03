# Early-access reservation flow

The form is intentionally not a payment flow. With Clerk configured, the browser posts a normalized email to `POST /api/waitlist`; the server validates it again and creates a Clerk user with the `kural_early_access` source marker. The Clerk secret stays server-side.

Expected outcomes:

- `201`: reservation accepted.
- `400`: malformed email.
- `409`: Clerk reports an existing identifier.
- `502`: Clerk rejected the create request for another reason.
- `503`: server secret is not configured.

The form shows a success state only after a successful response and offers a retry message on network/provider failure. No local signup database is maintained.