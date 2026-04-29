// src/pages/Landing/index.tsx
// Landing pública de Bolti — portada del diseño del Plury Escrow.
// El wrapper `.landing-root` aplica Geist + Plus Jakarta Sans y la paleta
// OKLCH, todo scoped para no afectar el dashboard.

import {
  ChatPreview,
  CtaBanner,
  Faq,
  Hero,
  HowItWorks,
  Modules,
  PartnerBadges,
  SiteFooter,
  SiteHeader,
  StatsStrip,
  Testimonials,
  TrustedBy,
  TrustSignals,
} from "./sections";

export default function LandingPage() {
  return (
    <div className="landing-root min-h-screen bg-background text-foreground antialiased">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <PartnerBadges />
        <StatsStrip />
        <Modules />
        <HowItWorks />
        <ChatPreview />
        <Testimonials />
        <TrustedBy />
        <TrustSignals />
        <Faq />
        <CtaBanner />
      </main>
      <SiteFooter />
    </div>
  );
}
