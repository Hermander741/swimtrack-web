import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.MAIL_FROM ?? 'SwimBase <noreply@swimbase.at>'
const APP_URL = process.env.APP_URL ?? 'https://swimbase.at'

export async function sendInvitationEmail(to: string, role: string, token: string): Promise<void> {
  const link = `${APP_URL}/register?token=${token}`
  const roleLabel: Record<string, string> = {
    admin: 'Administrator',
    trainer: 'Trainer',
    eltern: 'Elternteil',
    mitglied: 'Mitglied',
  }
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Einladung zur Mermaids App',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px;">
          <img src="https://swimbase.at/swimbase-logo.png" alt="SwimBase" style="width:64px;height:64px;border-radius:14px;margin-bottom:20px;display:block;" />
          <h2 style="margin:0 0 8px;color:#0f172a;">Willkommen bei SwimBase</h2>
          <p style="color:#475569;margin:0 0 24px;">Du wurdest als <strong>${roleLabel[role] ?? role}</strong> zur Mermaids Wien App eingeladen.</p>
          <a href="${link}" style="display:inline-block;padding:14px 28px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;">Jetzt registrieren</a>
          <p style="color:#94a3b8;font-size:13px;margin:24px 0 0;">Dieser Link ist 7 Tage gültig. Falls du diese Einladung nicht erwartet hast, kannst du sie ignorieren.</p>
        </div>
      `,
    })
  } catch (e) {
    console.error('sendInvitationEmail failed:', e)
  }
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${APP_URL}/reset-password?token=${token}`
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Passwort zurücksetzen – SwimBase',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px;">
          <img src="https://swimbase.at/swimbase-logo.png" alt="SwimBase" style="width:64px;height:64px;border-radius:14px;margin-bottom:20px;display:block;" />
          <h2 style="margin:0 0 8px;color:#0f172a;">Passwort zurücksetzen</h2>
          <p style="color:#475569;margin:0 0 24px;">Du hast eine Passwort-Zurücksetzen-Anfrage gestellt. Klicke auf den Button um ein neues Passwort zu setzen.</p>
          <a href="${link}" style="display:inline-block;padding:14px 28px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;">Passwort zurücksetzen</a>
          <p style="color:#94a3b8;font-size:13px;margin:24px 0 0;">Dieser Link ist 1 Stunde gültig. Falls du kein Passwort zurücksetzen wolltest, ignoriere diese E-Mail.</p>
        </div>
      `,
    })
  } catch (e) {
    console.error('sendPasswordResetEmail failed:', e)
  }
}
