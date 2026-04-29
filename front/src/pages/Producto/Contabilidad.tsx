// src/pages/Producto/Contabilidad.tsx
// Página dedicada al módulo Contable de Bolti. Detalle completo.
// Se accede vía ruta pública `/producto/contabilidad`.

import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Bot,
  Check,
  ChartLine,
  FileText,
  PackageCheck,
  Receipt,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import {
  ContabilidadPlans,
  Faq,
  SiteFooter,
  SiteHeader,
  TrustSignals,
  TrustedBy,
} from "../Landing/sections";

type FeatureBlock = {
  icon: React.ComponentType<{ className?: string }>;
  tint: "peach" | "mint" | "lilac" | "cream";
  title: string;
  points: string[];
};

const BLOCKS: FeatureBlock[] = [
  {
    icon: Receipt,
    tint: "mint",
    title: "Facturación electrónica DIAN",
    points: [
      "Facturas con CUFE válido radicadas al instante",
      "Notas crédito y débito con todo el flujo fiscal",
      "Remisiones antes de facturar mercancía",
      "Documento soporte (DSA) para no obligados a facturar",
      "Nómina electrónica DIAN conectada",
      "Soporte de venta interno (efectivo, POS manual)",
    ],
  },
  {
    icon: Banknote,
    tint: "peach",
    title: "Bancos y tesorería",
    points: [
      "Conciliación automática con Bancolombia, Lulo Bank, Nequi y Nubank",
      "Recibos de caja aplicados a facturas abiertas",
      "Pagos a proveedores con retenciones calculadas",
      "Cobros de clientes cruzados por cartera",
      "Extractos bancarios importados en segundos",
      "Movimientos contables sincronizados al asiento",
    ],
  },
  {
    icon: ChartLine,
    tint: "lilac",
    title: "Impuestos y cumplimiento",
    points: [
      "Liquidación IVA, ReteFuente y ReteICA por ciudad",
      "Exógena DIAN: formatos 1001, 1003, 1007, 1008, 1009",
      "Estado DIAN de factura electrónica y nómina electrónica",
      "Certificados de retención generados automáticos",
      "Información tributaria del tenant auto-completada",
      "Fechas y vencimientos DIAN recordados por la IA",
    ],
  },
  {
    icon: PackageCheck,
    tint: "cream",
    title: "Inventario y activos",
    points: [
      "Productos y servicios con precio, IVA y costo",
      "Kardex con costo promedio ponderado automático",
      "Valorización mensual y movimientos auditables",
      "Activos fijos con depreciación automática",
      "Control multi-bodega y por categoría",
      "Alertas de stock bajo y rotación",
    ],
  },
  {
    icon: FileText,
    tint: "peach",
    title: "Libros y estados financieros",
    points: [
      "Plan de cuentas (PUC) colombiano 2025 precargado",
      "Libro diario, mayor, auxiliar y balance de comprobación",
      "Balance general y estado de resultados en tiempo real",
      "Flujo de efectivo y estado de cambios en el patrimonio",
      "Libros de ventas, compras e inventarios oficiales",
      "Cartera por cliente, proveedor y vencimientos",
    ],
  },
  {
    icon: Users,
    tint: "mint",
    title: "Terceros y equipo",
    points: [
      "Clientes, proveedores, empleados y socios en una sola lista",
      "Importación masiva con CSV y mapeo inteligente",
      "Roles: administrador, contador, empleado, espacio contador",
      "Espacio contador para gestionar varias empresas",
      "Centros de costo y sucursales sin costo extra",
      "Auditoría de quién hizo qué (bitácora completa)",
    ],
  },
];

