# Alex MT Barber — Controle de fiados

Projeto inicial estático para GitHub Pages, com interface de administrador, página individual do cliente e PWA.

## Arquivos principais
- `index.html`: painel do administrador.
- `cliente.html`: página individual de consulta (`?token=...`).
- `css/`: estilos responsivos.
- `js/`: lógica de interface e camada de dados.
- `manifest.json` e `service-worker.js`: instalação e cache básico do PWA.
- `supabase/schema.sql`: esquema inicial para criar as tabelas.

## Teste inicial
Abra a pasta no VS Code e use uma extensão de servidor local (por exemplo, Live Server). O modo local salva os dados no `localStorage` do navegador e serve apenas para testar a interface. Os dados locais não sincronizam entre dispositivos nem devem ser usados como banco de produção.

## Configurar Supabase depois
1. Crie um projeto Supabase.
2. No SQL Editor, execute `supabase/schema.sql`.
3. Copie a Project URL e a chave publicável/anon.
4. Preencha as constantes `SUPABASE_URL` e `SUPABASE_ANON_KEY` no início de `js/supabase.js`.
5. Configure autenticação do administrador e políticas RLS antes de permitir dados reais.

**Segurança:** nunca coloque a chave `service_role` ou qualquer chave secreta no frontend. O SQL inicial ativa RLS sem políticas permissivas intencionalmente; por isso, a API online não funcionará até configurarmos as permissões corretas. Não publique dados reais antes disso.

## Ícones PWA
Adicione `img/icon-192.png` e `img/icon-512.png` (ícones quadrados PNG). A logo pode ser guardada como `img/logo.png`. O arquivo `manifest.json` já aponta para esses ícones.
