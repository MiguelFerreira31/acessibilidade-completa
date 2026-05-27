# ARQUITETURA FUTURA — Acessibilidade Completa

> Documento de referência para decisões de arquitetura em versões futuras (v4.x+).
> Não é um roadmap de datas — é um guia técnico para evitar débito arquitetural.

---

## 1. Página de Configurações no Admin (v4.1)

### Problema atual
- `ACC_GITHUB_USER` e `ACC_GITHUB_REPO` estão hardcoded como constantes PHP.
- O TTL do cache e seletores extras são configuráveis via `add_filter()`, mas sem UI.
- Não há forma visual de monitorar o estado do updater (última verificação, versão detectada).

### Proposta

```
wp-admin/
  Plugins > Configurações > Acessibilidade Completa
    ├── Aba: Geral
    │     • Posição do botão (top %, right/left)
    │     • Funcionalidades habilitadas por padrão
    │     • Seletores CSS extras (textarea)
    ├── Aba: Auto-Update
    │     • GitHub User (text input)
    │     • GitHub Repo (text input)
    │     • TTL do cache (número, horas)
    │     • Token de autenticação GitHub (para evitar rate-limit 60 req/h)
    │     • Status: última verificação, versão remota detectada
    └── Aba: Debug
          • Estado atual do ColorManager (tabela de contrastes)
          • Dump do localStorage do usuário atual (via AJAX)
```

### Implementação recomendada
- Usar `register_setting()` + `add_settings_section()` + `add_settings_field()` (WP Settings API).
- Opções armazenadas em `wp_options` sob `acc_options` (array serializado).
- Filtros `acc_*` continuam funcionando mas leem de `get_option('acc_options')` como fallback.
- Página registrada em `admin_menu` com capability `manage_options`.

### Impacto em arquivos
- Novo arquivo: `includes/class-settings.php` (Settings API handler)
- Modificar: `acessibilidade-completa.php` (registrar a instância de settings)
- Modificar: `class-github-updater.php` (ler token GitHub de `get_option`)
- Modificar: `class-plugin.php` (ler posição do botão de `get_option`)

---

## 2. Modelo FREE vs PRO (v4.2+)

### Razão arquitetural
O plugin atual é monolítico. Para monetização sem violar a GPL, a arquitetura ideal é:

```
acessibilidade-completa/        ← Gratuito (GPL, WP.org)
  features/
    ├── typography.js            ← Fonte, linha, letra
    ├── contrast.js              ← Contraste, saturação, daltonismo
    ├── navigation.js            ← Lupa, máscara, guia, cursor
    └── vlibras.js               ← VLibras LIBRAS

acessibilidade-completa-pro/    ← PRO (GPL ou comercial, não no WP.org)
  features/
    ├── tts.js                   ← Text-to-Speech (Web Speech API)
    ├── keyboard-nav.js          ← Navegação apenas teclado aprimorada
    ├── pdf-export.js            ← Exportar configurações como PDF
    ├── analytics.js             ← Relatório de funcionalidades mais usadas
    └── white-label.js           ← Remove branding, customiza logo/cores
```

### Como a versão PRO se integra sem modificar o core
O plugin PRO usa os filtros públicos do FREE:

```php
// No plugin PRO
add_filter( 'acc_text_selectors', fn($s) => $s . ',.custom-pro-selector' );
add_filter( 'acc_default_features', fn($f) => array_merge( $f, ['tts'] ) );
add_action( 'acc_after_panel_render', 'acc_pro_render_tts_section' );
```

### Hooks adicionais necessários no FREE para suportar o PRO
Esses hooks precisam ser adicionados ao `class-plugin.php` v4.2+:

```php
// render_widget() deve adicionar:
echo apply_filters( 'acc_after_panel_content', '' );          // Seções extras
echo apply_filters( 'acc_before_panel_footer', '' );         // Antes do footer
echo apply_filters( 'acc_trigger_html', $default_trigger );  // Substituir botão
```

---

## 3. Suporte a Multisite (v4.3)

### Estado atual
- O `uninstall.php` já limpa `$wpdb->sitemeta` em rede.
- O updater usa `get_plugin_data()` que funciona em multisite.
- Não há lógica de "ativar para toda a rede" (network activation).

### O que precisa mudar para suporte completo a multisite

| Cenário | Comportamento atual | Comportamento desejado |
|---|---|---|
| Ativação em rede | Plugin não suporta | Registrar settings em `wp_sitemeta` |
| Config por site | Todos usam `acc_options` global | Config por blog via `get_blog_option()` |
| Cache updater | Por site (transient normal) | Por rede (site_transient) para evitar N chamadas à API |
| Deactivation hook | Por site | Por rede quando network-activated |

### Implementação
- `register_activation_hook()` → checar `is_network_admin()` e usar `add_site_option()`.
- Cache do updater → `set_site_transient()` quando network-activated.
- Settings → instância separada de `class-settings.php` para nível de rede.

---

## 4. Migração para ES Modules (v5.0+)

### Estado atual
O JavaScript usa uma IIFE `(function($){ ... })(jQuery)` por:
1. Compatibilidade com WordPress que enfileira scripts sem `type=module`.
2. Acesso ao jQuery enfileirado globalmente.
3. Suporte a IE11 (progressivamente descartado pelo WP core).

### Caminho de migração

**Fase A — Bundler sem quebrar compatibilidade**
- Adicionar `package.json` com `@wordpress/scripts` (webpack pré-configurado).
- Converter cada módulo lógico para um arquivo ES module:
  ```
  src/
    ColorManager.js
    FontScaler.js
    ContrastManager.js
    MutationWatcher.js
    PublicAPI.js
    index.js          ← entry point, exporta window.ACC
  ```