const ContabilidadProductoPage = () => {
  document.title = "Módulo Contable | Bolti";

  return (
    <div className="landing-root min-h-screen bg-background text-foreground antialiased">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero contable */}
        <section className="relative overflow-hidden bg-cream">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 top-10 size-[520px] rounded-full bg-mint/40 blur-3xl"
          />
          <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16 lg:px-8">
            <Link
              to="/"
              className="mb-8 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[13px] font-semibold text-foreground no-underline transition hover:bg-muted"
            >
              <ArrowLeft className="size-3.5" /> Volver a la landing
            </Link>

            <div className="max-w-3xl">
              <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-ink">
                <ChartLine className="size-3.5" />
                Módulo Contable
              </span>
              <h1 className="tight-heading text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] text-foreground sm:text-5xl lg:text-6xl">
                Todo lo que hace el{" "}
                <span className="relative inline-block">
                  <span className="relative z-10 text-ink">módulo contable</span>
                </span>{" "}
                de Bolti.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Esto es lo que vas a encontrar adentro: facturación electrónica DIAN, bancos,
                impuestos, inventario, libros oficiales y reportes. Todo conectado y todo en
                pesos colombianos, desde{" "}
                <span className="font-semibold text-foreground">$499.000 al año</span>.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/register-tenant"
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-[14px] font-semibold text-ink-foreground no-underline shadow-md transition hover:brightness-125"
                >
                  Probar gratis 14 días
                  <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#planes"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-background px-6 text-[14px] font-semibold text-foreground no-underline transition hover:bg-muted"
                >
                  <Sparkles className="size-4 text-brand" />
                  Ver planes y precios
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Bloques detallados */}
        <section className="bg-background py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-5 lg:grid-cols-2">
              {BLOCKS.map((b) => {
                const tintClass = {
                  peach: "bg-peach",
                  mint: "bg-mint",
                  lilac: "bg-lilac",
                  cream: "bg-cream",
                }[b.tint];
                return (
                  <article
                    key={b.title}
                    className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-7"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`inline-flex size-14 items-center justify-center rounded-2xl text-ink ${tintClass}`}
                      >
                        <b.icon className="size-7" />
                      </div>
                      <h2 className="tight-heading text-2xl font-extrabold text-foreground">
                        {b.title}
                      </h2>
                    </div>
                    <ul className="flex flex-col gap-2.5">
                      {b.points.map((p) => (
                        <li key={p} className="flex items-start gap-2 text-[14.5px] leading-snug text-foreground">
                          <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={3} />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* IA contable */}
        <section className="bg-ink text-ink-foreground">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8">
            <div>
              <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-ink-foreground/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-ink-foreground/80">
                <Bot className="size-3.5 text-brand" />
                IA contable incluida
              </span>
              <h2 className="tight-heading text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
                Pregúntale a la IA <span className="text-brand">como a tu contador</span>.
              </h2>
              <p className="mt-4 max-w-xl text-base text-ink-foreground/75 sm:text-lg">
                Sin abrir Excel ni pantallas. La IA responde en segundos, explica el número,
                y si querés profundizar, abrís el módulo y está ahí todo.
              </p>
              <ul className="mt-6 flex flex-col gap-2 text-[14.5px] text-ink-foreground/85">
                {[
                  "¿Cuánto voy a pagar de IVA este mes?",
                  "¿Cuál es mi cliente con más cartera?",
                  "¿Cuánto gasté en nómina los últimos 3 meses?",
                  "Emitime una factura a Industrias ACME por el servicio X.",
                ].map((q) => (
                  <li key={q} className="inline-flex items-start gap-2 rounded-xl border border-ink-foreground/15 bg-ink-foreground/5 px-4 py-3">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" />
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-ink-foreground/15 bg-ink-foreground/5 p-6">
              <div className="space-y-3">
                <div className="ml-auto max-w-[80%] rounded-2xl bg-brand px-4 py-3 text-[14px] font-medium text-brand-foreground">
                  ¿Cuánto voy a pagar de IVA este bimestre?
                </div>
                <div className="max-w-[85%] rounded-2xl bg-ink-foreground/10 px-4 py-3 text-[14px] text-ink-foreground/90">
                  Con tus ventas y compras actuales vas a pagar <strong>$3.842.000</strong> de IVA el 14 de noviembre. Te quedan 21 días. Mirar detalle →
                </div>
                <div className="ml-auto max-w-[80%] rounded-2xl bg-brand px-4 py-3 text-[14px] font-medium text-brand-foreground">
                  ¿Cuál cliente tiene más cartera?
                </div>
                <div className="max-w-[85%] rounded-2xl bg-ink-foreground/10 px-4 py-3 text-[14px] text-ink-foreground/90">
                  <strong>Distribuciones JM</strong> con $8.420.000 en 3 facturas, la más vieja de hace 47 días.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bancos */}
        <TrustedBy />

        {/* Señales de confianza */}
        <TrustSignals />

        {/* Planes (reutilizo) */}
        <div id="planes">
          <ContabilidadPlans />
        </div>

        {/* FAQ */}
        <Faq />

        {/* CTA final */}
        <section className="bg-background px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-14 text-ink-foreground sm:rounded-[2.5rem] sm:px-12 sm:py-20">
              <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-brand/30 blur-3xl" />
              <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <h2 className="tight-heading text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
                    Tu contabilidad,{" "}
                    <span className="text-brand">en piloto automático</span>.
                  </h2>
                  <p className="mt-4 text-base text-ink-foreground/75 sm:text-lg">
                    Probá 14 días gratis sin tarjeta. Migración de tu contabilidad actual sin costo.
                  </p>
                </div>
                <Link
                  to="/register-tenant"
                  className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-brand px-8 text-base font-semibold text-brand-foreground no-underline shadow-lg transition hover:brightness-110"
                >
                  Empezar gratis
                  <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default ContabilidadProductoPage;
