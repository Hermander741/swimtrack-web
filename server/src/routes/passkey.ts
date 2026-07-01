import { Router } from 'express'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  AuthenticatorTransportFuture,
  CredentialDeviceType,
} from '@simplewebauthn/server'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/auth'
import { issueTokens, COOKIE_OPTS } from '../utils/jwt'
import { ok, err } from '../types'
import type { User } from '../types'

export const passkeyRouter = Router()

const RP_ID = process.env.RP_ID ?? 'swimbase.at'
const RP_NAME = process.env.RP_NAME ?? 'SwimBase'
const ORIGIN = process.env.APP_URL ?? 'https://swimbase.at'

// In-memory challenge store (per user, short-lived)
const challenges = new Map<string, { challenge: string; expiresAt: number }>()

function storeChallenge(key: string, challenge: string) {
  challenges.set(key, { challenge, expiresAt: Date.now() + 5 * 60_000 })
}

function consumeChallenge(key: string): string | null {
  const entry = challenges.get(key)
  challenges.delete(key)
  if (!entry || entry.expiresAt < Date.now()) return null
  return entry.challenge
}

// ── Registration ─────────────────────────────────────────────────────────────

passkeyRouter.post('/register/begin', requireAuth(), async (req, res) => {
  try {
    const user = req.user!
    const { rows: existing } = await pool.query(
      'SELECT id FROM passkey_credentials WHERE user_id = $1',
      [user.id],
    )
    const excludeCredentials = existing.map((r: { id: string }) => ({
      id: r.id,
      transports: ['internal'] as AuthenticatorTransportFuture[],
    }))

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: Buffer.from(user.id),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    })

    storeChallenge(`reg:${user.id}`, options.challenge)
    res.json(ok(options))
  } catch (e) {
    console.error('passkey register begin:', e)
    res.status(500).json(err('Interner Fehler'))
  }
})

passkeyRouter.post('/register/complete', requireAuth(), async (req, res) => {
  try {
    const user = req.user!
    const challenge = consumeChallenge(`reg:${user.id}`)
    if (!challenge) { res.status(400).json(err('Challenge abgelaufen')); return }

    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json(err('Passkey-Registrierung fehlgeschlagen'))
      return
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo

    await pool.query(
      `INSERT INTO passkey_credentials (id, user_id, public_key, counter, device_type, backed_up)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET counter = EXCLUDED.counter`,
      [
        credential.id,
        user.id,
        Buffer.from(credential.publicKey),
        credential.counter,
        credentialDeviceType as CredentialDeviceType,
        credentialBackedUp,
      ],
    )

    res.json(ok({ verified: true }))
  } catch (e) {
    console.error('passkey register complete:', e)
    res.status(500).json(err('Interner Fehler'))
  }
})

// ── Authentication ────────────────────────────────────────────────────────────

passkeyRouter.post('/login/begin', async (req, res) => {
  try {
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'preferred',
      allowCredentials: [],
    })

    // Key by IP as anonymous pre-auth
    const key = `auth:${req.ip}`
    storeChallenge(key, options.challenge)
    res.json(ok(options))
  } catch (e) {
    console.error('passkey login begin:', e)
    res.status(500).json(err('Interner Fehler'))
  }
})

passkeyRouter.post('/login/complete', async (req, res) => {
  try {
    const key = `auth:${req.ip}`
    const challenge = consumeChallenge(key)
    if (!challenge) { res.status(400).json(err('Challenge abgelaufen')); return }

    const credId = req.body.id as string
    const { rows } = await pool.query<{
      id: string; user_id: string; public_key: Buffer; counter: number; device_type: string; backed_up: boolean
    }>(
      'SELECT id, user_id, public_key, counter, device_type, backed_up FROM passkey_credentials WHERE id = $1',
      [credId],
    )
    if (!rows[0]) { res.status(400).json(err('Passkey nicht gefunden')); return }

    const cred = rows[0]
    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: cred.id,
        publicKey: new Uint8Array(cred.public_key),
        counter: cred.counter,
        transports: ['internal'],
      },
    })

    if (!verification.verified) {
      res.status(401).json(err('Passkey-Authentifizierung fehlgeschlagen'))
      return
    }

    // Update counter
    await pool.query(
      'UPDATE passkey_credentials SET counter = $1 WHERE id = $2',
      [verification.authenticationInfo.newCounter, cred.id],
    )

    // Load user and issue tokens
    const { rows: users } = await pool.query<User>(
      'SELECT id, email, name, role, avatar_color, created_at FROM users WHERE id = $1',
      [cred.user_id],
    )
    if (!users[0]) { res.status(404).json(err('Benutzer nicht gefunden')); return }

    const user = users[0]
    const { accessToken, rawToken, tokenHash, tokenSelector, expiresAt } = await issueTokens(user)
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, token_selector, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, tokenHash, tokenSelector, expiresAt],
    )

    res.cookie('rt', `${rawToken}.${tokenSelector}`, COOKIE_OPTS).json(ok({ accessToken, user }))
  } catch (e) {
    console.error('passkey login complete:', e)
    res.status(500).json(err('Interner Fehler'))
  }
})

// ── List & Delete ─────────────────────────────────────────────────────────────

passkeyRouter.get('/', requireAuth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, device_type, backed_up, created_at FROM passkey_credentials WHERE user_id = $1 ORDER BY created_at',
      [req.user!.id],
    )
    res.json(ok(rows))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

passkeyRouter.delete('/:id', requireAuth(), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM passkey_credentials WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id],
    )
    res.json(ok(null))
  } catch { res.status(500).json(err('Interner Fehler')) }
})
