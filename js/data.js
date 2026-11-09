// Dados da loja e cardápio — extraídos da loja Neemo da Ice Kero (Floramar) em 09/11/2026.
const CDN = "https://cdn.neemo.com.br/uploads/item/photo/";
const img = (id, file) => `${CDN}${id}/${file}`;

const LOJA = {
  nome: "Ice Kero",
  unidade: "Floramar",
  slogan: "O sabor da felicidade em cada colherada!",
  endereco: "Av. José Lopes Muradas, 277 — Floramar, Belo Horizonte/MG",
  cep: "31742-084",
  telefone: "(31) 3272-6248",
  telefoneLink: "tel:+553132726248",
  horario: "Abre todos os dias a partir das 11h",
  abreHora: 11,
  fechaHora: 22, // TODO: confirmar horário de fechamento com a loja
  instagram: "https://www.instagram.com/icekero.oficial/",
  facebook: "https://www.facebook.com/icekero.oficial/",
  ifood: "https://www.ifood.com.br/delivery/belo-horizonte-mg/ice-kero-acai---tupi-tupi-b/09308971-cb7f-47af-9dd5-7a3db739a0f3",
  mapa: "https://www.google.com/maps/search/?api=1&query=Av.+Jos%C3%A9+Lopes+Muradas,+277,+Floramar,+Belo+Horizonte",
  cnpj: "38.624.291/0001-61",
  razao: "ICE KERO AÇAÍ E LANCHONETE E SORVETERIA LTDA",
  taxaEntrega: 5.0,
  tempoEntrega: "20 – 45 min",
  logo: "https://cdn.neemo.com.br/uploads/settings_webdelivery/logo/16595/01logo.webp",
  // Fidelidade: a cada R$20 = 1 ponto; 10 pontos = R$5 de desconto
  fidelidade: { reaisPorPonto: 20, pontosParaResgate: 10, desconto: 5 },
};

const CATEGORIAS = [
  { id: "combos", nome: "Combos", emoji: "🎁" },
  { id: "acai", nome: "Açaí no copo", emoji: "🍇" },
  { id: "tacas", nome: "Taças 500ml", emoji: "🍨" },
  { id: "especiais", nome: "Sobremesas & Barcas", emoji: "🍫" },
  { id: "milk", nome: "Milk Shakes", emoji: "🥤" },
  { id: "vitamina", nome: "Vitaminas de Açaí", emoji: "🧃" },
  { id: "creme", nome: "Açaí para levar", emoji: "🧊" },
  { id: "potes", nome: "Sorvetes de Pote", emoji: "🍦" },
  { id: "paletas", nome: "Paletas Mexicanas", emoji: "🍡" },
  { id: "picoles", nome: "Picolés", emoji: "🍭" },
  { id: "bombons", nome: "Bombons de Sorvete", emoji: "🍬" },
  { id: "adicionais", nome: "Adicionais", emoji: "✨" },
];

