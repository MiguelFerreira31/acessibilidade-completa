# Acessibilidade Completa

> Plugin WordPress de acessibilidade WCAG 2.1 AA/AAA com suporte nativo ao Elementor e WooCommerce.

[![Versão](https://img.shields.io/badge/vers%C3%A3o-3.9.1-blue)](https://github.com/MiguelFerreira31/acessibilidade-completa/releases)
[![WordPress](https://img.shields.io/badge/WordPress-5.9%2B-21759b)](https://wordpress.org)
[![PHP](https://img.shields.io/badge/PHP-7.4%2B-8892be)](https://php.net)
[![Licença](https://img.shields.io/badge/licen%C3%A7a-GPL--2.0--or--later-green)](LICENSE)
[![WCAG](https://img.shields.io/badge/WCAG-2.1%20AA%2FAAA-success)](https://www.w3.org/WAI/WCAG21/quickref/)

---

## Visão Geral

O **Acessibilidade Completa** é um plugin WordPress que adiciona uma barra lateral flutuante com ferramentas de acessibilidade completas, projetado especificamente para funcionar com o **Elementor** e temas que definem estilos em `px` fixo.

Diferente de soluções genéricas que apenas alteram o `font-size` do elemento `<html>` (o que só funciona para unidades `rem`/`em`), este plugin usa `window.getComputedStyle` para capturar o tamanho real de cada elemento — independente de qual unidade CSS o tema usa — e um **cache incremental** para garantir que a escala seja rápida mesmo em páginas Elementor com centenas de elementos.

O **ColorManager** integrado detecta automaticamente se o tema usa cores claras, pastéis ou com baixo contraste e ajusta as variáveis CSS da barra para garantir conformidade **WCAG AAA** entre texto e fundo — sem necessidade de configuração.

---

## Funcionalidades

### 📝 Tipografia
| Recurso | Detalhes |
|---|---|
| **Tamanho de Fonte** | 5 níveis: −10%, Normal, +10%, +25%, +50% |
| **Fonte para Dislexia** | OpenDyslexic com espaçamento especial |
| **Espaço entre Linhas** | Normal / Médio (1.9) / Amplo (2.5) |
| **Espaço entre Letras** | Normal / Médio (0.08em) / Amplo (0.18em) |

### 👁 Visão & Cores
| Recurso | Detalhes |
|---|---|
| **Contraste** | Normal / Alto (preto e branco) / Invertido |
| **Saturação** | Normal / Escala de Cinza / Sépia |
| **Simulação de Daltonismo** | Protanopia, Deuteranopia, Tritanopia via SVG `feColorMatrix` (GPU-accelerated) |

### 🖱 Navegação
| Recurso | Detalhes |
|---|---|
| **Cursor Grande** | Cursor SVG personalizado 64×64px |
| **Lupa de Navegação** | Bubble com texto ampliado ao passar o mouse |
| **Máscara de Leitura** | Escurece a tela, destaca linha de leitura |
| **Guia de Leitura** | Linha horizontal que segue o cursor |
| **Destaque de Links** | Borda + background em todos os links |

### ♿ Conformidade e Extras
| Recurso | Detalhes |
|---|---|
| **VLibras** | Interpretação em Língua de Sinais Brasileira (LIBRAS) |
| **Focus Trap** | WCAG 2.1 SC 2.1.2 Level A — Tab/Shift+Tab confinados no painel |
| **ARIA Live Region** | WCAG SC 4.1.3 Level AA — feedback de ação para screen readers |
| **ColorManager** | Auto-correção WCAG AAA das cores da barra (7:1 contraste mínimo) |
| **Persistência** | Preferências salvas em `localStorage` |
| **API Pública** | `window.ACC` para integrações externas |

---

## Requisitos

| Componente | Versão Mínima |
|---|---|
| WordPress | 5.9 |
| PHP | 7.4 |
| jQuery | Qualquer versão incluída no WordPress |

> **Elementor** e **WooCommerce** são suportados mas **não obrigatórios**. O plugin funciona com qualquer tema WordPress.

---

## Instalação

### Via GitHub (recomendado — habilita atualizações automáticas)

1. Acesse [Releases](https://github.com/MiguelFerreira31/acessibilidade-completa/releases)
2. Baixe o arquivo `.zip` da versão mais recente
3. No painel WordPress: **Plugins → Adicionar Novo → Enviar Plugin**
4. Faça upload do `.zip` e ative o plugin

### Manual (FTP/SSH)

```bash
cd wp-content/plugins/
git clone https://github.com/MiguelFerreira31/acessibilidade-completa.git
```

Ative o plugin em **Plugins → Plugins Instalados**.

---

## Como Funciona

### Escalamento de Fonte com Cache

O plugin usa `window.getComputedStyle(el).fontSize` para capturar o tamanho real em `px` de cada elemento — independente de qual unidade CSS o tema usa (`rem`, `em`, `px`, `vw`). Na **primeira ativação**, o DOM é varrido uma única vez e o resultado é armazenado em `_fontEls[]`. Cliques subsequentes nos controles de fonte iteram sobre o cache sem nenhum `querySelectorAll`:

```javascript
// Primeira ativação: O(n) — varre o DOM
_buildFontCache();

// Cliques seguintes: O(m) — itera o array
for (var i = 0; i < _fontEls.length; i++) {
    _applyScaleToEl(_fontEls[i], scale);
}
```

O reset (`scale=1`) usa `querySelectorAll('[data-acc-orig-fs]')` — apenas os elementos que foram escalados — e invalida o cache para rebuild na próxima ativação.

### Proteção de Ícones

Elementos com classes de ícones (`fa`, `fas`, `dashicons`, `eicon`, etc.) e elementos SVG são automaticamente excluídos do escalamento via `_shouldSkipEl()`.

### Alto Contraste com Override JS

O Elementor define `background-color`, `color` e `border-color` via inline `style="... !important"`. CSS externo com `!important` não consegue superar um inline `!important` de mesma especificidade. A solução:

```javascript
el.style.setProperty('background-color', '#000000', 'important');
el.style.setProperty('color',            '#ffffff', 'important');
el.style.setProperty('border-color',     '#ffffff', 'important');
```

Os valores originais são preservados em `data-acc-orig-*` para restauração fiel quando o modo é desativado.

### MutationObserver Incremental

Quando conteúdo é adicionado ao DOM dinamicamente (popups Elementor, WooCommerce AJAX, LMS lazy-load), o MutationObserver acumula os novos nós e, após 250ms de debounce, **escala apenas esses nós novos** — sem re-processar o cache existente:

```
Popup Elementor injeta 30 nós → escala 30 (não 400+ cacheados)
```

### Filtros Visuais em `<html>`

Saturação, inversão e daltonismo são aplicados em `document.documentElement` (não em `body`). Isso garante que elementos `position:fixed` (sticky headers, modais, navbars do Elementor) sejam cobertos pelo filtro em vez de "escapar" para fora dele.

### ColorManager — Auto-correção WCAG

O ColorManager resolve as variáveis CSS `--acc-color-*` usando a técnica "probe element batch":

1. Cria 7 `<div>` filhos de um container `display:none`
2. Cada filho tem `color: var(--acc-color-X)` — o browser resolve toda a cadeia `var()` incluindo Elementor Global Colors e `theme.json`
3. Uma única passagem de `getComputedStyle` retorna todos os valores `rgb()` resolvidos
4. Valida os pares de contraste WCAG e ajusta via HSL preservando matiz e saturação
5. Injeta `<style id="acc-color-patch">` com as variáveis corrigidas

---

## Integração com Elementor e WooCommerce

### Elementor

| Desafio | Solução |
|---|---|
| Font-size em `px` fixo | `getComputedStyle` + cache `_fontEls` |
| Inline styles com `!important` | `el.style.setProperty(..., 'important')` |
| Widgets renderizados após DOM ready | `window.load` invalida cache e re-aplica |
| Conteúdo injetado via AJAX/popup | MutationObserver incremental |
| Ícones Elementor (`eicon-*`) | `ACC_ICON_RE` exclui por classe |
| CSS vars Elementor Global Colors | Probe element batch no ColorManager |

**Seletores Elementor cobertos:** `.elementor-heading-title`, `.elementor-button-text`, `.elementor-icon-box-title/description`, `.elementor-image-box-title/description`, `.elementor-testimonial__content/name`, `.elementor-tab-title`, `.elementor-price-table__heading/subheading`, `.elementor-countdown__label`, `.elementor-alert__title/description`, `.elementor-nav-menu a`.

### WooCommerce

Seletores adicionados ao `ACC_TEXT_SEL`: `.product_title`, `.woocommerce-loop-product__title`, `.price`, `.woocommerce-product-details__short-description p/li`, `.cart_item td`, `.order-total td`, `.woocommerce-checkout-review-order-table td`, `.woocommerce-error li`, `.woocommerce-message`, `.woocommerce-info`.

---

## Sistema de Auto-Update

O plugin usa `AcessibilidadeCompleta_GitHub_Updater` integrado à WordPress Update API:

1. **Verifica** `https://api.github.com/repos/{user}/{repo}/releases/latest`
2. **Filtra** releases com `prerelease=true` ou `draft=true` (previne updates acidentais)
3. **Compara** versões via `version_compare()` e injeta no transient `update_plugins`
4. **Exibe** notificação no painel + modal de detalhes com changelog do GitHub
5. **Instala** baixando o ZIP e renomeando a pasta extraída para o nome correto
6. **Cacheia** resultados por 12h via WP Transients (chave: `acc_gh_upd_*`)

### Forçar Verificação

Adicione `?force-check=1` à URL da página de atualizações. Requer `update_plugins` capability.

### Publicar Nova Versão

```bash
# 1. Atualizar ACC_VERSION em acessibilidade-completa.php (header + define)
# 2. Atualizar CHANGELOG.md
git commit -m "chore(release): bump version to X.Y.Z"
git tag vX.Y.Z
git push origin master --tags
# 3. Criar GitHub Release → asset = ZIP do plugin
# WordPress detecta automaticamente na próxima verificação
```

---

## API Pública — `window.ACC`

Interface estável para integração com Elementor addons, LMS, automações e qualquer código externo:

```javascript
// Tipografia
window.ACC.setFontLevel(2);       // -1 a 3
window.ACC.setDislexia(true);
window.ACC.setLinha('ampla');     // 'normal' | 'media' | 'ampla'
window.ACC.setLetra('media');

// Visão
window.ACC.setContraste('alto');  // 'normal' | 'alto' | 'invertido'
window.ACC.setSaturacao('cinza'); // 'normal' | 'cinza' | 'sepia'
window.ACC.setDaltonismo('protan'); // 'normal' | 'protan' | 'deuter' | 'tritan'

// Painel
window.ACC.openPanel();
window.ACC.closePanel();

// Estado e reset
var state = window.ACC.getState(); // cópia imutável do estado
window.ACC.reset();                // restaura tudo ao padrão
```

Todos os setters validam o input e ignoram valores inválidos silenciosamente.

---

## Para Desenvolvedores

### Estrutura de Pastas

```
acessibilidade-completa/
├── acessibilidade-completa.php   ← Loader: constantes + bootstrap
├── includes/
│   ├── class-plugin.php          ← Classe principal (singleton): assets + HTML
│   └── class-github-updater.php  ← Auto-update via GitHub Releases API
├── assets/
│   ├── acessibilidade.css        ← Estilos do widget (barra + modos)
│   └── acessibilidade.js         ← Lógica de acessibilidade (IIFE + jQuery)
├── CHANGELOG.md
├── DOCUMENTACAO.md               ← Referência técnica completa
├── ROADMAP.md                    ← Roadmap técnico com fases e prioridades
└── README.md
```

### Adicionar Novos Seletores

Em `assets/acessibilidade.js`, adicione ao `ACC_TEXT_SEL`:

```javascript
var ACC_TEXT_SEL = (
    // ... seletores existentes ...
    '.novo-widget-elementor,' +
    '.outro-seletor'
);
```

### Hooks Disponíveis

O plugin expõe a API pública `window.ACC` (ver seção acima). Hooks WordPress (`acc_before_scale`, etc.) estão previstos no roadmap para v4.2+.

---

## Changelog

Veja [CHANGELOG.md](CHANGELOG.md) para histórico completo de versões.

---

## Roadmap

Veja [ROADMAP.md](ROADMAP.md) para o plano técnico detalhado com fases, dependências e KPIs.

---

## Licença

GPL-2.0-or-later — veja [LICENSE](https://www.gnu.org/licenses/gpl-2.0.html) para detalhes.

---

## Autor

**Miguel Ferreira** — [@MiguelFerreira31](https://github.com/MiguelFerreira31)
