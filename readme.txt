=== Acessibilidade Completa ===
Contributors: miguelferreira31
Tags: accessibility, wcag, acessibilidade, elementor, vlibras, contrast, font-size, dyslexia, colorblind, screen-reader
Requires at least: 5.9
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 3.9.1
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Plugin WordPress de acessibilidade WCAG 2.1 AA/AAA com barra lateral flutuante, suporte nativo ao Elementor e WooCommerce.

== Description ==

**Acessibilidade Completa** adiciona uma barra lateral flutuante com ferramentas completas de acessibilidade, projetada especificamente para funcionar com o Elementor e temas que definem estilos em `px` fixo.

Diferente de soluções genéricas que apenas alteram o `font-size` do `<html>`, este plugin usa `window.getComputedStyle` para capturar o tamanho real de cada elemento — independente de qual unidade CSS o tema usa — e um cache incremental para garantir que a escala seja rápida em páginas com centenas de elementos.

= Funcionalidades =

**Tipografia**

* Tamanho de Fonte — 5 níveis: −10%, Normal, +10%, +25%, +50%
* Fonte para Dislexia — OpenDyslexic com espaçamento especial
* Espaço entre Linhas — Normal / Médio (1.9) / Amplo (2.5)
* Espaço entre Letras — Normal / Médio (0.08em) / Amplo (0.18em)

**Visão & Cores**

* Contraste — Normal / Alto (preto e branco) / Invertido
* Saturação — Normal / Escala de Cinza / Sépia
* Simulação de Daltonismo — Protanopia, Deuteranopia, Tritanopia via SVG feColorMatrix

**Navegação**

* Cursor Grande — Cursor SVG personalizado 64×64px
* Lupa de Navegação — Bubble com texto ampliado ao passar o mouse
* Máscara de Leitura — Escurece a tela, destaca linha de leitura
* Guia de Leitura — Linha horizontal que segue o cursor
* Destaque de Links — Borda + background em todos os links

**Conformidade e Extras**

* VLibras — Interpretação em Língua de Sinais Brasileira (LIBRAS)
* Focus Trap — WCAG 2.1 SC 2.1.2 Level A
* ARIA Live Region — WCAG SC 4.1.3 Level AA (polite, feedback de ação)
* ColorManager — Auto-correção WCAG AAA das cores da barra (7:1 contraste mínimo)
* Persistência — Preferências salvas em `localStorage`
* API Pública — `window.ACC` para integrações externas
* Auto-Update — Atualizações automáticas via GitHub Releases

= Como Funciona =

O escalamento de fonte usa `window.getComputedStyle(el).fontSize` para capturar o tamanho real em px de cada elemento. Na primeira ativação, o DOM é varrido uma única vez e o resultado é armazenado em cache. Cliques subsequentes nos controles de fonte iteram sobre o cache sem nenhum `querySelectorAll`.

O alto contraste usa `el.style.setProperty(..., 'important')` para superar inline styles com `!important` do Elementor — algo que CSS externo não consegue fazer.

O ColorManager detecta automaticamente se o tema usa cores claras, pastéis ou com baixo contraste e ajusta as variáveis CSS da barra para garantir conformidade WCAG AAA.

= Suporte a Elementor e WooCommerce =

Elementor e WooCommerce são suportados nativamente mas **não obrigatórios**. O plugin funciona com qualquer tema WordPress.

== Installation ==

= Via GitHub (recomendado — habilita atualizações automáticas) =

