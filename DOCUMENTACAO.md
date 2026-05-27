# Documentação Técnica — Acessibilidade Completa

> Referência técnica completa para desenvolvedores e mantenedores do plugin.

---

## Índice

1. [Arquitetura Geral](#1-arquitetura-geral)
2. [Estrutura de Pastas](#2-estrutura-de-pastas)
3. [Arquivo Principal — Loader](#3-arquivo-principal--loader)
4. [Classe Principal — AcessibilidadeCompleta_Plugin](#4-classe-principal--acessibilidadecompleta_plugin)
5. [Sistema de Auto-Update — AcessibilidadeCompleta_GitHub_Updater](#5-sistema-de-auto-update)
6. [JavaScript — acessibilidade.js](#6-javascript--acessibilidadejs)
7. [CSS — acessibilidade.css](#7-css--acessibilidadecss)
8. [Hooks e Filtros WordPress](#8-hooks-e-filtros-wordpress)
9. [Persistência de Preferências](#9-persistência-de-preferências)
10. [Integração com Elementor](#10-integração-com-elementor)
11. [Segurança e Sanitização](#11-segurança-e-sanitização)
12. [Internacionalização (i18n)](#12-internacionalização-i18n)
13. [Sistema de Auto-Update — Fluxo Completo](#13-fluxo-completo-do-auto-update)
14. [Boas Práticas Aplicadas](#14-boas-práticas-aplicadas)
15. [Guia de Manutenção Futura](#15-guia-de-manutenção-futura)

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
│ • enqueue JS   │        │ • WP Transient cache     │
│ • render HTML  │        │ • Inject update data     │
└───────┬────────┘        └──────────────────────────┘
        │
        ▼
┌───────────────────────────┐
│       CAMADA DE FRONTEND  │
│  acessibilidade.js (IIFE) │
│  acessibilidade.css       │
│                           │
│ • Estado da aplicação     │
│ • _scaleFonts()           │
│ • VLibras init            │
│ • localStorage prefs      │
└───────────────────────────┘
```

### Padrões de Design Utilizados
- **Singleton** — `AcessibilidadeCompleta_Plugin::get_instance()` garante uma instância
- **Module Pattern** — JavaScript encapsulado em IIFE `(function($){...})(jQuery)`
- **Observer** — Sistema de hooks do WordPress (filtros e actions)
- **Strategy** — `_scaleFonts()` usa estratégia diferente para reset vs. escala

---

## 2. Estrutura de Pastas

```
acessibilidade-completa/
│
├── acessibilidade-completa.php   ← LOADER: cabeçalho do plugin, constantes, bootstrap
│
├── includes/
│   ├── class-plugin.php          ← Classe principal (Singleton): assets + HTML
│   └── class-github-updater.php  ← Auto-update via GitHub Releases API
│
├── assets/
│   ├── acessibilidade.css        ← Estilos do widget (barra lateral + modos)
│   └── acessibilidade.js         ← Lógica de acessibilidade (IIFE + jQuery)
│
├── .gitignore                    ← Exclui temporários, OS files, claude.md
├── CHANGELOG.md                  ← Histórico de versões (Keep a Changelog)
├── README.md                     ← Documentação de usuário
└── DOCUMENTACAO.md               ← Esta documentação técnica
```

---

## 3. Arquivo Principal — Loader

**Arquivo:** `acessibilidade-completa.php`

### Responsabilidades
- Contém o cabeçalho do plugin (Plugin Name, Version, etc.)
- Define constantes globais com prefixo `ACC_`
- Carrega os arquivos de includes
- Faz o bootstrap via hook `plugins_loaded`

### Constantes Definidas

| Constante | Valor | Descrição |
|---|---|---|
| `ACC_VERSION` | `'3.8.0'` | Versão atual do plugin |
| `ACC_PLUGIN_FILE` | `__FILE__` | Caminho absoluto ao arquivo principal |
| `ACC_PLUGIN_DIR` | `plugin_dir_path(__FILE__)` | Diretório com trailing slash |
| `ACC_PLUGIN_URL` | `plugin_dir_url(__FILE__)` | URL pública com trailing slash |
| `ACC_PLUGIN_SLUG` | `plugin_basename(__FILE__)` | `pasta/arquivo.php` |
| `ACC_GITHUB_USER` | `'MiguelFerreira31'` | ⚠️ Alterar antes do deploy |
| `ACC_GITHUB_REPO` | `'acessibilidade-completa'` | ⚠️ Alterar antes do deploy |

### Hook de Bootstrap

```php
add_action( 'plugins_loaded', static function () {
    AcessibilidadeCompleta_Plugin::get_instance();
    new AcessibilidadeCompleta_GitHub_Updater( ... );
} );
```

O uso de `plugins_loaded` garante que o WordPress e todos os outros plugins
estejam carregados antes da inicialização, evitando conflitos de dependência.

---

## 4. Classe Principal — AcessibilidadeCompleta_Plugin

**Arquivo:** `includes/class-plugin.php`

### Métodos

#### `get_instance(): AcessibilidadeCompleta_Plugin`
Retorna a instância singleton. Cria na primeira chamada.

#### `init_hooks(): void`
Registra:
- `wp_enqueue_scripts` → `enqueue_assets()`
- `wp_footer` (prioridade 5) → `render_widget()`

#### `enqueue_assets(): void`
Scripts enfileirados:

| Handle | Tipo | Posição | Dependências |
|---|---|---|---|
| `vlibras` | JS externo (CDN) | `<head>` | — |
| `open-dyslexic` | CSS externo (CDN) | `<head>` | — |
| `acessibilidade-css` | CSS local | `<head>` | `open-dyslexic` |
| `acessibilidade-js` | JS local | `<footer>` | `jquery` |

#### `render_widget(): void`
Insere no footer (prioridade 5):
1. Filtros SVG para daltonismo (invisíveis)
2. Bubble da lupa de navegação
3. Overlays da máscara de leitura (top e bottom)
4. Guia de leitura
5. Widget VLibras
6. Barra de acessibilidade completa com painel

Todas as strings usam `esc_html_e()` e `esc_attr_e()` para internacionalização e segurança.

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
| `$transient_key` | string | `acc_gh_upd_` + md5 truncado |
| `$transient_ttl` | int | `12 * HOUR_IN_SECONDS` (43200s) |

### Métodos Públicos (Hooks)

#### `check_for_update($transient)`
**Hook:** `pre_set_site_transient_update_plugins`

Consulta a API do GitHub, compara versões e injeta dados de update no
`$transient->response[$plugin_slug]` quando `latest > current`.

#### `plugin_popup($result, $action, $args)`
**Hook:** `plugins_api` (prioridade 10)

Fornece o objeto de detalhes para o modal "Ver detalhes" no admin.
Popula `name`, `version`, `author`, `sections.description`, `sections.changelog`.

#### `after_install($response, $hook_extra, $result)`
**Hook:** `upgrader_post_install` (prioridade 10)

Após instalação do ZIP:
1. Renomeia pasta extraída (formato `user-repo-hash`) para o nome correto
2. Reativa o plugin se estava ativo
3. Invalida o transient de cache
4. Reseta propriedades em memória

#### `purge_cache_maybe()`
**Hook:** `admin_init`

Invalida o transient quando o admin acessa com `?force-check=1`.

### Métodos Privados

#### `get_github_release(): object|false`
1. Verifica cache em memória (`$this->github_response`)
2. Verifica WP Transient
3. Consulta `GET /repos/{user}/{repo}/releases/latest`
4. Valida resposta HTTP 200 e JSON válido
5. Salva no transient

#### `get_download_url($release): string|false`
Prioridade:
1. Asset com extensão `.zip` entre `$release->assets`
2. `$release->zipball_url` (fallback automático do GitHub)

#### `normalize_version($tag): string`
Remove prefixo `v` ou `V`: `'v3.9.0'` → `'3.9.0'`

#### `log($message): void`
Registra em `error_log()` apenas quando `WP_DEBUG === true`.

---

## 6. JavaScript — acessibilidade.js

**Padrão:** IIFE com jQuery (`(function($){ ... })(jQuery)`)

### Constantes

| Constante | Valor | Descrição |
|---|---|---|
| `FONT_LEVELS` | `{'-1': {...}, '0': {...}, ...}` | Labels e tamanhos demo por nível |
| `FONT_SCALES` | `{'-1': 0.90, '0': 1.00, ...}` | Fatores multiplicadores por nível |
| `FONT_MIN` | `-1` | Nível mínimo permitido |
| `FONT_MAX` | `3` | Nível máximo permitido |
| `ACC_FS_ATTR` | `'data-acc-orig-fs'` | Atributo HTML para font-size original |
| `ACC_TEXT_SEL` | String CSS | Seletor abrangente de elementos de texto |
| `ACC_ICON_RE` | RegExp | Identifica classes de ícones |
| `SEMANTIC_TAGS` | Array de strings | Tags para lupa de navegação |
| `MASCARA_BANDA` | `90` (px) | Metade da banda da máscara de leitura |

### Objeto `Acessibilidade`

#### Estado (`estado`)

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

#### Métodos Principais

| Método | Responsabilidade |
|---|---|
| `init()` | Bootstrap: VLibras + eventos + prefs |
| `initVLibras()` | Polling de 500ms (até 20 tentativas = 10s) |
| `bindEvents()` | Registra todos os event listeners |
| `aplicarAcao(acao)` | Despacha ação pelo prefixo do data-acao |
| `aplicarFontLevel(level)` | Orquestra escala + UI update |
| `_shouldSkipEl(el)` | Filtro de elementos a não escalar |
| `_scaleFonts(scale)` | **Núcleo do escalamento** |
| `aplicarContraste(modo)` | Classes + composeBodyFilter |
| `composeBodyFilter()` | Compõe filtro CSS do body |
| `aplicarLinha/Letra(nivel)` | Classes de espaçamento |
| `aplicarDislexia(ativo)` | Classe + aria-checked |
| `aplicarLupa(ativo)` | mousemove listener |
| `aplicarMascara(ativo)` | Overlay + mousemove handler |
| `aplicarGuia(ativo)` | Linha guia + mousemove handler |
| `aplicarLinksDestacados(ativo)` | Classe body + aria-checked |
| `resetTudo()` | Remove tudo e restaura padrão |
| `savePreferences()` | `localStorage.setItem(JSON)` |
| `loadPreferences()` | `localStorage.getItem` + migration |
| `aplicarTudoDoEstado()` | Reconstrói estado salvo |
| `marcarBotoesAtivos()` | Sincroniza UI com estado |

### `_scaleFonts(scale)` — Algoritmo Detalhado

```
Para cada elemento em querySelectorAll(ACC_TEXT_SEL):
  ├── _shouldSkipEl(el)?  → skip
  ├── scale === 1?
  │   └── el.style.removeProperty('font-size')  ← restaura
  └── scale !== 1?
      ├── tem data-acc-orig-fs?
      │   └── origPx = parseFloat(atributo)
      └── não tem?
          ├── origPx = parseFloat(getComputedStyle(el).fontSize)
          └── setAttribute('data-acc-orig-fs', origPx.toFixed(3))
      └── el.style.setProperty('font-size', origPx*scale+'px', 'important')
```

### `_shouldSkipEl(el)` — Critérios de Exclusão

1. Tag é: `SCRIPT`, `STYLE`, `NOSCRIPT`, `META`, `LINK`, `HEAD`, `HTML`, `BODY`, `SVG`, ou qualquer elemento SVG
2. `el.closest('#barra-acessibilidade')` retorna elemento (está dentro da barra)
3. `el.closest('[vw]')` retorna elemento (está dentro do VLibras)
4. `el.closest('svg')` retorna elemento (descendente de SVG)
5. `el.className` bate com `ACC_ICON_RE` (ícone de fonte)

### Event Listeners Registrados

| Seletor | Evento | Handler |
|---|---|---|
| `#toggle-acessibilidade` | click | Abre/fecha painel |
| `#fechar-painel` | click | Fecha painel |
| `#btn-fonte-inc` | click | `fontLevel++` |
| `#btn-fonte-dec` | click | `fontLevel--` |
| `.btn-acessibilidade` (delegado) | click | `aplicarAcao()` |
| `#toggle-dislexia` (delegado) | click | Toggle dislexia |
| `#toggle-lupa` (delegado) | click | Toggle lupa |
| `#toggle-links` (delegado) | click | Toggle links |
| `#toggle-mascara` (delegado) | click | Toggle máscara |
| `#toggle-guia` (delegado) | click | Toggle guia |
| `.btn-reset` (delegado) | click | `resetTudo()` |
| `document` | click | Fecha painel ao clicar fora |
| `document` | keydown | ESC fecha painel |

---

## 7. CSS — acessibilidade.css

### Arquitetura de Variáveis

Todas as variáveis CSS são definidas em `#barra-acessibilidade` com cascade fallback:

```
Elementor Global Colors (--e-global-color-*)
    ↓ fallback
WordPress theme.json (--wp--preset--color-*)
    ↓ fallback
Hardcoded (ex: #1a5276)
```

### Variáveis Internas (prefixo `--acc-`)

| Variável | Origem prioritária |
|---|---|
| `--acc-color-primary` | `--e-global-color-primary` |
| `--acc-color-secondary` | `--e-global-color-secondary` |
| `--acc-color-base` | `--e-global-color-base` |
| `--acc-color-contrast` | `--e-global-color-text` |
| `--acc-font-family` | `--e-global-typography-text-font-family` |

### Modos de Acessibilidade

| Classe no `<body>` | Efeito |
|---|---|
| `fonte-dislexia` | `font-family: OpenDyslexic !important` em `*` |
| `linha-media` | `line-height: 1.9 !important` em `*` |
| `linha-ampla` | `line-height: 2.5 !important` em `*` |
| `letra-media` | `letter-spacing: 0.08em !important` em `*` |
| `letra-ampla` | `letter-spacing: 0.18em !important` em `*` |
| `contraste-alto` | `background: #000; color: #fff` em `*` |
| `cursor-grande` | Cursor SVG 64×64px via `cursor: url(...)` |
| `links-destacados` | Outline + underline + background em todos os `a` |

Todos os seletores usam `:not(#barra-acessibilidade)` e `:not([vw])` para
isolar a UI do plugin dos modos que afetam o site.

### Seção de Isolamento da Barra

Após cada modo aplicado ao site, há overrides específicos para `#barra-acessibilidade`
que restauram o visual original da barra (ex: contraste alto não interfere nos botões).

---

## 8. Hooks e Filtros WordPress

### Actions Usadas

| Hook | Prioridade | Método | Descrição |
|---|---|---|---|
| `plugins_loaded` | default (10) | Bootstrap | Inicializa plugin + updater |
| `wp_enqueue_scripts` | default (10) | `enqueue_assets()` | Enfileira CSS/JS |
| `wp_footer` | **5** | `render_widget()` | Renderiza HTML no footer |
| `admin_init` | default (10) | `purge_cache_maybe()` | Purga cache de update |

### Filtros Usados

| Hook | Prioridade | Método | Descrição |
|---|---|---|---|
| `pre_set_site_transient_update_plugins` | default (10) | `check_for_update()` | Verifica update no GitHub |
| `plugins_api` | **10** | `plugin_popup()` | Info do plugin no admin |
| `upgrader_post_install` | **10** | `after_install()` | Pós-instalação do update |

---

## 9. Persistência de Preferências

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
        → localStorage.getItem('acessibilidade_prefs')
            → null: marcarBotoesAtivos() + aplicarFontLevel(0)
            → JSON com 'classes' (formato legado): _migrarPrefsLegadas() + salvar
            → JSON moderno: $.extend(estado, prefs) + aplicarTudoDoEstado()
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

## 10. Integração com Elementor

### Problema

O Elementor define `font-size` em `px` fixo em dois níveis:
1. **Folha de estilo**: `.elementor-heading-title { font-size: 48px; }`
2. **Inline style**: `<h2 style="font-size: 36px;">` (CSS customizado do widget)

Alterar `html { font-size: 110% }` não afeta valores em `px`.

### Solução

```javascript
// 1. Lê o valor computado (sempre em px, independente da unidade CSS)
var origPx = parseFloat(window.getComputedStyle(el).fontSize);

// 2. Aplica como inline style com !important
// Inline style com !important supera qualquer rule externa
el.style.setProperty('font-size', (origPx * 1.1).toFixed(2) + 'px', 'important');
```

### Seletores Elementor no `ACC_TEXT_SEL`

- `.elementor-heading-title` — Títulos de widgets Heading
- `.elementor-button-text` — Texto de botões
- `.elementor-icon-box-title`, `.elementor-icon-box-description` — Icon Box
- `.elementor-image-box-title`, `.elementor-image-box-description` — Image Box
- `.elementor-testimonial__content`, `.elementor-testimonial__name` — Testimonial
- `.elementor-tab-title` — Accordion / Tabs
- `.elementor-price-table__heading`, `.elementor-price-table__subheading` — Price Table
- `.elementor-countdown__label` — Countdown
- `.elementor-alert__title`, `.elementor-alert__description` — Alert
- `.elementor-nav-menu a` — Menu de navegação

---

## 11. Segurança e Sanitização

### PHP

| Dado | Tratamento |
|---|---|
| `$github_user` | `sanitize_text_field()` no construtor |
| `$github_repo` | `sanitize_text_field()` no construtor |
| HTML de output | `esc_html_e()` e `esc_attr_e()` em toda a view |
| Acesso a admin | `current_user_can('update_plugins')` no purge cache |
| URLs da API | `rawurlencode()` nos parâmetros da URL |
| Resposta da API | `json_decode()` + validação de `is_object()` |
| Requisições HTTP | `wp_remote_get()` com `sslverify: true` |

### JavaScript

| Dado | Tratamento |
|---|---|
| Texto da lupa | `.text()` (jQuery) — escapa HTML automaticamente |
| localStorage | `JSON.parse` em try/catch |
| `getComputedStyle` | Guard para NaN: `origPx !== origPx` |
| Event listeners | Delegação via `$(document).on(...)` |

---

## 12. Internacionalização (i18n)

**Text Domain:** `acessibilidade-completa`  
**Domain Path:** `/languages`

### Funções Utilizadas

- `esc_html_e( 'string', 'acessibilidade-completa' )` — output escapado e traduzido
- `esc_attr_e( 'string', 'acessibilidade-completa' )` — atributo escapado e traduzido
- `__( 'string', 'acessibilidade-completa' )` — retorna string traduzida

### Para Adicionar Tradução

1. Execute `wp i18n make-pot . languages/acessibilidade-completa.pot`
2. Crie `languages/acessibilidade-completa-pt_BR.po`
3. Compile: `msgfmt acessibilidade-completa-pt_BR.po -o acessibilidade-completa-pt_BR.mo`

---

## 13. Fluxo Completo do Auto-Update

```
Instalação inicial
    → PHP define ACC_GITHUB_USER + ACC_GITHUB_REPO
    → new GitHub_Updater(plugin_file, user, repo)

Verificação de update (WordPress)
    → WP checa atualizações
    → Hook pre_set_site_transient_update_plugins dispara
    → check_for_update():
        1. get_github_release()
           ├── Cache em memória? → retorna
           ├── WP Transient (12h)? → retorna
           └── wp_remote_get(api.github.com/releases/latest)
               ├── Erro HTTP → log + retorna false
               └── Sucesso → json_decode + set_transient
        2. Compara versões: version_compare(current, latest, '<')
        3. Se update disponível:
           └── $transient->response[slug] = { package, new_version, ... }

Painel WordPress
    → "Atualizações disponíveis" aparece
    → "Ver detalhes" → plugin_popup() fornece changelog do GitHub

Instalação do update
    → WP baixa ZIP da URL (release asset ou zipball)
    → Extrai em /tmp/
    → after_install():
        1. Renomeia pasta extraída para nome correto
        2. Reativa plugin se estava ativo
        3. delete_transient(key) → força nova verificação
```

---

## 14. Boas Práticas Aplicadas

| Prática | Implementação |
|---|---|
| Sem conflitos globais | IIFE JavaScript; classe PHP com prefixo único |
| Singleton pattern | `get_instance()` previne múltiplas instâncias |
| Early return | `if (!ABSPATH) exit;` em todos os arquivos PHP |
| Escape de output | `esc_html_e()` / `esc_attr_e()` em todo HTML |
| Sanitização de input | `sanitize_text_field()` nos parâmetros do construtor |
| Cache de API | WP Transient de 12h + cache em memória |
| Logs apenas em debug | `if (WP_DEBUG)` antes de `error_log()` |
| sslverify ativo | `'sslverify' => true` em `wp_remote_get()` |
| Verificação de capacidade | `current_user_can('update_plugins')` |
| WCAG 2.1 AA | `aria-*`, `role`, `focus-visible`, motion reduce |
| Performance JS | `querySelectorAll` com seletor específico |
| Cleanup de eventos | `.off()` antes de novos listeners |

---

## 15. Guia de Manutenção Futura

### Publicar Nova Versão

```bash
# 1. Atualizar versão
#    - acessibilidade-completa.php: ACC_VERSION e cabeçalho 'Version:'
#    - CHANGELOG.md: nova entrada

# 2. Commitar
git add -A
git commit -m "chore(release): bump version to X.Y.Z"

# 3. Criar tag semântica
git tag vX.Y.Z
git push origin main --tags

# 4. Criar GitHub Release
#    - Título: "v X.Y.Z — Descrição breve"
#    - Body: copiar entrada do CHANGELOG.md
#    - Asset: fazer upload do ZIP do plugin
#    O WordPress detectará automaticamente via GitHub Updater
```

### Adicionar Nova Funcionalidade de Acessibilidade

1. **HTML** (`includes/class-plugin.php` → `render_widget()`): adicionar botão/toggle
2. **Estado JS** (`assets/acessibilidade.js` → `estado`): adicionar nova chave
3. **Evento JS** (`bindEvents()`): registrar click handler
4. **Método JS** (`aplicar*`): implementar lógica
5. **CSS** (`assets/acessibilidade.css`): adicionar estilos do modo + isolamento da barra
6. **Reset** (`resetTudo()`): incluir na restauração
7. **Persistência**: garantir que a chave está sendo salva/carregada

### Adicionar Suporte a Novo Tema/Plugin

1. Identificar seletores CSS do tema via DevTools
2. Adicionar ao `ACC_TEXT_SEL` em `acessibilidade.js`
3. Se necessário, adicionar isolamento em `acessibilidade.css`

### Atualizar Compatibilidade WordPress/PHP

1. Testar em PHP 7.4+ e PHP 8.x
2. Atualizar `Requires at least` e `Requires PHP` no cabeçalho
3. Testar com `WP_DEBUG = true` para capturar avisos

### Monitoramento de Erros

Com `WP_DEBUG = true` e `WP_DEBUG_LOG = true`, os erros do updater aparecem em:
```
wp-content/debug.log
```
Prefixo: `[Acessibilidade Completa Updater]`
