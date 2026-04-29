// Landing sections — rediseño inspirado en Lulo Bank + Bancolombia.
// Moderno, financiero, limpio. Tokens Tailwind del proyecto (brand/ink/cream/mint/lilac/peach).
// Dependencias: react-router-dom, lucide-react.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Banknote,
  Bot,
  Building2,
  ChartLine,
  Check,
  ChevronDown,
  FileText,
  Instagram,
  Linkedin,
  Lock,
  MessageCircle,
  PackageCheck,
  Quote,
  Receipt,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Zap,
} from "lucide-react";

import logoBlack from "../../assets/images/logo/logoblack.png";
import logoWhite from "../../assets/images/logo/logowhite.png";

/* ------------------------------------------------------------------ */
/* utilities                                                           */
/* ------------------------------------------------------------------ */
function cn(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(" ");
}

/* ================================================================== */
/*  SITE HEADER — top bar + navbar con mega-menú y CTA destacado         */
/* ================================================================== */
export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const productMenu = [
    { icon: Receipt, title: "Facturación DIAN", desc: "Electrónica, nómina y soporte fiscal", href: "#producto" },
    { icon: Bot, title: "Contabilidad con IA", desc: "Asistente que responde sobre tus números", href: "#producto" },
    { icon: Building2, title: "Nómina", desc: "Liquida y reporta al PILA en minutos", href: "#producto" },
    { icon: PackageCheck, title: "Inventario (Kardex)", desc: "Costo promedio ponderado automático", href: "#producto" },
    { icon: Lock, title: "Bancos", desc: "Conciliación directa con tu banco", href: "#producto" },
    { icon: ShieldCheck, title: "Reportes DIAN", desc: "Exógena, IVA, retenciones al día", href: "#producto" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Top announcement bar */}
      <div className="w-full bg-ink text-ink-foreground">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-center gap-2 px-4 text-[12.5px] sm:px-6 lg:px-8">
          <Sparkles size={13} strokeWidth={2.25} className="text-brand" />
          <span className="font-medium">Facturación electrónica DIAN gratis los primeros 30 días.</span>
          <a href="#precios" className="ml-1 hidden items-center gap-1 text-brand hover:brightness-110 sm:inline-flex">
            Ver planes <ArrowRight size={12} strokeWidth={2.25} />
          </a>
        </div>
      </div>

      {/* Main nav */}
      <div
        className={cn(
          "w-full border-b border-border bg-background/90 backdrop-blur-md transition-shadow",
          scrolled && "shadow-sm"
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo + dot accent */}
          <Link to="/" className="group flex items-center gap-2.5 text-foreground no-underline">
            <span className="relative flex size-8 items-center justify-center">
              <img src={logoBlack} alt="" className="block h-8 w-auto dark:hidden" aria-hidden />
              <img src={logoWhite} alt="" className="hidden h-8 w-auto dark:block" aria-hidden />
            </span>
            <span className="tight-heading text-[20px] font-extrabold tracking-tight text-foreground">
              Bolti
              <span className="ml-0.5 inline-block size-1.5 translate-y-[-1px] rounded-full bg-brand align-middle" aria-hidden />
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 text-[14px] font-medium text-foreground md:flex">
            {/* Producto con mega-menu */}
            <div
              className="relative"
              onMouseEnter={() => setProductOpen(true)}
              onMouseLeave={() => setProductOpen(false)}
            >
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full px-3 py-2 transition hover:bg-muted"
                aria-expanded={productOpen}
              >
                Producto
                <ChevronDown
                  size={14}
                  strokeWidth={2.25}
                  className={cn("transition-transform", productOpen && "rotate-180")}
                />
              </button>
              {productOpen && (
                <div className="absolute left-1/2 top-full -translate-x-1/2 pt-2">
                  <div className="w-[640px] rounded-3xl border border-border bg-card p-3 shadow-lg">
                    <div className="grid grid-cols-2 gap-1">
                      {productMenu.map((item) => (
                        <a
                          key={item.title}
                          href={item.href}
                          className="group flex items-start gap-3 rounded-2xl p-3 text-foreground no-underline transition hover:bg-muted active:text-brand"
                        >
                          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-cream text-ink">
                            <item.icon size={18} strokeWidth={2} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[14px] font-semibold text-foreground">
                              {item.title}
                            </span>
                            <span className="block text-[12.5px] leading-snug text-muted-foreground">
                              {item.desc}
                            </span>
                          </span>
                        </a>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-2xl bg-muted px-4 py-3 text-[13px]">
                      <span className="text-muted-foreground">
                        ¿Todavía no usás facturación electrónica?
                      </span>
                      <a href="#como-funciona" className="inline-flex items-center gap-1 font-semibold text-brand hover:brightness-110">
                        Cómo empezar <ArrowRight size={12} strokeWidth={2.25} />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <a href="#precios" className="rounded-full px-3 py-2 text-foreground no-underline transition hover:bg-muted active:text-brand">Precios</a>
            <a href="#clientes" className="rounded-full px-3 py-2 text-foreground no-underline transition hover:bg-muted active:text-brand">Clientes</a>
            <a href="#recursos" className="rounded-full px-3 py-2 text-foreground no-underline transition hover:bg-muted active:text-brand">Recursos</a>
          </nav>

          {/* Desktop actions */}
          <div className="hidden items-center gap-2 md:flex">
            <Link
              to="/login"
              className="inline-flex h-10 items-center justify-center rounded-full px-4 text-[14px] font-semibold text-foreground transition hover:bg-muted"
            >
              Entrar
            </Link>
            <Link
              to="/register-tenant"
              className="group inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-brand px-5 text-[14px] font-semibold text-brand-foreground shadow-sm transition hover:brightness-110"
            >
              Probar gratis
              <ArrowRight size={14} strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileOpen}
            className="relative inline-flex size-10 items-center justify-center rounded-full border border-border bg-background md:hidden"
          >
            <span className="flex flex-col gap-[5px]">
              <span className={cn("block h-0.5 w-4 bg-foreground transition", mobileOpen && "translate-y-[7px] rotate-45")} />
              <span className={cn("block h-0.5 w-4 bg-foreground transition", mobileOpen && "opacity-0")} />
              <span className={cn("block h-0.5 w-4 bg-foreground transition", mobileOpen && "-translate-y-[7px] -rotate-45")} />
            </span>
          </button>
        </div>

        {/* Mobile panel */}
        {mobileOpen && (
          <div className="border-t border-border bg-background md:hidden">
            <div className="flex flex-col gap-1 px-4 py-3 text-[15px] font-medium">
              <a href="#producto" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-3 text-foreground no-underline hover:bg-muted active:text-brand">Producto</a>
              <a href="#precios" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-3 text-foreground no-underline hover:bg-muted active:text-brand">Precios</a>
              <a href="#clientes" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-3 text-foreground no-underline hover:bg-muted active:text-brand">Clientes</a>
              <a href="#recursos" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-3 text-foreground no-underline hover:bg-muted active:text-brand">Recursos</a>
              <div className="mt-2 flex gap-2 px-3 pb-3 pt-1">
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-11 flex-1 items-center justify-center rounded-full border border-border text-[14px] font-semibold"
                >
                  Entrar
                </Link>
                <Link
                  to="/register-tenant"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand text-[14px] font-semibold text-brand-foreground shadow-sm"
                >
                  Probar gratis
                  <ArrowRight size={14} strokeWidth={2.5} />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

/* ================================================================== */
/*  HERO — headline financiero + mockup placeholder                     */
/* ================================================================== */
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-cream">
      {/* Grid pattern sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at top, black 20%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-10 size-[520px] rounded-full bg-mint/50 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 bottom-0 size-[420px] rounded-full bg-lilac/40 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-14 sm:px-6 sm:pb-28 sm:pt-20 lg:px-8 lg:pb-32">
        <div className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
          {/* Columna texto */}
          <div className="flex flex-col items-start gap-7">
            {/* Badge live */}
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-[12.5px] font-semibold text-foreground backdrop-blur">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              Ya disponible: Facturación Electrónica DIAN · desde $499.000/año
            </span>

            {/* Headline masivo */}
            <h1 className="tight-heading text-[42px] font-extrabold leading-[1.02] tracking-[-0.02em] text-foreground sm:text-6xl lg:text-[76px]">
              Tu empresa en la
              <span className="mt-2 block">
                era de la <span className="text-brand">IA</span>.
              </span>
            </h1>

            <p className="max-w-xl text-[18px] leading-relaxed text-muted-foreground sm:text-lg">
              <span className="font-semibold text-foreground">Comercial, Contabilidad, Nómina y Legal</span> — cuatro módulos que hablás con una sola IA. Arrancá hoy con Facturación Electrónica DIAN desde{" "}
              <span className="font-semibold text-foreground">$499.000 al año</span> y el resto se va sumando.
            </p>

            {/* CTAs */}
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link
                to="/register-tenant"
                className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-ink px-7 text-[15px] font-semibold text-ink-foreground shadow-lg shadow-ink/20 transition hover:brightness-125"
              >
                Probar gratis 14 días
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#demo"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-border bg-background px-7 text-[15px] font-semibold text-foreground transition hover:bg-muted"
              >
                <Zap className="size-4 text-brand" />
                Ver demo de 2 min
              </a>
            </div>

            {/* Trust row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-2">
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-medium text-muted-foreground">
                <li className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-success" strokeWidth={3} />
                  Sin tarjeta
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-success" strokeWidth={3} />
                  Certificado DIAN
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-success" strokeWidth={3} />
                  Soporte en español
                </li>
              </ul>
            </div>

            {/* Social proof con avatares */}
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-background/70 px-4 py-3 backdrop-blur">
              <div className="flex -space-x-2">
                {["MG", "JP", "CR", "LA"].map((ini, i) => (
                  <div
                    key={ini}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border-2 border-background text-[11px] font-bold text-ink",
                      ["bg-mint", "bg-peach", "bg-lilac", "bg-cream"][i]
                    )}
                  >
                    {ini}
                  </div>
                ))}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1 text-brand">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="size-3.5 fill-current" aria-hidden />
                  ))}
                  <span className="ml-1 text-[12.5px] font-semibold text-foreground">4.9/5</span>
                </div>
                <span className="text-[12px] text-muted-foreground">
                  +1.200 empresas ya facturan con Bolti
                </span>
              </div>
            </div>
          </div>

          {/* Columna mockup simulado (no screenshot) */}
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -left-8 -top-8 size-40 rounded-full bg-peach/60 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-10 -right-6 size-48 rounded-full bg-mint/60 blur-3xl"
            />

            {/* App frame */}
            <div className="relative rounded-[28px] border border-border bg-background p-2 shadow-2xl shadow-ink/10">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="size-2.5 rounded-full bg-danger/70" />
                <span className="size-2.5 rounded-full bg-warning/70" />
                <span className="size-2.5 rounded-full bg-success/70" />
                <div className="ml-3 inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                  <Lock className="size-3" aria-hidden />
                  app.bolti.co/dashboard
                </div>
              </div>

              {/* App body */}
              <div className="rounded-[20px] bg-card p-4 sm:p-5">
                {/* Header interno */}
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Ingresos · octubre 2025
                    </p>
                    <p className="tight-heading text-2xl font-extrabold text-foreground">
                      $42.850.000
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-[11.5px] font-semibold text-success">
                    <ShieldCheck className="size-3.5" />
                    DIAN conectada
                  </span>
                </div>

                {/* Mini chart */}
                <div className="mb-4 flex h-20 items-end gap-1.5 rounded-xl bg-muted/70 p-3">
                  {[35, 48, 30, 62, 45, 70, 58, 82, 66, 90, 74, 95].map((h, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 rounded-sm",
                        i === 11 ? "bg-brand" : "bg-ink/25"
                      )}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>

                {/* Lista de facturas */}
                <div className="space-y-2">
                  {[
                    { n: "FV-0042", c: "Industrias ACME", v: "$2.142.000", ok: true },
                    { n: "FV-0041", c: "Distribuciones JM", v: "$860.500", ok: true },
                    { n: "FV-0040", c: "Almacén El Sol", v: "$1.430.000", ok: true },
                  ].map((f) => (
                    <div
                      key={f.n}
                      className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-mint text-ink">
                          <Receipt className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-foreground">
                            {f.c}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{f.n}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tight-heading text-[13px] font-bold text-foreground">
                          {f.v}
                        </span>
                        <span className="inline-flex size-5 items-center justify-center rounded-full bg-success/15 text-success">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating card: IA */}
            <div className="absolute -left-5 bottom-10 hidden max-w-[220px] rounded-2xl border border-border bg-background p-3.5 shadow-xl shadow-ink/10 sm:block">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground">
                  <Bot className="size-3.5" strokeWidth={2.25} />
                </span>
                <span className="text-[11.5px] font-bold text-foreground">IA de Bolti</span>
              </div>
              <p className="text-[12px] leading-snug text-muted-foreground">
                Tu margen bruto subió <span className="font-semibold text-success">+14%</span> vs. septiembre.
              </p>
            </div>

            {/* Floating card: CUFE */}
            <div className="absolute -right-4 -top-4 hidden rounded-2xl border border-border bg-background p-3 shadow-xl shadow-ink/10 sm:block">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-full bg-peach">
                  <ShieldCheck className="size-5 text-ink" aria-hidden />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    CUFE validado
                  </p>
                  <p className="tight-heading text-[13px] font-bold text-success">
                    DIAN · 0.8s
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  PARTNER BADGES — banda delgada de certificaciones                   */
/* ================================================================== */
const PARTNER_BADGES = [
  "DIAN Autorizado",
  "TLS 1.3",
  "SOC 2 Ready",
  "Hecho en Colombia",
  "GDPR Ready",
];

export function PartnerBadges() {
  return (
    <section className="border-y border-border bg-muted">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-6 sm:px-6 lg:px-8">
        {PARTNER_BADGES.map((label) => (
          <span
            key={label}
            className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ================================================================== */
/*  STATS STRIP — KPIs grandes sobre fondo oscuro                       */
/* ================================================================== */
const STATS = [
  { value: "15 min", label: "Setup completo" },
  { value: "50K+", label: "Facturas al mes" },
  { value: "99.9%", label: "Uptime DIAN" },
  { value: "−70%", label: "Tiempo contable" },
];

export function StatsStrip() {
  return (
    <section className="bg-ink text-ink-foreground">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <span className="mb-3 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/70">
            Bolti en números
          </span>
          <h2 className="tight-heading text-3xl font-extrabold sm:text-4xl">
            Resultados medibles desde el primer mes.
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:gap-6 lg:grid-cols-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="border-l-2 border-brand pl-5 sm:pl-6"
            >
              <p className="tight-heading text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                {s.value}
              </p>
              <p className="mt-2 text-sm font-medium text-white/70">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  MODULES — 6 tarjetas, íconos en círculos pastel                     */
/* ================================================================== */
type ModuleMeta = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  tint: "peach" | "mint" | "lilac" | "cream";
  featured?: boolean;
};

type ModuleStatus = "disponible" | "pronto";

type ModuleBlock = ModuleMeta & {
  status: ModuleStatus;
  href?: string;
};

const MODULES: ModuleBlock[] = [
  {
    icon: ChartLine,
    title: "Contabilidad",
    body: "Facturación electrónica DIAN, bancos, impuestos, libros oficiales y reportes. Desde $499.000/año.",
    tint: "mint",
    status: "disponible",
    href: "/producto/contabilidad",
    featured: true,
  },
  {
    icon: Receipt,
    title: "Comercial",
    body: "Cotizaciones, pedidos, remisiones, inventario con Kardex y CRM. El corazón operativo de tu empresa.",
    tint: "peach",
    status: "pronto",
  },
  {
    icon: Users,
    title: "Nómina (PILA)",
    body: "Liquidación, aportes PILA, seguridad social, prestaciones y nómina electrónica DIAN.",
    tint: "lilac",
    status: "pronto",
  },
  {
    icon: FileText,
    title: "Legal",
    body: "Contratos, plantillas, documentos firmables y cumplimiento básico — todo dentro del mismo sistema.",
    tint: "cream",
    status: "pronto",
  },
];

const MODULE_TINT: Record<ModuleMeta["tint"], string> = {
  peach: "bg-peach",
  mint: "bg-mint",
  lilac: "bg-lilac",
  cream: "bg-cream",
};

export function Modules() {
  return (
    <section id="producto" className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <span className="mb-4 inline-flex rounded-full bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            4 módulos · 1 sistema
          </span>
          <h2 className="tight-heading text-4xl font-extrabold text-foreground sm:text-5xl">
            Todo tu negocio, en un solo <span className="text-brand">ERP con IA</span>.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Arrancamos con <span className="font-semibold text-foreground">Contabilidad (Facturación Electrónica DIAN)</span>.
            Comercial, Nómina y Legal están en el roadmap — cuando los actives ya vas a tener historial.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => {
            const isDisponible = m.status === "disponible";
            const card = (
              <article
                className={cn(
                  "group relative flex h-full flex-col gap-4 rounded-3xl border p-6 transition duration-200",
                  isDisponible
                    ? "border-ink bg-ink text-ink-foreground hover:-translate-y-1 hover:shadow-lg"
                    : "border-dashed border-border bg-card/60"
                )}
              >
                <span
                  className={cn(
                    "absolute right-4 top-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-widest",
                    isDisponible
                      ? "bg-brand text-brand-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isDisponible ? (
                    <>
                      <Sparkles className="size-3" />
                      Disponible
                    </>
                  ) : (
                    "Próximamente"
                  )}
                </span>
                <div
                  className={cn(
                    "inline-flex size-12 items-center justify-center rounded-full",
                    isDisponible
                      ? "bg-brand text-brand-foreground"
                      : cn(MODULE_TINT[m.tint], "text-ink opacity-90")
                  )}
                >
                  <m.icon className="size-6" />
                </div>
                <h3
                  className={cn(
                    "tight-heading text-xl font-bold",
                    isDisponible ? "text-ink-foreground" : "text-foreground"
                  )}
                >
                  {m.title}
                </h3>
                <p
                  className={cn(
                    "text-sm leading-relaxed",
                    isDisponible ? "text-ink-foreground/75" : "text-muted-foreground"
                  )}
                >
                  {m.body}
                </p>
                {isDisponible && (
                  <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-brand">
                    Ver módulo
                    <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                  </span>
                )}
              </article>
            );
            return m.href ? (
              <Link
                key={m.title}
                to={m.href}
                className="no-underline"
              >
                {card}
              </Link>
            ) : (
              <div key={m.title}>{card}</div>
            );
          })}
        </div>

        {/* CTA a página dedicada */}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/producto/contabilidad"
            className="group inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[14px] font-semibold text-ink-foreground no-underline shadow-md transition hover:brightness-125"
          >
            Ver detalle del módulo Contable
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </Link>
          <span className="text-[13px] text-muted-foreground">
            Empezás desde {" "}
            <span className="font-semibold text-foreground">$499.000/año</span> con facturación DIAN completa.
          </span>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  CONTABILIDAD — sección dedicada + planes desde $499.000 COP/año     */
/* ================================================================== */
const CONTAB_FEATURES: Array<{ title: string; desc: string }> = [
  { title: "Facturación electrónica DIAN", desc: "CUFE válido, envío automático y nómina electrónica" },
  { title: "Notas crédito y débito", desc: "Ajustes a facturas emitidas con todo el flujo DIAN" },
  { title: "Compras y documento soporte (DSA)", desc: "Facturas de proveedores y soportes de no obligados" },
  { title: "Pagos y cobros", desc: "Recibos de caja, pagos a proveedores y cruces" },
  { title: "Bancos y conciliación", desc: "Conecta Bancolombia, Lulo, Nequi, Nubank" },
  { title: "Productos, servicios y kardex", desc: "Catálogo, costos y valorización de inventario" },
  { title: "Activos fijos", desc: "Registro, depreciación y control automático" },
  { title: "PUC colombiano + libros oficiales", desc: "Diario, mayor, auxiliar y balance de comprobación" },
  { title: "Estados financieros", desc: "Balance general, P&G, flujo de efectivo, patrimonio" },
  { title: "Impuestos y retenciones", desc: "IVA, ReteFuente, ReteICA — bases y liquidación" },
  { title: "Exógena DIAN", desc: "Medios magnéticos 1001, 1003, 1007, 1008, 1009" },
  { title: "Asistente IA contable", desc: "Preguntale por chat: utilidad, cartera, IVA…" },
];

type Plan = {
  name: string;
  priceYear: number;
  priceMonth: number;
  tagline: string;
  featured?: boolean;
  includes: string[];
  cta: string;
};

const CONTAB_PLANS: Plan[] = [
  {
    name: "Esencial",
    priceYear: 499000,
    priceMonth: 41600,
    tagline: "Para freelancers y micro-empresas que apenas empiezan.",
    includes: [
      "Facturación electrónica DIAN (200 facturas/mes)",
      "Notas crédito y débito",
      "PUC colombiano + libros oficiales",
      "Balance general y P&G",
      "1 usuario",
      "Soporte por chat",
    ],
    cta: "Empezar con Esencial",
  },
  {
    name: "Pro",
    priceYear: 899000,
    priceMonth: 74900,
    tagline: "La opción favorita de PyMEs ya establecidas.",
    featured: true,
    includes: [
      "Todo lo del Esencial",
      "Facturas DIAN ilimitadas",
      "Bancos y conciliación automática",
      "Kardex (inventario) y productos",
      "Pagos, cobros y documento soporte",
      "Exógena DIAN + IVA/retenciones",
      "3 usuarios",
      "Asistente IA contable",
    ],
    cta: "Probar Pro 14 días",
  },
  {
    name: "Empresarial",
    priceYear: 1590000,
    priceMonth: 132500,
    tagline: "Para empresas medianas con contador interno.",
    includes: [
      "Todo lo del Pro",
      "Activos fijos y depreciación",
      "Plantillas de asientos recurrentes",
      "Multi-sucursal + centros de costo",
      "10 usuarios",
      "API y webhooks",
      "Soporte prioritario WhatsApp",
    ],
    cta: "Hablar con ventas",
  },
];

const formatCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

export function ContabilidadPlans() {
  return (
    <section id="contabilidad" className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Encabezado */}
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-ink">
            <ChartLine className="size-3.5" />
            Módulo Contable
          </span>
          <h2 className="tight-heading text-4xl font-extrabold text-foreground sm:text-5xl">
            Toda la contabilidad colombiana,{" "}
            <span className="text-brand">en un solo lugar</span>.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            De la factura electrónica DIAN al balance general, pasando por bancos, inventario e impuestos.
            Desde <span className="font-semibold text-foreground">{formatCOP(499000)} al año</span>.
          </p>
        </div>

        {/* Feature grid */}
        <div className="mb-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONTAB_FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="size-4" strokeWidth={3} />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-foreground">{f.title}</p>
                <p className="text-[12.5px] leading-snug text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Planes */}
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h3 className="tight-heading text-3xl font-extrabold text-foreground sm:text-4xl">
            Planes en pesos colombianos
          </h3>
          <p className="mt-2 text-muted-foreground">
            Sin sorpresas, sin costo por factura. Todos los planes incluyen actualizaciones gratis.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {CONTAB_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative flex flex-col gap-5 rounded-3xl border p-6 transition sm:p-8",
                plan.featured
                  ? "border-ink bg-ink text-ink-foreground shadow-xl lg:-translate-y-4 lg:scale-[1.02]"
                  : "border-border bg-card"
              )}
            >
              {plan.featured && (
                <span className="absolute right-6 top-6 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-widest text-brand-foreground">
                  <Sparkles className="size-3" />
                  Más elegido
                </span>
              )}

              <div>
                <p
                  className={cn(
                    "text-[13px] font-semibold uppercase tracking-widest",
                    plan.featured ? "text-brand" : "text-muted-foreground"
                  )}
                >
                  {plan.name}
                </p>
                <p
                  className={cn(
                    "mt-1 text-[13.5px] leading-snug",
                    plan.featured ? "text-ink-foreground/75" : "text-muted-foreground"
                  )}
                >
                  {plan.tagline}
                </p>
              </div>

              <div>
                <div className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      "tight-heading text-4xl font-extrabold",
                      plan.featured ? "text-ink-foreground" : "text-foreground"
                    )}
                  >
                    {formatCOP(plan.priceYear)}
                  </span>
                  <span
                    className={cn(
                      "text-sm",
                      plan.featured ? "text-ink-foreground/60" : "text-muted-foreground"
                    )}
                  >
                    /año
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-1 text-[12.5px]",
                    plan.featured ? "text-ink-foreground/60" : "text-muted-foreground"
                  )}
                >
                  equivale a {formatCOP(plan.priceMonth)}/mes · IVA incluido
                </p>
              </div>

              <ul className="flex flex-col gap-2.5">
                {plan.includes.map((item) => (
                  <li
                    key={item}
                    className={cn(
                      "flex items-start gap-2 text-[13.5px] leading-snug",
                      plan.featured ? "text-ink-foreground/85" : "text-foreground"
                    )}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        plan.featured ? "text-brand" : "text-success"
                      )}
                      strokeWidth={3}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/register-tenant"
                className={cn(
                  "group mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-[14px] font-semibold no-underline transition",
                  plan.featured
                    ? "bg-brand text-brand-foreground shadow-md hover:brightness-110"
                    : "border border-border bg-background text-foreground hover:bg-muted"
                )}
              >
                {plan.cta}
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          ))}
        </div>

        {/* Pie */}
        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-4 text-success" strokeWidth={3} /> 14 días gratis sin tarjeta
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-4 text-success" strokeWidth={3} /> Cancelás cuando quieras
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-4 text-success" strokeWidth={3} /> Migración de tu contabilidad actual sin costo
          </span>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  HOW IT WORKS — 3 pasos con línea de conexión                        */
/* ================================================================== */
const STEPS = [
  {
    icon: Rocket,
    title: "Registrate en 2 minutos",
    body: "Crea tu cuenta, ingresa el NIT y datos básicos de tu empresa. Sin instalaciones.",
  },
  {
    icon: Zap,
    title: "Conecta tu banco y DIAN",
    body: "Enlaza Bancolombia, Nequi, Lulo Bank o Nubank, y tu certificado DIAN en un par de clics.",
  },
  {
    icon: Sparkles,
    title: "Factura y reporta automático",
    body: "Bolti emite, concilia y deja todo listo para impuestos. Tú solo revisas y firmas.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-cream py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <span className="mb-4 inline-flex rounded-full bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Cómo funciona
          </span>
          <h2 className="tight-heading text-4xl font-extrabold text-foreground sm:text-5xl">
            Tres pasos. Un día. Cero Excel.
          </h2>
        </div>

        <div className="relative">
          {/* línea de conexión en desktop */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-10 hidden h-0.5 bg-border lg:block"
          />

          <div className="grid gap-8 lg:grid-cols-3 lg:gap-6">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="relative flex flex-col items-center text-center lg:items-start lg:text-left"
              >
                <div className="relative z-10 flex size-20 items-center justify-center rounded-full border-4 border-cream bg-background shadow-sm">
                  <span className="tight-heading text-3xl font-extrabold text-brand">
                    0{i + 1}
                  </span>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <step.icon className="size-5 text-brand" aria-hidden />
                  <h3 className="tight-heading text-xl font-bold text-foreground">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  CHAT PREVIEW — IA contable, 2 burbujas                              */
/* ================================================================== */
export function ChatPreview() {
  return (
    <section className="bg-background py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8">
        <div className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-lilac/50 px-3 py-1 text-xs font-semibold text-ink">
            <Bot className="size-3.5" />
            IA contable
          </span>
          <h2 className="tight-heading text-4xl font-extrabold text-foreground sm:text-5xl">
            Hazle preguntas.{" "}
            <span className="text-brand">Obtén respuestas.</span>
          </h2>
          <p className="max-w-md text-lg text-muted-foreground">
            Bolti conoce tu empresa de memoria. Preguntale por tus números, tus
            clientes o tus impuestos, en español natural.
          </p>
          <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
            {[
              "Entiende lenguaje natural colombiano",
              "Ejecuta acciones sobre tu contabilidad",
              "Nunca inventa datos — trabaja sobre tu info real",
            ].map((c) => (
              <li key={c} className="flex items-center gap-2">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check className="size-3" />
                </span>
                {c}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-md sm:p-6">
            <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-brand text-brand-foreground">
                <Bot className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Bolti IA
                </p>
                <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success">
                  <span className="size-1.5 rounded-full bg-success" />
                  en línea
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-sm text-background">
                  ¿Cuánto vendí este mes?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">
                  Este mes llevas{" "}
                  <strong className="font-bold">$8.450.000</strong> en ventas,
                  23% más que agosto. Tu mejor cliente es Acme SAS con $1.2M.
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-sm text-background">
                  Hazle una factura a Acme por $500.000
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">
                  Listo, FV-00148 por $595.000 con IVA 19%. Enviada a DIAN.
                  CUFE validado.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  TESTIMONIALS — 3 tarjetas sobre cream                               */
/* ================================================================== */
type Testimonial = {
  name: string;
  role: string;
  initials: string;
  tint: "peach" | "mint" | "lilac";
  quote: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Camila R.",
    role: "Dueña, Beauty Store · Bogotá",
    initials: "CR",
    tint: "mint",
    quote:
      "Facturo desde el chat mientras despacho pedidos. Bolti me ahorra una hora al día que antes me pasaba peleando con Excel.",
  },
  {
    name: "Andrés M.",
    role: "Contador público · Medellín",
    initials: "AM",
    tint: "lilac",
    quote:
      "Llevo 18 clientes en Bolti. La conciliación bancaria automática me ahorra 20 horas al mes. Es impresionante.",
  },
  {
    name: "Laura G.",
    role: "Fundadora, SaaS · Cali",
    initials: "LG",
    tint: "peach",
    quote:
      "Probé 4 plataformas antes. Ninguna me dejaba hablarle natural. Con Bolti pido lo que quiero y ya está.",
  },
];

const AVATAR_BG: Record<Testimonial["tint"], string> = {
  peach: "bg-peach",
  mint: "bg-mint",
  lilac: "bg-lilac",
};

export function Testimonials() {
  return (
    <section id="clientes" className="bg-cream py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <span className="mb-4 inline-flex rounded-full bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Clientes
          </span>
          <h2 className="tight-heading text-4xl font-extrabold text-foreground sm:text-5xl">
            PyMEs colombianas que ya dejaron el Excel.
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <article
              key={t.name}
              className="relative flex flex-col gap-5 rounded-3xl border border-border bg-background p-7 shadow-sm"
            >
              <Quote
                className="absolute right-6 top-6 size-8 text-brand/20"
                aria-hidden
              />
              <p className="text-base leading-relaxed text-foreground">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-auto flex items-center gap-3 border-t border-border pt-4">
                <div
                  className={cn(
                    "flex size-11 items-center justify-center rounded-full text-sm font-bold text-ink",
                    AVATAR_BG[t.tint],
                  )}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  TRUSTED BY — cards grandes de bancos colombianos                    */
/* ================================================================== */
type Bank = { name: string; subtitle: string };

const BANKS: Bank[] = [
  { name: "Bancolombia", subtitle: "Conciliación automática" },
  { name: "Lulo Bank", subtitle: "Pagos y movimientos" },
  { name: "Nequi", subtitle: "Cobros y transferencias" },
  { name: "Nubank", subtitle: "Extractos en tiempo real" },
];

export function TrustedBy() {
  return (
    <section className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <span className="mb-4 inline-flex rounded-full bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Bancos
          </span>
          <h2 className="tight-heading text-4xl font-extrabold text-foreground sm:text-5xl">
            Conecta directo con los bancos que ya usás.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Sin subir extractos a mano. Sin copiar transacciones en Excel.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BANKS.map((b, i) => {
            const tints = ["bg-cream", "bg-mint", "bg-lilac", "bg-peach"];
            return (
              <div
                key={b.name}
                className={cn(
                  "flex flex-col gap-3 rounded-3xl border border-border p-6 transition hover:-translate-y-1 hover:shadow-md",
                  tints[i % tints.length],
                )}
              >
                <Banknote className="size-7 text-ink" aria-hidden />
                <p className="tight-heading text-2xl font-extrabold tracking-tight text-ink">
                  {b.name}
                </p>
                <p className="text-sm font-medium text-ink/70">{b.subtitle}</p>
                <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-ink/80">
                  <Check className="size-3.5" />
                  Conectado vía API
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  TRUST SIGNALS — 3 insignias sobre muted                             */
/* ================================================================== */
const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: "Datos cifrados TLS 1.3",
    body: "Toda la información viaja y se almacena cifrada con estándar bancario.",
  },
  {
    icon: Lock,
    title: "Servidores en Colombia",
    body: "Infraestructura local. Tus datos no salen del país sin tu consentimiento.",
  },
  {
    icon: Building2,
    title: "Autorizados DIAN",
    body: "Proveedor tecnológico certificado para facturación y nómina electrónica.",
  },
];

export function TrustSignals() {
  return (
    <section className="bg-muted py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-3">
          {TRUST_ITEMS.map((t) => (
            <div key={t.title} className="flex items-start gap-4">
              <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-background text-brand shadow-sm">
                <t.icon className="size-6" aria-hidden />
              </div>
              <div>
                <h3 className="tight-heading text-lg font-bold text-foreground">
                  {t.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{t.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  FAQ — acordeón                                                      */
/* ================================================================== */
const QA = [
  {
    q: "¿Cómo se conecta con la DIAN?",
    a: "Bolti está certificado como proveedor tecnológico ante la DIAN. Conectas tu certificado digital una sola vez y emitimos facturas, notas y nómina electrónica con CUFE válido en segundos.",
  },
  {
    q: "¿Qué pasa con mi contador actual?",
    a: "Tu contador sigue siendo el jefe. Bolti le da acceso de lectura y descarga, le ahorra el trabajo mecánico y mantiene toda la evidencia documental a su disposición.",
  },
  {
    q: "¿Puedo probar gratis?",
    a: "Sí, 14 días sin tarjeta de crédito. Puedes emitir facturas reales, conectar tu banco y probar la IA sin compromiso.",
  },
  {
    q: "¿Qué bancos soportan?",
    a: "Actualmente Bancolombia, Nequi, Lulo Bank y Nubank con conexión directa vía API. Si usas otro banco, puedes subir extractos en PDF/Excel y Bolti los concilia igual.",
  },
  {
    q: "¿Cómo cambio de sistema?",
    a: "Importamos tu plan de cuentas, terceros, productos y facturas históricas desde Siigo, Alegra, Helisa o Excel. El equipo te acompaña en la primera migración sin costo.",
  },
  {
    q: "¿Qué incluye el precio?",
    a: "Todos los módulos (contabilidad, facturación, nómina, inventario, bancos y reportes), facturas DIAN ilimitadas, soporte por chat y WhatsApp, y actualizaciones automáticas.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="recursos" className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <span className="mb-4 inline-flex rounded-full bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Preguntas frecuentes
          </span>
          <h2 className="tight-heading text-4xl font-extrabold text-foreground sm:text-5xl">
            Resolvamos dudas.
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {QA.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={item.q}
                className={cn(
                  "overflow-hidden rounded-2xl border transition",
                  isOpen
                    ? "border-brand bg-card shadow-sm"
                    : "border-border bg-card hover:border-foreground/30",
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-semibold text-foreground sm:text-lg">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-5 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180 text-brand",
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  CTA BANNER                                                          */
/* ================================================================== */
export function CtaBanner() {
  return (
    <section id="precios" className="bg-background px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-16 text-ink-foreground sm:rounded-[2.5rem] sm:px-12 sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-brand/30 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-10 size-72 rounded-full bg-mint/20 blur-3xl"
          />

          <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-ink-foreground/20 bg-ink-foreground/5 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-widest text-ink-foreground/80">
                <Sparkles className="size-3.5 text-brand" />
                Prueba 14 días
              </span>
              <h2 className="tight-heading mt-4 text-4xl font-extrabold leading-[1.05] text-ink-foreground sm:text-5xl lg:text-6xl">
                Empieza a facturar{" "}
                <span className="text-brand">hoy en 15 minutos</span>.
              </h2>
              <p className="mt-5 max-w-xl text-base text-ink-foreground/70 sm:text-lg">
                Sin tarjeta. Cancela cuando quieras. Soporte humano en español
                desde el primer minuto.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3">
              <Link
                to="/register-tenant"
                className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-brand px-8 text-base font-semibold text-brand-foreground shadow-lg transition hover:brightness-110"
              >
                Probar gratis 14 días
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </Link>
              <p className="text-xs text-ink-foreground/60">
                Sin tarjeta · Cancela cuando quieras
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  SITE FOOTER — 4 columnas                                            */
/* ================================================================== */
export function SiteFooter() {
  return (
    <footer className="bg-ink text-ink-foreground">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 sm:pt-20 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <img src={logoWhite} alt="Bolti" className="h-8 w-auto" />
              <span className="tight-heading text-xl font-extrabold text-ink-foreground">
                Bolti
              </span>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-white/65">
              Contabilidad con IA + facturación DIAN para PyMEs y contadores en
              Colombia.
            </p>
            <p className="mt-4 text-sm text-white/65">
              {/* TODO: reemplazar con email real */}
              <a
                href="mailto:hola@bolti.co"
                className="hover:text-white"
              >
                hola@bolti.co
              </a>
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="#"
                aria-label="Instagram"
                className="inline-flex size-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-white/40 hover:text-white"
              >
                <Instagram className="size-4" />
              </a>
              <a
                href="#"
                aria-label="LinkedIn"
                className="inline-flex size-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-white/40 hover:text-white"
              >
                <Linkedin className="size-4" />
              </a>
            </div>
          </div>

          <FooterCol
            title="Producto"
            items={[
              { label: "Módulos", href: "#producto" },
              { label: "Precios", href: "#precios" },
              { label: "Cómo funciona", href: "#producto" },
              { label: "Probar gratis", href: "/register-tenant", isLink: true },
            ]}
          />
          <FooterCol
            title="Empresa"
            items={[
              { label: "Sobre Bolti", href: "#" },
              { label: "Clientes", href: "#clientes" },
              { label: "Blog", href: "#" },
              { label: "Contacto", href: "mailto:hola@bolti.co" },
            ]}
          />
          <FooterCol
            title="Recursos"
            items={[
              { label: "Centro de ayuda", href: "#" },
              { label: "Documentación", href: "#" },
              { label: "Guías DIAN", href: "#" },
              { label: "Estado del sistema", href: "#" },
            ]}
          />
          <FooterCol
            title="Legal"
            items={[
              { label: "Términos", href: "#" },
              { label: "Privacidad", href: "#" },
              { label: "Tratamiento de datos", href: "#" },
              { label: "Cookies", href: "#" },
            ]}
          />
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Bolti · Hecho en Colombia</span>
          <span>
            {/* TODO: teléfono real de soporte */}
            Soporte: WhatsApp +57 000 000 0000
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; href: string; isLink?: boolean }>;
}) {
  return (
    <div>
      <div className="mb-4 text-[11px] font-bold uppercase tracking-widest text-white/50">
        {title}
      </div>
      <ul className="space-y-3 text-sm text-white/80">
        {items.map((it) =>
          it.isLink ? (
            <li key={it.label}>
              <Link to={it.href} className="hover:text-white">
                {it.label}
              </Link>
            </li>
          ) : (
            <li key={it.label}>
              <a href={it.href} className="hover:text-white">
                {it.label}
              </a>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
