import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail({ to, subject, html, from }: SendEmailOptions): Promise<boolean> {
  if (!resend) {
    console.log("[Email] RESEND_API_KEY no configurado, email no enviado:", subject);
    return false;
  }

  try {
    await resend.emails.send({
      from: from || process.env.EMAIL_FROM || "ProfesorApp <onboarding@resend.dev>",
      to,
      subject,
      html,
    });
    console.log(`[Email] Enviado a ${to}: ${subject}`);
    return true;
  } catch (error: any) {
    console.error("[Email] Error enviando:", error.message);
    return false;
  }
}

export function buildReminderEmail(params: {
  teacherName: string;
  reminderTitle: string;
  reminderMessage?: string;
  dueDate?: string;
  groupName?: string;
  studentName?: string;
}): string {
  const { teacherName, reminderTitle, reminderMessage, dueDate, groupName, studentName } = params;

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; border: 1px solid #e9ecef;">
        <h2 style="margin: 0 0 16px 0; color: #1a1a1a;">📚 ProfesorApp - Recordatorio</h2>

        <p>Hola <strong>${teacherName}</strong>,</p>

        <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #3b82f6;">
          <h3 style="margin: 0 0 8px 0; color: #1a1a1a;">${reminderTitle}</h3>
          ${reminderMessage ? `<p style="margin: 0; color: #666;">${reminderMessage}</p>` : ""}
        </div>

        <table style="width: 100%; font-size: 14px; color: #666;">
          ${groupName ? `<tr><td style="padding: 4px 0;">Grupo:</td><td style="padding: 4px 0;"><strong>${groupName}</strong></td></tr>` : ""}
          ${studentName ? `<tr><td style="padding: 4px 0;">Alumno:</td><td style="padding: 4px 0;"><strong>${studentName}</strong></td></tr>` : ""}
          ${dueDate ? `<tr><td style="padding: 4px 0;">Fecha límite:</td><td style="padding: 4px 0;"><strong>${dueDate}</strong></td></tr>` : ""}
        </table>

        <hr style="border: none; border-top: 1px solid #e9ecef; margin: 20px 0;" />
        <p style="font-size: 12px; color: #999; margin: 0;">
          Enviado automáticamente por ProfesorApp
        </p>
      </div>
    </body>
    </html>
  `;
}
