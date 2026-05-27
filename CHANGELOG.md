# Changelog

Todas as mudanças relevantes deste projeto estão documentadas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [3.9.1] — 2026-05-27

### Adicionado
- **ColorManager — Sistema Adaptativo de Cores WCAG** — Novo módulo JavaScript
  que resolve automaticamente problemas de UI quando o tema usa cores claras,
  pastéis, brancas ou com baixo contraste como suas cores globais.

  **Algoritmo:**
  1. Lê cada variável CSS (`--acc-color-*`) via "probe element" — cria um `<div>`
     invisível com `color: var(--acc-color-X)`, lê `getComputedStyle().color`.
     O browser resolve toda a cadeia `var()` (Elementor → theme.json → fallback)
     e retorna o `rgb()` final. Suporta qualquer profundidade de encadeamento.
  2. Calcula luminância relativa WCAG 2.1 (linearização IEC 61966-2-1 sRGB)
     para cada cor resolvida.
  3. Detecta o "polo" do tema:
     - `luminância < 0.18` → dark mode (fundo escuro)
     - `luminância ≥ 0.75` → light mode (fundo claro)
     - `0.18–0.75` → "zona cinza" → força para near-white (L=97%) preservando matiz
  4. Valida e ajusta cada par de contraste:
     - `--acc-color-contrast` vs `--acc-color-base` → 7:1 (WCAG AAA)
     - `--acc-color-muted`    vs `--acc-color-base`    → 4.5:1 (AA)
     - `--acc-color-muted`    vs `--acc-color-surface`  → 4.5:1 (AA)
     - `--acc-color-border`   vs `--acc-color-surface`  → 3:1 (UI component)
     - `--acc-color-secondary` vs `--acc-color-base`   → 3:1 (UI component)
     - texto (base) vs `--acc-color-secondary` (btn-reset bg) → 4.5:1 (AA)
  5. Geração de shades: percorre L em passos de 1.5% (escurecendo ou clareando),
     preservando matiz e saturação da cor original. Último recurso: `#000` / `#fff`.
  6. Injeta `<style id="acc-color-patch">` no `<head>` com variáveis corrigidas.
     Por vir APÓS os stylesheets enfileirados (document order), vence na cascata
     sem precisar de `!important`.
  7. Executado em `$(document).ready()` e novamente em `$(window).on('load')`
     para capturar variáveis CSS atualizadas por JavaScript pós-load (Elementor Pro,
     theme builders com dark mode dinâmico).

  **Casos cobertos:** branco puro, cinza claro/médio, pastel, neon, gradiente de fundo,
  dark mode, Elementor light/dark, themes minimalistas com paleta monocromática.

- **Separação visual de cards via `box-shadow`** — `.btn-acessibilidade`, `.toggle-row`
  e `.fonte-stepper` recebem uma sombra sutil `rgba(0,0,0,0.06)` que garante
  diferenciação visual mesmo quando `surface` e `base` são quase idênticos.

- **`--acc-color-accent` nos dots de nível** — `nivel-dot.ativo` usa agora
  `--acc-color-accent` (validado pelo ColorManager com contraste ≥ 3:1) em vez de
  `--acc-color-contrast`, criando diferenciação visual mais clara no stepper de fonte.

### Corrigido
- **Lógica de secondary em dark mode** — o ColorManager verificava o btn-reset
  contra `#ffffff` hardcoded em vez de contra `--acc-color-base` (a cor de texto real).
  Em dark mode, isso escurecia incorretamente o secondary. Corrigido para usar
  `contrast(safeBase, safeSecondary) >= 4.5:1`, que funciona para ambos os modos.

---

## [3.9.0] — 2026-05-27

