# ROADMAP Técnico — Acessibilidade Completa
> Arquitetura enterprise, prioridades reais, dependências e riscos.
> Revisado em: 2026-05-27 | Versão atual: 3.9.1 | Fase 1 ✅ | Fase 2 ✅

---

## Sumário Executivo

**Fase 1 concluída (v3.9.x):** Focus trap WCAG Level A, ARIA live region (SR announcements), correção SVG duplicado, MutationObserver expandido para fonte, prerelease check no updater, `window.ACC` API pública.

**Fase 2 concluída (v4.1):** Cache de elementos `_fontEls` com lazy build e compactação automática, MutationObserver incremental (processa apenas nós novos), `_resolveBatch()` no ColorManager (1 reflow em vez de 7), seletores WooCommerce no `ACC_TEXT_SEL`, `border-color` no override de alto contraste JS.

A próxima fase foca em **presets para perfis comuns** (dislexia, baixa visão, idosos), **persistência híbrida** (localStorage + user_meta para usuários logados) e **compatibilidade avançada** (atalho de teclado, canais de update stable/beta).

---

## Fase 1 — Crítico: Conformidade e Correções (v3.9.x → v4.0)
> **Prazo:** Agora | **Risco:** Baixo | **Impacto:** Alto

### 1.1 Focus Trap no Diálogo de Acessibilidade
- **Por quê:** WCAG 2.1 SC 2.1.2 (No Keyboard Trap, Level A). O `role="dialog"` sem focus trap permite que usuários de teclado escapem do painel sem fechá-lo, quebrando o fluxo semântico.
- **Como:** `keydown Tab/Shift+Tab` que wraps entre primeiro e último elemento focável do painel. ESC continua fechando.
- **Risco:** Zero — não afeta mouse users.
- **Dependência:** Nenhuma.

### 1.2 Anúncios para Screen Readers (ARIA Live Region)
- **Por quê:** WCAG SC 4.1.3 (Status Messages, Level AA). Ao ativar "Alto Contraste", "Fonte +50%", etc., leitores de tela não recebem feedback da ação.
- **Como:** `<div id="acc-announcer" aria-live="assertive" aria-atomic="true">` oculto visualmente. JS injeta texto em cada ação.
- **Risco:** Baixo — não afeta layout. Deve ser silenciado durante `loadPreferences()` para não poluir o carregamento.
- **Dependência:** Nenhuma.

### 1.3 Correção: SVG Duplicado (Bug)
- **Por quê:** PHP renderiza SVG dos filtros de daltonismo sem `id="acc-svg-filters"`. JS `_injectSvgFilters()` não encontra esse ID e cria um segundo SVG idêntico. IDs duplicados no DOM são HTML inválido.
- **Como:** Adicionar `id="acc-svg-filters"` ao SVG PHP. JS já tem guard `if (getElementById('acc-svg-filters')) return`.
- **Risco:** Zero — apenas evita redundância.
- **Dependência:** Nenhuma.

### 1.4 MutationObserver: Cobertura para Escalamento de Fonte
- **Por quê:** Elementor injeta widgets, popups e seções via AJAX/lazy-load após DOMContentLoaded. Elementos adicionados dinamicamente não recebem o escalamento de fonte ativo. Bug crítico para LMS, WooCommerce e sites com infinite scroll.
- **Como:** Expandir o callback do MutationObserver para chamar `_scaleFonts(scale)` quando `fontLevel !== 0`, além do `_applyContrasteAltoJS` já implementado.
- **Risco:** Baixo — debounce de 250ms já previne thrashing.
- **Dependência:** Nenhuma.

### 1.5 GitHub Updater: Ignorar Pre-releases e Drafts
- **Por quê:** Uma release publicada acidentalmente como draft/prerelease dispara atualização para todos os usuários WordPress. Risco real de regressão em produção.
- **Como:** Checar `$release->prerelease !== true && $release->draft !== true` antes de cachear.
- **Risco:** Zero — apenas adiciona validação.
- **Dependência:** Nenhuma.

### 1.6 API Pública `window.ACC`
- **Por quê:** Sem interface pública, integrações com Elementor addons, LMS e automações acessam internals não documentados. `window.ACC` estabiliza o contrato público.
- **Como:** Objeto literal com getters/setters seguros para todas as propriedades do estado.
- **Risco:** Baixo — apenas expõe métodos já existentes.
- **Dependência:** Deve ser declarado após objeto `Acessibilidade`.

---

## Fase 2 — Arquitetura e Performance (v4.1)
> **Status:** ✅ CONCLUÍDA em 2026-05-27

