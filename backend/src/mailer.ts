import nodemailer from "nodemailer";

// one ethereal test account per sender, created lazily and reused after that
const transporters = new Map<string, Promise<nodemailer.Transporter>>();

async function getTransporterFor(sender: string): Promise<nodemailer.Transporter> {
  if (transporters.has(sender)) {
    return transporters.get(sender)!;
  }

  const promise = (async () => {
    // 1. If explicit SMTP credentials are provided in env, use them
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }

    // 2. If Ethereal credentials are provided in env, use them
    if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS) {
      return nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: process.env.ETHEREAL_USER,
          pass: process.env.ETHEREAL_PASS,
        },
      });
    }

    // 3. Otherwise dynamically create a separate Ethereal test account per sender
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log(`[mailer] created ethereal account for sender "${sender}": ${testAccount.user}`);

      return nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
    } catch (err: any) {
      // Remove from cache so subsequent retries are not stuck on the same failure
      transporters.delete(sender);
      console.error(`[mailer] failed to create test account for "${sender}":`, err.message);
      throw err;
    }
  })();

  transporters.set(sender, promise);
  return promise;
}

export async function sendEmail(options: {
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  const transporter = await getTransporterFor(options.from);
  const info = await transporter.sendMail(options);
  return {
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl(info) || null,
  };
}
