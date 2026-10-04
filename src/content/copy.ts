/**
 * All user-facing wording in one place. Edit freely; no code changes needed.
 * Keep it plain English: no jargon, short sentences.
 */

// TODO(brand): confirm these addresses.
export const SUPPORT_EMAIL = 'hello@coherent.agency'
/** The email clients invite to Webflow, Google Tag Manager, Analytics, etc. */
export const ACCESS_EMAIL = 'access@coherent.agency'
export const MARKETING_SITE_URL = 'https://coherent.agency'
export const COMPANY_NAME = 'Coherent Agency'

export const copy = {
  appName: 'Coherent',

  landing: {
    visitSite: 'Visit coherent.agency',
    headline: 'Follow your project, step by step.',
    support: 'See what is done, what is next, and when it will be ready.',
    chooseLabel: 'How would you like to continue?',
    client: {
      title: "I'm a client",
      body: 'Track progress, due dates, and approvals for your project.',
      cta: 'Continue as client',
    },
    team: {
      title: "I'm on the Coherent team",
      body: 'Track time, update tasks, and share progress with clients.',
      cta: 'Continue as team member',
    },
    howTitle: 'How it works',
    how: [
      { title: 'Share access', body: 'Give us access to your tools in a few guided steps. Never your passwords.' },
      { title: 'Watch progress', body: 'See each stage, every update, and your due date in one place.' },
      { title: 'Review and approve', body: 'Leave feedback right on the page and approve when you are happy.' },
    ],
    footerSupport: 'Questions? Email us at',
  },

  login: {
    clientTitle: 'Client login',
    teamTitle: 'Team login',
    intro: 'Enter your email and we will send you a link to log in. No password needed.',
    switchToTeam: 'Not a client? Team login',
    switchToClient: 'Not on the team? Client login',
    emailLabel: 'Email address',
    submit: 'Send me a login link',
    sending: 'Sending…',
    notFoundTitle: 'We could not find an account for this email.',
    notFoundBody: 'Check the spelling, or create an account. It only takes a minute.',
    createAccount: 'Create account',
    tryAnother: 'Try a different email',
    back: 'Back',
    noAccount: 'New here?',
    devTitle: 'Developer login (only shown in development)',
    devPassword: 'Password',
    devSubmit: 'Log in with password',
  },

  signup: {
    clientTitle: 'Create your client account',
    teamTitle: 'Join the Coherent team',
    clientIntro: 'Tell us who you are. We will send you a link to finish signing up.',
    teamIntro: 'Use your work email. An admin will check your account before you can see projects.',
    fullName: 'Your full name',
    companyName: 'Company name',
    email: 'Email address',
    submit: 'Create account',
    submitting: 'Creating…',
    haveAccount: 'Already have an account?',
    logIn: 'Log in',
  },

  checkEmail: {
    title: 'Check your email',
    body: (email: string) => `We sent a link to ${email}. Open it on this device to continue.`,
    hint: 'It can take a minute to arrive. Check your spam folder too.',
    resend: 'Send the link again',
    resendIn: (s: number) => `You can resend in ${s}s`,
    resent: 'A new link is on its way.',
    useDifferent: 'Use a different email',
  },

  callback: {
    working: 'Logging you in…',
    failedTitle: 'That link did not work',
    failedBody: 'Login links expire after a while and can only be used once. Please ask for a new one.',
    newLink: 'Get a new login link',
  },

  pending: {
    title: 'Your account is waiting for approval',
    body: 'Thanks for signing up. An admin at Coherent will check your account soon. We will email you when you can log in.',
    rejectedTitle: 'Your account was not approved',
    rejectedBody: 'If you think this is a mistake, please contact us.',
    signOut: 'Sign out',
  },

  clientHome: {
    title: 'Your projects',
    noOrgTitle: 'Welcome.',
    noOrgBody: 'The Coherent team is setting up your project. We will email you when it is ready.',
    noProjects: 'There are no projects here yet. We will email you as soon as one is ready.',
    shareAccess: 'Share access',
    open: 'Open project',
  },

  project: {
    timeline: 'Project stages',
    activity: 'Latest updates',
    noActivity: 'No updates yet. You will see progress here as soon as we share it.',
    thisWeek: 'This week',
    accessCard: 'Access steps',
    qaCard: 'Review and feedback',
    requestCard: 'Ask for something',
    stagingCard: 'Preview your site',
    dueHistory: 'Due date changed',
  },

  access: {
    title: 'Share access',
    intro: 'Each step takes a couple of minutes. Your answers save as you go, so you can come back any time.',
    neverPasswords: 'Never share passwords here. We only need IDs and links. Invite our email instead.',
    inviteEmailLabel: 'Our email to invite',
    statusLabel: 'Where are you with this step?',
    statusPending: 'Not done yet',
    statusProvided: "I've done this",
    statusSkipped: 'Already shared before',
    skippedNote: 'Who did you share it with, and when?',
    skippedNotePlaceholder: 'e.g. Sent to Sadman by email on 3 March',
    verifiedNote: 'Checked by our team. Thank you!',
    saved: 'Saved',
    saving: 'Saving…',
    back: 'Back',
    next: 'Next',
    review: 'Review',
    secretWarning: 'This looks like a password or secret. Please do not share passwords here. Invite our email instead.',
    letsGo: "Let's Go",
    letsGoHelp: 'Ready? Tell us to start the project.',
    letsGoBlocked: 'Please complete the Webflow step first. We need it to start.',
    letsGoWarning: 'Some steps are still not done. You can still start, and finish them later.',
    confirmTitle: 'Start your project?',
    confirmBody: 'We will let the team know you are ready, and email you a short kickoff summary.',
    confirmPendingIntro: 'These steps are still not done:',
    confirm: 'Yes, start the project',
    cancel: 'Not yet',
    started: 'Your project has started. We have emailed you a kickoff summary.',
    alreadyStarted: 'Your project has already started.',
  },

  qa: {
    title: 'Review and feedback',
    intro: 'We use Webvizio so you can click anywhere on your site and leave a comment.',
    open: 'Open Webvizio',
    notReady: 'Your review link is not ready yet. We will let you know when it is.',
    showHere: 'Show it here',
    hide: 'Hide',
    embedNote: 'If the page below stays blank, use the "Open Webvizio" button instead.',
  },

  request: {
    title: 'Ask for something',
    intro: 'Need a change, or found something broken? Tell us here and the team will get back to you.',
    kindLabel: 'What is it?',
    kindRequest: 'A new request',
    kindBug: 'Something is broken',
    projectLabel: 'Which project?',
    titleLabel: 'Short summary',
    titlePlaceholder: 'e.g. Add a new team member to the About page',
    detailsLabel: 'Details (optional)',
    pageLabel: 'Page link (optional)',
    submit: 'Send to the team',
    sent: 'Thanks! The team has your message.',
  },

  errors: {
    generic: 'Something went wrong. Please try again.',
    network: 'We could not reach the server. Check your connection and try again.',
    rateLimit: 'Too many emails were sent just now. Please wait a minute and try again.',
    invalidEmail: 'Please enter a valid email address.',
    required: 'This field is required.',
    notConfigured: 'The app is not connected to its database yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    permission: 'You do not have permission to do that.',
  },
} as const
