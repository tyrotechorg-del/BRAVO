import { Link } from 'react-router-dom'

const UPDATED = 'June 2026'
const SUPPORT_EMAIL = 'support@bravomusics.com'
const WHATSAPP_DISPLAY = '0760 775 472'
const WHATSAPP_LINK = 'https://wa.me/260760775472'

// Shared shell for all static info pages
function LegalShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="max-w-[860px] mx-auto px-5 py-12">
      <Link to="/" className="text-sm text-primary no-underline inline-flex items-center gap-2 mb-6">
        <i className="fas fa-arrow-left" /> Back to Bravo Music
      </Link>
      <h1 className="text-3xl md:text-4xl font-extrabold mb-2">{title}</h1>
      {subtitle && <p className="text-[#b3b3b3] mb-8">{subtitle}</p>}
      <div className="legal-body space-y-6 text-[#d0d0d0] leading-relaxed">{children}</div>

      <div className="mt-12 p-5 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a]">
        <h3 className="font-semibold mb-2">Questions?</h3>
        <p className="text-sm text-[#b3b3b3] mb-3">We're happy to help. Reach our support team:</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="btn-outline inline-flex items-center gap-2 no-underline"><i className="fas fa-envelope" />{SUPPORT_EMAIL}</a>
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="btn-outline inline-flex items-center gap-2 no-underline"><i className="fab fa-whatsapp" />{WHATSAPP_DISPLAY}</a>
        </div>
      </div>
    </main>
  )
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-white mb-2">{n}. {title}</h2>
      <div className="space-y-2 text-[15px]">{children}</div>
    </section>
  )
}

// =====================================================================
// TERMS OF SERVICE
// =====================================================================
export function Terms() {
  return (
    <LegalShell title="Terms of Service" subtitle={`Last updated: ${UPDATED}`}>
      <p>
        Welcome to Bravo Music. These Terms of Service ("Terms") govern your use of the Bravo Music
        website, apps, and services (together, the "Platform"), operated from Zambia. By creating an
        account or using the Platform, you agree to these Terms. If you do not agree, please do not
        use the Platform.
      </p>

      <Section n="1" title="Who can use Bravo Music">
        <p>You must be at least 13 years old to use the Platform. If you are under 18, you should have
          permission from a parent or guardian. You are responsible for keeping your account details
          and password secure, and for all activity that happens under your account.</p>
      </Section>

      <Section n="2" title="Accounts and roles">
        <p>The Platform offers listener, artist, and administrator roles. Artists may upload, promote,
          and earn from their music. You agree to provide accurate information and to keep it up to
          date. We may suspend or close accounts that break these Terms or that we reasonably believe
          are being used for fraud or abuse.</p>
      </Section>

      <Section n="3" title="Artist content and ownership">
        <p>If you upload music, artwork, or other content, you keep ownership of your work. By
          uploading, you grant Bravo Music a non-exclusive licence to host, stream, display, and
          promote that content on the Platform so we can provide the service.</p>
        <p>You confirm that you own or have the rights to everything you upload, and that it does not
          infringe anyone else's copyright or other rights. You are responsible for the content you
          publish. We may remove content that we believe is unlawful, infringing, or in breach of
          these Terms.</p>
      </Section>

      <Section n="4" title="Acceptable use">
        <p>You agree not to: upload content you do not have the rights to; impersonate others; attempt
          to disrupt or hack the Platform; use the Platform to distribute malware or spam; or use it
          for any unlawful purpose. Stream-manipulation, fake plays, or other attempts to game payouts
          and rankings are not allowed and may lead to account closure and forfeiture of earnings.</p>
      </Section>

      <Section n="5" title="Payments, purchases, and earnings">
        <p>Some features — such as buying songs or albums, subscriptions, and artist promotion — are
          paid. Payments are processed through mobile money and other supported methods. Prices are
          shown in Zambian Kwacha (ZMW) unless stated otherwise.</p>
        <p>Artist earnings accrue to your wallet based on eligible activity and can be withdrawn
          subject to any minimum thresholds and verification we apply. We may withhold or reverse
          earnings linked to fraud, chargebacks, or breaches of these Terms. Except where required by
          law, completed purchases are non-refundable.</p>
      </Section>

      <Section n="6" title="Subscriptions">
        <p>Paid subscriptions renew according to the plan you choose until cancelled. You can manage or
          cancel a subscription from your account settings. Cancelling stops future charges but does
          not refund the current period unless required by law.</p>
      </Section>

      <Section n="7" title="Intellectual property">
        <p>The Bravo Music name, logo, and Platform software are owned by Bravo Music and protected by
          law. You may not copy, modify, or redistribute them without our permission. Music and content
          uploaded by artists remain the property of their respective owners.</p>
      </Section>

      <Section n="8" title="Copyright complaints">
        <p>If you believe content on the Platform infringes your copyright, contact us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary">{SUPPORT_EMAIL}</a> with details
          of the work and the infringing content. We will review and act on valid notices, which may
          include removing the content and, for repeat infringers, closing accounts.</p>
      </Section>

      <Section n="9" title="Disclaimers and liability">
        <p>The Platform is provided "as is." We work hard to keep it available and secure but cannot
          guarantee it will always be uninterrupted or error-free. To the extent permitted by law,
          Bravo Music is not liable for indirect or consequential losses arising from your use of the
          Platform.</p>
      </Section>

      <Section n="10" title="Changes and termination">
        <p>We may update these Terms from time to time. If we make significant changes, we'll take
          reasonable steps to let you know. Continuing to use the Platform after changes take effect
          means you accept the updated Terms. You may stop using the Platform at any time.</p>
      </Section>

      <Section n="11" title="Governing law">
        <p>These Terms are governed by the laws of the Republic of Zambia, and any disputes will be
          handled by the courts of Zambia.</p>
      </Section>

    </LegalShell>
  )
}

