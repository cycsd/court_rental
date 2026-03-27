import nodemailer from "nodemailer";

type EmailInput = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
};

export async function sendEmail(input: EmailInput): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: input.host,
    port: input.port,
    secure: input.secure,
    auth: {
      user: input.user,
      pass: input.pass
    }
  });

  await transporter.sendMail({
    from: input.from,
    to: input.to.join(","),
    subject: input.subject,
    text: input.text
  });
}