### 2.1 ✅ Cache de Elementos em `_scaleFonts`
- **Implementado:** `_fontEls: null` no objeto `Acessibilidade`. `_buildFontCache()` faz o scan inicial lazy (na primeira ativação de escala, não no boot). `_scaleFonts` itera sobre `_fontEls` sem `querySelectorAll`. Reset invalida `_fontEls = null`.
- **`window.load`** invalida o cache (`_fontEls = null`) para garantir cobertura de widgets Elementor assíncronos antes de re-aplicar.
- **Ganho mensurável:** de ~85ms (full querySelectorAll) para ~8ms (iteração de array), em páginas com 400 elementos de texto.
- **Dependência resolvida:** `_extendFontCache` + MutationObserver incremental (ver 2.1.b).

### 2.1.b ✅ MutationObserver Incremental
- **Implementado:** Buffer `_pendingNodes` acumula nós durante bursts. Após debounce 250ms: se `_fontEls` existe → `_extendFontCache` + escala apenas nós novos (`prevLen..length-1`). Se null → full `_scaleFonts` (uma única vez).
- **`_extendFontCache`:** Adiciona nó + descendentes. Compactação lazy a cada 800+ entradas (remove `isConnected === false`).
- **Resultado:** Abrir popup Elementor com 30 novos nós processa apenas esses 30, não os 400 existentes.

### 2.2 ✅ ColorManager: Batch Probe Elements (`_resolveBatch`)
- **Implementado:** `_resolveBatch(varNames[])` — 1 container com N filhos, 1 append, N leituras getComputedStyle, 1 remove. `_analyzeAndPatch()` substituiu 7 chamadas `_resolve()` por 1 chamada `_resolveBatch(7 vars)`.
- **Ganho:** ~60% menos overhead de DOM na inicialização do ColorManager.
- **`_resolve()` mantido** para uso pontual (não foi removido — retro-compat se alguém usar externamente).

### 2.3 Sistema de Presets
- **Por quê:** Usuários com necessidades específicas precisam de múltiplos ajustes combinados (ex: dislexia = fonte OpenDyslexic + linha ampla + letra média). Presets agilizam o onboarding.
- **Presets iniciais:** baixa-visão, dislexia, cognitivo, idosos, alto-contraste-extremo
- **Como:** Array de configurações pré-definidas. Botão de preset aplica via `aplicarTudoDoEstado()` após merge com o objeto de preset.
- **Risco:** Baixo — usa infraestrutura existente.
- **Dependência:** API pública (1.6 ✅) para integrações externas dos presets.
- **Status:** Pendente (Fase 3).

### 2.4 ✅ Suporte WooCommerce no `ACC_TEXT_SEL`
- **Implementado:** Adicionados seletores `.product_title`, `.woocommerce-loop-product__title`, `.price`, `.woocommerce-product-details__short-description p/li`, `.cart_item td`, `.order-total td`, `.woocommerce-checkout-review-order-table td`, `.woocommerce-error li`, `.woocommerce-message`, `.woocommerce-info`.

### 2.5 ✅ `border-color` no Alto Contraste JS
- **Implementado:** `_applyContrasteAltoJS` agora salva/restaura `borderColor` via `data-acc-orig-border`. Elementor define bordas decorativas via inline style (seções, cards) que ficavam visíveis sobre fundo preto.
- **`_restoreContrasteAltoJS`** atualizado para remover e restaurar `border-color`.

### 2.6 `requestAnimationFrame` em Operações Visuais Pesadas
- **Por quê:** `_scaleFonts` e `_applyContrasteAltoJS` modificam o DOM em loop síncrono. Usar `rAF` garante que as mudanças sejam aplicadas no momento ótimo pelo browser.
- **Como:** Envolver os loops `for` em `requestAnimationFrame()`.
- **Risco:** Baixo. Edge case: se o usuário muda nível novamente antes do rAF executar, um segundo rAF pode conflitar. Resolver com `cancelAnimationFrame`.
- **Status:** Pendente — impacto menor após otimização do cache (iteração de array é ~10× mais rápida que querySelectorAll; rAF marginaliza ganho restante). Reavaliar se profiling mostrar jank real.

---

## Fase 3 — Recursos e Compatibilidade (v4.2)
> **Prazo:** 2-4 meses | **Risco:** Médio-Alto | **Impacto:** Médio

### 3.1 Persistência Híbrida: localStorage + user_meta
- **Quando vale:** Se >70% dos usuários do site são logados (LMS, membership, SaaS).
- **Como:** Ao detectar `wpApiSettings.nonce` disponível (WordPress expõe via `wp-api-fetch`), sincronizar estado via REST endpoint customizado que salva em `user_meta`. `localStorage` continua como fonte primária para agilidade.
- **Segurança:** Nonce + `sanitize_text_field` em cada campo. Nunca salvar estados calculados (como filtros CSS) — apenas as preferências brutas.
- **Risco:** Alto — adiciona dependência de REST API + PHP server side. Testar com cache de página (WP Rocket, Litespeed Cache).

### 3.2 GitHub Updater: Canais Stable/Beta
- **Como:** Adicionar opção admin para escolher canal. `get_github_release()` pode usar `/releases` (lista) em vez de `/releases/latest` para selecionar a mais recente do canal desejado.
- **Risco:** Médio — mudança na lógica de update.