// =====================================================================
// PRIVACY POLICY
// =====================================================================
export function Privacy() {
  return (
    <LegalShell title="Privacy Policy" subtitle={`Last updated: ${UPDATED}`}>
      <p>
        This Privacy Policy explains how Bravo Music collects, uses, and protects your information when
        you use the Platform. We respect your privacy and only use your data to provide and improve the
        service.
      </p>

      <Section n="1" title="Information we collect">
        <p>We collect: account details you give us (such as username, email, phone number, and profile
          picture); content you upload (for artists); activity on the Platform (songs played, liked,
          downloaded, followed, comments); payment information needed to process transactions; and
          basic technical data such as device and log information.</p>
      </Section>

      <Section n="2" title="How we use your information">
        <p>We use your information to: create and manage your account; stream music and run features
          like playlists, follows, and downloads; process payments, subscriptions, and artist earnings;
          keep the Platform secure and prevent fraud or abuse; respond to your support requests; and
          improve the service.</p>
      </Section>

      <Section n="3" title="Payments">
        <p>Payments are handled through mobile money and other supported providers. We receive
          confirmation and reference details needed to complete and record your transaction. We do not
          store full mobile-money PINs or passwords.</p>
      </Section>

      <Section n="4" title="Sharing your information">
        <p>We do not sell your personal data. We share information only as needed to run the Platform —
          for example, with payment processors to complete transactions, or where required by law. Your
          public profile, uploaded music, and activity such as comments may be visible to other users.</p>
      </Section>

      <Section n="5" title="Cookies and local storage">
        <p>We use cookies and similar storage to keep you signed in, remember preferences (like volume
          and downloads saved on your device), and understand how the Platform is used. You can control
          cookies through your browser settings, though some features may not work without them.</p>
      </Section>

      <Section n="6" title="Data security">
        <p>We use reasonable technical and organisational measures to protect your data, including
          encrypted connections and secure password storage. No system is perfectly secure, so we
          cannot guarantee absolute security, but we work to keep your information safe.</p>
      </Section>

      <Section n="7" title="Your choices and rights">
        <p>You can view and update your profile in your account settings, change your notification
          preferences, and delete your account. If you'd like a copy of your data or want it removed,
          contact us and we'll help, subject to any records we must keep by law.</p>
      </Section>

      <Section n="8" title="Children">
        <p>The Platform is not intended for children under 13. If you believe a child has given us
          personal information, contact us and we will remove it.</p>
      </Section>

      <Section n="9" title="Changes to this policy">
        <p>We may update this Privacy Policy from time to time. We'll post the new version here and
          update the date above. Significant changes will be communicated where reasonable.</p>
      </Section>

      <Section n="10" title="Contact us">
        <p>For any privacy questions or requests, email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary">{SUPPORT_EMAIL}</a> or message us
          on WhatsApp at <a href={WHATSAPP_LINK} className="text-primary">{WHATSAPP_DISPLAY}</a>.</p>
      </Section>
    </LegalShell>
  )
}