### Corrigido (Bug Fix crítico)
- **Filtros visuais não afetavam o site inteiro** — grayscale, sépia, inversão de cor e
  simulação de daltonismo eram aplicados no `<body>`, fazendo com que elementos com
  `position:fixed` (sticky headers, navbars, modais e popups do Elementor) "escapassem"
  do filtro. O filtro passou a ser aplicado em `<html>` (documentElement), onde
  `position:fixed` posiciona corretamente e todo o conteúdo é coberto.
- **Simulação de daltonismo não funcionava** — os filtros SVG de protanopia, deuteranopia
  e tritanopia eram referenciados por `url(#acc-protan)` mas os elementos `<filter id="...">` 
  nunca eram injetados no DOM. Adicionado `_injectSvgFilters()` chamado na inicialização.
- **Alto contraste não sobrescrevia Elementor** — o Elementor e temas modernos definem
  `background-color` e `color` em inline styles com `!important`. CSS externo com
  `!important` não consegue superar um inline `!important` de mesma especificidade quando
  declarado depois. Solução: `_applyContrasteAltoJS()` usa `el.style.setProperty(..., 'important')`
  diretamente no objeto de inline style do elemento, substituindo o valor Elementor.
- **Conteúdo dinâmico não coberto pelo alto contraste** — popups, modais e seções
  carregadas assincronamente (Elementor lazy-load, AJAX) não recebiam o alto contraste JS.

### Adicionado
- **`_injectSvgFilters()`** — Injeta `<svg id="acc-svg-filters">` com três filtros
  `feColorMatrix` (`color-interpolation-filters="linearRGB"`) no início do `<body>`:
  `#acc-protan` (protanopia), `#acc-deuter` (deuteranopia), `#acc-tritan` (tritanopia).
- **`_applyContrasteAltoJS()`** — Override JS de alto contraste para elementos com inline
  styles: seleciona `body [style]`, preserva originais em `data-acc-orig-*` e aplica
  `background-color: #000`, `color: #fff`, `background-image: none` via `setProperty(..., 'important')`.
- **`_restoreContrasteAltoJS()`** — Reverte overrides JS, restaurando inline styles
  originais de cada elemento e removendo os atributos `data-acc-orig-*`.
- **`_initMutationObserver()`** — MutationObserver em `document.body` (childList + subtree)
  com debounce de 250ms que re-aplica `_applyContrasteAltoJS()` quando novos nós são
  adicionados ao DOM e o alto contraste está ativo.
- **Re-aplicação no `window.load`** — além da escala de fonte, re-aplica `_applyContrasteAltoJS()`
  em `window.load` para cobrir widgets Elementor renderizados assincronamente.
- **Pseudo-elementos em alto contraste** — regra CSS para `::before` e `::after` de
  elementos não-barra garante que decorações de tema/Elementor também sejam cobertas.
- **Vídeos em alto contraste** — regra CSS `filter: contrast(1.5) grayscale(1)` para `<video>`.
- **Foco visível em alto contraste** — `outline: 3px solid #ffff00` em `:focus-visible`
  garante conformidade WCAG 2.1 AA mesmo no modo de alto contraste.
- **`background` shorthand em alto contraste** — regra CSS inclui `background: #000 !important`
  além de `background-color`, cobrindo casos onde o tema usa a propriedade shorthand.

### Alterado
- Seletor CSS de alto contraste: `body.contraste-alto` → `html body.contraste-alto`
  para maior especificidade CSS, superando regras de tema.
- Bloco de isolamento da barra em alto contraste: `body.contraste-alto #barra-acessibilidade`
  → `html body.contraste-alto #barra-acessibilidade` (mesma lógica de especificidade);
  adicionados `::before`/`::after` e propriedade `background` ao reset.
- Todos os seletores de restauração de cores da barra atualizados para `html body.contraste-alto`.
- Comentário do contraste-invertido atualizado para documentar a estratégia `html` filter.

---

## [3.8.0] — 2026-05-27

