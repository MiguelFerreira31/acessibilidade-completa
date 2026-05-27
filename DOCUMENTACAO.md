# Documentação Técnica — Acessibilidade Completa

> Referência técnica completa para desenvolvedores e mantenedores do plugin.  
> Atualizada em: 2026-05-27 | Versão do código: 3.9.1 + Fases 1 e 2

---

## Índice

1. [Arquitetura Geral](#1-arquitetura-geral)
2. [Estrutura de Pastas](#2-estrutura-de-pastas)
3. [Arquivo Principal — Loader](#3-arquivo-principal--loader)
4. [Classe Principal — AcessibilidadeCompleta_Plugin](#4-classe-principal--acessibilidadecompleta_plugin)
5. [Sistema de Auto-Update — AcessibilidadeCompleta_GitHub_Updater](#5-sistema-de-auto-update)
6. [ColorManager — Sistema Adaptativo de Cores](#6-colormanager--sistema-adaptativo-de-cores)
7. [JavaScript — acessibilidade.js](#7-javascript--acessibilidadejs)
8. [CSS — acessibilidade.css](#8-css--acessibilidadecss)
9. [API Pública — window.ACC](#9-api-pública--windowacc)
10. [Hooks e Filtros WordPress](#10-hooks-e-filtros-wordpress)
11. [Persistência de Preferências](#11-persistência-de-preferências)
12. [Integração com Elementor e WooCommerce](#12-integração-com-elementor-e-woocommerce)
13. [Conformidade WCAG 2.1](#13-conformidade-wcag-21)
14. [Segurança e Sanitização](#14-segurança-e-sanitização)
15. [Internacionalização (i18n)](#15-internacionalização-i18n)
16. [Sistema de Auto-Update — Fluxo Completo](#16-fluxo-completo-do-auto-update)
17. [Boas Práticas Aplicadas](#17-boas-práticas-aplicadas)
18. [Guia de Manutenção Futura](#18-guia-de-manutenção-futura)

---

## 1. Arquitetura Geral

O plugin segue uma arquitetura em 3 camadas:

```
┌─────────────────────────────────────────────────────┐
│                  CAMADA DE BOOTSTRAP                │
│         acessibilidade-completa.php (loader)        │
│   Define constantes → require includes → init       │
└──────────────────────┬──────────────────────────────┘
                       │
         ┌─────────────┴────────────┐
         ▼                          ▼
┌────────────────┐        ┌──────────────────────────┐
│  class-plugin  │        │   class-github-updater   │
│   (Singleton)  │        │  (WordPress Update API)  │
│                │        │                          │
│ • enqueue CSS  │        │ • GitHub API polling     │
│ • enqueue JS   │        │ • prerelease/draft filter│
│ • render HTML  │        │ • WP Transient 12h cache │
└───────┬────────┘        └──────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────┐
│                  CAMADA DE FRONTEND                   │
│           acessibilidade.js (IIFE + jQuery)           │
│           acessibilidade.css                          │
│                                                       │
│  ┌─────────────────┐   ┌──────────────────────────┐  │
│  │  ColorManager   │   │  Objeto Acessibilidade   │  │
│  │                 │   │                          │  │
│  │ _resolveBatch() │   │ _fontEls[] cache         │  │
│  │ _analyzeAndPatch│   │ _buildFontCache()        │  │
│  │ _inject() patch │   │ _scaleFonts()            │  │
│  └─────────────────┘   │ _applyContrasteAltoJS()  │  │
│                        │ MutationObserver increm. │  │
│                        │ window.ACC API           │  │
│                        └──────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

### Padrões de Design Utilizados

| Padrão | Onde |
|---|---|
| **Singleton** | `AcessibilidadeCompleta_Plugin::get_instance()` |
| **Module Pattern** | IIFE JavaScript `(function($){...})(jQuery)` |
| **Observer** | MutationObserver + hooks WordPress |
| **Strategy** | `_scaleFonts`: estratégia cache vs. full scan |
| **Facade** | `window.ACC` — interface pública sobre internals |
| **Lazy Init** | `_buildFontCache()` só executa na primeira ativação |

---

## 2. Estrutura de Pastas

```
acessibilidade-completa/
│
├── acessibilidade-completa.php   ← LOADER: cabeçalho, constantes, bootstrap
│
├── includes/
│   ├── class-plugin.php          ← Singleton: assets + HTML do widget
│   └── class-github-updater.php  ← Auto-update via GitHub Releases API
│
├── assets/
│   ├── acessibilidade.css        ← Estilos (barra lateral + modos de acessibilidade)
│   └── acessibilidade.js         ← Lógica completa (IIFE + ColorManager + window.ACC)
│
├── .gitignore
├── CHANGELOG.md                  ← Histórico de versões (Keep a Changelog)
├── DOCUMENTACAO.md               ← Esta documentação técnica
├── ROADMAP.md                    ← Roadmap com fases, prioridades e KPIs
└── README.md                     ← Documentação de usuário e API pública
```

---

## 3. Arquivo Principal — Loader

**Arquivo:** `acessibilidade-completa.php`

### Responsabilidades
- Contém o cabeçalho do plugin (Plugin Name, Version, etc.)
- Define constantes globais com prefixo `ACC_`
- Carrega os arquivos de `includes/`
- Bootstrap via hook `plugins_loaded`

### Constantes Definidas

| Constante | Valor atual | Descrição |
|---|---|---|
| `ACC_VERSION` | `'3.9.1'` | Versão atual — atualizar em header E define() |
| `ACC_PLUGIN_FILE` | `__FILE__` | Caminho absoluto ao arquivo principal |
| `ACC_PLUGIN_DIR` | `plugin_dir_path(__FILE__)` | Diretório com trailing slash |
| `ACC_PLUGIN_URL` | `plugin_dir_url(__FILE__)` | URL pública com trailing slash |
| `ACC_PLUGIN_SLUG` | `plugin_basename(__FILE__)` | `pasta/arquivo.php` |
| `ACC_GITHUB_USER` | `'MiguelFerreira31'` | Usuário GitHub |
| `ACC_GITHUB_REPO` | `'acessibilidade-completa'` | Repositório GitHub |

### Hook de Bootstrap

```php
add_action( 'plugins_loaded', static function () {
    AcessibilidadeCompleta_Plugin::get_instance();
    new AcessibilidadeCompleta_GitHub_Updater(
        ACC_PLUGIN_FILE, ACC_GITHUB_USER, ACC_GITHUB_REPO
    );
} );
```

`plugins_loaded` garante que WordPress e todos os outros plugins estejam carregados antes da inicialização, evitando conflitos de dependência.

---

## 4. Classe Principal — AcessibilidadeCompleta_Plugin

**Arquivo:** `includes/class-plugin.php`

### Métodos

#### `get_instance(): AcessibilidadeCompleta_Plugin`
Singleton. Cria na primeira chamada; retorna a mesma instância nas seguintes.

#### `init_hooks(): void`
Registra `wp_enqueue_scripts` → `enqueue_assets()` e `wp_footer` (prioridade 5) → `render_widget()`.

#### `enqueue_assets(): void`

| Handle | Tipo | Posição | Deps |
|---|---|---|---|
| `vlibras` | JS externo (CDN) | `<head>` | — |
| `open-dyslexic` | CSS externo (CDN) | `<head>` | — |
| `acessibilidade-css` | CSS local | `<head>` | `open-dyslexic` |
| `acessibilidade-js` | JS local | `<footer>` | `jquery` |

#### `render_widget(): void`
Insere no footer (prioridade 5):
1. `<svg id="acc-svg-filters">` — filtros feColorMatrix para daltonismo (posicionado antes de `_injectSvgFilters()` para evitar duplicação)
2. Bubble da lupa de navegação (`#acc-lupa-bubble`)
3. Overlays da máscara de leitura (`#acc-mascara-top`, `#acc-mascara-bottom`)
4. Guia de leitura (`#acc-guia`)
5. Widget VLibras
6. `#barra-acessibilidade` com `role="complementary"` + painel `role="dialog" aria-modal="true"`
7. `#acc-announcer` — live region ARIA para screen readers

---

## 5. Sistema de Auto-Update

**Arquivo:** `includes/class-github-updater.php`

### Construtor

```php
new AcessibilidadeCompleta_GitHub_Updater(
    string $plugin_file,   // Caminho absoluto ao arquivo principal
    string $github_user,   // Usuário GitHub (sanitizado)
    string $github_repo    // Nome do repositório (sanitizado)
);
```

### Propriedades Principais

| Propriedade | Tipo | Descrição |
|---|---|---|
| `$plugin_file` | string | Caminho ao arquivo principal |
| `$plugin_slug` | string | `plugin_basename()` do arquivo |
| `$github_user` | string | Usuário GitHub (sanitizado) |
| `$github_repo` | string | Repositório GitHub (sanitizado) |
| `$transient_key` | string | `acc_gh_upd_` + md5 truncado (12 chars) |
| `$transient_ttl` | int | `12 * HOUR_IN_SECONDS` (43200s) |

### Métodos Públicos (Hooks)

#### `check_for_update($transient)`
**Hook:** `pre_set_site_transient_update_plugins`

Consulta GitHub API, compara `version_compare(current, latest, '<')` e injeta dados no transient quando há update disponível.

#### `plugin_popup($result, $action, $args)`
**Hook:** `plugins_api` (prioridade 10)

Fornece o objeto de detalhes para o modal "Ver detalhes" no admin. Popula `name`, `version`, `author`, `sections.description`, `sections.changelog` (com conteúdo `$release->body` do GitHub).

#### `after_install($response, $hook_extra, $result)`
**Hook:** `upgrader_post_install` (prioridade 10)

1. Renomeia pasta extraída do ZIP (formato `user-repo-hash`) para o nome correto
2. Reativa o plugin se estava ativo
3. Invalida o transient de cache
4. Reseta propriedades em memória

#### `purge_cache_maybe()`
**Hook:** `admin_init`

Invalida o transient quando admin acessa com `?force-check=1` e tem `update_plugins` capability.

### `get_github_release(): object|false`

Fluxo:
1. Cache em memória (`$this->github_response`) → retorna
2. WP Transient → retorna
3. `wp_remote_get` para `/releases/latest` com `sslverify: true`
4. Valida HTTP 200, JSON válido, objeto com `tag_name`
5. **Rejeita** releases com `prerelease === true` ou `draft === true` (prevenção de updates acidentais)
6. Salva no transient por 12h

---

## 6. ColorManager — Sistema Adaptativo de Cores

**Localização:** objeto `ColorManager` em `assets/acessibilidade.js` (antes de `Acessibilidade`)

### Problema Resolvido

O plugin herda variáveis CSS do tema via `--acc-color-*`. Quando o tema usa cores claras, pastéis ou brancas, a barra fica "lavada" — botões ilegíveis, separadores invisíveis. O ColorManager detecta e corrige automaticamente.

### Fluxo de `_analyzeAndPatch()`

```
1. _resolveBatch([7 vars])           ← 1 DOM operation (ver abaixo)
       ↓
2. Detectar polo do tema
   lum < 0.18  → dark mode
   lum ≥ 0.75  → light mode
   0.18–0.75   → zona cinza → força near-white (L=97%)
       ↓
3. Validar e corrigir cada par de contraste WCAG:
   contrast vs base    → 7:1  (AAA)
   muted   vs base     → 4.5:1 (AA)
   muted   vs surface  → 4.5:1 (AA)
   border  vs surface  → 3:1  (UI component)
   secondary vs base   → 3:1  (UI component)
   base    vs secondary → 4.5:1 (texto no btn-reset)
       ↓
4. _inject() → <style id="acc-color-patch"> no <head>
```

### `_resolveBatch(varNames[])` — Batch Probe Element

**Problema anterior:** 7 chamadas a `_resolve()` = 7 × (createElement + appendChild + getComputedStyle + removeChild). Cada getComputedStyle antes de removeChild pode forçar style recalculation separado.

**Solução batch:**
```javascript
// 1 container com N filhos — 1 insert/remove em vez de 7
var container = document.createElement('div');
container.style = 'display:none; position:absolute';

varNames.forEach(function(varName) {
    var probe = document.createElement('div');
    probe.style = 'color: var(' + varName + ')';
    container.appendChild(probe);
});

bar.appendChild(container);  // 1 operação DOM

// Browser resolve todas as vars antes de retornar
varNames.forEach(function(name, i) {
    out[name] = _parseRgb(getComputedStyle(probes[i]).color);
});

bar.removeChild(container);  // 1 operação DOM
```

**Ganho:** ~60% menos overhead de DOM vs. 7×`_resolve()`.

### `_makeSafe(fg, bg, minRatio, goDark)` — Ajuste HSL

Percorre Lightness em passos de 1.5% na direção correta (escurecendo se `goDark=true`, clareando se `false`), preservando Hue e Saturation. Retorna preto/branco puro como último recurso absoluto após 80 iterações.

### Contraste Mínimo por Variável

| Par | Mínimo | Padrão WCAG |
|---|---|---|
| `--acc-color-contrast` vs `base` | 7:1 | AAA — texto principal |
| `--acc-color-muted` vs `base` | 4.5:1 | AA — texto secundário |
| `--acc-color-muted` vs `surface` | 4.5:1 | AA — labels em cards |
| `--acc-color-border` vs `surface` | 3:1 | SC 1.4.11 UI component |
| `--acc-color-secondary` vs `base` | 3:1 | UI component |
| `base` vs `--acc-color-secondary` | 4.5:1 | AA — texto no btn-reset |

---

## 7. JavaScript — acessibilidade.js

**Padrão:** IIFE `(function($){ 'use strict'; ... })(jQuery)` — sem ESModules, compatível com jQuery enqueue do WordPress.

### Constantes do Módulo

| Constante | Descrição |
|---|---|
| `FONT_LEVELS` | Labels e tamanhos demo por nível (`-1` a `3`) |
| `FONT_SCALES` | Fatores multiplicadores: `0.90, 1.00, 1.10, 1.25, 1.50` |
| `FONT_MIN` / `FONT_MAX` | `-1` / `3` |
| `ACC_FS_ATTR` | `'data-acc-orig-fs'` — preserva font-size original em px |
| `ACC_TEXT_SEL` | Seletor abrangente: h1-h6, p, li, td, a, button, widgets Elementor, WP Blocks, WooCommerce |
| `ACC_ICON_RE` | RegExp para classes de ícones (fa, fas, dashicons, eicon, material-icons...) |
| `SEMANTIC_TAGS` | Tags semânticas para a lupa de navegação |
| `MASCARA_BANDA` | `90` px — metade da banda da máscara |

### Propriedades do Objeto `Acessibilidade`

| Propriedade | Tipo | Descrição |
|---|---|---|
| `_vlibrasInit` | boolean | Flag de inicialização do VLibras |
| `_lupaTimer` | number\|null | Timer do debounce da lupa |
| `_navHandlersActive` | boolean | Flag dos handlers de máscara+guia |
| `_mutationObserver` | MutationObserver\|null | Instância do observer |
| `_mutationTimer` | number\|null | Timer do debounce do observer |
| `_suppressAnnounce` | boolean | `true` durante bulk operations para silenciar live region |
| `_fontEls` | Element[]\|null | Cache de elementos de texto (`null` = inválido) |

### Estado (`estado`)

```javascript
estado: {
    fontLevel:       0,         // -1 a 3
    dislexia:        false,
    linha:           'normal',  // 'normal' | 'media' | 'ampla'
    letra:           'normal',  // 'normal' | 'media' | 'ampla'
    contraste:       'normal',  // 'normal' | 'alto'  | 'invertido'
    saturacao:       'normal',  // 'normal' | 'cinza' | 'sepia'
    daltonismo:      'normal',  // 'normal' | 'protan' | 'deuter' | 'tritan'
    cursor:          'normal',  // 'normal' | 'grande'
    lupa:            false,
    linksDestacados: false,
    mascara:         false,
    guia:            false
}
```

### Referência Completa de Métodos

| Método | Responsabilidade |
|---|---|
| `init()` | Bootstrap: ColorManager → SVG filters → VLibras → eventos → prefs → MutationObserver |
| `initVLibras()` | Polling 500ms × 20 = 10s máximo |
| `_injectSvgFilters()` | Guard: `getElementById('acc-svg-filters')` → cria SVG com 3 filtros feColorMatrix |
| `bindEvents()` | Registra todos os event listeners + focus trap |
| `aplicarAcao(acao)` | Despacha ação pelo prefixo de `data-acao` |
| `aplicarFontLevel(level)` | Orquestra `_scaleFonts` + UI do stepper |
| `_shouldSkipEl(el)` | Filtro: SVG, barra, VLibras, ícones de fonte → `true` = pular |
| `_buildFontCache()` | Scan lazy do DOM → popula `_fontEls[]` |
| `_extendFontCache(nodes)` | Adiciona novos nós ao cache; compactação se > 800 |
| `_applyScaleToEl(el, scale)` | Aplica escala em elemento único via `ACC_FS_ATTR` |
| `_scaleFonts(scale)` | Escala via cache; reset via `[ACC_FS_ATTR]` query |
| `aplicarContraste(modo)` | Classes + `_applyContrasteAltoJS` via rAF + `composeBodyFilter` |
| `composeBodyFilter()` | Compõe `invert+grayscale+sepia+daltonismo` em `documentElement.filter` |
| `_applyContrasteAltoJS()` | Override JS de `bg/color/border/bgImage` com `setProperty('important')` |
| `_restoreContrasteAltoJS()` | Reverte overrides via `data-acc-orig-*` |
| `aplicarLinha/Letra(nivel)` | Classes de espaçamento no `body` |
| `aplicarDislexia(ativo)` | Classe `fonte-dislexia` + `aria-checked` |
| `aplicarLupa(ativo)` | `mousemove.acc-lupa` handler |
| `aplicarMascara(ativo)` | Overlays + `_updateNavHandlers()` |
| `aplicarGuia(ativo)` | Linha guia + `_updateNavHandlers()` |
| `aplicarLinksDestacados(ativo)` | Classe `links-destacados` + `aria-checked` |
| `_announce(msg)` | Injeta em `#acc-announcer` (clear → 50ms → set); respeita `_suppressAnnounce` |
| `resetTudo()` | Remove tudo; `_suppressAnnounce = true` → ações → `false` → anúncio único |
| `savePreferences()` | `localStorage.setItem(JSON)` |
| `loadPreferences()` | Lê + migração de prefs legadas (v1/v2) + `aplicarTudoDoEstado` |
| `aplicarTudoDoEstado()` | Reconstrói estado com `_suppressAnnounce = true` durante restore |
| `marcarBotoesAtivos()` | Sincroniza `aria-pressed`/`aria-checked` com estado |
| `_initMutationObserver()` | Configura observer incremental com `_pendingNodes` buffer |

### `_scaleFonts(scale)` — Algoritmo com Cache

```
scale === 1 (reset):
  _fontEls = null                        ← invalida cache
  querySelectorAll('[data-acc-orig-fs]')  ← apenas os já escalados
    → removeProperty('font-size')

scale !== 1 (ativar):
  _fontEls === null?
    → _buildFontCache()                  ← scan único do DOM
  para cada el em _fontEls:
    el.isConnected === false?  → pula    ← nó removido do DOM (IE11-safe)
    _applyScaleToEl(el, scale)
      → ACC_FS_ATTR present?   → origPx = parseFloat(atributo)
      → ACC_FS_ATTR absent?    → origPx = getComputedStyle(el).fontSize
                               → setAttribute(ACC_FS_ATTR, origPx)
      → setProperty('font-size', origPx*scale+'px', 'important')
```

### `_shouldSkipEl(el)` — Critérios de Exclusão

1. Tag is: `SCRIPT`, `STYLE`, `NOSCRIPT`, `META`, `LINK`, `HEAD`, `HTML`, `BODY`, `SVG`, ou qualquer tag de elemento SVG (`PATH`, `CIRCLE`, `RECT`, etc.)
2. `el.closest('#barra-acessibilidade')` → dentro da barra do plugin
3. `el.closest('[vw]')` → dentro do widget VLibras
4. `el.closest('svg')` → descendente de SVG inline
5. `el.className` match `ACC_ICON_RE` → ícone de fonte

### Focus Trap — `keydown.acc-trap`

```javascript
$(document).on('keydown.acc-trap', function(e) {
    if (e.key !== 'Tab') return;
    if (painel.hasClass('painel-hidden')) return;

    var $focusable = painel.find(
        'button:not([disabled]),[href],input:not([disabled]),' +
        'select:not([disabled]),textarea:not([disabled]),' +
        '[tabindex]:not([tabindex="-1"])'
    ).filter(':visible');

    // Shift+Tab no primeiro → vai para o último
    // Tab no último → vai para o primeiro
});
```

### `_announce(msg)` — Live Region

```javascript
_announce: function(msg) {
    if (this._suppressAnnounce) return;
    var $ann = $('#acc-announcer');
    $ann.text('');                        // clear garante mudança de DOM
    setTimeout(function() {
        $ann.text(msg);                   // AT detecta a inserção
    }, 50);
}
```

**Por que `assertive` e não `polite`?** Mudanças de contraste e fonte afetam a visibilidade imediata. O usuário precisa saber agora.

**`_suppressAnnounce`:** `true` durante `aplicarTudoDoEstado()` (restauração na carga da página) e `resetTudo()` (único anúncio consolidado ao final). Evita flood de mensagens ao recarregar com prefs salvas.

### MutationObserver Incremental

```javascript
// Buffer closure — não polui o objeto Acessibilidade
var _pendingNodes = [];

observer = new MutationObserver(function(mutations) {
    // Coleta todos os nós adicionados neste burst
    mutations.forEach(function(m) {
        m.addedNodes.forEach(function(n) { _pendingNodes.push(n); });
    });

    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(function() {
        var nodes = _pendingNodes.splice(0);  // drena o buffer

        if (fontLevel !== 0 && scale !== 1) {
            if (_fontEls !== null) {
                var prev = _fontEls.length;
                _extendFontCache(nodes);       // adiciona apenas os novos
                for (var k = prev; k < _fontEls.length; k++) {
                    if (_fontEls[k].isConnected !== false)
                        _applyScaleToEl(_fontEls[k], scale);
                }
            } else {
                _scaleFonts(scale);            // fallback: full scan
            }
        }

        if (contraste === 'alto') {
            _applyContrasteAltoJS();           // idempotente — re-scan de [style]
        }
    }, 250);
});

observer.observe(document.body, { childList: true, subtree: true });
// NÃO usa attributes: true → evita loop infinito
```

### `_applyContrasteAltoJS()` e `_restoreContrasteAltoJS()`

| Atributo de preservação | Propriedade CSS sobrescrita |
|---|---|
| `data-acc-orig-bg` | `background-color: #000000 !important` |
| `data-acc-orig-color` | `color: #ffffff !important` |
| `data-acc-orig-bgi` | `background-image: none !important` |
| `data-acc-orig-border` | `border-color: #ffffff !important` |

Presença de `data-acc-orig-color` no elemento é o sentinel de "já foi processado" — previne dupla preservação ao chamar `_applyContrasteAltoJS` múltiplas vezes.

---

## 8. CSS — acessibilidade.css

### Arquitetura de Variáveis

```
Elementor Global Colors (--e-global-color-*)
    ↓ fallback
WordPress theme.json (--wp--preset--color-*)
    ↓ fallback
Hardcoded (#1a5276, #ffffff, etc.)
    ↓ override (document order, sem !important)
acc-color-patch <style> injetado pelo ColorManager
```

### Variáveis Internas com Prefixo `--acc-`

| Variável | Função |
|---|---|
| `--acc-color-base` | Background do painel / texto sobre botões |
| `--acc-color-contrast` | Background do header, botão toggle, botões ativos |
| `--acc-color-secondary` | Background do botão reset |
| `--acc-color-surface` | Background de cards e botões inativos |
| `--acc-color-border` | Bordas e separadores |
| `--acc-color-muted` | Texto secundário, labels, versão |
| `--acc-color-accent` | Dots de nível do stepper de fonte |

### Modos de Acessibilidade (classes no `<body>`)

| Classe | Efeito principal |
|---|---|
| `fonte-dislexia` | `font-family: OpenDyslexic !important` |
| `linha-media` | `line-height: 1.9 !important` |
| `linha-ampla` | `line-height: 2.5 !important` |
| `letra-media` | `letter-spacing: 0.08em !important` |
| `letra-ampla` | `letter-spacing: 0.18em !important` |
| `contraste-alto` | CSS base + `_applyContrasteAltoJS` para Elementor |
| `contraste-invertido` | `html { filter: invert(1) hue-rotate(180deg) }` |
| `cursor-grande` | Cursor SVG 64×64px |
| `links-destacados` | Outline + underline + background em `a` |

### Por Que Filtros em `<html>` e Não em `<body>`?

```
filter em <body>:
  position:fixed → posiciona relativo ao <body> filtrado
  → sticky headers, modais e navbars "escapam" do filtro

filter em <html> (dimensões ≈ viewport):
  position:fixed → continua correto
  → TODO o conteúdo recebe o filtro, incluindo Elementor Pro modais
```

### Isolamento da Barra

Após cada bloco de modo, há overrides específicos para `#barra-acessibilidade` que restauram o visual original (ex: `contraste-alto` não interfere nos botões da barra). Os seletores usam especificidade `html body.contraste-alto #barra-acessibilidade`.

---

## 9. API Pública — `window.ACC`

Declarado dentro da IIFE, após o objeto `Acessibilidade`, exposto via `window` para acesso externo.

### Contrato

- Todos os setters **validam o input** e ignoram valores inválidos silenciosamente
- `getState()` retorna uma **cópia** (JSON.parse/stringify) — sem acesso direto ao estado interno
- Chamadas antes de `document.ready` são aceitas mas podem não ter efeito se o DOM não existir

### Referência de Métodos

```javascript
window.ACC.setFontLevel(level)
// level: integer -1 a 3
// Chama aplicarFontLevel() + savePreferences() + marcarBotoesAtivos()

window.ACC.setContraste(modo)
// modo: 'normal' | 'alto' | 'invertido'

window.ACC.setSaturacao(modo)
// modo: 'normal' | 'cinza' | 'sepia'

window.ACC.setDaltonismo(modo)
// modo: 'normal' | 'protan' | 'deuter' | 'tritan'

window.ACC.setLinha(nivel)
// nivel: 'normal' | 'media' | 'ampla'

window.ACC.setLetra(nivel)
// nivel: 'normal' | 'media' | 'ampla'

window.ACC.setDislexia(ativo)
// ativo: qualquer truthy/falsy

window.ACC.reset()
// Equivalente a clicar no botão "Restaurar padrões"

window.ACC.getState()
// Retorna: { fontLevel, dislexia, linha, letra, contraste,
//            saturacao, daltonismo, cursor, lupa,
//            linksDestacados, mascara, guia }

window.ACC.openPanel()
// Abre o painel e foca no botão fechar

window.ACC.closePanel()
// Fecha o painel
```

---

## 10. Hooks e Filtros WordPress

### Actions

| Hook | Prioridade | Método | Descrição |
|---|---|---|---|
| `plugins_loaded` | 10 | Bootstrap | Inicia plugin + updater |
| `wp_enqueue_scripts` | 10 | `enqueue_assets()` | Enfileira CSS/JS |
| `wp_footer` | **5** | `render_widget()` | Renderiza HTML no footer |
| `admin_init` | 10 | `purge_cache_maybe()` | Purga cache de update |

### Filtros

| Hook | Prioridade | Método | Descrição |
|---|---|---|---|
| `pre_set_site_transient_update_plugins` | 10 | `check_for_update()` | Verifica update no GitHub |
| `plugins_api` | 10 | `plugin_popup()` | Info do plugin no modal admin |
| `upgrader_post_install` | 10 | `after_install()` | Pós-instalação do update |

---

## 11. Persistência de Preferências

### Chave e Formato

```javascript
// Chave no localStorage
'acessibilidade_prefs'

// Estrutura JSON salva
{
    "fontLevel": 2,
    "dislexia": false,
    "linha": "media",
    "letra": "normal",
    "contraste": "normal",
    "saturacao": "cinza",
    "daltonismo": "normal",
    "cursor": "normal",
    "lupa": false,
    "linksDestacados": true,
    "mascara": false,
    "guia": false
}
```

### Fluxo de Carregamento

```
document.ready
  → loadPreferences()
      → null       → marcarBotoesAtivos() + aplicarFontLevel(0)
      → JSON legado (array de classes) → _migrarPrefsLegadas() + salvar
      → JSON moderno → $.extend(estado, prefs)
          → aplicarTudoDoEstado()
              → _suppressAnnounce = true   ← silencia live region
              → aplicarFontLevel()
              → aplicarDislexia()
              → aplicarLinha/Letra()
              → aplicarContraste()   ← rAF para _applyContrasteAltoJS
              → composeBodyFilter()
              → aplicarLupa/Links/Mascara/Guia()
              → _suppressAnnounce = false
              → marcarBotoesAtivos()
```

### Migração de Prefs Legadas (v1/v2)

| Classe legada | Estado moderno |
|---|---|
| `contraste-alto` | `contraste: 'alto'` |
| `contraste-invertido` | `contraste: 'invertido'` |
| `fonte-aumentar` | `fontLevel: 2` |
| `fonte-diminuir` | `fontLevel: -1` |
| `espaco-aumentado` | `linha: 'ampla', letra: 'media'` |
| `cursor-grande` | `cursor: 'grande'` |

---

## 12. Integração com Elementor e WooCommerce

### Problema do Elementor

O Elementor define `font-size` em `px` fixo em dois níveis:
1. **Folha de estilo:** `.elementor-heading-title { font-size: 48px; }`
2. **Inline style:** `<h2 style="font-size: 36px !important;">` (CSS customizado do widget)

Alterar `html { font-size: 110% }` não afeta valores em `px`. CSS externo com `!important` não supera inline `!important` de mesma especificidade quando declarado depois.

### Soluções Implementadas

| Desafio | Solução |
|---|---|
| Font-size em px | `getComputedStyle` + cache `_fontEls` |
| Inline !important | `el.style.setProperty(..., 'important')` modifica o próprio inline style |
| Widgets pós-load | `window.load` invalida `_fontEls = null` + re-aplica |
| Popups/AJAX | MutationObserver incremental com `_pendingNodes` |
| CSS vars Elementor | Probe element batch no ColorManager |
| Ícones Elementor | `ACC_ICON_RE` exclui `.eicon-*` etc. |
| position:fixed pós-filter | Filter aplicado em `<html>` e não em `<body>` |

### Seletores Elementor em `ACC_TEXT_SEL`

`.elementor-heading-title`, `.elementor-button-text`, `.elementor-icon-box-title`,
`.elementor-icon-box-description`, `.elementor-image-box-title`,
`.elementor-image-box-description`, `.elementor-testimonial__content`,
`.elementor-testimonial__name`, `.elementor-tab-title`,
`.elementor-price-table__heading`, `.elementor-price-table__subheading`,
`.elementor-countdown__label`, `.elementor-alert__title`,
`.elementor-alert__description`, `.elementor-nav-menu a`

### Seletores WooCommerce em `ACC_TEXT_SEL`

`.product_title`, `.woocommerce-loop-product__title`, `.price`,
`.woocommerce-product-details__short-description p/li`,
`.cart_item td`, `.order-total td`,
`.woocommerce-checkout-review-order-table td`,
`.woocommerce-error li`, `.woocommerce-message`, `.woocommerce-info`

---

## 13. Conformidade WCAG 2.1

| Critério | Nível | Implementação |
|---|---|---|
| **1.4.3** Contrast (Minimum) | AA | ColorManager garante 4.5:1 em textos da barra |
| **1.4.6** Contrast (Enhanced) | AAA | ColorManager garante 7:1 para texto principal |
| **1.4.11** Non-text Contrast | AA | Border 3:1 vs surface via ColorManager |
| **1.4.12** Text Spacing | AA | Controles de linha/letra no painel |
| **2.1.1** Keyboard | A | Todos os controles acessíveis via teclado |
| **2.1.2** No Keyboard Trap | A | Focus trap implementado com wrap Tab/Shift+Tab |
| **2.4.7** Focus Visible | AA | `:focus-visible` em todos os elementos interativos |
| **4.1.2** Name, Role, Value | A | `aria-pressed`, `aria-checked`, `aria-expanded` em todos os botões |
| **4.1.3** Status Messages | AA | `#acc-announcer` com `aria-live="assertive"` para feedback de ação |

### Estrutura ARIA do Painel

```html
<nav id="barra-acessibilidade" role="complementary" aria-label="Ferramentas de acessibilidade">
  <button id="toggle-acessibilidade" aria-controls="painel-acessibilidade"
          aria-expanded="false">
  </button>

  <section id="painel-acessibilidade" role="dialog"
           aria-modal="true" aria-label="Painel de acessibilidade"
           class="painel-hidden">
    <button id="fechar-painel">...</button>
    <!-- controles com aria-pressed / aria-checked -->
  </section>
</nav>

<!-- Fora da barra, invisível visualmente -->
<div id="acc-announcer" role="status"
     aria-live="assertive" aria-atomic="true">
</div>
```

---

## 14. Segurança e Sanitização

### PHP

| Dado | Tratamento |
|---|---|
| `$github_user` | `sanitize_text_field()` no construtor |
| `$github_repo` | `sanitize_text_field()` no construtor |
| HTML de output | `esc_html_e()` e `esc_attr_e()` em toda a view |
| Acesso admin | `current_user_can('update_plugins')` no purge cache |
| URLs da API | `rawurlencode()` nos parâmetros |
| Resposta da API | `json_decode()` + `is_object()` + validação de campos |
| Requisições HTTP | `wp_remote_get()` com `sslverify: true` |
| Releases | Rejeita `prerelease` e `draft` antes de cachear |

### JavaScript

| Dado | Tratamento |
|---|---|
| Texto da lupa | `.text()` jQuery — escapa HTML |
| localStorage | `JSON.parse` em `try/catch` |
| `getComputedStyle` | Guard NaN: `origPx !== origPx` |
| `el.isConnected` | Guard IE11: `el.isConnected === false` (undefined ≠ false) |
| `el.matches()` | Guard antes de chamar: `node.matches &&` |
| `el.closest()` | Guard: `typeof el.closest === 'function'` |
| Inputs da API ACC | Validação de tipo e valores permitidos em cada setter |

---

## 15. Internacionalização (i18n)

**Text Domain:** `acessibilidade-completa`  
**Domain Path:** `/languages`

Funções utilizadas: `esc_html_e()`, `esc_attr_e()`, `__()` com segundo argumento `'acessibilidade-completa'`.

```bash
# Gerar arquivo POT
wp i18n make-pot . languages/acessibilidade-completa.pot

# Criar tradução
cp languages/acessibilidade-completa.pot languages/acessibilidade-completa-pt_BR.po
# Editar o .po com Poedit ou similar
msgfmt acessibilidade-completa-pt_BR.po -o acessibilidade-completa-pt_BR.mo
```

---

## 16. Fluxo Completo do Auto-Update

```
Instalação inicial
  → define ACC_GITHUB_USER + ACC_GITHUB_REPO
  → new GitHub_Updater(plugin_file, user, repo)
  → add_filter('pre_set_site_transient_update_plugins', check_for_update)

Verificação pelo WordPress
  → check_for_update($transient)
      → get_github_release()
          → cache em memória? → retorna
          → WP Transient (12h)? → retorna
          → wp_remote_get('api.github.com/releases/latest')
              → erro HTTP → log (WP_DEBUG) + false
              → HTTP 200 → json_decode
                  → prerelease ou draft? → log + false  ← NOVO
                  → válido → set_transient(12h)
      → version_compare(current, latest, '<')?
          → $transient->response[slug] = {package, new_version, ...}

Painel WordPress
  → "Atualizações disponíveis"
  → "Ver detalhes" → plugin_popup() → changelog do GitHub

Instalação
  → WP baixa ZIP (release asset ou zipball_url)
  → Extrai em /tmp/
  → after_install()
      → rename: user-repo-abc123/ → plugin-dir/
      → activate_plugin() se estava ativo
      → delete_transient() → força nova verificação
      → log('Plugin atualizado com sucesso')
```

---

## 17. Boas Práticas Aplicadas

| Prática | Implementação |
|---|---|
| Sem globais | IIFE JavaScript; classes PHP com prefixo único |
| Singleton | `get_instance()` previne múltiplas instâncias |
| Early return | `if (!ABSPATH) exit;` em todos os arquivos PHP |
| Output escape | `esc_html_e()` / `esc_attr_e()` |
| Input sanitize | `sanitize_text_field()` no updater |
| Cache de API | WP Transient 12h + cache em memória |
| Logs condicionais | `if (WP_DEBUG)` antes de `error_log()` |
| TLS obrigatório | `sslverify: true` em `wp_remote_get()` |
| Verificação de capability | `current_user_can('update_plugins')` |
| WCAG 2.1 AA/AAA | Focus trap, live region, aria-*, ColorManager |
| Cache incremental | `_fontEls` + `_extendFontCache` — sem scan a cada clique |
| IE11 safe | Guards `isConnected === false`, `typeof closest`, `node.matches &&` |
| Loop infinito prevention | MutationObserver observa `childList` apenas, não `attributes` |
| Debounce | 250ms no MutationObserver — agrupa bursts de mutação |
| Idempotência | `data-acc-orig-*` guards — sem dupla aplicação |
| Prerelease filter | Rejeita `draft` e `prerelease` no GitHub Updater |

---

## 18. Guia de Manutenção Futura

### Publicar Nova Versão

```bash
# 1. Atualizar ambos os locais:
#    acessibilidade-completa.php → cabeçalho "Version:" E define('ACC_VERSION', 'X.Y.Z')
# 2. Atualizar CHANGELOG.md: mover [Unreleased] para [X.Y.Z] com data
git add -A
git commit -m "chore(release): bump version to X.Y.Z"
git tag vX.Y.Z
git push origin master --tags
# 3. GitHub → Releases → New Release
#    Tag: vX.Y.Z | Title: "vX.Y.Z — Descrição breve"
#    Body: copiar entrada do CHANGELOG
#    Asset: upload do ZIP do plugin
# WordPress detecta automaticamente na próxima verificação (ou ?force-check=1)
```

### Adicionar Nova Funcionalidade de Acessibilidade

1. **HTML** (`includes/class-plugin.php` → `render_widget()`): botão/toggle com `aria-*`
2. **Estado JS** (`assets/acessibilidade.js` → `estado`): nova chave
3. **Evento** (`bindEvents()`): click handler + `_announce()`
4. **Método** (`aplicar*()`): implementar lógica
5. **CSS** (`assets/acessibilidade.css`): modo + isolamento da barra
6. **Reset** (`resetTudo()`): incluir na restauração
7. **API** (`window.ACC`): expor setter se faz sentido externamente
8. **Persistência**: nova chave em `savePreferences`/`loadPreferences`

### Adicionar Seletores para Novo Tema/Plugin

```javascript
// assets/acessibilidade.js → ACC_TEXT_SEL
var ACC_TEXT_SEL = (
    // ... existentes ...
    '.novo-widget-titulo,' +
    '.novo-widget-descricao'
);
```

Se o tema/plugin usa CSS vars próprias que interferem com `--acc-color-*`, adicionar fallback no CSS:

```css
#barra-acessibilidade {
    --acc-color-contrast: var(--tema-color-text, #111827);
}
```

### Monitoramento de Erros (WP_DEBUG)

```
WP_DEBUG = true
WP_DEBUG_LOG = true
WP_DEBUG_DISPLAY = false

→ wp-content/debug.log
   [Acessibilidade Completa Updater] Erro ao consultar GitHub API: ...
   [Acessibilidade Completa Updater] Release v4.0.0-beta é prerelease — ignorando.
   [Acessibilidade Completa Updater] Update disponível: 3.9.1 → 4.0.0
```

### Atualizar Compatibilidade WordPress/PHP

1. Testar em PHP 7.4, 8.0, 8.1, 8.2
2. Atualizar `Requires at least` e `Requires PHP` no cabeçalho
3. Verificar `get_bloginfo('version')` nos headers do updater
4. Testar com WP 5.9 (mínimo) e versão atual
