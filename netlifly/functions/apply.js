const nodemailer = require("nodemailer");

function isValidUrl(s) {
  try { new URL(s); return true; } catch { return false; }
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const data = JSON.parse(event.body || "{}");

    // Basic validation
    const required = ["twitch","twitch_link","viewer","streams","category","discord","reason","consent"];
    for (const k of required) {
      if (!data[k] || String(data[k]).trim() === "") {
        return { statusCode: 400, body: JSON.stringify({ error: `Feld fehlt: ${k}` }) };
      }
    }
    if (!isValidUrl(data.twitch_link)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Twitch Link ist keine gültige URL." }) };
    }
    if (String(data.consent) !== "on" && String(data.consent) !== "true") {
      return { statusCode: 400, body: JSON.stringify({ error: "Zustimmung fehlt." }) };
    }

    // ENV (in Netlify setzen!)
    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS,
      MAIL_FROM,
      MAIL_TO
    } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !MAIL_FROM || !MAIL_TO) {
      return { statusCode: 500, body: JSON.stringify({ error: "Server Mail-Config fehlt (ENV Vars)." }) };
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465, // 465 = SSL, 587 = STARTTLS
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });

    const subject = `HRX Bewerbung – ${data.twitch}`;

    const text =
`Neue HRX CreatorNET Bewerbung

Twitch Name: ${data.twitch}
Twitch Link: ${data.twitch_link}
Durchschnittliche Viewer (30 Tage): ${data.viewer}
Streams pro Woche: ${data.streams}
Content Kategorie: ${data.category}
Discord Tag / Kontakt: ${data.discord}

Warum will die Person ins HRX CreatorNET?
${data.reason}

Datenschutz/Kontaktaufnahme zugestimmt: JA
`;

    // Optional: HTML nicer
    const html = `
      <h2>Neue HRX CreatorNET Bewerbung</h2>
      <ul>
        <li><b>Twitch Name:</b> ${escapeHtml(data.twitch)}</li>
        <li><b>Twitch Link:</b> <a href="${escapeAttr(data.twitch_link)}">${escapeHtml(data.twitch_link)}</a></li>
        <li><b>Durchschnittliche Viewer (30 Tage):</b> ${escapeHtml(String(data.viewer))}</li>
        <li><b>Streams pro Woche:</b> ${escapeHtml(String(data.streams))}</li>
        <li><b>Content Kategorie:</b> ${escapeHtml(data.category)}</li>
        <li><b>Discord:</b> ${escapeHtml(data.discord)}</li>
      </ul>
      <h3>Warum HRX?</h3>
      <pre style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif">${escapeHtml(data.reason)}</pre>
      <p><b>Zustimmung:</b> JA</p>
    `;

    await transporter.sendMail({
      from: MAIL_FROM,
      to: MAIL_TO, // z.B. Bewerbung-HRX@rose-entertain.de
      subject,
      text,
      html
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Server error" }) };
  }
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}