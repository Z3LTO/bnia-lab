-- =====================================================================
--  bnia.lab · Assistant administratif artisans
--  Schéma de base de données Supabase (PostgreSQL)
--
--  À coller dans Supabase > SQL Editor > New query, puis « Run ».
--  Peut être relancé sans risque sur une base vide.
--
--  Principes :
--   • Une entreprise = un artisan (ou une petite équipe).
--   • Chaque utilisateur est membre d'une entreprise avec un rôle :
--       - directeur : accès complet (factures, encaissements, réglages)
--       - salarie   : clients et devis uniquement
--   • Les règles d'accès (RLS) sont dans la base : même avec la clé
--     publique, personne ne voit les données d'une autre entreprise.
--   • Factures : numéro continu par année, attribué par la base,
--     jamais supprimées, lignes figées une fois émises.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
--  Tables
-- ---------------------------------------------------------------------

create table if not exists public.entreprises (
  id               uuid primary key default gen_random_uuid(),
  nom              text not null check (length(trim(nom)) > 0),
  statut           text not null default 'micro' check (statut in ('micro','ei','societe')),
  metier           text,
  siret            text,
  rm               text,                       -- n° répertoire des métiers
  adresse          text,
  cp               text,
  ville            text,
  tel              text,
  email            text,
  tva_intra        text,
  capital          text,                       -- ex. « SARL au capital de 5 000 € »
  assureur         text,                       -- assurance pro / décennale
  assurance_zone   text,
  iban             text,
  delai_paiement   int  not null default 30 check (delai_paiement between 0 and 60),
  validite_devis   int  not null default 30 check (validite_devis > 0),
  created_at       timestamptz not null default now()
);

create table if not exists public.membres (
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'salarie' check (role in ('directeur','salarie')),
  created_at    timestamptz not null default now(),
  primary key (entreprise_id, user_id)
);
create index if not exists membres_user_idx on public.membres(user_id);

create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  type          text not null default 'particulier' check (type in ('particulier','pro')),
  nom           text not null check (length(trim(nom)) > 0),
  adresse       text,
  cp            text,
  ville         text,
  email         text,
  tel           text,
  siren         text,                          -- clients professionnels
  created_at    timestamptz not null default now()
);
create index if not exists clients_entreprise_idx on public.clients(entreprise_id);

create table if not exists public.devis (
  id             uuid primary key default gen_random_uuid(),
  entreprise_id  uuid not null references public.entreprises(id) on delete cascade,
  client_id      uuid not null references public.clients(id) on delete restrict,
  numero         text not null,                -- D-2026-001 (attribué par la base)
  objet          text,
  chantier       text,                         -- adresse des travaux si différente
  date_devis     date not null default current_date,
  validite_jours int  not null default 30 check (validite_jours > 0),
  acompte_pct    numeric(5,2) not null default 0 check (acompte_pct between 0 and 100),
  note           text,
  statut         text not null default 'brouillon'
                 check (statut in ('brouillon','envoye','accepte','refuse','facture')),
  envoye_le      date,
  created_by     uuid references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  unique (entreprise_id, numero)
);
create index if not exists devis_entreprise_idx on public.devis(entreprise_id, created_at desc);

create table if not exists public.factures (
  id             uuid primary key default gen_random_uuid(),
  entreprise_id  uuid not null references public.entreprises(id) on delete restrict,
  client_id      uuid not null references public.clients(id) on delete restrict,
  devis_id       uuid references public.devis(id) on delete set null,
  numero         text not null,                -- F-2026-001 (attribué par la base)
  objet          text,
  chantier       text,
  date_facture   date not null default current_date,
  date_execution date not null default current_date,
  echeance       date not null,
  note           text,
  statut         text not null default 'emise' check (statut in ('emise','payee','annulee')),
  paye_le        date,
  created_by     uuid references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  unique (entreprise_id, numero),
  check (statut <> 'payee' or paye_le is not null)
);
create index if not exists factures_entreprise_idx on public.factures(entreprise_id, created_at desc);
create index if not exists factures_impayees_idx on public.factures(entreprise_id, echeance) where statut = 'emise';

