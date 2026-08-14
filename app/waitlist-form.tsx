"use client";

import { useWaitlist } from "@clerk/nextjs";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import styles from "./waitlist-form.module.css";

type WaitlistFormProps = {
  configured: boolean;
};

export function WaitlistForm({ configured }: WaitlistFormProps) {
  return configured ? <ClerkWaitlistForm /> : <UnconfiguredWaitlistForm />;
}

function ClerkWaitlistForm() {
  const { waitlist, fetchStatus } = useWaitlist();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const loading = fetchStatus === "fetching";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const normalizedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setMessage("Enter a valid email address.");
      return;
    }

    try {
      const result = await waitlist.join({ emailAddress: normalizedEmail });
      if (result.error) {
        const providerMessage = result.error.message.toLowerCase();
        setMessage(
          providerMessage.includes("already")
            ? "You’re already on the Kural early-access list."
            : "We couldn’t reserve your place. Please check your email and try again.",
        );
        return;
      }

      setSubmitted(true);
    } catch {
      setMessage("The reservation service is temporarily unavailable. Please try again.");
    }
  }

  if (submitted) {
    return (
      <div className={styles.success} role="status">
        <Check aria-hidden="true" size={28} />
        <div>
          <strong>Your place is reserved.</strong>
          <p>Check your inbox for confirmation from Kural.</p>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label htmlFor="early-access-email">Email address</label>
      <div className={styles.control}>
        <input
          id="early-access-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          aria-invalid={Boolean(message)}
          aria-describedby={message ? "waitlist-message" : undefined}
        />
        <button type="submit" disabled={loading || !email.trim()}>
          <span>{loading ? "Reserving" : "Reserve early access"}</span>
          {loading ? (
            <LoaderCircle className={styles.spinner} aria-hidden="true" size={18} />
          ) : (
            <ArrowRight aria-hidden="true" size={18} />
          )}
        </button>
      </div>
      {message ? <p className={styles.error} id="waitlist-message" role="alert">{message}</p> : null}
      <p className={styles.note}>No payment details. No charge today.</p>
    </form>
  );
}

function UnconfiguredWaitlistForm() {
  return (
    <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
      <label htmlFor="preview-email">Email address</label>
      <div className={styles.control}>
        <input
          id="preview-email"
          type="email"
          placeholder="you@example.com"
          aria-describedby="preview-note"
          disabled
        />
        <button type="submit" disabled>
          <span>Reserve early access</span>
          <ArrowRight aria-hidden="true" size={18} />
        </button>
      </div>
      <p className={styles.note} id="preview-note">Reservations open when Clerk is connected.</p>
    </form>
  );
}
