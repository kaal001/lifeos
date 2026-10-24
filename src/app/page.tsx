import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  CircleCheck,
  Dumbbell,
  Layers3,
  LockKeyhole,
  Menu,
  Sparkles,
  Target,
  Timer,
  Zap,
} from "lucide-react";

import styles from "./landing.module.css";

const features = [
  {
    icon: CircleCheck,
    number: "01",
    title: "My Day",
    description:
      "Turn your plans into manageable daily tasks. Set priorities, check off progress, and focus on what matters.",
    tag: "DAILY FOCUS",
  },
  {
    icon: Activity,
    number: "02",
    title: "Trackers",
    description:
      "Track the small things that add up: routines, study time, water intake, and personal habits.",
    tag: "BUILD CONSISTENCY",
  },
  {
    icon: Target,
    number: "03",
    title: "Goals",
    description:
      "Break big ambitions into smaller milestones and make your progress easier to see.",
    tag: "LONG-TERM GROWTH",
  },
  {
    icon: BookOpen,
    number: "04",
    title: "Academics",
    description:
      "Organise courses, assessments, marks, grading scales, and your academic progress in one place.",
    tag: "STUDY SMARTER",
  },
  {
    icon: Dumbbell,
    number: "05",
    title: "Fitness",
    description:
      "Plan your workout sessions, record exercises, and follow your training history.",
    tag: "MOVE FORWARD",
  },
  {
    icon: Layers3,
    number: "06",
    title: "Personal Growth",
    description:
      "Organise learning paths, practice sessions, milestones, projects, and useful resources.",
    tag: "KEEP LEARNING",
  },
];

