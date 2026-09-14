/**
 * Code4Ever transactional e-mail template.
 *
 * Constraints that shape every decision below — e-mail is not the web:
 *  - Layout is TABLE based. Flexbox and grid are unsupported in Outlook (Word rendering
 *    engine) and unreliable in several mobile clients.
 *  - Styles are INLINE. Gmail strips <style> blocks on forwarded mail and most clients drop
 *    external stylesheets entirely. The one <style> block we keep only carries the dark-mode
 *    and small-screen overrides, which degrade harmlessly when stripped.
 *  - The logo ships as a PNG referenced by Content-ID, not as the project's logo.svg:
 *    Gmail, Outlook and Yahoo all refuse to render SVG in mail. `scripts/build-email-logo.mjs`
 *    rasterises public/logo.svg into public/email-logo.png, so the mark stays in sync with
 *    the app while remaining renderable everywhere.
 *  - A plain-text alternative is always generated. Mail without one scores as spam and is
 *    unreadable in text-only clients.
 */

export interface MailTemplateInput {
  /** Pre-heading shown in the inbox preview line, after the subject. */
  preheader?: string;
  heading: string;
  /** Body paragraphs, plain text. Each becomes its own <p>. */
  paragraphs: string[];
  callToAction?: { label: string; url: string };
  /** Small print under the divider, e.g. why the recipient got this. */
  footnote?: string;
  recipientName?: string;
  brandName?: string;
  brandDomain?: string;
  /** The cid: reference for the inline logo attachment. */
  logoCid?: string;
}

const COLORS = {
  pageBg: '#f4f4f5',
  cardBg: '#ffffff',
  headerBg: '#09090b',
  headerBorder: '#27272a',
  text: '#18181b',
  muted: '#52525b',
  faint: '#a1a1aa',
  border: '#e4e4e7',
  accent: '#18181b',
  accentText: '#ffffff'
};

/** HTML-escapes a value destined for markup. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Only absolute http(s) links may become a button. A `javascript:` or `data:` href in a
 * mail body is a phishing primitive, and some desktop clients will happily follow it.
 */
