
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import styles from "../login/auth-form.module.css";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const supabase = createClient();

        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (active) {
          setHasSession(!error && Boolean(user));
        }
      } catch {
        if (active) {
          setHasSession(false);
        }
      } finally {
        if (active) {
          setIsCheckingSession(false);
        }
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (isCheckingSession) {
      setErrorMessage("Please wait while we verify your session.");
      return;
    }

    if (!hasSession) {
      setErrorMessage(
        "Open a valid reset link from your email before updating your password.",
      );
      return;
    }

    if (password.length < 8) {
      setErrorMessage(
        "Your password must contain at least 8 characters.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(
        "Your passwords don't match. Please check them.",
      );
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      // End this browser's session after the password is changed.
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "local",
      });

      if (signOutError) {
        console.error(
          "Password changed, but local sign-out failed:",
          signOutError,
        );

        setErrorMessage(
          "Your password was changed, but we couldn't end this session. Please sign out before sharing this device.",
        );
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setHasSession(false);
      setIsComplete(true);
    } catch (error: unknown) {
      console.error("Password update failed:", error);

      setErrorMessage(
        "We couldn't update your password. The reset link may have expired or already been used. Request a new reset link and try again.",
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
          <Link href="/" className={styles.brand} aria-label="LifeOS home">
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
              <LockKeyhole size={21} />
            </div>

            <div className={styles.formIntro}>
              <span className={styles.formEyebrow}>
                ACCOUNT SECURITY
              </span>

              <h2>
                {isComplete
                  ? "Password updated"
                  : "Create a new password"}
              </h2>

              <p>
                {isComplete
                  ? "Your password has been changed. Sign in using your new password."
                  : isCheckingSession
                    ? "Verifying your password reset session..."
                    : !hasSession
                      ? "Use a valid password reset link from your email to continue."
                      : "Choose a strong password with at least 8 characters for your LifeOS account."}
              </p>
            </div>

            {isCheckingSession ? (
              <div className={styles.successMessage} role="status">
                <p>Verifying your password reset link...</p>
              </div>
            ) : isComplete ? (
              <>
                <div className={styles.successMessage} role="status">
                  <CheckCircle2 size={19} />
                  <p>Your password was updated successfully.</p>
                </div>

                <Link
                  href="/login"
                  className={styles.submitButton}
                  style={{
                    marginTop: 24,
                    textDecoration: "none",
                  }}
                >
                  Return to sign in
                  <ArrowRight size={18} />
                </Link>
              </>
            ) : !hasSession ? (
              <>
                <div className={styles.errorMessage} role="alert">
                  <span className={styles.messageIcon}>!</span>
                  <p>
                    This reset link is invalid, expired, or no longer
                    active. Request a new password reset link to continue.
                  </p>
                </div>

                <Link
                  href="/forgot-password"
                  className={styles.submitButton}
                  style={{
                    marginTop: 24,
                    textDecoration: "none",
                  }}
                >
                  Request a new reset link
                  <ArrowRight size={18} />
                </Link>
              </>
            ) : (
              <>
                {errorMessage && (
                  <div className={styles.errorMessage} role="alert">
                    <span className={styles.messageIcon}>!</span>
                    <p>{errorMessage}</p>
                  </div>
                )}

                <form
                  method="post"
                  className={styles.form}
                  onSubmit={handleSubmit}
                >
                  <div className={styles.field}>
                    <label htmlFor="new-password">
                      New password
                    </label>

                    <div className={styles.inputWrap}>
                      <LockKeyhole size={18} />

                      <input
                        id="new-password"
                        name="newPassword"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Enter a new password"
                        value={password}
                        onChange={(event) =>
                          setPassword(event.target.value)
                        }
                        minLength={8}
                        required
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="confirm-new-password">
                      Confirm new password
                    </label>

                    <div className={styles.inputWrap}>
                      <LockKeyhole size={18} />

                      <input
                        id="confirm-new-password"
                        name="confirmNewPassword"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Enter your new password again"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        minLength={8}
                        required
                      />
                    </div>
                  </div>

                  <button
                    className={styles.submitButton}
                    type="submit"
                    disabled={isLoading || isCheckingSession}
                  >
                    {isLoading ? (
                      "Updating password..."
                    ) : (
                      <>
                        Update password
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}

            <p className={styles.privacyNote}>
              <ShieldCheck size={15} />
              Password updates are handled by Supabase authentication.
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