const faqs = [
  {
    question: "What is LifeOS?",
    answer:
      "LifeOS is a personal productivity workspace for organising daily tasks, habits, goals, academics, fitness, learning, and progress.",
  },
  {
    question: "Is LifeOS free to use?",
    answer:
      "Yes. All currently planned workspaces are free. Premium access is not currently enabled, and there is no paid plan you need to purchase to get started.",
  },
  {
    question: "Can I use LifeOS on different devices?",
    answer:
      "LifeOS supports account-based cloud storage for connected workspaces. Sign in with the same account on another device to access supported data. Availability may vary by workspace.",
  },
  {
    question: "Can other users see my personal data?",
    answer:
      "LifeOS is being built with account-based access and database-level security. The multi-user data isolation needs to be fully tested before the app is opened for general use.",
  },
];

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <span id="top" className={styles.topAnchor} aria-hidden="true"/>
      <div className={styles.ambient} aria-hidden="true">
        <span className={styles.ambientOrbOne} />
        <span className={styles.ambientOrbTwo} />
        <span className={styles.ambientOrbThree} />
      </div>

      <header className={styles.header}>
        <a href="#top" className={styles.brand} aria-label="LifeOS home">
          <span className={styles.brandIcon} aria-hidden="true" />
          <span className={styles.brandText}>
            <strong>LifeOS</strong>
            <small>PERSONAL OPERATING SYSTEM</small>
          </span>
        </a>

        <nav className={styles.desktopNav} aria-label="Main navigation">
          <Link href="#features">Features</Link>
          <Link href="#how-it-works">How it works</Link>
          <Link href="#pricing">Pricing</Link>
        </nav>

        <div className={styles.headerActions}>
          <Link href="/login" className={styles.signInLink}>
            Sign in
          </Link>
          <Link href="/login?mode=signup" className={styles.headerCta}>
            Get started <ArrowRight size={15} />
          </Link>
        </div>

        <details className={styles.mobileMenu}>
          <summary aria-label="Open navigation menu">
            <Menu size={21} />
          </summary>
          <nav aria-label="Mobile navigation">
            <Link href="#features">Features</Link>
            <Link href="#how-it-works">How it works</Link>
            <Link href="#pricing">Pricing</Link>
            <Link href="/login">Sign in</Link>
            <Link href="/login?mode=signup">Create account</Link>
          </nav>
        </details>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>
            <span className={styles.liveDot} />
            <Sparkles size={14} />
            YOUR LIFE, MORE INTENTIONAL
          </div>

          <h1>
            Your life.
            <br />
            One clear
            <br />
            <span className={styles.heroGradient}>system.</span>
          </h1>

          <p className={styles.heroDescription}>
            Bring your daily plans, goals, studies, fitness, and personal
            growth into one thoughtful workspace. Less chaos. More progress.
          </p>

          <div className={styles.heroActions}>
            <Link href="/login?mode=signup" className={styles.primaryButton}>
              Get started for free
              <ArrowRight size={17} />
            </Link>

            <Link href="#features" className={styles.secondaryButton}>
              Explore LifeOS
              <ArrowDownRight size={17} />
            </Link>
          </div>

          <div className={styles.heroAssurance}>
            <span>
              <Check size={14} /> All current workspaces free
            </span>
            <span>
              <LockKeyhole size={14} /> Personal account access
            </span>
          </div>
        </div>

        <div className={styles.heroVisual} aria-label="Illustrative LifeOS dashboard preview">
          <div className={styles.visualHalo} />

          <div className={styles.visualTopLabel}>
            <span className={styles.visualStatus}>
              <span className={styles.liveDot} /> LIFEOS / OVERVIEW
            </span>
            <span className={styles.visualDate}>YOUR PERSONAL SPACE</span>
          </div>

          <div className={styles.mockWindow}>
            <div className={styles.mockSidebar}>
              <div className={styles.mockLogo}>L<span>.</span></div>
              <div className={`${styles.mockSideIcon} ${styles.mockSideActive}`}>
                <Layers3 size={15} />
              </div>
              <div className={styles.mockSideIcon}>
                <CircleCheck size={15} />
              </div>
              <div className={styles.mockSideIcon}>
                <Target size={15} />
              </div>
              <div className={styles.mockSideIcon}>
                <BookOpen size={15} />
              </div>
              <div className={styles.mockSideIcon}>
                <Dumbbell size={15} />
              </div>
            </div>

            <div className={styles.mockContent}>
              <div className={styles.mockTopbar}>
                <div>
                  <span>YOUR WORKSPACE</span>
                  <strong>Make today count.</strong>
                </div>
                <div className={styles.mockAvatar}>L</div>
              </div>

              <div className={styles.mockGreeting}>
                <div>
                  <small>YOUR MOMENTUM</small>
                  <h3>Progress, not perfection.</h3>
                  <p>Every small action adds up.</p>
                </div>
                <div className={styles.mockSpark}>
                  <Sparkles size={20} />
                </div>
              </div>

              <div className={styles.mockMetrics}>
                <div className={styles.mockMetric}>
                  <span className={styles.mockMetricIcon}>
                    <CircleCheck size={14} />
                  </span>
                  <small>TASKS</small>
                  <strong>04<span> / 06</span></strong>
                  <div className={styles.miniTrack}>
                    <span style={{ width: "66%" }} />
                  </div>
                </div>

                <div className={styles.mockMetric}>
                  <span className={styles.mockMetricIcon}>
                    <Timer size={14} />
                  </span>
                  <small>FOCUS</small>
                  <strong>2<span>h 15m</span></strong>
                  <div className={styles.miniTrack}>
                    <span style={{ width: "74%" }} />
                  </div>
                </div>
              </div>

              <div className={styles.mockTasks}>
                <div className={styles.mockSectionTitle}>
                  <span>Today&apos;s focus</span>
                  <small>YOUR PLAN</small>
                </div>

                <div className={styles.mockTask}>
                  <span className={styles.mockTaskCheck}>
                    <Check size={10} />
                  </span>
                  <span>Review priorities</span>
                  <small>DONE</small>
                </div>

                <div className={styles.mockTask}>
                  <span className={styles.mockTaskCheck} />
                  <span>Study something new</span>
                  <small>UP NEXT</small>
                </div>

                <div className={styles.mockTask}>
                  <span className={styles.mockTaskCheck} />
                  <span>Move your body</span>
                  <small>PLANNED</small>
                </div>
              </div>
            </div>
          </div>

          <div className={`${styles.floatingCard} ${styles.floatingCardProgress}`}>
            <span className={styles.floatingIcon}>
              <Target size={17} />
            </span>
            <span className={styles.floatingText}>
              <small>KEEP MOVING</small>
              <strong>One step at a time</strong>
            </span>
            <span className={styles.floatingArrow}>
              <ArrowRight size={14} />
            </span>
          </div>

          <div className={`${styles.floatingCard} ${styles.floatingCardFocus}`}>
            <span className={styles.focusRing}>
              <Zap size={16} />
            </span>
            <span>
              <small>YOUR NEXT CHAPTER</small>
              <strong>Starts with today.</strong>
            </span>
          </div>

          <div className={styles.visualFootnote}>
            <span className={styles.liveDot} />
            ONE WORKSPACE. MANY WAYS TO GROW.
          </div>
        </div>

        <a href="#features" className={styles.scrollCue} aria-label="Scroll to features">
          <span>SCROLL TO EXPLORE</span>
          <ChevronDown size={15} />
        </a>
      </section>

      <section className={styles.introStrip}>
        <p>A home for the things you&apos;re working toward.</p>
        <div className={styles.introItems}>
          <span><CircleCheck size={14} /> Daily focus</span>
          <span><Target size={14} /> Meaningful goals</span>
          <span><BookOpen size={14} /> Better learning</span>
          <span><Activity size={14} /> Real progress</span>
        </div>
      </section>

      <section id="features" className={styles.featuresSection}>
        <div className={styles.sectionHeading}>
          <span className={styles.sectionKicker}>ONE SPACE. MORE CLARITY.</span>
          <h2>
            Everything you need.
            <br />
            <span>Nothing you don&apos;t.</span>
          </h2>
          <p>
            Separate tools for different parts of life, connected through one
            consistent workspace.
          </p>
        </div>

        <div className={styles.featuresGrid}>
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <article className={styles.featureCard} key={feature.number}>
                <div className={styles.featureCardTop}>
                  <span className={styles.featureIcon}>
                    <Icon size={21} />
                  </span>
                  <span className={styles.featureNumber}>{feature.number}</span>
                </div>

                <span className={styles.featureTag}>{feature.tag}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>

                <div className={styles.featureCardBottom}>
                  <span>Explore your potential</span>
                  <ArrowRight size={15} />
                </div>
              </article>
            );
          })}
        </div>

        <p className={styles.featureNote}>
          <Sparkles size={15} />
          Your progress is personal. Build your own system, one step at a time.
        </p>
      </section>

      <section id="how-it-works" className={styles.workflowSection}>
        <div className={styles.workflowHeading}>
          <span className={styles.sectionKicker}>SIMPLE BY DESIGN</span>
          <h2>A better system.
            <br />
            <span>Three small steps.</span>
          </h2>
          <p>
            You don&apos;t need another complicated routine. You need a place
            to start and a clear way to keep going.
          </p>
        </div>

        <div className={styles.workflowSteps}>
          <article className={styles.workflowCard}>
            <span className={styles.workflowNumber}>01</span>
            <div className={styles.workflowIcon}><Layers3 size={22} /></div>
            <h3>Bring it together</h3>
            <p>Organise the work, routines, and goals that matter to you.</p>
          </article>

          <article className={styles.workflowCard}>
            <span className={styles.workflowNumber}>02</span>
            <div className={styles.workflowIcon}><Timer size={22} /></div>
            <h3>Show up daily</h3>
            <p>Make manageable plans and record the effort you put in.</p>
          </article>

          <article className={styles.workflowCard}>
            <span className={styles.workflowNumber}>03</span>
            <div className={styles.workflowIcon}><BarChart3 size={22} /></div>
            <h3>See your progress</h3>
            <p>Use your history and milestones to understand how you grow.</p>
          </article>
        </div>
      </section>

      <section id="pricing" className={styles.pricingSection}>
        <div className={styles.pricingCopy}>
          <span className={styles.sectionKicker}>NO PAYWALL TO GET STARTED</span>
          <h2>
            Your next step
            <br />
            <span>starts free.</span>
          </h2>
          <p>
            All current LifeOS workspaces are available for free. Build your
            routine and explore the tools without choosing a paid plan.
          </p>
          <div className={styles.pricingAssurance}>
            <Check size={16} /> No paid plan required
          </div>
          <div className={styles.pricingAssurance}>
            <Check size={16} /> All current workspaces included
          </div>
          <div className={styles.pricingAssurance}>
            <Check size={16} /> Premium features are not enabled yet
          </div>
        </div>

        <div className={styles.priceCard}>
          <div className={styles.priceCardGlow} />
          <div className={styles.priceTopline}>
            <span className={styles.pricePlanIcon}><Sparkles size={17} /></span>
            <span className={styles.pricePlanLabel}>THE LIFEOS PLAN</span>
            <span className={styles.priceBadge}>AVAILABLE NOW</span>
          </div>

          <h3>Free</h3>
          <div className={styles.priceValue}>
            <strong>$0</strong>
            <span> / forever, while offered free</span>
          </div>
          <p className={styles.priceDescription}>
            The complete starting workspace for your daily life.
          </p>

          <div className={styles.priceDivider} />

          <ul className={styles.priceFeatures}>
            {[
              "My Day task planning",
              "Trackers and personal goals",
              "Academics and grade tracking",
              "Fitness and workout logs",
              "Personal Growth workspace",
              "LifeOS Analytics",
            ].map((item) => (
              <li key={item}>
                <span><Check size={13} /></span>
                {item}
              </li>
            ))}
          </ul>

          <Link href="/login?mode=signup" className={styles.priceButton}>
            Create your free account <ArrowRight size={16} />
          </Link>

          <p className={styles.priceFootnote}>
            Premium plans are planned for the future and are not currently on sale.
          </p>
        </div>
      </section>

      <section className={styles.faqSection}>
        <div className={styles.sectionHeading}>
          <span className={styles.sectionKicker}>GOOD TO KNOW</span>
          <h2>Questions, answered.</h2>
          <p>A few things to know before you make LifeOS your own.</p>
        </div>

        <div className={styles.faqList}>
          {faqs.map((faq) => (
            <details className={styles.faqItem} key={faq.question}>
              <summary>
                {faq.question}
                <ChevronDown size={18} />
              </summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalCtaGlow} />
        <div className={styles.finalCtaIcon}><Sparkles size={21} /></div>
        <span className={styles.sectionKicker}>START WHERE YOU ARE</span>
        <h2>
          Make space for
          <br />
          <span>what matters.</span>
        </h2>
        <p>Your life is made of small moments. Give them a place to grow.</p>
        <Link href="/login?mode=signup" className={styles.primaryButton}>
          Start with LifeOS <ArrowRight size={17} />
        </Link>
      </section>

      <footer className={styles.footer}>
        <Link href="/" className={styles.footerBrand}>
          <span className={styles.brandIcon} aria-hidden="true" />
          <strong>LifeOS</strong>
        </Link>

        <p>Made for the life you&apos;re building.</p>

        <div className={styles.footerLinks}>
          <Link href="#features">Features</Link>
          <Link href="#pricing">Pricing</Link>
          <Link href="/login">Sign in</Link>
          <a
  href="https://mail.google.com/mail/?view=cm&fs=1&to=kaal2004n%40gmail.com&su=LifeOS%20Help"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Help and support: kaal2004n@gmail.com"
>
            Help: kaal2004n@gmail.com
          </a>
        </div>

        <span className={styles.copyright}>© 2026 LifeOS</span>
      </footer>
    </main>
  );
}
