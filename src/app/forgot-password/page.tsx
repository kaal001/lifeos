
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import styles from "../login/auth-form.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setStatusMessage("");
    setIsLoading(true);

    try {
      const supabase = createClient();

      const callbackUrl = new URL(
        "/auth/confirm",
        window.location.origin,
      );

      callbackUrl.searchParams.set("next", "/reset-password");

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: callbackUrl.toString(),
        },
      );

      if (error) {
        throw error;
      }

      setStatusMessage(
        "If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder.",
      );

      setEmail("");
    } catch (error: unknown) {
      console.error("Password reset request failed:", error);

      setErrorMessage(
        "We couldn't process your request right now. Please try again in a moment.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true">
        <span className={styles.ambientOrbOne} />
        <span className={styles.ambientOrbTwo} />
        <span className={styles.ambientGrid} />
      </div>

      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Link
            href="/"
            className={styles.brand}
            aria-label="LifeOS home"
          >
            <span className={styles.brandMark}>
              L<span>.</span>
            </span>
            <span className={styles.brandName}>LifeOS</span>
          </Link>

          <Link href="/login" className={styles.backLink}>
            <ArrowLeft size={16} />
            <span>Back to sign in</span>
          </Link>
        </header>

        <section
          className={styles.formSection}
          style={{ margin: "56px auto" }}
        >
          <div className={styles.formCard}>
            <div className={styles.formIcon}>
              <Mail size={21} />
            </div>

            <div className={styles.formIntro}>
              <span className={styles.formEyebrow}>
                ACCOUNT RECOVERY
              </span>

              <h2>Forgot your password?</h2>

              <p>
                Enter your email address and we&apos;ll send you a link
                to reset your LifeOS password.
              </p>
            </div>

            {errorMessage && (
              <div className={styles.errorMessage} role="alert">
                <span className={styles.messageIcon}>!</span>
                <p>{errorMessage}</p>
              </div>
            )}

            {statusMessage && (
              <div className={styles.successMessage} role="status">
                <CheckCircle2 size={19} />
                <p>{statusMessage}</p>
              </div>
            )}

            <form
              method="post"
              className={styles.form}
              onSubmit={handleSubmit}
            >
              <div className={styles.field}>
                <label htmlFor="recovery-email">Email address</label>

                <div className={styles.inputWrap}>
                  <Mail size={18} />

                  <input
                    id="recovery-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                className={styles.submitButton}
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? (
                  "Sending reset link..."
                ) : (
                  <>
                    Send reset link
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className={styles.formDivider}>
              <span />
              <span>YOUR SPACE, YOUR PACE</span>
              <span />
            </div>

            <p className={styles.privacyNote}>
              <ShieldCheck size={15} />
              Password recovery is handled by Supabase authentication.
            </p>
          </div>
        </section>

        <footer className={styles.footer}>
          <span>One workspace. Many ways to grow.</span>
        </footer>
      </div>
    </main>
  );
}
