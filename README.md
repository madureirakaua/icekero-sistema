# Ice Kero — Site + Sistema de Pedidos

Proposta de site e sistema de pedidos próprio para a **Ice Kero Açaí & Sorvetes** (Floramar, Belo Horizonte/MG).

## O que tem

**Unidades**

| Loja | Endereço | Telefone | Horário* |
|---|---|---|---|
| Floramar | Av. José Lopes Muradas, 277 | (31) 3272-6248 | 10h–22h |
| Tupi | R. Emílio Cardoso Aíres, 274 | (31) 3272-6248 | 11h–22h |
| Santa Efigênia | Av. Mem de Sá, 271 | (31) 99503-8825 | 6h30–22h |

\* Dados do Google Maps em 09/11/2026. O fechamento de Floramar e Santa Efigênia precisa ser confirmado com a loja. Lojas, horários, coordenadas e taxas ficam na tabela `stores` do Supabase.

**Loja mais próxima, automática**
- No checkout o cliente digita o **CEP** (o endereço é preenchido pelo ViaCEP) ou toca em **"Usar minha localização"**
- O site encontra as coordenadas do endereço (OpenStreetMap/Nominatim) e escolhe a **unidade aberta mais próxima** que entrega naquele endereço
- Taxa pela distância: R$ 5 até 3 km, + R$ 1 por km a mais, raio máximo de 8 km (ajustável por loja)
- Se a loja mais perto estiver fechada, o pedido vai para a próxima aberta. Se nenhuma atende, o site oferece a retirada
- Na retirada o cliente escolhe a unidade, ordenadas pela distância
- O servidor confere loja, horário, distância e taxa: o navegador não consegue escolher uma loja fora da área nem mudar a taxa
- O endereço com as coordenadas fica salvo na conta, então no próximo pedido a loja já aparece direto
- Seção **Nossas lojas** com as 3 unidades, status aberta/fechada ao vivo, mapa e botão "Qual loja fica mais perto de mim?"

**Site do cliente (`index.html`)**
- Página da marca com as cores e a identidade da Ice Kero
- **Monte seu açaí** interativo: tamanho, adicionais e um copo que vai sendo montado na tela
- **Cardápio digital** com os itens reais, busca e categorias
- **Conta do cliente** (e-mail e senha): o cliente navega livremente, mas precisa entrar para finalizar o pedido. Nome, celular e endereço ficam salvos para os próximos pedidos
- **Sacola e checkout**: entrega ou retirada, Pix, cartão ou dinheiro (com troco)
- **Clube de fidelidade** ligado à conta (a cada R$20 = 1 ponto; 10 pontos = R$5 de desconto)
- **Acompanhamento do pedido** em tempo real
- Aberto/fechado automático pelo horário (ou controlado pelo painel), endereço, mapa e redes sociais
- Pensado primeiro para o celular

**Meus pedidos (`pedidos.html`)**
- Só com login. Pedidos em andamento ao vivo, com barra de etapas e aviso quando o status muda
- Histórico com entregues, recusados e cancelados (com o motivo), e botão "Pedir de novo"
- **Meus dados**: editar nome e celular, ver o endereço salvo, trocar senha, sair
- Saldo de pontos do Clube Ice Kero

**Painel da loja (`painel.html`)**
- Login com conta de funcionário (validado no servidor)
- Funcionário de uma unidade vê e mexe só nos pedidos dela. O dono (sem loja definida) escolhe "Todas as lojas" ou uma unidade
- Abrir/fechar cada unidade separadamente
- Pedidos de qualquer celular chegam ao vivo, com aviso sonoro
- Quadro Kanban: Recebido → Em preparo → Entrega/Retirada → Concluído, com o pedido mais antigo no topo
- **Recusar** (pedido novo) ou **cancelar** (em andamento), sempre com motivo. O cliente é avisado na hora, os pontos usados voltam para ele e o pedido sai do faturamento
- Indicadores do dia: pedidos, faturamento, ticket médio e item mais vendido
- Abrir ou fechar a loja manualmente (o site atualiza na hora)

## Segurança

Os dados ficam no **Supabase** (projeto `icekero`, região São Paulo). O site é estático e fala direto com o banco; quem protege os dados são as regras do próprio banco (Row Level Security):

- Cada cliente só consegue ver o próprio perfil e os próprios pedidos.
- O cliente só pode alterar nome, celular e endereço. Pontos e permissão de funcionário só mudam pelo servidor.
- **Preços, taxa de entrega, desconto e pontos são calculados no servidor** (`place_order`). Mesmo que alguém altere o preço no navegador, o banco usa o preço oficial da tabela `products`.
- Só funcionários (`profiles.is_staff = true`) veem todos os pedidos, mudam status, cancelam e abrem/fecham a loja.
- Senhas são guardadas pelo Supabase Auth, nunca no site.
- A chave em `js/config.js` é a chave **pública** (anon), feita para ficar no site. Nunca coloque a chave `service_role` no código.

- O endereço digitado é enviado ao ViaCEP e ao OpenStreetMap só para achar as coordenadas. Para uso com muito movimento, troque o Nominatim por um serviço pago (Google Maps ou Mapbox) em `Geo.geocode` (`js/store.js`).

O SQL completo está em [`supabase/`](supabase/), na ordem `001_schema.sql`, `002_cardapio.sql` e `003_multiplas_lojas.sql`.

## Configuração no Supabase (uma vez)

1. **Confirmação de e-mail.** O Supabase exige que o cliente confirme o e-mail antes de entrar, mas o envio padrão de e-mails dele só funciona para os membros da sua equipe no Supabase e tem limite por hora.
   - Para a demonstração: *Authentication → Sign In / Providers → Email* → desligue **Confirm email**.
   - Para produção: configure um SMTP próprio (*Authentication → Emails → SMTP Settings*, por exemplo Resend ou Brevo) e ligue a confirmação de novo.
2. **Endereços do site.** Em *Authentication → URL Configuration*, coloque em **Site URL** o endereço publicado (ex.: `https://madureirakaua.github.io/icekero-sistema/`) e adicione em **Redirect URLs** esse endereço e `http://localhost:5173/**`. Sem isso, os links de confirmação e de "esqueci minha senha" não voltam para o site.
3. **Contas da equipe.** Crie a conta pelo próprio site (Entrar → Criar conta) e depois marque-a como equipe no *SQL Editor*. Use `store_id` para prender o funcionário a uma unidade (`'floramar'`, `'tupi'` ou `'santa-efigenia'`), ou `null` para o dono ver todas:
   ```sql
   update public.profiles set is_staff = true, store_id = 'tupi'
   where id = (select id from auth.users where email = 'email-da-loja@exemplo.com');
   ```

## Como rodar

É um site estático, sem build:

```bash
npx serve .
```

Também funciona publicado no GitHub Pages. Como os pedidos ficam no banco, dá para pedir pelo celular e ver o pedido chegar no painel aberto no notebook.

## Observações

- As fotos vêm do CDN atual da loja (Neemo). Antes de publicar de vez, baixe-as para `assets/`.
- Mudou um preço? Altere em `js/data.js` (o que aparece na tela) **e** na tabela `products` do Supabase (o que é cobrado).
- Confirmar com a loja: horário de fechamento de cada unidade (`fecha_min` em `stores`), taxa e raio de entrega de cada uma, e WhatsApp.
- O cardápio e os preços foram copiados da loja Neemo em 09/11/2026.
