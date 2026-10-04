/**
 * The short visual guide on the QA page. Edit freely.
 * `icon` is one of: cursor, comment, pin, check.
 */
export const QA_GUIDE: { icon: 'cursor' | 'comment' | 'pin' | 'check'; title: string; body: string }[] = [
  {
    icon: 'cursor',
    title: 'Open your review link',
    body: 'Click "Open Webvizio". Your site opens with a small toolbar on the side.',
  },
  {
    icon: 'pin',
    title: 'Click the spot you want to change',
    body: 'Turn on comment mode, then click any text, image or button on the page.',
  },
  {
    icon: 'comment',
    title: 'Write what you would like',
    body: 'Keep it short, for example "Make this headline bigger". You can add a screenshot too.',
  },
  {
    icon: 'check',
    title: 'Send it',
    body: 'Press send. We get your comment right away and will reply in the same place.',
  },
]
