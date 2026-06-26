import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

export async function sendInvitationEmail(to: string, role: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const link = `${appUrl}/register?token=${token}`
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject: 'Einladung zur Mermaids App',
      html: `
        <p>Du wurdest als <strong>${role}</strong> zur Mermaids Schwimmverein App eingeladen.</p>
        <p><a href="${link}">Jetzt registrieren</a></p>
        <p>Dieser Link ist 7 Tage gültig.</p>
      `,
    })
  } catch (e) {
    console.error('sendInvitationEmail failed:', e)
  }
}
