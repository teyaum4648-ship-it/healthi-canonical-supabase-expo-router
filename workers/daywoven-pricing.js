// Daywoven public pricing. Own Worker route (/pricing*) preserves the existing
// marketing/signup Worker. Only authenticated app onboarding can mint a session.
// This Worker never receives card information or RevenueCat secrets.
const API = 'https://lhqpexnepgvuohmhltnr.supabase.co/functions/v1/web-checkout';
const SITE = 'https://daywovenapp.com';
const ticketPattern = /^[A-Za-z0-9_-]{20,600}\.[A-Za-z0-9_-]{40,100}$/;

function page(session) {
  const ready = Boolean(session && ticketPattern.test(session));
  const checkoutLink = (plan) => '/pricing/checkout?session=' + encodeURIComponent(session) + '&plan=' + plan;
  const button = (plan) => ready
    ? '<a class="cta" href="' + checkoutLink(plan) + '">Continue to secure checkout <span aria-hidden="true">↗</span></a>'
    : '<span class="cta disabled" aria-disabled="true">Complete your free assessment first</span>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="description" content="Daywoven membership gives you ongoing personalized wellness plans, food and sleep tracking, movement tools, and progress insights.">
<title>Daywoven Membership | Continue your wellbeing journey</title>
<style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}html{background:#0c1119}body{margin:0;color:#f5f2ef;background:radial-gradient(ellipse 80% 56% at 55% -10%,#373347 0%,#131827 58%,#0b1119 100%);min-height:100vh}
a{color:inherit}header{max-width:1090px;margin:auto;padding:30px 26px;display:flex;align-items:center;justify-content:space-between;gap:20px}
.brand{text-decoration:none;font-size:20px;font-weight:750;letter-spacing:-.7px}.brand small{font-weight:400;color:#c8b5a7;font-size:12px;margin-left:6px;letter-spacing:.13em}
nav a{font-size:13px;color:#c4c4ce;text-decoration:none;margin-left:18px}nav a:hover{color:white}
main{max-width:1060px;margin:auto;padding:32px 26px 68px}.eyebrow{color:#d8b9a2;text-transform:uppercase;letter-spacing:.24em;font-weight:700;font-size:11px}
h1{font-family:Georgia,"Times New Roman",serif;font-weight:400;font-size:clamp(39px,6vw,68px);line-height:1.08;max-width:750px;margin:18px auto 16px;letter-spacing:-1.8px}
.hero{text-align:center}.hero p{font-size:17px;color:#c1c3ce;line-height:1.65;max-width:680px;margin:auto}
.result-note{margin:26px auto 32px;max-width:690px;padding:14px 19px;border:1px solid #554949;background:rgba(178,152,134,.08);border-radius:14px;color:#e5d7cd;font-size:14px;line-height:1.5;text-align:center}
.result-note.ready{border-color:#485f57;background:rgba(128,180,157,.07);color:#d2ebd9}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;max-width:890px;margin:35px auto}
.plan{position:relative;background:linear-gradient(150deg,#212330,#151a25);border:1px solid #373a49;border-radius:22px;padding:31px 29px 29px;min-height:314px;display:flex;flex-direction:column}
.plan.featured{border-color:#c6a891;background:linear-gradient(155deg,#342d32,#191c28 65%)}
.chip{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:#efc9a8;margin-bottom:8px;font-weight:700}
.plan h2{font-family:Georgia,serif;font-size:31px;font-weight:400;margin:10px 0}
.cadence{color:#c1bbc0;font-size:14px}
.plan p{color:#bbbfc9;font-size:14px;line-height:1.62;margin:19px 0 22px}
.cta{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:auto;min-height:52px;border-radius:11px;font-size:14px;font-weight:700;background:#e8cbb5;color:#1a1b26;text-decoration:none;text-align:center;padding:12px}
.cta:hover{background:#f6dfc9}.cta.disabled{background:#393944;color:#b9b7bf;cursor:not-allowed}
.price-note{text-align:center;color:#b2b5c4;font-size:13px;margin:4px 0 34px}
.benefits{margin:24px auto 0;max-width:890px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.benefit{padding:22px;background:rgba(255,255,255,.035);border:1px solid #2c303e;border-radius:15px;min-height:125px}
.benefit h3{font-size:14px;margin:0 0 9px}.benefit p{font-size:13px;line-height:1.55;color:#adb3c2;margin:0}
footer{border-top:1px solid #2d3140;padding:25px 26px 36px;text-align:center;color:#a5a9b6;font-size:12px;line-height:1.6}
footer a{color:#d3c6bc;margin:0 8px}
@media(max-width:720px){header{padding:22px 18px}main{padding:25px 18px 45px}.grid{grid-template-columns:1fr}.benefits{grid-template-columns:1fr}.plan{min-height:290px}h1{letter-spacing:-1px}nav a{margin-left:10px}}
</style>
</head>
<body>
<header><a href="/" class="brand">daywoven <small>MEMBERSHIP</small></a><nav><a href="/">Home</a><a href="/legal/privacy.html">Privacy</a></nav></header>
<main>
<section class="hero">
<div class="eyebrow">A plan that gets to know you</div>
<h1>Your starting point was free. Your progress grows from here.</h1>
<p>Keep building on your personal baseline with daily sleep and meal insights, movement guidance, adaptive plans and a clearer picture of your wellbeing.</p>
</section>
<div class="result-note ${ready ? 'ready' : ''}" role="status">
${ready
 ? 'Your Daywoven account is linked to this checkout. Choose a plan below. After paying, return to the app and tap “Check my access”.'
 : 'For now, finish the free onboarding and results in Daywoven to open an account-linked checkout. This prevents a purchase from being attached to the wrong account.'}
</div>
<div class="grid" aria-label="Membership plans">
<article class="plan"><div class="chip">Flexible</div><h2>Monthly</h2><div class="cadence">Billed every month</div><p>Stay consistent with a personalized, evolving daily experience. Cancel future renewals through the website billing provider.</p>${button('monthly')}</article>
<article class="plan featured"><div class="chip">Longer term</div><h2>Annual</h2><div class="cadence">Billed every year</div><p>Build better routines over time with the same Daywoven Premium experience, renewed yearly until cancelled.</p>${button('annual')}</article>
</div>
<p class="price-note">Exact prices, any taxes, renewal terms and applicable offers are shown by our secure payment provider before you confirm a purchase. No payment is taken on this page.</p>
<div class="benefits">
<div class="benefit"><h3>Sleep and recovery</h3><p>Log your rhythm, spot trends and adjust day-to-day habits.</p></div>
<div class="benefit"><h3>Nutrition and movement</h3><p>Track meals and activity in the context of your personal goals.</p></div>
<div class="benefit"><h3>Daily direction</h3><p>Turn your onboarding baseline into useful plans and ongoing progress.</p></div>
</div>
</main>
<footer>Daywoven is a wellness and lifestyle tool, not a medical diagnosis or treatment.<br>
<a href="/legal/terms.html">Terms</a><a href="/legal/privacy.html">Privacy</a><a href="/legal/refunds.html">Refunds</a></footer>
</body></html>`;
}

async function handle(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" };
  if (path === '/pricing/checkout') {
    const token = url.searchParams.get('session') || '';
    const plan = url.searchParams.get('plan') || '';
    if (!ticketPattern.test(token) || !['monthly','annual'].includes(plan)) {
      return new Response('Start with your free Daywoven results in the app to create a secure checkout session.', { status: 400, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    const destination = new URL(API);
    destination.searchParams.set('session', token);
    destination.searchParams.set('plan', plan);
    return new Response(null, { status: 302, headers: { ...headers, Location: destination.toString() } });
  }
  if (path !== '/pricing') return new Response('Not found', { status: 404 });
  const session = url.searchParams.get('session') ?? '';
  return new Response(request.method === 'HEAD' ? null : page(session), {
    status: 200, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' }
  });
}

addEventListener('fetch', event => event.respondWith(handle(event.request)));
