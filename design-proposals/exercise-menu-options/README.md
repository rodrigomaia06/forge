# Popup de opções do exercício

Três alternativas visuais para o popup aberto pelos três pontos, mantendo o estilo escuro, os elementos e as ações do Forge. São propostas estáticas do Stitch, não alterações adotadas na aplicação.

| Opção | Tratamento | iPhone Air | Galaxy S24 | HTML |
| --- | --- | --- | --- | --- |
| A | Lista contínua, ícones sem caixa e separadores discretos | [Imagem](a-quiet-list.iphone-air.png) | [Imagem](a-quiet-list.samsung-galaxy-s24.png) | [Abrir](a-quiet-list.html) |
| B | Lista contínua com pequenos fundos tonais nos ícones | [Imagem](b-tonal-icons.iphone-air.png) | [Imagem](b-tonal-icons.samsung-galaxy-s24.png) | [Abrir](b-tonal-icons.html) |
| C | Dois grupos compactos, mantendo a sequência de ações | [Imagem](c-compact-groups.iphone-air.png) | [Imagem](c-compact-groups.samsung-galaxy-s24.png) | [Abrir](c-compact-groups.html) |

Recomendação visual: C. O intervalo entre os dois grupos distingue consulta/configuração de alterações ao exercício sem acrescentar títulos. A é a alternativa mais simples.

Os ficheiros `.stitch.png` são os originais exportados pelo Stitch. As imagens dos dois perfis foram renderizadas a partir dos HTML e inspecionadas sem overflow horizontal. São referências de aparência, sem validação de interações nativas. O fundo é ilustrativo; a navegação e os ícones finais devem usar os componentes existentes do Forge. Os HTML usam Tailwind CDN e Google Fonts e precisam de ligação à Internet.

Todas preservam Tracking, Add note, Previous sessions, Warm-up sets, Exercise info, Replace exercise e Mark off-session. A ação de remover permanece no botão destrutivo do cabeçalho.

[Projeto Stitch](https://stitch.withgoogle.com/projects/7052184188603807829)

A proposta anterior `forge-dark-more` não corresponde ao pedido corrigido: não serve de referência para mudar a navegação. Na aplicação, apenas o título da página Settings passa a More, mantendo a localização e a navegação existentes.
