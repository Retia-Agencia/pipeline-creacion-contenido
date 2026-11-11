-- 049_outputs_video_key.sql - La llave del video en `outputs`, derivada por la base y no por quien escribe.
-- Aplicar DESPUES de la `048`. SQL Editor de Supabase -> pegar -> Run (o `psql -1 -f`).
--
-- Ejecuta el techo que ADR-070 dejo declarado (`lib/historicos.ts`, "ponytail: techo declarado") y
-- cierra [ADR-105](../../docs/adr/ADR-105-las-lecturas-por-coleccion-piden-por-llave.md).
--
-- EL PORQUE
-- 1. `public.outputs` no tiene una columna con la llave del video. En las 867 filas del feed
--    archivado `external_id` es el uuid del candidato, no el id del video, asi que la llave
--    (`plataforma:id`) se deriva en memoria desde `metadata.url_referente`. Resultado: para saber
--    titulo y voz de los 40 videos de una coleccion el cockpit baja TODO el historico (1.966 filas,
--    en paginas de 25) y lo cruza en Node. Funciona, pero cuesta lo mismo con 40 videos que con 4.000.
-- 2. Una columna comun obligaria a que cada escritor (el archivado de n8n, el cockpit, lo que venga)
--    la calcule, y n8n no puede importar `domain/enlace.ts`: serian dos derivaciones, el bug mudo
--    que `claveDe` ya documenta. Una columna GENERADA la calcula la base, siempre, para todos.
--
-- LA DERIVACION ES UNA SOLA IDEA EN DOS LENGUAJES, y por eso esta medida y no supuesta: el mismo
-- criterio de `parsearEnlaces` (ADR-031: el id de Instagram es el shortcode leido como base64
-- big-endian; el de TikTok viaja crudo en `/video/<id>`). Verificada contra las 1.966 filas reales
-- comparandola con la funcion TypeScript antes de escribir esto: ver la prueba al final.
--
-- ORDEN: se aplica ANTES del deploy del cockpit que filtra por `video_key`. Sin la columna
-- PostgREST responde 42703 y la pantalla de colecciones se cae.
--
-- Aditiva e idempotente. La columna generada se llena sola al crearse (1.966 filas, milisegundos).

create or replace function app.clave_de_url(url text)
returns text
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  u text;
  m text[];
  n numeric := 0;
  pos int;
  i int;
  alfabeto constant text :=
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
begin
  if url is null then
    return null;
  end if;

  -- Misma limpieza que `limpiar` en domain/enlace.ts: sin cola (?igsh=, #) ni puntuacion pegada.
  u := regexp_replace(split_part(split_part(url, '?', 1), '#', 1), '[.,;:!)\]}>]+$', '');

  m := regexp_match(u, 'instagram\.com/(?:[\w.]+/)?(?:p|reel|reels|tv)/([A-Za-z0-9_-]{5,30})', 'i');
  if m is not null then
    for i in 1..length(m[1]) loop
      pos := strpos(alfabeto, substr(m[1], i, 1));
      if pos = 0 then
        return null;
      end if;
      -- numeric y no bigint: 64^11 supera el maximo de bigint y un shortcode largo desbordaria.
      n := n * 64 + (pos - 1);
    end loop;
    return 'instagram:' || n::text;
  end if;

  m := regexp_match(u, 'tiktok\.com/@([\w.-]+)/video/(\d{5,25})', 'i');
  if m is not null then
    return 'tiktok:' || m[2];
  end if;

  -- Un link que no es de un video identificable (corto de TikTok, perfil, etc.): sin llave. NULL es
  -- "no se sabe", nunca una llave inventada.
  return null;
end;
$$;

comment on function app.clave_de_url(text) is
  'Llave de video (plataforma:id) derivada de una URL. Gemela de claveDe/parsearEnlaces en apps/dashboard/domain/enlace.ts: si una cambia, cambia la otra (ADR-031, ADR-105).';

-- Sin esto la funcion nace con EXECUTE para PUBLIC (default de Postgres, ver la `041`).
revoke execute on function app.clave_de_url(text) from public;
grant execute on function app.clave_de_url(text) to authenticated, service_role;

-- Generated STORED: la base la mantiene sola, no hay backfill que correr ni escritor que la olvide.
alter table public.outputs
  add column if not exists video_key text
  generated always as (app.clave_de_url(metadata ->> 'url_referente')) stored;

comment on column public.outputs.video_key is
  'plataforma:id del video, derivada de metadata.url_referente por app.clave_de_url. NULL si no hay URL identificable. Generada: no se escribe (ADR-105).';

-- La consulta que justifica la columna: "de estas N llaves, que hay aprobado en este tenant".
create index if not exists outputs_instance_video_key_idx
  on public.outputs (instance_id, video_key)
  where video_key is not null;