-- Une ligne appartient soit à un devis, soit à une facture.
create table if not exists public.lignes (
  id              uuid primary key default gen_random_uuid(),
  devis_id        uuid references public.devis(id) on delete cascade,
  facture_id      uuid references public.factures(id) on delete restrict,
  position        int  not null default 0,
  designation     text not null default '',
  quantite        numeric(12,3) not null default 1,
  unite           text,
  prix_unitaire_ht numeric(12,2) not null default 0,
  taux_tva        numeric(4,2) not null default 0 check (taux_tva in (0, 2.1, 5.5, 10, 20)),
  check ((devis_id is null) <> (facture_id is null))
);
create index if not exists lignes_devis_idx on public.lignes(devis_id, position);
create index if not exists lignes_facture_idx on public.lignes(facture_id, position);

create table if not exists public.relances (
  id          uuid primary key default gen_random_uuid(),
  facture_id  uuid not null references public.factures(id) on delete cascade,
  niveau      int  not null check (niveau between 1 and 3),  -- 1 amicale, 2 ferme, 3 mise en demeure
  canal       text not null default 'email' check (canal in ('email','courrier','telephone','sms')),
  envoyee_le  date not null default current_date,
  created_by  uuid references auth.users(id) default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists relances_facture_idx on public.relances(facture_id);

-- Compteurs de numérotation (un par entreprise, type et année).
create table if not exists public.compteurs (
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  type          text not null check (type in ('devis','facture')),
  annee         int  not null,
  dernier       int  not null default 0,
  primary key (entreprise_id, type, annee)
);

-- ---------------------------------------------------------------------
--  Fonctions d'accès (utilisées par les règles RLS)
-- ---------------------------------------------------------------------

create or replace function public.est_membre(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membres where entreprise_id = e and user_id = auth.uid());
$$;

create or replace function public.est_directeur(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membres where entreprise_id = e and user_id = auth.uid() and role = 'directeur');
$$;

-- ---------------------------------------------------------------------
--  Numérotation continue, sans trou, attribuée par la base
-- ---------------------------------------------------------------------

create or replace function public.prochain_numero(e uuid, t text, d date) returns text
language plpgsql security definer set search_path = public as $$
declare n int; y int := extract(year from d);
begin
  insert into compteurs as c (entreprise_id, type, annee, dernier) values (e, t, y, 1)
  on conflict (entreprise_id, type, annee) do update set dernier = c.dernier + 1
  returning dernier into n;
  return (case t when 'devis' then 'D-' else 'F-' end) || y || '-' || lpad(n::text, 3, '0');
end $$;
revoke all on function public.prochain_numero(uuid, text, date) from public, anon, authenticated;

create or replace function public.trg_numero_devis() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.numero := prochain_numero(new.entreprise_id, 'devis', new.date_devis);
  return new;
end $$;

create or replace function public.trg_numero_facture() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.numero := prochain_numero(new.entreprise_id, 'facture', new.date_facture);
  if new.echeance is null then
    new.echeance := new.date_facture + (select delai_paiement from entreprises where id = new.entreprise_id);
  end if;
  return new;
end $$;

drop trigger if exists numero_devis on public.devis;
create trigger numero_devis before insert on public.devis
  for each row execute function public.trg_numero_devis();

drop trigger if exists numero_facture on public.factures;
create trigger numero_facture before insert on public.factures
  for each row execute function public.trg_numero_facture();

-- ---------------------------------------------------------------------
--  Garde-fous légaux sur les factures
-- ---------------------------------------------------------------------

-- Champs figés après émission : seuls statut, paye_le et note peuvent changer.
create or replace function public.trg_facture_figee() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Une facture ne peut pas être supprimée. Annulez-la (et émettez un avoir si besoin).';
  end if;
  if (new.numero, new.entreprise_id, new.client_id, new.date_facture, new.date_execution, new.echeance, new.objet, new.chantier, new.devis_id)
     is distinct from
     (old.numero, old.entreprise_id, old.client_id, old.date_facture, old.date_execution, old.echeance, old.objet, old.chantier, old.devis_id) then
    raise exception 'Une facture émise ne peut plus être modifiée (seuls le statut et le paiement peuvent changer).';
  end if;
  if old.statut = 'annulee' and new.statut <> 'annulee' then
    raise exception 'Une facture annulée ne peut pas être réactivée.';
  end if;
  return new;
end $$;

drop trigger if exists facture_figee on public.factures;
create trigger facture_figee before update or delete on public.factures
  for each row execute function public.trg_facture_figee();

-- Lignes de facture : uniquement ajoutées au moment de la création (via creer_facture).
create or replace function public.trg_lignes_facture_figees() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'DELETE' and old.facture_id is not null)
     or (tg_op <> 'DELETE' and new.facture_id is not null and coalesce(current_setting('bnia.creation_facture', true), '') <> 'on')
     or (tg_op = 'UPDATE' and old.facture_id is not null) then
    raise exception 'Les lignes d''une facture émise ne peuvent pas être modifiées.';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists lignes_facture_figees on public.lignes;