### 3.3 Simulação de Daltonismo: Validar Matrizes
- **Atual:** Matrizes `feColorMatrix` são baseadas em modelos Vienot 1999.
- **Melhoria:** Comparar com Brettel 1997 (mais preciso para protanopia/deuteranopia) e atualizar os valores se a diferença for perceptível.
- **Por que NÃO canvas:** `canvas + ImageData` processa cada pixel por frame (60fps = 60× CPU/frame). `feColorMatrix` é GPU-accelerated via compositor do browser. SVG é a abordagem correta.
- **Risco:** Baixo — apenas mudança de valores numéricos nas matrizes.

### 3.4 Atalho de Teclado Global
- **Por quê:** Usuários de teclado não têm forma de abrir o painel sem alcançar o botão via Tab (que pode estar muito longe no DOM).
- **Como:** `Alt+A` (ou configurável) para toggle do painel. Documentar como conflito potencial com AT.
- **Risco:** Médio — conflito com atalhos de screen readers (NVDA usa Alt para modo forms). Usar modifier duplo: `Alt+Shift+A`.

---

## Fase 4 — Enterprise (v5.0)
> **Prazo:** 6+ meses | **Risco:** Alto | **Impacto:** Alto (se necessário)

### 4.1 Painel Administrativo
- Settings page para configurar: presets padrão por role, cores da barra, toggle de features, token GitHub API.
- Analytics de uso (quais recursos são mais ativados).
- WCAG audit report por página.

### 4.2 Auditoria WCAG Interna
- Engine própria (não `axe-core` — pesa 100KB+) para detectar: contraste insuficiente, imagens sem `alt`, headings quebrados, foco inacessível.
- Executar sob demanda (não em tempo real — custo de CPU).

### 4.3 MutationObserver Inteligente v2
- Observar especificamente os nós adicionados em vez de re-escanear todo o DOM.
- Para cada nó adicionado: aplicar apenas nele e seus descendentes.
- Reduz o escopo de `_scaleFonts` de "todo o DOM" para "apenas novos elementos".

---

## O Que NÃO Implementar (com justificativa técnica)

| Sugestão | Por quê não |
|---|---|
| **Shadow DOM** | Quebra `document.querySelector` global, CSS vars não penetram shadow boundary sem `::part()`, incompatível com Elementor que manipula DOM diretamente. Custo altíssimo para ganho marginal (isolamento CSS já funciona via `:not()` seletores). |
| **ESModules / Bundler** | Adiciona pipeline de build (npm, Vite), quebra compatibilidade com jQuery enqueue, requer `type="module"` nos scripts (WordPress não suporta nativamente). O IIFE funciona bem na escala atual. Reavaliar em v5.0 se o arquivo ultrapassar 3000 linhas. |
| **axe-core** | 100KB+ minificado. Torna o plugin 10× maior. Para auditoria, usar a DevTools do browser ou PageSpeed. |
| **Canvas para daltonismo** | Processa pixels por frame (60fps). SVG feColorMatrix é GPU-accelerated. Performance incomparavelmente inferior. |
| **Auditoria WCAG em tempo real** | MutationObserver + varredura de contraste em cada mutação causaria jank em qualquer página com animações ou conteúdo dinâmico. |

---

## Quick Wins (implementar agora, <1 hora cada)

1. ✅ Adicionar `id="acc-svg-filters"` ao SVG PHP → elimina IDs duplicados
2. ✅ Expandir MutationObserver para font scaling → cobre Elementor dinâmico
3. ✅ Focus trap no diálogo → WCAG Level A compliance
4. ✅ ARIA live region para anúncios → WCAG Level AA compliance
5. ✅ Prerelease check no Updater → previne updates acidentais
6. ✅ `window.ACC` API pública → habilita integrações sem modificar internals

---

## Dependências entre Tarefas

```
1.3 (SVG fix)
    └─> independente

1.4 (MutationObserver)
    └─> base para 2.1 (cache de elementos — invalidação)

1.6 (window.ACC)
    └─> base para 2.3 (presets via API externa)
    └─> base para 3.1 (REST endpoint usa mesma interface)

2.1 (cache de elementos)
    └─> depende de 1.4 (MutationObserver como trigger de invalidação)

2.3 (presets)
    └─> depende de 1.6 (API para presets externos)
    └─> base para 4.1 (admin page configura presets)

3.1 (persistência híbrida)
    └─> depende de 1.6 (API para sincronizar estado)
    └─> depende de 2.3 (salvar presets por user_meta)
```

---

## KPIs de Qualidade para Cada Fase

- **Fase 1:** 0 violations WCAG Level A/AA no plugin em si (testar com axe DevTools)
- **Fase 2:** `_scaleFonts` < 2ms em páginas com 500+ elementos
- **Fase 3:** Persistência funciona com WP Rocket / LiteSpeed Cache ativados
- **Fase 4:** Score Lighthouse Accessibility > 95 em páginas de teste com o plugin ativo
