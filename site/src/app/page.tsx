import { ArrowRight, ArrowUpRight, Check, Globe, LayoutDashboard, Bot, PenTool, Plus } from "lucide-react";
import { Reveal } from "@/components/fx/reveal";
import { asset, contactHref, CONTACT_EMAIL, INSTAGRAM_HANDLE } from "@/lib/site";

const external = CONTACT_EMAIL ? {} : { target: "_blank", rel: "noopener" };

const SERVICES = [
  {
    icon: Globe,
    title: "Sites web",
    text: "Sites vitrines rapides, élégants et bien référencés, que vous pouvez faire évoluer facilement.",
    tags: ["Site vitrine", "Référencement", "Mobile"],
  },
  {
    icon: LayoutDashboard,
    title: "Applications métier",
    text: "Une application web et mobile pour piloter votre activité, avec un accès dirigeant complet et un accès salarié restreint.",
    tags: ["Web", "Mobile", "Outils de gestion"],
  },
  {
    icon: Bot,
    title: "Agents et automatisations IA",
    text: "Devis, relances, tri des mails, saisies : l'IA prépare le travail répétitif, vous le validez en un clic.",
    tags: ["Agents IA", "Automatisations", "Assistants"],
  },
  {
    icon: PenTool,
    title: "Identité et design",
    text: "Logo, charte graphique, visuels pour les réseaux : une image claire et reconnaissable dès le premier coup d'œil.",
    tags: ["Logo", "Charte", "Visuels réseaux"],
  },
];

const SECTEURS = [
  {
    name: "Immobilier",
    lead: "Moins d'administratif, plus de terrain. Pour les agences, les mandataires et leurs équipes.",
    items: [
      ["Rédaction d'annonces", "Une annonce complète à partir de vos notes de visite et de vos photos."],
      ["Relances de prospects", "Des relances préparées au bon moment, relues avant l'envoi."],
      ["Comptes rendus de visite", "Vos notes deviennent un compte rendu clair pour le vendeur."],
      ["Tri de la boîte mail", "Les demandes classées par priorité, avec un brouillon de réponse prêt."],
    ],
  },
  {
    name: "Industrie",
    lead: "Des dossiers qui avancent sans ressaisie. Pour les PME de production et de conditionnement.",
    items: [
      ["Devis", "Un devis préparé à partir de la demande client et de vos tarifs, à valider."],
      ["Suivi des commandes", "Un point de situation automatique, et une alerte quand un dossier prend du retard."],
      ["Qualité et sécurité", "Procédures et fiches tenues à jour, faciles à retrouver par toute l'équipe."],
      ["Appels d'offres", "Un premier jet structuré à partir de vos dossiers précédents."],
    ],
  },
];

const PROJETS = [
  {
    name: "Tampon",
    kind: "Application · Artisans",
    status: "En test",
    text: "Un assistant qui prend en charge les tâches administratives pénibles des artisans, jusqu'au scan des factures reçues.",
  },
  {
    name: "Carnet Courtier",
    kind: "Application · Courtage",
    status: "En test",
    text: "Planning du jour, notes d'appel, rappels à J+1 / J+3 et mails au même endroit, pour un courtier en rachat de crédit.",
  },
  {
    name: "Toc & Go",
    kind: "Application · Immobilier",
    status: "En test",
    text: "La prospection terrain des agents immobiliers : tout noter au porte-à-porte d'une seule main, avec export vers le CRM de l'agence.",
  },
];

const VITRINES = [
  { name: "Cryptotidien", kind: "Média · Site · IA", img: "cryptotidien", text: "Un média crypto francophone rédigé chaque matin par un agent IA, puis validé avant publication." },
  { name: "Bureau des agents", kind: "IA · Automatisation", img: "bureau", text: "Un espace où des agents IA trient les mails, rédigent, préparent les réseaux. Rien n'est publié sans validation." },
];