function safeUrl(url: string): string | null {
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function renderMailHtml(input: MailTemplateInput): string {
  const brandName = input.brandName || 'Code4Ever';
  const brandDomain = input.brandDomain || 'lanux.online';
  const logoCid = input.logoCid || 'c4elogo';
  const cta = input.callToAction ? { ...input.callToAction, url: safeUrl(input.callToAction.url) } : null;

  const paragraphs = input.paragraphs
    .filter((p) => String(p || '').trim())
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${COLORS.text};">${escapeHtml(p).replace(/\n/g, '<br />')}</p>`
    )
    .join('');

  const greeting = input.recipientName
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${COLORS.text};">Merhaba <strong>${escapeHtml(input.recipientName)}</strong>,</p>`
    : '';

  const ctaBlock =
    cta && cta.url
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px;">
           <tr>
             <td align="center" bgcolor="${COLORS.accent}" style="border-radius:10px;">
               <a href="${escapeHtml(cta.url)}"
                  style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:700;
                         color:${COLORS.accentText};text-decoration:none;border-radius:10px;
                         font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                 ${escapeHtml(cta.label)}
               </a>
             </td>
           </tr>
         </table>`
      : '';

  const footnote = input.footnote
    ? `<p class="c4e-note" style="margin:0 0 10px;font-size:12px;line-height:1.6;color:${COLORS.muted};">${escapeHtml(input.footnote)}</p>`
    : '';

  // Zero-width joiners pad the preview line so the client does not pull body text into it.
  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
         ${escapeHtml(input.preheader)}${'&#8203;&nbsp;'.repeat(60)}
       </div>`
    : '';

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml(input.heading)}</title>
<style>
  /* Stripped by some clients; every rule here is an enhancement, never a requirement. */
  @media (max-width:600px){
    .c4e-card{width:100% !important;border-radius:0 !important;}
    .c4e-pad{padding-left:22px !important;padding-right:22px !important;}
    .c4e-h1{font-size:21px !important;}
  }
  @media (prefers-color-scheme:dark){
    .c4e-page{background:#09090b !important;}
    .c4e-card{background:#0c0c0e !important;border-color:#27272a !important;}
    /* Paragraphs carry their own inline colour (required for clients that drop this
       block), so the dark override has to target them directly — an inherited rule on the
       cell alone loses to the inline declaration and left the body near-invisible. */
    .c4e-text,.c4e-h1,.c4e-text p,.c4e-text strong{color:#f4f4f5 !important;}
    .c4e-muted,.c4e-note{color:#a1a1aa !important;}
    .c4e-divider{border-color:#27272a !important;}
    .c4e-cta a{background:#f4f4f5 !important;color:#09090b !important;}
    .c4e-cta td{background:#f4f4f5 !important;}
    .c4e-sent{color:#71717a !important;}
  }
  a{color:#2563eb;}
</style>
</head>
<body class="c4e-page" style="margin:0;padding:0;background:${COLORS.pageBg};
      -webkit-font-smoothing:antialiased;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
${preheader}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       style="background:${COLORS.pageBg};padding:32px 12px;">
  <tr>
    <td align="center">

      <table role="presentation" class="c4e-card" cellpadding="0" cellspacing="0" border="0" width="600"
             style="width:600px;max-width:600px;background:${COLORS.cardBg};border:1px solid ${COLORS.border};
                    border-radius:16px;overflow:hidden;">

        <!-- Header band -->
        <tr>
          <td class="c4e-pad" align="left"
              style="background:${COLORS.headerBg};padding:26px 34px;border-bottom:1px solid ${COLORS.headerBorder};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle" style="padding-right:13px;">
                  <img src="cid:${escapeHtml(logoCid)}" width="44" height="44" alt="${escapeHtml(brandName)}"
                       style="display:block;width:44px;height:44px;border-radius:11px;border:0;outline:none;" />
                </td>
                <td valign="middle">
                  <div style="font-size:17px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;line-height:1.2;">
                    ${escapeHtml(brandName)}
                  </div>
                  <div style="font-size:12px;color:#a1a1aa;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.5;">
                    ${escapeHtml(brandDomain)}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td class="c4e-pad c4e-text" align="left" style="padding:34px;color:${COLORS.text};">
            <h1 class="c4e-h1" style="margin:0 0 18px;font-size:24px;line-height:1.3;font-weight:800;
                       letter-spacing:-0.5px;color:${COLORS.text};">
              ${escapeHtml(input.heading)}
            </h1>
            ${greeting}
            ${paragraphs}
            <div class="c4e-cta">${ctaBlock}</div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td class="c4e-pad" align="left" style="padding:0 34px 30px;">
            <hr class="c4e-divider" style="border:0;border-top:1px solid ${COLORS.border};margin:0 0 18px;" />
            ${footnote}
            <p class="c4e-muted" style="margin:0;font-size:12px;line-height:1.6;color:${COLORS.faint};">
              ${escapeHtml(brandName)} ·
              <a href="https://${escapeHtml(brandDomain)}" style="color:${COLORS.muted};text-decoration:none;">${escapeHtml(brandDomain)}</a> ·
              <a href="https://app.${escapeHtml(brandDomain)}/tos" style="color:${COLORS.muted};text-decoration:none;">Kullanım Şartları</a> ·
              <a href="https://app.${escapeHtml(brandDomain)}/privacy" style="color:${COLORS.muted};text-decoration:none;">Gizlilik</a>
            </p>
          </td>
        </tr>
      </table>

      <p class="c4e-sent" style="margin:18px 0 0;font-size:11px;color:${COLORS.faint};">
        Bu e-posta ${escapeHtml(brandDomain)} tarafından gönderildi.
      </p>

    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Plain-text alternative. Mail without one is penalised by spam filters. */
export function renderMailText(input: MailTemplateInput): string {
  const brandName = input.brandName || 'Code4Ever';
  const brandDomain = input.brandDomain || 'lanux.online';
  const lines: string[] = [brandName.toUpperCase(), '='.repeat(brandName.length), '', input.heading, ''];

  if (input.recipientName) lines.push(`Merhaba ${input.recipientName},`, '');
  for (const p of input.paragraphs) {
    if (String(p || '').trim()) lines.push(p, '');
  }
  const url = input.callToAction ? safeUrl(input.callToAction.url) : null;
  if (input.callToAction && url) lines.push(`${input.callToAction.label}: ${url}`, '');
  if (input.footnote) lines.push('--', input.footnote, '');
  lines.push('--', `${brandName} · ${brandDomain}`);

  return lines.join('\n');
}
