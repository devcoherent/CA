import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fakeSupabase, resetState, state } from '@/test/mockSupabase'

vi.mock('@/lib/supabase', () => ({ supabase: fakeSupabase, isSupabaseConfigured: true }))
const { renderApp } = await import('@/test/renderApp')

beforeEach(() => {
  resetState()
  sessionStorage.clear()
})

describe('landing page', () => {
  test('shows both role cards', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Follow your project, step by step.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /I'm a client/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /I'm on the Coherent team/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How it works' })).toBeInTheDocument()
  })

  test('the client card leads to the client login and remembers the choice', async () => {
    renderApp('/')
    await userEvent.click(await screen.findByRole('button', { name: /I'm a client/ }))
    expect(await screen.findByRole('heading', { name: 'Client login' })).toBeInTheDocument()
    expect(sessionStorage.getItem('coherent.portalRole')).toBe('client')
  })

  test('the team card leads to the team login and is keyboard accessible', async () => {
    renderApp('/')
    const card = await screen.findByRole('button', { name: /I'm on the Coherent team/ })
    card.focus()
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: 'Team login' })).toBeInTheDocument()
    expect(sessionStorage.getItem('coherent.portalRole')).toBe('team')
  })
})

describe('login', () => {
  test('an unknown email shows the "Create account" prompt', async () => {
    state.otp = { error: { code: 'otp_disabled', message: 'Signups not allowed for otp', status: 422 } }
    renderApp('/login?role=client')
    await userEvent.type(await screen.findByLabelText('Email address', { selector: '#login-email' }), 'new@person.test')
    await userEvent.click(screen.getByRole('button', { name: 'Send me a login link' }))
    expect(await screen.findByText('We could not find an account for this email.')).toBeInTheDocument()
    const create = screen.getByRole('link', { name: 'Create account' })
    expect(create).toHaveAttribute('href', '/signup?role=client&email=new%40person.test')
    expect(state.otpCalls[0]).toMatchObject({ email: 'new@person.test', options: { shouldCreateUser: false } })
  })

  test('a known email shows "Check your email" with a resend cooldown', async () => {
    renderApp('/login?role=team')
    await userEvent.type(await screen.findByLabelText('Email address', { selector: '#login-email' }), 'will@coherent.test')
    await userEvent.click(screen.getByRole('button', { name: 'Send me a login link' }))
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /You can resend in \d+s/ })).toBeDisabled()
  })

  test('rate limits show a friendly message, not a raw error', async () => {
    state.otp = { error: { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded', status: 429 } }
    renderApp('/login')
    await userEvent.type(await screen.findByLabelText('Email address', { selector: '#login-email' }), 'will@coherent.test')
    await userEvent.click(screen.getByRole('button', { name: 'Send me a login link' }))
    expect(await screen.findByText(/Too many emails were sent just now/)).toBeInTheDocument()
  })

  test('the wrong-role link switches between client and team login', async () => {
    renderApp('/login?role=client')
    await userEvent.click(await screen.findByRole('link', { name: 'Not a client? Team login' }))
    expect(await screen.findByRole('heading', { name: 'Team login' })).toBeInTheDocument()
  })
})

describe('signup', () => {
  test('client signup sends only full_name and company_name as metadata', async () => {
    renderApp('/signup?role=client')
    await userEvent.type(await screen.findByLabelText('Your full name'), 'Maya Chen')
    await userEvent.type(screen.getByLabelText('Company name'), 'Acme Bakery')
    await userEvent.type(screen.getByLabelText('Email address'), 'maya@acme.test')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(state.otpCalls[0]).toMatchObject({
      email: 'maya@acme.test',
      options: { shouldCreateUser: true, data: { full_name: 'Maya Chen', company_name: 'Acme Bakery' } },
    })
    const data = (state.otpCalls[0] as { options: { data: Record<string, unknown> } }).options.data
    expect(Object.keys(data).sort()).toEqual(['company_name', 'full_name'])
  })

  test('team signup has no company field and sends only full_name', async () => {
    renderApp('/signup?role=team')
    await userEvent.type(await screen.findByLabelText('Your full name'), 'Sam')
    expect(screen.queryByLabelText('Company name')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Email address'), 'sam@coherent.test')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await screen.findByRole('heading', { name: 'Check your email' })
    expect((state.otpCalls[0] as { options: { data: unknown } }).options.data).toEqual({ full_name: 'Sam' })
  })

  test('validates required fields with friendly messages', async () => {
    renderApp('/signup?role=client')
    await userEvent.click(await screen.findByRole('button', { name: 'Create account' }))
    expect(screen.getAllByText('This field is required.')).toHaveLength(2)
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument()
    expect(state.otpCalls).toHaveLength(0)
  })
})

describe('signed-in users are redirected to their dashboard', () => {
  const account = (role: string, status = 'approved') => ({
    id: 'u1', role, status, email: 'x@x.test', full_name: 'X', avatar_url: null, org_id: null, timezone: 'UTC', theme_preference: 'system', requested_company_name: null,
  })

  for (const path of ['/', '/login', '/signup']) {
    test(`client on ${path} → /client`, async () => {
      state.session = { user: { id: 'u1' } }
      state.account = account('client')
      renderApp(path)
      expect(await screen.findByText('Welcome.')).toBeInTheDocument()
    })
  }

  test('team member on / → team dashboard', async () => {
    state.session = { user: { id: 'u1' } }
    state.account = account('team')
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'My projects' })).toBeInTheDocument()
  })

  test('pending user on /login → /pending', async () => {
    state.session = { user: { id: 'u1' } }
    state.account = account('team', 'pending')
    renderApp('/login?role=team')
    expect(await screen.findByRole('heading', { name: 'Your account is waiting for approval' })).toBeInTheDocument()
  })

  test('the ?role value never decides the dashboard: a client opening /login?role=team goes to /client', async () => {
    state.session = { user: { id: 'u1' } }
    state.account = account('client')
    renderApp('/login?role=team')
    await waitFor(() => expect(screen.getByText('Welcome.')).toBeInTheDocument())
  })

  test('a client cannot open team or admin pages', async () => {
    state.session = { user: { id: 'u1' } }
    state.account = account('client')
    renderApp('/admin')
    expect(await screen.findByText('Welcome.')).toBeInTheDocument()
  })
})