- O bundler gera `assets/acessibilidade.js` (IIFE para compatibilidade).
- `@wordpress/scripts` cuida de `wp_register_script_module()` quando disponível.

**Fase B — Dependência explícita do jQuery**
- Migrar de `jQuery(document).on(...)` para `document.addEventListener(...)`.
- O plugin já usa `document.addEventListener` para mousemove (passivo).
- Eliminaria a dependência de jQuery, reduzindo o peso total.

**Fase C — type=module nativo (WP 6.5+)**
- WordPress 6.5 introduziu `wp_register_script_module()`.
- Substituir `wp_enqueue_script()` por `wp_enqueue_script_module()` no `class-plugin.php`.
- Modules têm `defer` implícito e `strict mode` nativo.

---

## 5. Sistema de Testes Automatizados

### Prioridades de teste

**PHPUnit (unit)**
- `AcessibilidadeCompleta_GitHub_Updater::normalize_version()` — edge cases de tag_name
- `AcessibilidadeCompleta_GitHub_Updater::get_download_url()` — validação de domínio
- `AcessibilidadeCompleta_Plugin::enqueue_assets()` — verifica handles enfileirados

**Jest (unit/integration)**
- `ColorManager._contrast()` — validação matemática WCAG
- `ColorManager._makeSafe()` — garantia de convergência do algoritmo HSL
- `Acessibilidade.loadPreferences()` — validação de schema com payloads maliciosos
- `Acessibilidade._scaleFonts()` — cache build/reset cycle

**Playwright/Cypress (E2E)**
- Ativar alto contraste → verificar que texto ficou branco sobre fundo preto
- Escalar fonte para +50% → verificar que textos Elementor foram escalados
- Reload → verificar persistência das preferências
- Focus trap → Tab dentro do painel não sai para o resto da página
- Mobile (375px) → painel abre como bottom-sheet

### Estrutura de pastas proposta
```
tests/
  php/
    UpdaterTest.php
    PluginTest.php
  js/
    ColorManager.test.js
    FontScaler.test.js
    LoadPreferences.test.js
  e2e/
    contrast.spec.js
    font-scale.spec.js
    persistence.spec.js
    mobile.spec.js
```

---

## 6. Token de Autenticação GitHub (v4.1)

### Problema
- GitHub API: 60 requests/hora sem autenticação (por IP).
- Sites com múltiplos plugins usando a API do GitHub podem esgotar o limite.
- Com token pessoal (PAT): 5000 requests/hora.

### Implementação
```php
// Na página de settings (v4.1)
$token = get_option( 'acc_github_token', '' );

// No wp_remote_get() do updater
$headers = array(
    'Accept'     => 'application/vnd.github+json',
    'User-Agent' => 'WordPress/...',
);
if ( ! empty( $token ) ) {
    $headers['Authorization'] = 'Bearer ' . $token;
}
```

**Segurança:**
- Token armazenado via `update_option()` (criptografado pelo WP se usando object cache com serialização segura).
- Campo exibido como `<input type="password">` na settings page.
- Nunca exposto no frontend (PHP-only).
- Documentar que o token precisa apenas do scope `public_repo` (read-only).

---

## 7. Refatoração de `render_widget()` (v4.0)

### Estado atual
`render_widget()` em `class-plugin.php` tem ~380 linhas de HTML PHP inline.
Isso dificulta testes, tradução e manutenção.

### Proposta: Template Files
```
templates/
  widget-bar.php          ← #barra-acessibilidade completo
  section-typography.php  ← Seção tipografia
  section-vision.php      ← Seção visão & cores
  section-navigation.php  ← Seção navegação
  overlays.php            ← Lupa, máscara, guia, SVG filters
  announcer.php           ← ARIA live region
```

```php
// class-plugin.php
public function render_widget() {
    /**
     * Filtro: acc_trigger_html
     * Substitui o HTML completo do botão trigger por uma versão personalizada.
     *
     * @param string $html  HTML padrão do botão.
     */
    $trigger_html = apply_filters( 'acc_trigger_html', $this->_render_default_trigger() );

    include ACC_PLUGIN_DIR . 'templates/overlays.php';
    include ACC_PLUGIN_DIR . 'templates/widget-bar.php';
    include ACC_PLUGIN_DIR . 'templates/announcer.php';
}
```

### Benefícios
- Temas/plugins podem substituir `templates/section-typography.php` via filtro.
- Testes E2E podem incluir templates isolados sem instanciar o plugin completo.
- Templates são mais simples de traduzir (apenas strings PHP puras, sem HTML complexo).

---

## Sumário de Filtros Públicos Planejados

| Filtro | Versão | Descrição |
|---|---|---|
| `acc_text_selectors` | ✅ 3.9.1 | Seletores CSS para escalamento de fonte |
| `acc_updater_cache_ttl` | ✅ 3.9.1 | TTL do cache do updater em segundos |
| `acc_button_position` | 🚧 4.1 | Posição vertical do botão toggle |
| `acc_default_features` | 🚧 4.1 | Features ativas por padrão |
| `acc_trigger_html` | 🚧 4.0 | HTML completo do botão de abertura |
| `acc_after_panel_content` | 🚧 4.2 | Injeção de seções extras no painel (PRO) |
| `acc_before_panel_footer` | 🚧 4.2 | Injeção antes do footer do painel |

---

*Última atualização: 2026-05-27 — Miguel Ferreira*