// =====================================================================
// ARTIST RESOURCES
// =====================================================================
export function ArtistResources() {
  const cards = [
    { icon: 'fa-cloud-upload-alt', title: 'Uploading your music', body: 'Upload high-quality audio (MP3/M4A) with cover art at least 1000×1000px. Add an accurate title, genre, and tags so listeners can find you.' },
    { icon: 'fa-image', title: 'Cover art that stands out', body: 'Use clear, original artwork with no blurry text. Square images look best across the Platform. Keep files under 5MB.' },
    { icon: 'fa-bullhorn', title: 'Promoting your release', body: 'Share your song links (they include your name and title) on WhatsApp and socials. Consider a promotion package to reach more listeners.' },
    { icon: 'fa-wallet', title: 'Earnings & withdrawals', body: 'Track plays and earnings on your dashboard. Withdraw to mobile money once you reach the minimum threshold.' },
    { icon: 'fa-compact-disc', title: 'Albums & EPs', body: 'Group related songs into an album or EP. Add tracks while creating the album so everything is in one place.' },
    { icon: 'fa-shield-alt', title: 'Rights & originality', body: 'Only upload music you own or have permission to use. Original work protects your account and your earnings.' },
  ]
  return (
    <LegalShell title="Artist Resources" subtitle="Everything you need to grow on Bravo Music">
      <div className="grid sm:grid-cols-2 gap-4 not-prose">
        {cards.map((c) => (
          <div key={c.title} className="p-5 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a]">
            <i className={`fas ${c.icon} text-2xl text-primary mb-3 block`} />
            <h3 className="font-semibold text-white mb-1">{c.title}</h3>
            <p className="text-sm text-[#b3b3b3]">{c.body}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 pt-2">
        <Link to="/upload" className="btn-primary no-underline"><i className="fas fa-upload" /> Upload a song</Link>
        <Link to="/artist-dashboard" className="btn-outline no-underline"><i className="fas fa-chart-line" /> Go to dashboard</Link>
      </div>
    </LegalShell>
  )
}

// =====================================================================
// PROMOTION PACKAGES
// =====================================================================
export function Promotion() {
  const tiers = [
    { name: 'Starter', price: 'K20', features: ['Featured on Trending for 3 days', 'Social share kit', 'Basic play boost'] },
    { name: 'Pro', price: 'K40', features: ['Featured for 7 days', 'Homepage spotlight', 'Priority in search', 'Promo banner'], highlight: true },
    { name: 'Premium', price: 'K70', features: ['Featured for 14 days', 'Top homepage placement', 'Push notification to fans', 'Dedicated WhatsApp promo'] },
  ]
  return (
    <LegalShell title="Promotion Packages" subtitle="Get your music in front of more listeners">
      <p>Boost your reach on Bravo Music with a promotion package. Pricing is indicative — contact us to
        confirm current packages and availability.</p>
      <div className="grid sm:grid-cols-3 gap-4 not-prose">
        {tiers.map((t) => (
          <div key={t.name} className={`p-5 rounded-2xl border ${t.highlight ? 'border-primary bg-primary/10' : 'border-[#2a2a2a] bg-[#1a1a1a]'}`}>
            {t.highlight && <span className="text-[10px] uppercase tracking-wider bg-primary text-white px-2 py-0.5 rounded-full">Most popular</span>}
            <h3 className="font-bold text-white text-lg mt-2">{t.name}</h3>
            <p className="text-2xl font-extrabold text-primary my-2">{t.price}</p>
            <ul className="space-y-1.5 list-none p-0 m-0">
              {t.features.map((f) => (
                <li key={f} className="text-sm text-[#b3b3b3] flex items-start gap-2"><i className="fas fa-check text-success mt-1 text-xs" />{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-sm text-[#888]">To book a package, message us on WhatsApp or call at{' '}
        <a href={WHATSAPP_LINK} className="text-primary">{WHATSAPP_DISPLAY}</a> or email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary">{SUPPORT_EMAIL}</a>.</p>
    </LegalShell>
  )
}