1. Acesse [Releases](https://github.com/MiguelFerreira31/acessibilidade-completa/releases)
2. Baixe o arquivo `.zip` da versão mais recente
3. No painel WordPress: **Plugins → Adicionar Novo → Enviar Plugin**
4. Faça upload do `.zip` e ative o plugin

= Manual (FTP/SSH) =

1. Copie a pasta `acessibilidade-completa` para `wp-content/plugins/`
2. Ative em **Plugins → Plugins Instalados**

== Frequently Asked Questions ==

= O plugin funciona com o Elementor? =

Sim. O plugin foi especificamente projetado para funcionar com o Elementor, que define font-sizes em px fixo e usa inline styles com !important. O plugin usa JavaScript para superar essas limitações de forma confiável.

= O plugin funciona com o WooCommerce? =

Sim. Seletores específicos do WooCommerce são incluídos para produtos, carrinho, checkout e mensagens de status.

= O plugin é compatível com o WordPress em modo bloco (FSE)? =

Sim. As variáveis CSS do plugin se integram com `theme.json` e Elementor Global Colors automaticamente.

= Como forçar a verificação de updates? =

Acesse a página de atualizações do WordPress e adicione `?force-check=1` à URL.

= Como adicionar seletores CSS extras para escalamento de fonte? =

Use o filtro `acc_text_selectors` no seu `functions.php`:

`add_filter( 'acc_text_selectors', function( $sel ) {
    return $sel . ',.meu-widget-title,.minha-classe';
} );`

= Como ajustar o intervalo de verificação de updates? =

Use o filtro `acc_updater_cache_ttl`:

`add_filter( 'acc_updater_cache_ttl', fn() => 3600 ); // 1 hora`

= O plugin viola a política de privacidade do usuário ao salvar preferências? =

O plugin salva preferências de acessibilidade em `localStorage` do navegador (não em cookies rastreáveis e não enviados ao servidor). Este dado é técnico/funcional e geralmente não requer consentimento sob LGPD/GDPR. Consulte seu DPO para confirmar conforme o contexto do seu site.

== Screenshots ==

1. Barra de acessibilidade fechada — botão toggle na lateral direita
2. Painel de acessibilidade aberto — seção Tipografia
3. Painel de acessibilidade aberto — seção Visão & Cores e Navegação
4. Alto contraste ativado em página Elementor
5. Fonte dislexia (OpenDyslexic) ativada

== Changelog ==

= 3.9.1 =
* Auditoria de segurança: validação de domínio em URLs de download do Updater
* Auditoria JS: validação estrita de schema no loadPreferences (anti prototype-pollution)
* Performance: event listeners passivos ({ passive: true }) para mousemove
* WCAG: aria-live="polite" para anunciador de ações (WCAG SC 4.1.3)
* WP Standards: Tested up to 6.7, load_plugin_textdomain, activation/deactivation hooks
* CSS: touch targets mínimos 44px (WCAG 2.2 SC 2.5.5), iOS safe area, dark mode fallback
* CSS: variáveis --acc-z-index-* para z-index hierarquizado e documentado
* API: filtros acc_text_selectors e acc_updater_cache_ttl para extensibilidade
* UI: botão toggle fica sem texto (apenas ícone) em todas as resoluções
* UI: botão mantém posição top: 5% / right: 0 em mobile sem mover para bottom

= 3.9.0 =
* Phase 2 — Performance: cache _fontEls[], MutationObserver incremental, batch ColorManager
* Phase 1 — WCAG: Focus Trap (SC 2.1.2), ARIA live region (SC 4.1.3), window.ACC API
* ColorManager: auto-correção WCAG AAA das cores da barra de acessibilidade
* Filtros visuais em `<html>` (não `<body>`) para cobertura de position:fixed
* Alto contraste via JS setProperty supera inline !important do Elementor
* WooCommerce: seletores de produto, carrinho e checkout adicionados
* VLibras: polling com timeout de 10s, sem quebrar em falha de carregamento

= 3.8.0 =
* Sistema de auto-update via GitHub Releases
* Suporte a Elementor Global Colors no ColorManager

= 3.7.0 =
* Simulação de daltonismo via feColorMatrix SVG
* Lupa de navegação com bubble de texto ampliado
* Máscara de leitura e guia de leitura

== Upgrade Notice ==

= 3.9.1 =
Auditoria de segurança e WCAG. Recomendamos atualizar para todos os usuários.