const DEMOS = [
  { name: "Horizon Immobilier", kind: "Agence immobilière", img: "horizon" },
  { name: "Maison Braise", kind: "Restaurant", img: "braise" },
  { name: "Atelier Rives", kind: "Artisan rénovation", img: "rives" },
  { name: "Ferrand Industrie", kind: "PME industrielle", img: "ferrand" },
];

const METHODE = [
  ["01", "Diagnostic gratuit", "Un premier échange pour repérer les tâches qui vous prennent le plus de temps."],
  ["02", "Un premier cas d'usage", "On en choisit un seul, on le construit, et vous le testez sur votre vrai travail."],
  ["03", "Déploiement", "Branchement à vos outils actuels et prise en main par votre équipe."],
  ["04", "Suivi", "On ajuste selon vos retours, puis on élargit si le gain est là."],
];

const FAQ = [
  [
    "Combien ça coûte ?",
    "Chaque projet est chiffré après le diagnostic, qui est gratuit et sans engagement. On commence par un seul cas d'usage pour que le budget reste maîtrisé, de l'artisan seul à la PME.",
  ],
  [
    "Faut-il changer mes outils ?",
    "Non. On part de ce que vous utilisez déjà (mails, tableur, logiciel de facturation, CRM) et on s'y branche quand c'est possible.",
  ],
  [
    "L'IA peut-elle envoyer quelque chose à ma place ?",
    "Pas sans vous. L'IA prépare : devis, relances, réponses, comptes rendus. Vous relisez et vous validez. Rien ne part sans votre accord.",
  ],
  [
    "Et mes données ?",
    "Elles servent uniquement à faire fonctionner votre outil. Elles ne sont ni revendues, ni utilisées pour autre chose.",
  ],
  [
    "Je ne suis pas à La Rochelle, est-ce possible ?",
    "Oui. Le premier échange et le suivi peuvent se faire en visio ou par téléphone.",
  ],
];

function Eyebrow({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-[13px] font-medium uppercase tracking-[0.18em] text-soft">
      <span className="font-mono text-accent">{n}</span>
      <span className="h-px w-8 bg-white/15" />
      {children}
    </p>
  );
}

