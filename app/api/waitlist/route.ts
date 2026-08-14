import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ClerkError = {
  errors?: Array<{ code?: string; long_message?: string; message?: string }>;
};

export async function POST(request: Request) {
  const { email } = (await request.json().catch(() => ({}))) as { email?: unknown };
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Reservations are not configured." }, { status: 503 });
  }

  const clerkResponse = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: [normalizedEmail],
      skip_password_requirement: true,
      skip_password_checks: true,
      public_metadata: { source: "kural_early_access" },
    }),
  });

  if (clerkResponse.ok) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const error = (await clerkResponse.json().catch(() => ({}))) as ClerkError;
  const detail = error.errors?.[0];
  const duplicate = detail?.code === "form_identifier_exists";
  const message = duplicate
    ? "You’re already on the Kural early-access list."
    : detail?.long_message ?? detail?.message ?? "Unable to reserve early access.";

  return NextResponse.json({ error: message }, { status: duplicate ? 409 : 502 });
}