create trigger lignes_facture_figees before insert or update or delete on public.lignes
  for each row execute function public.trg_lignes_facture_figees();

-- Pas de modification d'un devis déjà facturé.
create or replace function public.trg_devis_facture_fige() returns trigger
language plpgsql as $$
begin
  if old.statut = 'facture' then
    raise exception 'Ce devis a déjà été facturé, il ne peut plus être modifié.';
  end if;
  if tg_op = 'UPDATE' and new.numero is distinct from old.numero then
    raise exception 'Le numéro d''un devis ne peut pas être modifié.';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists devis_facture_fige on public.devis;
create trigger devis_facture_fige before update or delete on public.devis
  for each row execute function public.trg_devis_facture_fige();

-- ---------------------------------------------------------------------
--  Actions appelées par l'application (RPC)
-- ---------------------------------------------------------------------

-- Inscription : crée l'entreprise et en fait l'utilisateur directeur.
create or replace function public.creer_entreprise(p_nom text) returns uuid
language plpgsql security definer set search_path = public as $$
declare e uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  insert into entreprises (nom) values (p_nom) returning id into e;
  insert into membres (entreprise_id, user_id, role) values (e, auth.uid(), 'directeur');
  return e;
end $$;

-- Le directeur ajoute un salarié (qui doit déjà avoir créé son compte).
create or replace function public.ajouter_membre(p_entreprise uuid, p_email text, p_role text default 'salarie')
returns void language plpgsql security definer set search_path = public, auth as $$
declare u uuid;
begin
  if not est_directeur(p_entreprise) then raise exception 'Réservé au directeur'; end if;
  select id into u from auth.users where lower(email) = lower(trim(p_email));
  if u is null then raise exception 'Aucun compte avec cet e-mail : la personne doit d''abord s''inscrire.'; end if;
  insert into membres (entreprise_id, user_id, role) values (p_entreprise, u, p_role)
  on conflict (entreprise_id, user_id) do update set role = excluded.role;
end $$;

