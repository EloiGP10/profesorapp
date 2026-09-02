import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Se requiere un email válido." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { message: "Si ese email existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña." },
        { status: 200 }
      );
    }

    const resetToken = randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    const resetUrl = `https://profesorapp.51.170.52.210.sslip.io/reset-password?token=${resetToken}`;
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f5; margin: 0; padding: 0; }
    .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .logo { font-size: 24px; font-weight: bold; color: #4f46e5; margin-bottom: 24px; }
    h1 { font-size: 20px; color: #111827; margin: 0 0 16px 0; }
    p { color: #6b7280; line-height: 1.6; margin: 0 0 24px 0; font-size: 15px; }
    .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; }
    .footer { margin-top: 32px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">ProfesorApp</div>
    <h1>Restablece tu contraseña</h1>
    <p>Hola,</p>
    <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en ProfesorApp. Pulsa en el botón de abajo para crear una nueva contraseña:</p>
    <p style="text-align:center;">
      <a href="${resetUrl}" class="btn">Restablecer contraseña</a>
    </p>
    <p>Si no solicitaste este cambio, puedes ignorar este email. El enlace caduca en <strong>1 hora</strong> y solo puede usarse una vez.</p>
    <div class="footer">
      ProfesorApp &mdash; Tu portal de gestión docente<br/>
      Si el botón no funciona, copia y pega esta dirección en tu navegador:<br/>
      <span style="word-break:break-all;">${resetUrl}</span>
    </div>
  </div>
</body>
</html>`;

    const sent = sendEmail({
      to: user.email,
      subject: "Restablece tu contraseña — ProfesorApp",
      html,
    });

    return NextResponse.json(
      { message: "Si ese email existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña." },
      { status: 200 }
    );
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json(
      { error: "Error interno. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
