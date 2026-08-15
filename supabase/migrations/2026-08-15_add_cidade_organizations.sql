alter table public.organizations add column if not exists cidade text;
comment on column public.organizations.cidade is
  'Cidade onde o cliente atua — usada para propagar ao Cadastro Mestre e, no Dashboard, decidir se reaproveita uma estrutura territorial já mapeada (ver Task 4 do plano de provisionamento cross-sistema).';
