-- Factures : la base calcule elle-même TPS et TVQ (arrondies au cent) à partir des taux copiés,
-- et une facture payée devient non modifiable (son revenu est déjà dans le budget).
create function public.factures_avant_ecriture()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.statut = 'payee' then
    raise exception 'Une facture payée ne peut plus être modifiée.' using errcode = '42501';
  end if;
  if new.taxable then
    new.tps := round(new.montant_ht * new.taux_tps / 100, 2);
    new.tvq := round(new.montant_ht * new.taux_tvq / 100, 2);
  else
    new.tps := 0;
    new.tvq := 0;
  end if;
  -- Le passage à « payée » se fait seulement par marquer_facture_payee, qui crée le revenu.
  if new.statut = 'payee' and (tg_op = 'INSERT' or old.statut <> 'payee') and current_setting('mes_finances.paiement', true) is distinct from 'oui' then
    raise exception 'Utilise marquer_facture_payee pour enregistrer un paiement.' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger factures_avant_ecriture
  before insert or update on public.factures
  for each row execute function public.factures_avant_ecriture();

-- marquer_facture_payee signale le passage autorisé à « payée ».
create or replace function public.marquer_facture_payee(p_facture uuid, p_date date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  f      public.factures;
  cat    uuid;
  tx     uuid;
  trouve boolean;
begin
  perform set_config('mes_finances.paiement', 'oui', true);
  update public.factures
     set statut = 'payee', date_paiement = p_date
   where id = p_facture and statut <> 'payee'
  returning * into f;
  trouve := found; -- avant PERFORM, qui réécrit FOUND
  perform set_config('mes_finances.paiement', '', true);

  if not trouve then
    select id into tx from public.transactions where facture_id = p_facture;
    return tx;
  end if;

  select id into cat from public.categories where user_id = f.user_id and code = 'rev-entreprise';

  insert into public.transactions (user_id, date, libelle_brut, marchand, montant, categorie_id,
                                   source, facture_id, tps, tvq)
  values (f.user_id, p_date, 'Facture ' || f.numero || ' ' || f.client, f.client,
          f.montant_ht + f.tps + f.tvq, cat, 'facture', f.id, f.tps, f.tvq)
  on conflict do nothing
  returning id into tx;

  return tx;
end $$;
