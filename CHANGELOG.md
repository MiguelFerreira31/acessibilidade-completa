# Changelog

Todas as mudanças relevantes deste projeto estão documentadas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
