# Ice Kero — Site + Sistema de Pedidos

Proposta de site e sistema de pedidos próprio para a **Ice Kero Açaí & Sorvetes** (Floramar, Belo Horizonte/MG).

## O que tem

**Site do cliente (`index.html`)**
- Página da marca com as cores e a identidade da Ice Kero
- **Monte seu açaí** interativo: tamanho, adicionais e um copo que vai sendo montado na tela
- **Cardápio digital** com mais de 80 itens reais, busca e categorias
- **Sacola e checkout**: entrega ou retirada, Pix, cartão ou dinheiro (com troco)
- **Clube de fidelidade** já embutido (a cada R$20 = 1 ponto; 10 pontos = R$5 de desconto), identificado pelo celular
- **Acompanhamento do pedido** em tempo real
- Aberto/fechado automático pelo horário, endereço, mapa e redes sociais
- Pensado primeiro para o celular

**Painel da loja (`painel.html`)**
- Pedidos chegam ao vivo, com aviso sonoro
- Quadro Kanban: Recebido → Em preparo → Entrega/Retirada → Concluído
- Indicadores do dia: pedidos, faturamento, ticket médio e item mais vendido
- Botão para abrir ou fechar a loja manualmente

## Por que um sistema próprio

| | iFood / marketplaces | Sistema próprio |
|---|---|---|
| Comissão por pedido | ~12% a 27% | **0%** |
| Dados do cliente | ficam com a plataforma | **ficam com a loja** |
| Fidelidade | não controla | **programa próprio** |
| Marca | uma loja entre centenas | **vitrine exclusiva** |

## Como rodar

É um site estático, sem build. Para uma demonstração local:

```bash
npx serve .
```

Abra o site e o `painel.html` em duas abas **do mesmo navegador**. Faça um pedido no site e ele aparece no painel na hora.

## Observações da demonstração

- Na demonstração, os pedidos ficam salvos no `localStorage` do navegador (`js/store.js`). Em produção, essa camada passa a usar um banco de dados (por exemplo, Supabase) para que o painel receba pedidos de qualquer celular.
- As fotos vêm do CDN atual da loja (Neemo). Antes de publicar, baixe-as para `assets/`.
- Confirmar com a loja: horário de fechamento (`fechaHora` em `js/data.js`), taxa de entrega por bairro e WhatsApp.
- O cardápio e os preços foram copiados da loja Neemo em 09/11/2026.
