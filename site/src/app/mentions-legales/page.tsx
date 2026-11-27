import type { Metadata } from "next";
import { CONTACT_EMAIL, INSTAGRAM_HANDLE, LEGAL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mentions légales · bnia.lab",
  robots: { index: false },
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/[0.08] py-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-2 leading-relaxed text-soft">{children}</div>
    </section>
  );
}

export default function MentionsLegales() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-36">
      <h1 className="mb-10 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Mentions légales</h1>

      <Block title="Éditeur du site">
        <p><span className="text-foreground">Nom commercial :</span> bnia.lab</p>
        <p><span className="text-foreground">Responsable :</span> {LEGAL.responsable}, {LEGAL.statut}</p>
        <p><span className="text-foreground">SIRET :</span> {LEGAL.siret}</p>
        <p><span className="text-foreground">Adresse :</span> {LEGAL.adresse}</p>
        <p><span className="text-foreground">Contact :</span> {CONTACT_EMAIL || `Instagram ${INSTAGRAM_HANDLE}`}</p>
        <p><span className="text-foreground">TVA :</span> {LEGAL.tva}</p>
        <p><span className="text-foreground">Directeur de la publication :</span> {LEGAL.responsable}</p>
      </Block>

      <Block title="Hébergement">
        <p>GitHub Pages, service de GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.</p>
      </Block>

      <Block title="Propriété intellectuelle">
        <p>Les textes, visuels et éléments graphiques de ce site sont la propriété de bnia.lab, sauf mention contraire. Toute reproduction sans autorisation est interdite.</p>
        <p>Les sites vitrines présentés dans la rubrique « Réalisations » sont des démonstrations : les entreprises qui y figurent sont fictives.</p>
      </Block>

      <Block title="Données personnelles">
        <p>Ce site ne comporte aucun formulaire et ne dépose aucun cookie de mesure d&apos;audience ou de publicité. Les polices de caractères sont hébergées avec le site, sans appel à un service externe comme Google Fonts.</p>
        <p>Si vous nous écrivez, vos messages sont utilisés uniquement pour vous répondre et ne sont jamais cédés. Vous pouvez demander à tout moment l&apos;accès, la rectification ou la suppression de vos données en nous contactant.</p>
      </Block>
    </main>
  );
}