### Corrigido (Bug Fix crítico)
- **Escalamento de fonte não afetava textos do site** — O mecanismo anterior alterava
  apenas `font-size` no elemento `<html>`, o que só escalava elementos com unidades
  relativas (`rem`/`em`). O Elementor e a maioria dos temas WordPress definem
  `font-size` em `px` fixo (inclusive via inline styles), tornando a escala inoperante
  para textos comuns, headings, parágrafos, menus e widgets Elementor.

### Adicionado
- **`_scaleFonts(scale)`** — Novo método JavaScript que aplica escalamento diretamente
  nos elementos de texto via `el.style.setProperty('font-size', value, 'important')`,
  superando qualquer `!important` ou inline style externo.
- **`_shouldSkipEl(el)`** — Filtro que exclui da escala: barra de acessibilidade,
  VLibras, elementos SVG, ícones de fonte (Font Awesome, Dashicons, Material Icons, etc.).
- **`ACC_TEXT_SEL`** — Seletor abrangente cobrindo: `h1–h6`, `p`, `li`, `td`, `th`,
  `a`, `button`, `label`, `.elementor-heading-title`, `.elementor-button-text`,
  `.elementor-nav-menu a`, `.wp-block-paragraph`, `.menu-item>a`, `.widget-title`
  e dezenas de outros seletores Elementor e WordPress Blocks.
- **`window.load` re-aplicação** — Garante cobertura de widgets Elementor renderizados
  assincronamente após `document.ready`.
- **`data-acc-orig-fs`** — Atributo HTML que preserva o `font-size` original
  (em px) antes da primeira escala, garantindo idempotência em trocas de nível.
- **Sistema de Auto-Update via GitHub Releases** — Classe `AcessibilidadeCompleta_GitHub_Updater`
  integrada à WordPress Update API para detecção e instalação automática de novas versões.
- **Estrutura modular** — Plugin refatorado em `class-plugin.php` e
  `class-github-updater.php` dentro de `includes/`.
- **Internacionalização** — Todas as strings do PHP passaram a usar funções i18n
  (`esc_html_e`, `esc_attr_e`).

### Alterado
- Regras CSS `html.acc-font-*` removidas (duplo-escalamento com ícones eliminado).
- Bloco CSS `html[class*="acc-font-"] #barra-acessibilidade` removido (não mais necessário).
- Arquivo principal refatorado para loader limpo + constantes + bootstrap via `plugins_loaded`.
- Versão de todos os assets (`wp_enqueue_*`) atualizada para `3.8.0`.

---

## [3.7.0] — 2026-05-XX

### Adicionado
- Painel de acessibilidade completo com: tipografia granular, visão & cores,
  daltonismo, navegação avançada.
- VLibras integrado com polling de inicialização (10s, 20 tentativas).
- Stepper de fonte com 5 níveis (−10%, Normal, +10%, +25%, +50%).
- Fonte OpenDyslexic para suporte a dislexia.
- Simulação de Protanopia, Deuteranopia e Tritanopia via filtros SVG.
- Contraste alto, contraste invertido (CSS filter composição).
- Saturação: normal, cinza (grayscale), sépia.
- Cursor grande via CSS SVG cursor.
- Lupa de navegação (bubble com texto ampliado ao hover).
- Máscara de leitura com banda configurável.
- Guia de leitura que segue o cursor.
- Destaque de links com indicador de link externo.
- Persistência de preferências via `localStorage`.
- Migração de preferências legadas (v1/v2).
- Isolamento total da barra de acessibilidade dos modos aplicados ao site.
- Conformidade WCAG 2.1 AA: `aria-*`, `role`, foco visível, redução de movimento.

---

## Versões anteriores

O histórico de versões anteriores a 3.7.0 não está disponível neste repositório.

[3.8.0]: https://github.com/MiguelFerreira31/acessibilidade-completa/releases/tag/v3.8.0
[3.7.0]: https://github.com/MiguelFerreira31/acessibilidade-completa/releases/tag/v3.7.0
