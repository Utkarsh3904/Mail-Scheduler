import nodemailer from "nodemailer";

// one ethereal test account per sender, created lazily and reused after that
const transporters = new Map<string, Promise<nodemailer.Transporter>>();

async function getTransporterFor(sender: string) {
  if (transporters.has(sender)) {
    return transporters.get(sender)!;
  }

  const promise = (async () => {
    const testAccount = await nodemailer.createTestAccount();
    console.log(`created ethereal account for sender "${sender}": ${testAccount.user}`);

    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
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