-- Crée une facture et ses lignes en une seule opération.
-- p_lignes : [{"designation":"…","quantite":1,"unite":"h","prix_unitaire_ht":50,"taux_tva":10}, …]
create or replace function public.creer_facture(
  p_entreprise uuid, p_client uuid, p_lignes jsonb,
  p_objet text default null, p_chantier text default null, p_note text default null,
  p_date date default current_date, p_date_execution date default null, p_devis uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare f uuid;
begin
  if not est_directeur(p_entreprise) then raise exception 'Réservé au directeur'; end if;
  if not exists (select 1 from clients where id = p_client and entreprise_id = p_entreprise) then
    raise exception 'Client inconnu';
  end if;
  if jsonb_array_length(coalesce(p_lignes, '[]')) = 0 then raise exception 'Ajoutez au moins une ligne'; end if;
  insert into factures (entreprise_id, client_id, devis_id, objet, chantier, note, date_facture, date_execution)
  values (p_entreprise, p_client, p_devis, p_objet, p_chantier, p_note, p_date, coalesce(p_date_execution, p_date))
  returning id into f;
  perform set_config('bnia.creation_facture', 'on', true);
  insert into lignes (facture_id, position, designation, quantite, unite, prix_unitaire_ht, taux_tva)
  select f, (o - 1)::int, coalesce(l->>'designation', ''), coalesce((l->>'quantite')::numeric, 1), l->>'unite',
         coalesce((l->>'prix_unitaire_ht')::numeric, 0), coalesce((l->>'taux_tva')::numeric, 0)
  from jsonb_array_elements(p_lignes) with ordinality as t(l, o);
  perform set_config('bnia.creation_facture', 'off', true);
  return f;
end $$;

-- Transforme un devis en facture (recopie les lignes, marque le devis « facturé »).
create or replace function public.facturer_devis(p_devis uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare d devis; f uuid;
begin
  select * into d from devis where id = p_devis for update;
  if d.id is null or not est_directeur(d.entreprise_id) then raise exception 'Devis introuvable ou accès refusé'; end if;
  if d.statut = 'facture' then raise exception 'Ce devis est déjà facturé'; end if;
  f := creer_facture(d.entreprise_id, d.client_id,
         (select jsonb_agg(jsonb_build_object('designation', designation, 'quantite', quantite, 'unite', unite,
                 'prix_unitaire_ht', prix_unitaire_ht, 'taux_tva', taux_tva) order by position)
          from lignes where devis_id = d.id),
         d.objet, d.chantier, null, current_date, current_date, d.id);
  update devis set statut = 'facture' where id = d.id;
  return f;
end $$;

grant execute on function public.creer_entreprise(text) to authenticated;
grant execute on function public.ajouter_membre(uuid, text, text) to authenticated;
grant execute on function public.creer_facture(uuid, uuid, jsonb, text, text, text, date, date, uuid) to authenticated;
grant execute on function public.facturer_devis(uuid) to authenticated;
revoke execute on function public.creer_entreprise(text), public.ajouter_membre(uuid, text, text),
  public.creer_facture(uuid, uuid, jsonb, text, text, text, date, date, uuid), public.facturer_devis(uuid) from anon, public;

-- ---------------------------------------------------------------------
--  Vue des totaux (calculés, jamais stockés en double)
-- ---------------------------------------------------------------------

create or replace view public.factures_totaux with (security_invoker = true) as
select f.*,
       coalesce(sum(l.quantite * l.prix_unitaire_ht), 0)::numeric(12,2) as total_ht,
       coalesce(sum(l.quantite * l.prix_unitaire_ht * case when e.statut = 'micro' then 0 else l.taux_tva end / 100), 0)::numeric(12,2) as total_tva,
       coalesce(sum(l.quantite * l.prix_unitaire_ht * (1 + case when e.statut = 'micro' then 0 else l.taux_tva end / 100)), 0)::numeric(12,2) as total_ttc,
       greatest(current_date - f.echeance, 0) as jours_retard,
       (select count(*) from relances r where r.facture_id = f.id) as nb_relances
from factures f
join entreprises e on e.id = f.entreprise_id
left join lignes l on l.facture_id = f.id
group by f.id, e.statut;

create or replace view public.devis_totaux with (security_invoker = true) as
select d.*,
       coalesce(sum(l.quantite * l.prix_unitaire_ht), 0)::numeric(12,2) as total_ht,
       coalesce(sum(l.quantite * l.prix_unitaire_ht * (1 + case when e.statut = 'micro' then 0 else l.taux_tva end / 100)), 0)::numeric(12,2) as total_ttc,
       d.date_devis + d.validite_jours as expire_le
from devis d
join entreprises e on e.id = d.entreprise_id
left join lignes l on l.devis_id = d.id
group by d.id, e.statut;

-- ---------------------------------------------------------------------
--  Règles d'accès (Row Level Security)
-- ---------------------------------------------------------------------

alter table public.entreprises enable row level security;
alter table public.membres     enable row level security;
alter table public.clients     enable row level security;
alter table public.devis       enable row level security;
alter table public.factures    enable row level security;
alter table public.lignes      enable row level security;
alter table public.relances    enable row level security;
alter table public.compteurs   enable row level security;   -- aucune règle : inaccessible depuis l'appli

-- Entreprises : les membres voient la leur, seul le directeur la modifie.
drop policy if exists entreprises_lecture on public.entreprises;
create policy entreprises_lecture on public.entreprises for select to authenticated using (est_membre(id));
drop policy if exists entreprises_modif on public.entreprises;
create policy entreprises_modif on public.entreprises for update to authenticated using (est_directeur(id)) with check (est_directeur(id));

-- Membres : chacun voit son équipe, le directeur gère les rôles et retire des membres.
drop policy if exists membres_lecture on public.membres;
create policy membres_lecture on public.membres for select to authenticated using (est_membre(entreprise_id));
drop policy if exists membres_modif on public.membres;
create policy membres_modif on public.membres for update to authenticated using (est_directeur(entreprise_id)) with check (est_directeur(entreprise_id));
drop policy if exists membres_retrait on public.membres;
create policy membres_retrait on public.membres for delete to authenticated using (est_directeur(entreprise_id) and user_id <> auth.uid());

-- Clients : toute l'équipe.
drop policy if exists clients_equipe on public.clients;
create policy clients_equipe on public.clients for all to authenticated
  using (est_membre(entreprise_id)) with check (est_membre(entreprise_id));

-- Devis : toute l'équipe.
drop policy if exists devis_equipe on public.devis;
create policy devis_equipe on public.devis for all to authenticated
  using (est_membre(entreprise_id)) with check (est_membre(entreprise_id));

-- Factures : directeur uniquement. Création via creer_facture / facturer_devis.
drop policy if exists factures_lecture on public.factures;
create policy factures_lecture on public.factures for select to authenticated using (est_directeur(entreprise_id));
drop policy if exists factures_statut on public.factures;
create policy factures_statut on public.factures for update to authenticated
  using (est_directeur(entreprise_id)) with check (est_directeur(entreprise_id));

-- Lignes : suivent les droits de leur devis ou de leur facture.
drop policy if exists lignes_acces on public.lignes;
create policy lignes_acces on public.lignes for all to authenticated
  using (
    (devis_id is not null and exists (select 1 from devis d where d.id = devis_id and est_membre(d.entreprise_id)))
    or (facture_id is not null and exists (select 1 from factures f where f.id = facture_id and est_directeur(f.entreprise_id))))
  with check (
    devis_id is not null and exists (select 1 from devis d where d.id = devis_id and est_membre(d.entreprise_id)));

-- Relances : directeur uniquement.
drop policy if exists relances_directeur on public.relances;
create policy relances_directeur on public.relances for all to authenticated
  using (exists (select 1 from factures f where f.id = facture_id and est_directeur(f.entreprise_id)))
  with check (exists (select 1 from factures f where f.id = facture_id and est_directeur(f.entreprise_id)));

-- Droits de base (Supabase les donne déjà, rappelés ici pour être explicite).
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.clients, public.devis, public.lignes, public.relances to authenticated;
grant select, update on public.entreprises, public.factures to authenticated;
grant select, update, delete on public.membres to authenticated;
grant select on public.factures_totaux, public.devis_totaux to authenticated;
revoke all on public.entreprises, public.membres, public.clients, public.devis, public.factures,
  public.lignes, public.relances, public.compteurs, public.factures_totaux, public.devis_totaux from anon;
revoke all on public.compteurs from authenticated;
