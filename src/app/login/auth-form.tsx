
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import styles from "./auth-form.module.css";

type AuthMode = "signin" | "signup";

function getSafeNextPath(candidate: string | null): string {
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    candidate === "/login" ||
    candidate.startsWith("/login?")
  ) {
    return "/dashboard";
  }

  return candidate;
}

export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get("mode");

  const [mode, setMode] = useState<AuthMode>(
    requestedMode === "signup" ? "signup" : "signin",
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const currentYear = new Date().getFullYear();

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrorMessage("");
    setStatusMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");

    if (mode === "signup") {
      if (fullName.trim().length < 2) {
        setErrorMessage("Please enter your name.");
        return;
      }

      if (password.length < 8) {
        setErrorMessage("Your password must contain at least 8 characters.");
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage("Your passwords don't match. Please check them.");
        return;
      }
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo:
              `${window.location.origin}/auth/confirm?next=` +
              encodeURIComponent(nextPath),
            data: {
              display_name: fullName.trim(),
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          router.replace(nextPath);
          router.refresh();
          return;
        }

        setStatusMessage(
          "Your account request was submitted. Check your email for the confirmation link, then use it to activate your account.",
        );
        setPassword("");
        setConfirmPassword("");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        router.replace(nextPath);
        router.refresh();
      }
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
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
            <span className={styles.brandIcon} aria-hidden="true" />
            <span className={styles.brandName}>LifeOS</span>
          </Link>

          <Link href="/" className={styles.backLink}>
            <span>Back to home</span>
            <ArrowRight size={16} />
          </Link>
        </header>

        <div className={styles.layout}>
          <section className={styles.story}>
            <div className={styles.storyEyebrow}>
              <span className={styles.statusDot} />
              <Sparkles size={15} />
              <span>YOUR PERSONAL OPERATING SYSTEM</span>
            </div>

            <h1 className={styles.headline}>
              Make room for
              <br />
              what <span>matters.</span>
            </h1>

            <p className={styles.description}>
              Your daily plans, goals, studies, fitness, and personal growth.
              One thoughtful workspace, built around your life.
            </p>

            <div className={styles.benefits}>
              <div className={styles.benefit}>
                <span className={styles.benefitIcon}>
                  <CheckCircle2 size={17} />
                </span>
                <span>Bring your routines into one place</span>
              </div>
              <div className={styles.benefit}>
                <span className={styles.benefitIcon}>
                  <ShieldCheck size={17} />
                </span>
                <span>Your own account and personal workspace</span>
              </div>
              <div className={styles.benefit}>
                <span className={styles.benefitIcon}>
                  <Activity size={17} />
                </span>
                <span>Small steps. Steady progress.</span>
              </div>
            </div>

            <div className={styles.preview}>
              <div className={styles.previewTopbar}>
                <div className={styles.windowDots}>
                  <span />
                  <span />
                  <span />
                </div>
                <span className={styles.previewLabel}>LIFEOS / OVERVIEW</span>
                <span className={styles.previewLive}>
                  <span className={styles.statusDot} />
                  PERSONAL SPACE
                </span>
              </div>

              <div className={styles.previewBody}>
                <div className={styles.previewHeading}>
                  <div>
                    <span className={styles.previewKicker}>YOUR NEXT CHAPTER</span>
                    <h2>Make today count.</h2>
                  </div>
                  <span className={styles.previewSpark}>
                    <Sparkles size={20} />
                  </span>
                </div>

                <div className={styles.previewQuote}>
                  <span className={styles.previewKicker}>YOUR MOMENTUM</span>
                  <p>Progress, not perfection.</p>
                  <span>Every small action adds up.</span>
                </div>

                <div className={styles.previewCards}>
                  <div className={styles.previewMiniCard}>
                    <span className={styles.previewMiniIcon}>
                      <Target size={17} />
                    </span>
                    <span className={styles.previewKicker}>YOUR GOALS</span>
                    <strong>One step at a time</strong>
                    <div className={styles.progressTrack}>
                      <span />
                    </div>
                  </div>

                  <div className={styles.previewMiniCard}>
                    <span className={styles.previewMiniIcon}>
                      <BookOpen size={17} />
                    </span>
                    <span className={styles.previewKicker}>YOUR LEARNING</span>
                    <strong>Keep moving forward</strong>
                    <div className={styles.progressTrack}>
                      <span />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className={styles.storyFooter}>
              <LockKeyhole size={13} />
              A personal space for your next step.
            </p>
          </section>

          <section className={styles.formSection}>
            <div className={styles.formCard}>
              <div className={styles.formIcon}>
                <LockKeyhole size={21} />
              </div>

              <div className={styles.formIntro}>
                <span className={styles.formEyebrow}>
                  {mode === "signin" ? "WELCOME BACK" : "YOUR NEXT CHAPTER"}
                </span>
                <h2>
                  {mode === "signin" ? "Sign in to LifeOS" : "Create your account"}
                </h2>
                <p>
                  {mode === "signin"
                    ? "Pick up where you left off."
                    : "Start building a more intentional day."}
                </p>
              </div>

              <div className={styles.modeSwitch} role="tablist" aria-label="Account access">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "signin"}
                  className={mode === "signin" ? styles.modeActive : styles.modeButton}
                  onClick={() => changeMode("signin")}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "signup"}
                  className={mode === "signup" ? styles.modeActive : styles.modeButton}
                  onClick={() => changeMode("signup")}
                >
                  Create account
                </button>
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

              <form method="post" className={styles.form} onSubmit={handleSubmit}>
                {mode === "signup" && (
                  <div className={styles.field}>
                    <label htmlFor="fullName">Full name</label>
                    <div className={styles.inputWrap}>
                      <UserRound size={18} />
                      <input
                        id="fullName"
                        name="name"
                        type="text"
                        autoComplete="name"
                        placeholder="Your name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        minLength={2}
                        required
                      />
                    </div>
                  </div>
                )}

                <div className={styles.field}>
                  <label htmlFor="email">Email address</label>
                  <div className={styles.inputWrap}>
                    <Mail size={18} />
                    <input
                      id="email"
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

                <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label htmlFor="password">Password</label>

                  {mode === "signup" ? (
                    <span className={styles.fieldHint}>8+ characters</span>
                  ) : (
                    <Link
                      href="/forgot-password"
                      style={{
                        color: "var(--accent)",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Forgot password?
                    </Link>
                  )}
                </div>
                  <div className={styles.inputWrap}>
                    <LockKeyhole size={18} />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={mode === "signup" ? 8 : undefined}
                      required
                    />
                    <button
                      className={styles.visibilityButton}
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {mode === "signup" && (
                  <div className={styles.field}>
                    <label htmlFor="confirmPassword">Confirm password</label>
                    <div className={styles.inputWrap}>
                      <LockKeyhole size={18} />
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Enter your password again"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        minLength={8}
                        required
                      />
                      <button
                        className={styles.visibilityButton}
                        type="button"
                        onClick={() => setShowConfirmPassword((visible) => !visible)}
                        aria-label={
                          showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"
                        }
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                )}

                <button className={styles.submitButton} type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <LoaderCircle className={styles.spinner} size={18} />
                      Please wait...
                    </>
                  ) : (
                    <>
                      {mode === "signin" ? "Sign in to your workspace" : "Create my free account"}
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
                Your account is protected by Supabase authentication.
              </p>

              <p className={styles.switchPrompt}>
                {mode === "signin" ? "New to LifeOS?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => changeMode(mode === "signin" ? "signup" : "signin")}
                >
                  {mode === "signin" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </div>

            <p className={styles.legalNote}>
              By continuing, you agree to use your account responsibly and keep
              your sign-in details secure.
            </p>
          </section>
        </div>

        <footer className={styles.footer}>
          <span>© {currentYear} LifeOS</span>
          <span>One workspace. Many ways to grow.</span>
        </footer>
      </div>
    </main>
  );
}
