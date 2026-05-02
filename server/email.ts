import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

export async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export async function sendPetOfTheDayEmail(to: string, petName: string, petId: number, avgRating: string, voteCount: number, baseUrl: string) {
  const { client, fromEmail } = await getUncachableResendClient();
  const petUrl = `${baseUrl}/pet/${petId}`;
  await client.emails.send({
    from: fromEmail || 'NowPetMe <onboarding@resend.dev>',
    to,
    subject: `🎉 ${petName} is today's Pet of the Day on NowPetMe!`,
    html: `
      <div style="font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 56px;">👑</div>
          <h1 style="margin: 8px 0 0; font-size: 26px; color: #1a1a1a;">Pet of the Day!</h1>
        </div>
        <p style="color: #333; font-size: 16px; line-height: 1.6; text-align: center;">
          Huge congrats — <strong>${petName}</strong> has been crowned today's Pet of the Day on NowPetMe! 🎉
        </p>
        <div style="background: linear-gradient(135deg, #FF6B6B22, #4ECDC422); border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
          <div style="font-size: 14px; color: #555;">Current rating</div>
          <div style="font-size: 32px; font-weight: 700; color: #1a1a1a;">⭐ ${avgRating} / 10</div>
          <div style="font-size: 13px; color: #666; margin-top: 4px;">${voteCount} ${voteCount === 1 ? 'vote' : 'votes'}</div>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${petUrl}" style="display: inline-block; background: #FF6B6B; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
            View ${petName}'s page
          </a>
        </div>
        <p style="color: #555; font-size: 14px; line-height: 1.6; text-align: center;">
          Now's the perfect time to share ${petName} on social media and rack up votes while they're in the spotlight!
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, token: string, baseUrl: string) {
  const { client, fromEmail } = await getUncachableResendClient();
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  await client.emails.send({
    from: fromEmail || 'NowPetMe <onboarding@resend.dev>',
    to,
    subject: 'Reset your NowPetMe password',
    html: `
      <div style="font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #FF6B6B; margin-bottom: 12px;">Reset your password</h1>
        <p style="color: #333; font-size: 15px; line-height: 1.6;">
          Someone (hopefully you!) requested a password reset for your NowPetMe account. Click the button below to choose a new password. This link expires in 1 hour.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #FF6B6B; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600;">
            Reset Password
          </a>
        </div>
        <p style="color: #888; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendVerificationEmail(to: string, token: string, baseUrl: string) {
  const { client, fromEmail } = await getUncachableResendClient();
  const verifyUrl = `${baseUrl}/api/auth/verify?token=${token}`;

  await client.emails.send({
    from: fromEmail || 'NowPetMe <onboarding@resend.dev>',
    to,
    subject: 'Verify your NowPetMe account',
    html: `
      <div style="font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; width: 48px; height: 48px; border-radius: 50%; background: #f87171; line-height: 48px; text-align: center;">
            <span style="color: white; font-size: 24px;">&#10084;</span>
          </div>
          <h1 style="margin: 12px 0 0; font-size: 24px; color: #1a1a1a;">NowPetMe</h1>
        </div>
        <h2 style="font-size: 20px; color: #1a1a1a; text-align: center;">Verify your email</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.6; text-align: center;">
          Click the button below to verify your email address and start sharing your pets with the world!
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${verifyUrl}" style="display: inline-block; background: #f87171; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
            Verify Email
          </a>
        </div>
        <p style="color: #999; font-size: 13px; text-align: center;">
          If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