function Status({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-[#ff8a57]">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      {children}
    </span>
  );
}

export default function Home() {
  return (
    <main className="overflow-x-clip">
      {/* ───────── HERO ───────── */}
      <section className="hero-halo relative">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-24 pt-36 lg:grid-cols-[1.15fr_0.85fr] lg:pt-44">
          <div>
            <p className="text-sm text-soft">Studio digital &amp; IA · La Rochelle</p>
            <h1 className="mt-6 text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-6xl lg:text-[4.2rem]">
              Moins d&apos;administratif.
              <br />
              <span className="text-soft">Plus de temps pour votre métier.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-soft">
              bnia.lab conçoit des sites, des applications et des assistants IA sur mesure pour les artisans, les TPE et les PME.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a href={contactHref} {...external} className="btn-primary group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium">
                Demander un diagnostic gratuit
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <a href="#realisations" className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3.5 text-sm font-medium transition hover:bg-white/5">
                Voir les réalisations
              </a>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-soft">
              {["Premier échange gratuit", "Réponse sous 48 h", "Rien ne part sans votre accord"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-accent" /> {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Aperçu sobre : l'IA prépare, vous validez */}
          <Reveal delay={0.15}>
            <div className="card rounded-3xl p-6 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">À valider aujourd&apos;hui</p>
                <span className="text-xs text-soft">3 éléments</span>
              </div>
              <ul className="mt-5 space-y-3">
                {[
                  ["Devis · Rénovation salle de bain", "Préparé à partir de la demande reçue à 09:02"],
                  ["Relance · Client sans réponse", "Programmée à J+3, prête à partir"],
                  ["Facture · Chantier terminé", "Montants repris du devis signé"],
                ].map(([t, d], i) => (
                  <li key={t} className="flex items-start justify-between gap-4 rounded-2xl border border-white/[0.07] bg-black/30 p-4">
                    <div>
                      <p className="text-sm font-medium">{t}</p>
                      <p className="mt-1 text-xs text-soft">{d}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${i === 0 ? "bg-foreground text-background" : "border border-white/15 text-soft"}`}>
                      {i === 0 ? "Valider" : "Voir"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs text-soft">Exemple d&apos;écran · l&apos;IA prépare, vous décidez.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────── SERVICES ───────── */}
      <section id="services" className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <Reveal>
          <Eyebrow n="01">Services</Eyebrow>
          <h2 className="mt-5 max-w-2xl text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Ce que l&apos;on construit pour vous
          </h2>
          <p className="mt-5 max-w-xl text-soft">
            Vous arrivez avec un problème, pas forcément avec un cahier des charges. On l&apos;éclaircit avec vous, puis on construit l&apos;outil qui le règle.
          </p>
        </Reveal>
        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {SERVICES.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.05}>
              <article className="card h-full rounded-3xl p-8">
                <s.icon className="h-6 w-6 text-accent" strokeWidth={1.6} />
                <h3 className="mt-6 text-xl font-semibold">{s.title}</h3>
                <p className="mt-3 leading-relaxed text-soft">{s.text}</p>
                <p className="mt-6 text-xs text-soft/80">{s.tags.join("  ·  ")}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────── SECTEURS ───────── */}
      <section className="border-y border-white/[0.07] bg-white/[0.015]">
        <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
          <Reveal>
            <Eyebrow n="02">Intégration IA</Eyebrow>
            <h2 className="mt-5 max-w-2xl text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Deux secteurs connus de l&apos;intérieur</h2>
            <p className="mt-5 max-w-xl text-soft">
              Pour y avoir travaillé. On part de vos tâches réelles, pas d&apos;un catalogue d&apos;outils.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            {SECTEURS.map((s, i) => (
              <Reveal key={s.name} delay={i * 0.08}>
                <article className="card h-full rounded-3xl p-8">
                  <h3 className="text-2xl font-semibold">{s.name}</h3>
                  <p className="mt-2 text-soft">{s.lead}</p>
                  <ul className="mt-8 divide-y divide-white/[0.07]">
                    {s.items.map(([t, d]) => (
                      <li key={t} className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-6">
                        <p className="font-medium">{t}</p>
                        <p className="text-sm leading-relaxed text-soft">{d}</p>
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── RÉALISATIONS ───────── */}
      <section id="realisations" className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <Reveal>
          <Eyebrow n="03">Réalisations</Eyebrow>
          <h2 className="mt-5 max-w-2xl text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Testé d&apos;abord chez nous</h2>
          <p className="mt-5 max-w-xl text-soft">
            Des projets maison, conçus et construits de bout en bout. Les applications ci-dessous sont en phase de test avec de premiers utilisateurs.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {PROJETS.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.05}>
              <article className="card flex h-full flex-col rounded-3xl p-7">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-soft">{p.kind}</p>
                  <Status>{p.status}</Status>
                </div>
                <h3 className="mt-8 text-2xl font-semibold tracking-tight">{p.name}</h3>
                <p className="mt-3 leading-relaxed text-soft">{p.text}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {VITRINES.map((v, i) => (
            <Reveal key={v.name} delay={i * 0.05}>
              <article className="card h-full overflow-hidden rounded-3xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset(`/${v.img}.jpg`)} alt={`Aperçu de ${v.name}`} width={1200} height={900} loading="lazy" className="aspect-[16/10] w-full object-cover object-top" />
                <div className="p-7">
                  <p className="text-xs uppercase tracking-[0.14em] text-soft">{v.kind}</p>
                  <h3 className="mt-3 text-xl font-semibold">{v.name}</h3>
                  <p className="mt-2 leading-relaxed text-soft">{v.text}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-20 flex flex-wrap items-end justify-between gap-6 border-t border-white/[0.07] pt-10">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight">Sites vitrines</h3>
              <p className="mt-2 max-w-xl text-soft">Quatre démos, quatre univers, prêtes à être déclinées à votre image. Les entreprises présentées sont fictives.</p>
            </div>
          </div>
        </Reveal>
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {DEMOS.map((d, i) => (
            <Reveal key={d.name} delay={i * 0.05}>
              <figure>
                <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset(`/${d.img}.jpg`)} alt={`Démo de site : ${d.name}`} width={1200} height={900} loading="lazy" className="aspect-[4/3] w-full object-cover transition duration-500 hover:scale-[1.03]" />
                </div>
                <figcaption className="mt-3">
                  <p className="text-sm font-medium">{d.name}</p>
                  <p className="text-xs text-soft">{d.kind} · démo</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────── MÉTHODE ───────── */}
      <section id="methode" className="border-y border-white/[0.07] bg-white/[0.015]">
        <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
          <Reveal>
            <Eyebrow n="04">Méthode</Eyebrow>
            <h2 className="mt-5 max-w-2xl text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Comment ça démarre</h2>
          </Reveal>
          <ol className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-4">
            {METHODE.map(([n, t, d], i) => (
              <li key={n} className="bg-[#0e0e11] p-8">
                <Reveal delay={i * 0.05}>
                  <p className="font-mono text-sm text-accent">{n}</p>
                  <h3 className="mt-6 text-lg font-semibold">{t}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-soft">{d}</p>
                </Reveal>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-sm text-soft">Vous gardez la main à chaque étape : l&apos;IA prépare, vous validez.</p>
        </div>
      </section>

      {/* ───────── À PROPOS ───────── */}
      <section id="apropos" className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <Eyebrow n="05">À propos</Eyebrow>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Un interlocuteur, du terrain au code</h2>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="space-y-5 text-lg leading-relaxed text-soft">
              <p>
                Derrière bnia.lab, il y a Benjamin. Avant de développer des outils, il a travaillé dans l&apos;immobilier en région parisienne, dans l&apos;industrie et dans le matériel médical.
              </p>
              <p>
                C&apos;est ce qui guide chaque projet : comprendre comment vous travaillez vraiment, puis construire un outil simple, que votre équipe a envie d&apos;utiliser.
              </p>
              <p className="text-foreground">Vous parlez à la personne qui construit votre outil, du premier échange au suivi.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section id="faq" className="mx-auto max-w-3xl px-6 pb-24 sm:pb-32">
        <Reveal>
          <Eyebrow n="06">Questions fréquentes</Eyebrow>
        </Reveal>
        <div className="mt-10 divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-6">
              <summary className="flex items-center justify-between gap-6 text-lg font-medium">
                {q}
                <Plus className="faq-plus h-5 w-5 shrink-0 text-soft transition-transform" />
              </summary>
              <p className="mt-4 max-w-2xl leading-relaxed text-soft">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ───────── CONTACT ───────── */}
      <section id="contact" className="mx-auto max-w-6xl px-6 pb-28">
        <Reveal>
          <div className="hero-halo card overflow-hidden rounded-[2rem] px-8 py-16 text-center sm:px-16 sm:py-24">
            <h2 className="text-4xl font-semibold tracking-[-0.03em] sm:text-6xl">Un projet en tête&nbsp;?</h2>
            <p className="mx-auto mt-5 max-w-lg text-lg text-soft">
              Décrivez-nous la tâche qui vous pèse le plus. On vous dit comment la simplifier. Premier échange gratuit et sans engagement.
            </p>
            <a href={contactHref} {...external} className="btn-primary group mt-10 inline-flex items-center gap-2 rounded-full px-7 py-4 text-sm font-medium">
              {CONTACT_EMAIL ? "Nous écrire" : `Nous écrire sur Instagram`}
              {CONTACT_EMAIL ? <ArrowRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
            </a>
            <p className="mt-5 text-sm text-soft">{CONTACT_EMAIL || INSTAGRAM_HANDLE} · réponse sous 48 h</p>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
