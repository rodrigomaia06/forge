# Forge Dark: More no canto superior esquerdo

Exploração anterior criada com Google Stitch, fora do pedido corrigido. Não deve orientar a implementação: o pedido é apenas trocar o título da página Settings por More, mantendo a navegação, e explorar o aspeto do popup dos três pontos em `../exercise-menu-options/`.

## Direção

- Manter Manrope, as superfícies escuras e as ações monocromáticas do Forge.
- Explorar uma composição diferente para o Dashboard com os mesmos conteúdos: início de treino, semana e último treino.
- Substituir a tab Settings por um botão More no canto superior esquerdo.
- Manter Home, History e Plans na dock inferior.
- Mostrar os destinos atuais de Settings numa sheet More, sem acrescentar funcionalidades.
- ENERGY 1 / RHYTHM 2 / MOTION 1. Conceitos estáticos, com valores assinalados como Demo data.

[Abrir projeto Stitch](https://stitch.withgoogle.com/projects/7232219864531036686)

## Imagens

- [Dashboard escuro](dashboard.stitch.png): More no canto superior esquerdo, início de treino diretamente na página, semana e último treino em grupos separados, dock com três destinos.
- [More aberto, iPhone Air](more-sheet.iphone-air.png) e [Galaxy S24](more-sheet.samsung-galaxy-s24.png): destinos atuais de Settings numa sheet sobre o Dashboard.
- [Maqueta HTML da sheet](more-sheet.html), que usa Tailwind CDN e Google Fonts e precisa de ligação à rede.
- [Exportação original da sheet](more-sheet.stitch.png), preservada como recebida do Stitch numa tela larga.

## Critérios de revisão

- Preservar as funções existentes e a tipografia Manrope.
- Identificar More sem depender apenas de um ícone.
- Manter a ação de início como foco do Dashboard.
- Distinguir a sheet do Dashboard através da sobreposição e do contraste de superfícies.

Esta exploração altera a composição do Dashboard e a entrada de More; não propõe novas métricas ou funcionalidades.

O Stitch sugeriu explorar uma animação de fecho, abrir um dos destinos ou ajustar a densidade das linhas. Essas sugestões ficam fora desta proposta estática.

Os HTML exportados são maquetas para revisão; as imagens não são screenshots da aplicação React Native. A proposta de navegação depende da revisão do utilizador antes de qualquer implementação.