// monte: true => abre o montador de açaí com N adicionais
const PRODUTOS = [
  // Combos
  { id: "combo-pote", cat: "combos", nome: "Combo Pote de Sorvete", desc: "Pote de 1 litro (sorvete ou açaí) + mini cobertura + pacote de casquinhas.", preco: 45.9, img: img(2563556, "photo1744824878.jpeg.webp"), tag: "Promo" },
  { id: "combo-milk", cat: "combos", nome: "Combo Milk-Shake", desc: "Dois milk shakes em promoção — escolha o sabor e a cobertura de cada um.", preco: 25.0, img: img(2548896, "photo1731766714.jpeg.webp"), tag: "Promo" },
  { id: "combo-milk-feliz", cat: "combos", nome: "Combinado Milk Shake Feliz", desc: "Combinado especial de milk shake da casa.", preco: 20.9 },
  { id: "combinado-especial", cat: "combos", nome: "Combinado Ice Kero + Especial", desc: "Vitamina de açaí super concentrada + leite condensado, leite em pó, chantilly e canudo biju.", preco: 17.9, img: img(2394436, "photo1749137196.jpeg.webp"), tag: "Mais pedido" },

  // Açaí montado
  { id: "acai-300", cat: "acai", nome: "Açaí Gourmet 300ml", desc: "Monte do seu jeito: 3 adicionais à sua escolha montados no copo.", preco: 17.9, img: img(2314734, "photo1711591598.jpeg.webp"), monte: 3 },
  { id: "acai-500", cat: "acai", nome: "Açaí Gourmet 500ml", desc: "Monte do seu jeito: 4 adicionais à sua escolha montados no copo.", preco: 23.9, img: img(2314727, "photo1711591773.jpeg.webp"), monte: 4, tag: "Mais pedido" },
  { id: "acai-700", cat: "acai", nome: "Açaí Gourmet 700ml", desc: "Monte do seu jeito: 5 adicionais à sua escolha montados no copo.", preco: 24.9, img: img(2314733, "photo1711591715.jpeg.webp"), monte: 5 },

  // Taças
  { id: "taca-icekero", cat: "tacas", nome: "Taça IceKero", desc: "Creme de açaí, creme de avelã, amendoim granulado, leite em pó, leite condensado e canudo biju.", preco: 24.9, img: img(2314674, "photo1711593344.jpeg.webp"), tag: "Da casa" },
  { id: "taca-oreo", cat: "tacas", nome: "Taça Oreo", desc: "Taça de 500ml com Oreo.", preco: 24.9, img: img(2314673, "photo1711592974.jpeg.webp") },
  { id: "taca-kitkat", cat: "tacas", nome: "Taça KitKat", desc: "Taça de 500ml com KitKat.", preco: 26.9, img: img(2314672, "photo1711635706.jpeg.webp") },
  { id: "taca-kids", cat: "tacas", nome: "Taça Kids", desc: "A taça colorida da criançada — 500ml.", preco: 26.8, img: img(2314671, "photo1711635424.jpeg.webp") },
  { id: "taca-ovomaltine", cat: "tacas", nome: "Taça Ovomaltine", desc: "Taça de 500ml com muito Ovomaltine.", preco: 28.9, img: img(2314667, "photo1711593015.jpeg.webp") },

  // Sobremesas & barcas
  { id: "roleta", cat: "especiais", nome: "Roleta de Açaí", desc: "6 opções de recheio à sua escolha. Pra dividir (ou não).", preco: 44.9, img: img(2314675, "photo1711592931.jpeg.webp"), monte: 6 },
  { id: "barca", cat: "especiais", nome: "Barca de Açaí Média", desc: "6 opções de acompanhamentos à sua escolha.", preco: 39.9, img: img(2314680, "photo1711592822.jpeg.webp"), monte: 6 },
  { id: "chocobrownie", cat: "especiais", nome: "Chocobrownie de Inverno", desc: "Brownie, calda de chocolate, 1 bola de sorvete e 1 fruta à escolha.", preco: 24.9, img: img(2421352, "photo1718554626.jpeg.webp") },
  { id: "petit-2", cat: "especiais", nome: "Petit Gâteau c/ 2 bolas", desc: "Petit gâteau, 2 bolas de sorvete, cobertura à escolha e chantilly grátis.", preco: 24.9, img: img(2314682, "photo1711592669.jpeg.webp") },
  { id: "petit-1", cat: "especiais", nome: "Petit Gâteau c/ 1 bola", desc: "Petit gâteau, 1 bola de sorvete, cobertura à escolha e chantilly grátis.", preco: 19.9, img: img(2314681, "photo1711592418.jpeg.webp") },
  { id: "brownie-2", cat: "especiais", nome: "Brownie c/ 2 bolas", desc: "Brownie, 2 bolas de sorvete, cobertura à escolha e chantilly grátis.", preco: 23.9, img: img(2314685, "photo1711592198.jpeg.webp") },
  { id: "brownie-1", cat: "especiais", nome: "Brownie c/ 1 bola", desc: "Brownie, 1 bola de sorvete, cobertura à escolha e chantilly grátis.", preco: 18.9, img: img(2314684, "photo1711592061.jpeg.webp") },
  { id: "banana-split", cat: "especiais", nome: "Banana Split", desc: "3 bolas de sorvete, amendoim granulado, cobertura, chantilly e cereja.", preco: 21.9, img: img(2314683, "photo1711638239.jpeg.webp") },

  // Milk shakes
  { id: "milk-300", cat: "milk", nome: "Milk Shake 300ml", desc: "Escolha o sabor. Coberturas: morango, chocolate ou caramelo.", preco: 10.9, img: img(2314725, "photo1711588979.jpeg.webp") },
  { id: "milk-500", cat: "milk", nome: "Milk Shake 500ml", desc: "Escolha o sabor. Coberturas: morango, chocolate ou caramelo.", preco: 14.9, img: img(2314715, "photo1711588783.jpeg.webp") },
  { id: "milk-700", cat: "milk", nome: "Milk Shake 700ml", desc: "Escolha o sabor. Coberturas: morango, chocolate ou caramelo.", preco: 19.9, img: img(2314724, "photo1711588600.jpeg.webp") },
  { id: "milk-1l", cat: "milk", nome: "Milk Shake 1 litro", desc: "Pra quem não brinca em serviço.", preco: 24.9 },

  // Vitaminas
  { id: "vit-300", cat: "vitamina", nome: "Vitamina de Açaí 300ml", desc: "Com leite, água ou laranja. Energia e sabor.", preco: 8.9, img: img(2315152, "photo1711586107.jpeg.webp") },
  { id: "vit-500", cat: "vitamina", nome: "Vitamina de Açaí 500ml", desc: "Com leite, água ou laranja.", preco: 11.9, img: img(2315153, "photo1711585468.jpeg.webp") },
  { id: "vit-700", cat: "vitamina", nome: "Vitamina de Açaí 700ml", desc: "Com leite, água ou laranja.", preco: 15.9, img: img(2315154, "photo1711585879.jpeg.webp") },
  { id: "vit-1l", cat: "vitamina", nome: "Vitamina de Açaí 1 litro", desc: "Com leite, água ou laranja.", preco: 19.9, img: img(2315155, "photo1716226597.jpeg.webp") },

  // Creme de açaí para levar
  { id: "creme-500", cat: "creme", nome: "Creme de Açaí 500ml", desc: "Chega congelado — espere uns minutinhos e aproveite.", preco: 16.9, img: img(2314706, "photo1711589324.jpeg.webp") },
  { id: "creme-700", cat: "creme", nome: "Creme de Açaí 700ml", desc: "Acompanha 2 acréscimos grátis (banana, granola…).", preco: 20.9, img: img(2314707, "photo1711586252.jpeg.webp") },
  { id: "creme-1l", cat: "creme", nome: "Creme de Açaí 1 litro", desc: "Acompanha 2 acréscimos grátis (banana, granola…).", preco: 27.9, img: img(2314708, "photo1711586192.jpeg.webp") },
  { id: "creme-ninho", cat: "creme", nome: "Açaí c/ Ninho 1 litro", desc: "Metade açaí, metade creme de Ninho.", preco: 29.9, img: img(2314710, "item-photo-creme-de-acai-c-ninho-1-litro.webp") },
  { id: "creme-morango", cat: "creme", nome: "Açaí c/ Morango 1 litro", desc: "Metade açaí, metade creme de morango.", preco: 29.9, img: img(2314711, "item-photo-creme-de-acai-c-morango-1-litro.webp") },
  { id: "creme-cupuacu", cat: "creme", nome: "Açaí c/ Cupuaçu 1 litro", desc: "Metade açaí, metade creme de cupuaçu.", preco: 29.9, img: img(2314712, "item-photo-creme-de-acai-c-cupuacu-1-litro.webp") },
  { id: "creme-5l", cat: "creme", nome: "Açaí Creme — Caixa 5 litros", desc: "Pra festa, pra família, pro freezer.", preco: 95.9, img: img(2314713, "item-photo-acai-creme-caixa-5-litros.webp") },

  // Potes
  { id: "pote-kinder", cat: "potes", nome: "Kinder Ovo 1 litro", desc: "Sorvete de chocolate branco recheado com creme de Ninho e chocolate trufado.", preco: 29.9, img: img(2557877, "photo1733001858.jpeg.webp"), tag: "Novo" },
  { id: "pote-grego-morango", cat: "potes", nome: "Iogurte Grego c/ Morango 1 litro", desc: "Sorvete de iogurte grego com recheio de polpa de morango.", preco: 29.9, img: img(2557904, "photo1733002972.jpeg.webp") },
  { id: "pote-grego-maracuja", cat: "potes", nome: "Iogurte Grego c/ Maracujá 1 litro", desc: "Sorvete de iogurte grego com recheio de polpa de maracujá.", preco: 29.9, img: img(2557896, "photo1733002649.jpeg.webp") },
  { id: "pote-milk-trufado", cat: "potes", nome: "Premium 1,5L — Ninho Trufado", desc: "Sorvete premium de Ninho com chocolate trufado.", preco: 32.9, img: img(2315138, "photo1711590281.jpeg.webp") },
  { id: "pote-flocos", cat: "potes", nome: "Premium 1,5L — Flocos", desc: "O clássico flocos em versão premium.", preco: 32.9, img: img(2315133, "photo1711590937.jpeg.webp") },

  // Paletas
  { id: "paleta-ninho", cat: "paletas", nome: "Paleta Ninho Trufado", desc: "Sabor leitinho com recheio de chocolate trufado. 123g.", preco: 12.9, img: img(2314808, "item-photo-paleta-mexicana-de-ninho-trufado-123g.webp") },
  { id: "paleta-morango", cat: "paletas", nome: "Paleta Morango c/ Leite Condensado", desc: "Morango natural com recheio de leite condensado. 123g.", preco: 12.9, img: img(2314807, "item-photo-paleta-mexicana-de-morango-c-leite-condensado-123g.webp") },
  { id: "paleta-kitkat", cat: "paletas", nome: "Paleta Kit Kat", desc: "Baunilha com recheio de Kit Kat original. 123g.", preco: 12.9, img: img(2314805, "item-photo-paleta-mexicana-de-kit-kat-123g.webp") },
  { id: "paleta-belga", cat: "paletas", nome: "Paleta Chocolate Belga", desc: "Chocolate belga intenso. 123g.", preco: 12.9 },
  { id: "paleta-pacoca", cat: "paletas", nome: "Paleta Paçoca c/ Leite Condensado", desc: "Paçoca com recheio de leite condensado. 123g.", preco: 12.9 },

  // Picolés
  { id: "pic-bombom-amor", cat: "picoles", nome: "Picolé Bombom do Amor", desc: "Picolé especial recheado.", preco: 12.9, img: img(2672914, "photo1749737285.jpeg.webp") },
  { id: "pic-mega-brownie", cat: "picoles", nome: "Mega Picolé Brownie c/ Doce de Leite", desc: "Picolé gigante de brownie com doce de leite.", preco: 12.9, img: img(2671722, "photo1749611198.jpeg.webp") },
  { id: "pic-mega-pistache", cat: "picoles", nome: "Mega Picolé Pistache", desc: "Picolé gigante sabor pistache.", preco: 12.9 },
  { id: "pic-dino", cat: "picoles", nome: "Picolé Dino", desc: "O preferido da criançada.", preco: 10.9, img: img(2672906, "photo1749737058.jpeg.webp") },
  { id: "pic-crokito", cat: "picoles", nome: "Picolé Crokito", desc: "Crocante por fora, cremoso por dentro.", preco: 9.9, img: img(2672915, "photo1749737527.jpeg.webp") },
  { id: "pic-skimo-caixa", cat: "picoles", nome: "Caixa Skimo — Pague 10 Leve 12", desc: "12 picolés com cobertura de chocolate.", preco: 50.0, tag: "Promo" },
  { id: "pic-trad-caixa", cat: "picoles", nome: "Caixa Tradicionais — Pague 10 Leve 12", desc: "Mais de 20 sabores de picolés tradicionais e ao leite.", preco: 30.0, img: img(2505977, "photo1726867154.jpeg.webp"), tag: "Promo" },
  { id: "pic-brigadeiro", cat: "picoles", nome: "Skimo Brigadeiro", desc: "Brigadeiro com cobertura meio amargo e granulado.", preco: 5.0, img: img(2315101, "photo1711634715.jpeg.webp") },
  { id: "pic-ovomaltine", cat: "picoles", nome: "Skimo Ovomaltine", desc: "Cobertura de chocolate com Ovomaltine.", preco: 5.0, img: img(2315102, "photo1711634399.jpeg.webp") },
  { id: "pic-morango-choc", cat: "picoles", nome: "Skimo Morango c/ Chocolate", desc: "Morango ao leite com cobertura meio amargo.", preco: 5.0, img: img(2315104, "photo1711634609.jpeg.webp") },
  { id: "pic-coco-choc", cat: "picoles", nome: "Skimo Coco c/ Chocolate", desc: "Coco ao leite com cobertura meio amargo.", preco: 5.0, img: img(2315103, "photo1711634516.jpeg.webp") },
  { id: "pic-pacoca", cat: "picoles", nome: "Picolé Paçoca", desc: "Ao leite.", preco: 3.0, img: img(2315156, "photo1711634863.jpeg.webp") },
  { id: "pic-flocos", cat: "picoles", nome: "Picolé Flocos", desc: "Baunilha com flocos de chocolate meio amargo.", preco: 3.0, img: img(2315114, "photo1711632705.jpeg.webp") },
  { id: "pic-coco", cat: "picoles", nome: "Picolé Coco", desc: "Ao leite com coco ralado.", preco: 3.0, img: img(2315113, "photo1711632564.jpeg.webp") },
  { id: "pic-jabuticaba", cat: "picoles", nome: "Picolé Jabuticaba", desc: "Ao leite. Bem mineiro.", preco: 3.0, img: img(2315116, "photo1711632436.jpeg.webp") },
  { id: "pic-maracuja", cat: "picoles", nome: "Picolé Mousse de Maracujá", desc: "Ao leite.", preco: 3.0, img: img(2315124, "photo1711630724.jpeg.webp") },
  { id: "pic-blue", cat: "picoles", nome: "Picolé Blue Ice", desc: "Ao leite.", preco: 3.0, img: img(2315109, "photo1711633911.jpeg.webp") },
  { id: "pic-uva", cat: "picoles", nome: "Picolé Uva Refrescante", desc: "À base de água. Zero lactose, zero glúten.", preco: 3.0, img: img(2315125, "photo1711632820.jpeg.webp") },
  { id: "pic-limao", cat: "picoles", nome: "Picolé Limão Refrescante", desc: "À base de água. Zero lactose, zero glúten.", preco: 3.0, img: img(2315119, "photo1711631702.jpeg.webp") },
  { id: "pic-acai", cat: "picoles", nome: "Picolé Açaí", desc: "Zero lactose.", preco: 3.0, img: img(2315107, "photo1711634083.jpeg.webp") },

  // Bombons
  { id: "bombom-choc", cat: "bombons", nome: "Bombom de Sorvete — Chocolate", desc: "Caixa com 12. Sorvete de chocolate com cobertura meio amargo.", preco: 10.9, img: img(2314666, "photo1711635087.jpeg.webp") },
  { id: "bombom-morango", cat: "bombons", nome: "Bombom de Sorvete — Morango", desc: "Caixa com 12. Morango com cobertura meio amargo.", preco: 10.9, img: img(2314665, "photo1711635227.jpeg.webp") },
  { id: "bombom-acai", cat: "bombons", nome: "Bombom de Sorvete — Açaí", desc: "Caixa com 12. Creme de açaí com cobertura de chocolate branco.", preco: 10.9, img: img(2314664, "photo1711635148.jpeg.webp") },
  { id: "bombom-ddl", cat: "bombons", nome: "Bombom de Sorvete — Doce de Leite", desc: "Caixa com 12. Doce de leite com cobertura meio amargo.", preco: 10.9, img: img(2314660, "photo1711635027.jpeg.webp") },

  // Adicionais
  { id: "add-oreo", cat: "adicionais", nome: "Oreo", desc: "4 biscoitos.", preco: 4.5, img: img(2314657, "photo1711637911.jpeg.webp") },
  { id: "add-ovomaltine", cat: "adicionais", nome: "Ovomaltine", desc: "Pote de 75ml.", preco: 4.0, img: img(2314658, "photo1711637341.jpeg.webp") },
  { id: "add-morango", cat: "adicionais", nome: "Morango (fruta)", desc: "Pote de 100ml.", preco: 4.0, img: img(2314656, "photo1711636921.jpeg.webp") },
  { id: "add-pacoca", cat: "adicionais", nome: "Paçoca", desc: "Pote de 75ml.", preco: 3.0, img: img(2314659, "photo1711636470.jpeg.webp") },
];

// Opções do "Monte seu açaí"
const ADICIONAIS_MONTE = [
  "Leite condensado", "Leite em pó", "Granola", "Banana", "Morango", "Paçoca",
  "Amendoim granulado", "Creme de avelã", "Ovomaltine", "Oreo", "Chantilly",
  "Canudo biju", "Confete", "Creme de Ninho", "Kiwi", "Mel",
];
