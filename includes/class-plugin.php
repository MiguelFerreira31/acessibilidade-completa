<?php
/**
 * Classe principal do plugin Acessibilidade Completa.
 *
 * Responsável por:
 *  - Enfileirar scripts e estilos
 *  - Renderizar o widget de acessibilidade no footer
 *
 * Padrão Singleton garante que apenas uma instância exista por request.
 *
 * @package AcessibilidadeCompleta
 * @since   3.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class AcessibilidadeCompleta_Plugin {

    /** @var AcessibilidadeCompleta_Plugin|null Instância singleton */
    private static $instance = null;

    /* ──────────────────────────────────────────
       SINGLETON
    ────────────────────────────────────────── */

    /**
     * Retorna (ou cria) a instância singleton do plugin.
     *
     * @return AcessibilidadeCompleta_Plugin
     */
    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /** Construtor privado — instancie via get_instance(). */
    private function __construct() {
        $this->init_hooks();
    }

    /** Evita clonagem acidental. */
    private function __clone() {}

    /* ──────────────────────────────────────────
       HOOKS
    ────────────────────────────────────────── */

    /** Registra todos os hooks do WordPress. */
    private function init_hooks() {
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );

        // Prioridade 5: garante que o HTML seja inserido antes dos
        // scripts de footer (wp_print_footer_scripts roda na prioridade 20).
        add_action( 'wp_footer', array( $this, 'render_widget' ), 5 );
    }

    /* ──────────────────────────────────────────
       ASSETS
    ────────────────────────────────────────── */

    /**
     * Enfileira CSS e JS do plugin.
     *
     * Dependências:
     *  - CSS: open-dyslexic (Google Fonts CDN)
     *  - JS:  jquery (WordPress core), vlibras (CDN externo, no-head)
     *
     * Filtros disponíveis para desenvolvedores:
     *  - acc_button_position   string  top|bottom — posição vertical do botão toggle
     *  - acc_default_features  array   Lista de features ativas por padrão
     */
    public function enqueue_assets() {

        // VLibras — deve carregar no <head> de forma síncrona
        wp_enqueue_script(
            'vlibras',
            'https://vlibras.gov.br/app/vlibras-plugin.js',
            array(),
            null,
            false
        );

        // Fonte OpenDyslexic (fallback gracioso no CSS se indisponível)
        wp_enqueue_style(
            'open-dyslexic',
            'https://fonts.cdnfonts.com/css/open-dyslexic',
            array(),
            null
        );

        wp_enqueue_style(
            'acessibilidade-css',
            ACC_PLUGIN_URL . 'assets/acessibilidade.css',
            array( 'open-dyslexic' ),
            ACC_VERSION,
            'all'
        );

        wp_enqueue_script(
            'acessibilidade-js',
            ACC_PLUGIN_URL . 'assets/acessibilidade.js',
            array( 'jquery' ),
            ACC_VERSION,
            true
        );

        /**
         * Filtro: acc_text_selectors
         * Permite que desenvolvedores adicionem seletores CSS extras para o
         * escalamento de fonte sem modificar o core do plugin.
         *
         * Exemplo de uso (functions.php do tema):
         *   add_filter( 'acc_text_selectors', function( $sel ) {
         *       return $sel . ',.meu-widget-title,.meu-widget-desc';
         *   } );
         *
         * @param string $selectors  Seletores CSS padrão do plugin (separados por vírgula).
         */
        $extra_selectors = apply_filters( 'acc_text_selectors', '' );

        /**
         * Filtro: acc_updater_cache_ttl
         * Permite ajustar o TTL do cache de verificação de update (segundos).
         * Padrão: 43200 (12 horas). Reduzir em staging/dev para testes.
         *
         * @param int $ttl  Tempo em segundos.
         */

        // Passa dados do PHP para o JS (acc_text_selectors, versão)
        wp_localize_script(
            'acessibilidade-js',
            'accData',
            array(
                'version'        => ACC_VERSION,
                'extraSelectors' => sanitize_text_field( $extra_selectors ),
            )
        );
    }

    /* ──────────────────────────────────────────
       WIDGET HTML
    ────────────────────────────────────────── */

    /**
     * Renderiza o widget completo de acessibilidade no footer.
     *
     * Inclui:
     *  - Filtros SVG para simulação de daltonismo
     *  - Bolla da lupa de navegação
     *  - Overlays da máscara de leitura
     *  - Guia de leitura
     *  - Widget VLibras
     *  - Barra de acessibilidade com painel completo
     */
    public function render_widget() {
        ?>
        <!-- ════════════════════════════════════════
             FILTROS SVG — Simulação de Daltonismo
             (Ocultos, usados via CSS filter: url(#id))
             id="acc-svg-filters" previne duplicação pelo JS _injectSvgFilters()
        ═════════════════════════════════════════ -->
        <svg id="acc-svg-filters" xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false">
            <defs>
                <!-- Protanopia: ausência de fotorreceptores vermelhos (L) -->
                <filter id="acc-protan" x="0" y="0" width="100%" height="100%">
                    <feColorMatrix type="matrix" values="0.56667 0.43333 0 0 0 0.55833 0.44167 0 0 0 0 0.24167 0.75833 0 0 0 0 0 1 0"/>
                </filter>
                <!-- Deuteranopia: ausência de fotorreceptores verdes (M) -->
                <filter id="acc-deuter" x="0" y="0" width="100%" height="100%">
                    <feColorMatrix type="matrix" values="0.625 0.375 0 0 0 0.7 0.3 0 0 0 0 0.3 0.7 0 0 0 0 0 1 0"/>
                </filter>
                <!-- Tritanopia: ausência de fotorreceptores azuis (S) -->
                <filter id="acc-tritan" x="0" y="0" width="100%" height="100%">
                    <feColorMatrix type="matrix" values="0.95 0.05 0 0 0 0 0.433 0.567 0 0 0 0.475 0.525 0 0 0 0 0 1 0"/>
                </filter>
            </defs>
        </svg>

        <!-- ════════════════════════════════════════
             LUPA DE NAVEGAÇÃO
        ═════════════════════════════════════════ -->
        <div id="acc-lupa-bubble" class="acc-lupa-hidden" role="status" aria-live="polite" aria-atomic="true"></div>

        <!-- ════════════════════════════════════════
             MÁSCARA DE LEITURA
        ═════════════════════════════════════════ -->
        <div id="acc-mascara-top"    class="acc-mascara-overlay acc-mascara-hidden" aria-hidden="true"></div>
        <div id="acc-mascara-bottom" class="acc-mascara-overlay acc-mascara-hidden" aria-hidden="true"></div>

        <!-- ════════════════════════════════════════
             GUIA DE LEITURA
        ═════════════════════════════════════════ -->
        <div id="acc-guia" class="acc-guia-hidden" aria-hidden="true"></div>

        <!-- ════════════════════════════════════════
             VLIBRAS WIDGET
        ═════════════════════════════════════════ -->
        <div vw class="enabled">
            <div vw-access-button class="active"></div>
            <div vw-plugin-wrapper>
                <div class="vw-plugin-top-wrapper"></div>
            </div>
        </div>

        <!-- ════════════════════════════════════════
             BARRA DE ACESSIBILIDADE
        ═════════════════════════════════════════ -->
        <div id="barra-acessibilidade" role="complementary" aria-label="<?php esc_attr_e( 'Ferramentas de acessibilidade', 'acessibilidade-completa' ); ?>">

            <button
                type="button"
                id="toggle-acessibilidade"
                aria-label="<?php esc_attr_e( 'Abrir opções de acessibilidade', 'acessibilidade-completa' ); ?>"
                aria-expanded="false"
                aria-controls="painel-acessibilidade"
                title="<?php esc_attr_e( 'Recursos de Acessibilidade', 'acessibilidade-completa' ); ?>"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" focusable="false">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="8" r="2.5" fill="currentColor" stroke="none"/>
                    <path d="M12 13v5"/>
                    <path d="M8 15l4-2 4 2"/>
                </svg>
               
            </button>

            <div
                id="painel-acessibilidade"
                class="painel-hidden"
                role="dialog"
                aria-labelledby="painel-titulo"
                aria-modal="true"
            >
                <!-- Cabeçalho -->
                <div class="painel-header">
                    <div class="header-content">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false">
                            <circle cx="12" cy="12" r="10"/>
                            <circle cx="12" cy="8" r="2" fill="currentColor" stroke="none"/>
                            <path d="M12 14v6"/>
                            <path d="M9 16l3-2 3 2"/>
                        </svg>
                        <h3 id="painel-titulo"><?php esc_html_e( 'Acessibilidade', 'acessibilidade-completa' ); ?></h3>
                    </div>
                    <button type="button" id="fechar-painel" aria-label="<?php esc_attr_e( 'Fechar painel de acessibilidade', 'acessibilidade-completa' ); ?>">&times;</button>
                </div>

                <div class="painel-content">

                    <!-- ═══════════════════════════════ -->
                    <!-- SEÇÃO: TIPOGRAFIA               -->
                    <!-- ═══════════════════════════════ -->
                    <div class="secao-titulo">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M4 7h16M9 3v18M5 21h8"/></svg>
                        <?php esc_html_e( 'Tipografia', 'acessibilidade-completa' ); ?>
                    </div>

                    <!-- Tamanho da fonte (stepper) -->
                    <div class="opcao-grupo" role="group" aria-labelledby="label-fonte-tam">
                        <label id="label-fonte-tam">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M9 3v18M5 21h8"/></svg>
                            <?php esc_html_e( 'Tamanho da Fonte', 'acessibilidade-completa' ); ?>
                        </label>
                        <div class="fonte-stepper" role="group" aria-label="<?php esc_attr_e( 'Controle de tamanho de fonte', 'acessibilidade-completa' ); ?>">
                            <button type="button" class="btn-stepper" id="btn-fonte-dec" aria-label="<?php esc_attr_e( 'Diminuir fonte', 'acessibilidade-completa' ); ?>">−</button>
                            <div class="fonte-display" aria-live="polite" aria-atomic="true">
                                <span class="fonte-demo" id="fonte-demo" aria-hidden="true">Aa</span>
                                <span class="fonte-nivel-label" id="fonte-nivel-label"><?php esc_html_e( 'Normal', 'acessibilidade-completa' ); ?></span>
                            </div>
                            <button type="button" class="btn-stepper" id="btn-fonte-inc" aria-label="<?php esc_attr_e( 'Aumentar fonte', 'acessibilidade-completa' ); ?>">+</button>
                        </div>
                        <div class="fonte-niveis" aria-hidden="true">
                            <span class="nivel-dot" data-level="-1" title="−10%"></span>
                            <span class="nivel-dot ativo" data-level="0" title="Normal"></span>
                            <span class="nivel-dot" data-level="1" title="+10%"></span>
                            <span class="nivel-dot" data-level="2" title="+25%"></span>
                            <span class="nivel-dot" data-level="3" title="+50%"></span>
                        </div>
                    </div>

                    <!-- Fonte para dislexia -->
                    <div class="opcao-grupo">
                        <label id="label-dislexia">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            <?php esc_html_e( 'Fonte para Dislexia', 'acessibilidade-completa' ); ?>
                        </label>
                        <button
                            type="button"
                            class="toggle-row"
                            id="toggle-dislexia"
                            data-acao="dislexia-toggle"
                            role="switch"
                            aria-checked="false"
                            aria-labelledby="label-dislexia"
                        >
                            <div class="toggle-info">
                                <span class="toggle-titulo">OpenDyslexic</span>
                                <span class="toggle-desc"><?php esc_html_e( 'Fonte que reduz dificuldades de leitura', 'acessibilidade-completa' ); ?></span>
                            </div>
                            <div class="toggle-switch" aria-hidden="true"></div>
                        </button>
                    </div>

                    <!-- Espaço entre linhas -->
                    <div class="opcao-grupo" role="group" aria-labelledby="label-linha">
                        <label id="label-linha">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/><path d="M8 3l-3 3 3 3M8 15l-3 3 3 3"/></svg>
                            <?php esc_html_e( 'Espaço entre Linhas', 'acessibilidade-completa' ); ?>
                        </label>
                        <div class="opcao-botoes">
                            <button type="button" class="btn-acessibilidade ativo" data-acao="linha-normal" aria-pressed="true">
                                <svg class="btn-icon" width="20" height="16" viewBox="0 0 20 16" aria-hidden="true"><line x1="0" y1="3" x2="20" y2="3" stroke="currentColor" stroke-width="2"/><line x1="0" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="2"/><line x1="0" y1="13" x2="20" y2="13" stroke="currentColor" stroke-width="2"/></svg>
                                <?php esc_html_e( 'Normal', 'acessibilidade-completa' ); ?>
                            </button>
                            <button type="button" class="btn-acessibilidade" data-acao="linha-media" aria-pressed="false">
                                <svg class="btn-icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><line x1="0" y1="2" x2="20" y2="2" stroke="currentColor" stroke-width="2"/><line x1="0" y1="10" x2="20" y2="10" stroke="currentColor" stroke-width="2"/><line x1="0" y1="18" x2="20" y2="18" stroke="currentColor" stroke-width="2"/></svg>
                                <?php esc_html_e( 'Médio', 'acessibilidade-completa' ); ?>
                            </button>
                            <button type="button" class="btn-acessibilidade" data-acao="linha-ampla" aria-pressed="false">
                                <svg class="btn-icon" width="20" height="24" viewBox="0 0 20 24" aria-hidden="true"><line x1="0" y1="2" x2="20" y2="2" stroke="currentColor" stroke-width="2"/><line x1="0" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2"/><line x1="0" y1="22" x2="20" y2="22" stroke="currentColor" stroke-width="2"/></svg>
                                <?php esc_html_e( 'Amplo', 'acessibilidade-completa' ); ?>
                            </button>
                        </div>
                    </div>

                    <!-- Espaço entre letras -->
                    <div class="opcao-grupo" role="group" aria-labelledby="label-letra">
                        <label id="label-letra">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 7H6l-3 10h3M9 7l3 10M9 7h6M15 7h3l3 10h-3M15 7l-3 10M12 14h3"/></svg>
                            <?php esc_html_e( 'Espaço entre Letras', 'acessibilidade-completa' ); ?>
                        </label>
                        <div class="opcao-botoes">
                            <button type="button" class="btn-acessibilidade ativo" data-acao="letra-normal" aria-pressed="true">
                                <span class="btn-letra-preview" aria-hidden="true" style="letter-spacing:0">Aa</span>
                                <?php esc_html_e( 'Normal', 'acessibilidade-completa' ); ?>
                            </button>
                            <button type="button" class="btn-acessibilidade" data-acao="letra-media" aria-pressed="false">
                                <span class="btn-letra-preview" aria-hidden="true" style="letter-spacing:.1em">Aa</span>
                                <?php esc_html_e( 'Médio', 'acessibilidade-completa' ); ?>
                            </button>
                            <button type="button" class="btn-acessibilidade" data-acao="letra-ampla" aria-pressed="false">
                                <span class="btn-letra-preview" aria-hidden="true" style="letter-spacing:.2em">Aa</span>
                                <?php esc_html_e( 'Amplo', 'acessibilidade-completa' ); ?>
                            </button>
                        </div>
                    </div>

                    <!-- ═══════════════════════════════ -->
                    <!-- SEÇÃO: VISÃO & CORES            -->
                    <!-- ═══════════════════════════════ -->
                    <div class="secao-titulo">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        <?php esc_html_e( 'Visão &amp; Cores', 'acessibilidade-completa' ); ?>
                    </div>

                    <!-- Contraste -->
                    <div class="opcao-grupo" role="group" aria-labelledby="label-contraste">
                        <label id="label-contraste">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/></svg>
                            <?php esc_html_e( 'Contraste', 'acessibilidade-completa' ); ?>
                        </label>
                        <div class="opcao-botoes">
                            <button type="button" class="btn-acessibilidade ativo" data-acao="contraste-normal" aria-pressed="true">
                                <svg class="btn-icon" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 1v20" stroke="currentColor" stroke-width="2"/><path d="M11 1a10 10 0 0 1 0 20" fill="currentColor"/></svg>
                                <?php esc_html_e( 'Normal', 'acessibilidade-completa' ); ?>
                            </button>
                            <button type="button" class="btn-acessibilidade" data-acao="contraste-alto" aria-pressed="false">
                                <svg class="btn-icon" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><rect width="22" height="22" rx="11" fill="currentColor"/><circle cx="11" cy="11" r="7" fill="none" stroke="white" stroke-width="2"/><path d="M11 4v14" stroke="white" stroke-width="2"/></svg>
                                <?php esc_html_e( 'Alto', 'acessibilidade-completa' ); ?>
                            </button>
                            <button type="button" class="btn-acessibilidade" data-acao="contraste-invertido" aria-pressed="false">
                                <svg class="btn-icon" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="10" fill="currentColor"/><path d="M11 1v20" stroke="white" stroke-width="2"/><path d="M11 1a10 10 0 0 1 0 20" fill="none" stroke="white" stroke-width="2"/></svg>
                                <?php esc_html_e( 'Invertido', 'acessibilidade-completa' ); ?>
                            </button>
                        </div>
                    </div>

                    <!-- Saturação de Cor -->
                    <div class="opcao-grupo" role="group" aria-labelledby="label-satur">
                        <label id="label-satur">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2a7 7 0 0 1 7 7c0 4-7 13-7 13S5 13 5 9a7 7 0 0 1 7-7z"/></svg>
                            <?php esc_html_e( 'Saturação de Cor', 'acessibilidade-completa' ); ?>
                        </label>
                        <div class="opcao-botoes">
                            <button type="button" class="btn-acessibilidade ativo" data-acao="satur-normal" aria-pressed="true">
                                <svg class="btn-icon" width="22" height="18" viewBox="0 0 22 18" aria-hidden="true"><rect x="0" y="2" width="7" height="14" rx="2" fill="#e74c3c"/><rect x="7" y="2" width="8" height="14" rx="2" fill="#2ecc71"/><rect x="15" y="2" width="7" height="14" rx="2" fill="#3498db"/></svg>
                                <?php esc_html_e( 'Normal', 'acessibilidade-completa' ); ?>
                            </button>
                            <button type="button" class="btn-acessibilidade" data-acao="satur-cinza" aria-pressed="false">
                                <svg class="btn-icon" width="22" height="18" viewBox="0 0 22 18" aria-hidden="true"><rect x="0" y="2" width="7" height="14" rx="2" fill="#888"/><rect x="7" y="2" width="8" height="14" rx="2" fill="#aaa"/><rect x="15" y="2" width="7" height="14" rx="2" fill="#ccc"/></svg>
                                <?php esc_html_e( 'Cinza', 'acessibilidade-completa' ); ?>
                            </button>
                            <button type="button" class="btn-acessibilidade" data-acao="satur-sepia" aria-pressed="false">
                                <svg class="btn-icon" width="22" height="18" viewBox="0 0 22 18" aria-hidden="true"><rect x="0" y="2" width="7" height="14" rx="2" fill="#8B4513"/><rect x="7" y="2" width="8" height="14" rx="2" fill="#A0522D"/><rect x="15" y="2" width="7" height="14" rx="2" fill="#D2691E"/></svg>
                                <?php esc_html_e( 'Sépia', 'acessibilidade-completa' ); ?>
                            </button>
                        </div>
                    </div>

                    <!-- Simulação de Visão (Daltonismo) -->
                    <div class="opcao-grupo" role="group" aria-labelledby="label-dalton">
                        <label id="label-dalton">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2"/></svg>
                            <?php esc_html_e( 'Simulação de Visão', 'acessibilidade-completa' ); ?>
                        </label>
                        <div class="dalton-info"><?php esc_html_e( 'Simula tipos de daltonismo para revisão de contraste', 'acessibilidade-completa' ); ?></div>
                        <div class="opcao-botoes grid-4">
                            <button type="button" class="btn-acessibilidade ativo" data-acao="dalton-normal" aria-pressed="true">
                                <svg class="btn-icon" width="20" height="14" viewBox="0 0 20 14" aria-hidden="true"><rect x="0" y="0" width="7" height="14" rx="2" fill="#e74c3c"/><rect x="6.5" y="0" width="7" height="14" rx="2" fill="#2ecc71"/><rect x="13" y="0" width="7" height="14" rx="2" fill="#3498db"/></svg>
                                Normal
                            </button>
                            <button type="button" class="btn-acessibilidade" data-acao="dalton-protan" aria-pressed="false" title="<?php esc_attr_e( 'Protanopia: dificuldade com vermelho', 'acessibilidade-completa' ); ?>">
                                <svg class="btn-icon" width="20" height="14" viewBox="0 0 20 14" aria-hidden="true"><rect x="0" y="0" width="7" height="14" rx="2" fill="#7d7000"/><rect x="6.5" y="0" width="7" height="14" rx="2" fill="#c8b400"/><rect x="13" y="0" width="7" height="14" rx="2" fill="#4a8aff"/></svg>
                                Protan.
                            </button>
                            <button type="button" class="btn-acessibilidade" data-acao="dalton-deuter" aria-pressed="false" title="<?php esc_attr_e( 'Deuteranopia: dificuldade com verde', 'acessibilidade-completa' ); ?>">
                                <svg class="btn-icon" width="20" height="14" viewBox="0 0 20 14" aria-hidden="true"><rect x="0" y="0" width="7" height="14" rx="2" fill="#9e6000"/><rect x="6.5" y="0" width="7" height="14" rx="2" fill="#b28500"/><rect x="13" y="0" width="7" height="14" rx="2" fill="#6080ff"/></svg>
                                Deuter.
                            </button>
                            <button type="button" class="btn-acessibilidade" data-acao="dalton-tritan" aria-pressed="false" title="<?php esc_attr_e( 'Tritanopia: dificuldade com azul', 'acessibilidade-completa' ); ?>">
                                <svg class="btn-icon" width="20" height="14" viewBox="0 0 20 14" aria-hidden="true"><rect x="0" y="0" width="7" height="14" rx="2" fill="#c03060"/><rect x="6.5" y="0" width="7" height="14" rx="2" fill="#30b080"/><rect x="13" y="0" width="7" height="14" rx="2" fill="#40a080"/></svg>
                                Tritan.
                            </button>
                        </div>
                    </div>

                    <!-- ═══════════════════════════════ -->
                    <!-- SEÇÃO: NAVEGAÇÃO                -->
                    <!-- ═══════════════════════════════ -->
                    <div class="secao-titulo">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
                        <?php esc_html_e( 'Navegação', 'acessibilidade-completa' ); ?>
                    </div>

                    <div class="opcao-grupo" role="group" aria-labelledby="label-cursor">
                        <label id="label-cursor">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
                            <?php esc_html_e( 'Cursor do Mouse', 'acessibilidade-completa' ); ?>
                        </label>
                        <div class="opcao-botoes grid-2">
                            <button type="button" class="btn-acessibilidade ativo" data-acao="cursor-normal" aria-pressed="true">
                                <svg class="btn-icon" width="16" height="20" viewBox="0 0 16 20" aria-hidden="true"><path fill="currentColor" d="M0 0l6 16.5 2.5-7 7-2.5z"/></svg>
                                <?php esc_html_e( 'Normal', 'acessibilidade-completa' ); ?>
                            </button>
                            <button type="button" class="btn-acessibilidade" data-acao="cursor-grande" aria-pressed="false">
                                <svg class="btn-icon" width="22" height="28" viewBox="0 0 22 28" aria-hidden="true"><path fill="currentColor" stroke="white" stroke-width="1" d="M0 0l9 23 3.5-9.5 9.5-3.5z"/></svg>
                                <?php esc_html_e( 'Grande', 'acessibilidade-completa' ); ?>
                            </button>
                        </div>
                    </div>

                    <!-- Lupa de Navegação -->
                    <div class="opcao-grupo">
                        <label id="label-lupa">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                            <?php esc_html_e( 'Lupa de Navegação', 'acessibilidade-completa' ); ?>
                        </label>
                        <button type="button" class="toggle-row" id="toggle-lupa" data-acao="lupa-toggle" role="switch" aria-checked="false" aria-labelledby="label-lupa">
                            <div class="toggle-info">
                                <span class="toggle-titulo"><?php esc_html_e( 'Ampliar ao Passar o Mouse', 'acessibilidade-completa' ); ?></span>
                                <span class="toggle-desc"><?php esc_html_e( 'Exibe o texto do elemento em tamanho ampliado', 'acessibilidade-completa' ); ?></span>
                            </div>
                            <div class="toggle-switch" aria-hidden="true"></div>
                        </button>
                    </div>

                    <!-- Destaque de Links -->
                    <div class="opcao-grupo">
                        <label id="label-links">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                            <?php esc_html_e( 'Destaque de Links', 'acessibilidade-completa' ); ?>
                        </label>
                        <button type="button" class="toggle-row" id="toggle-links" data-acao="links-toggle" role="switch" aria-checked="false" aria-labelledby="label-links">
                            <div class="toggle-info">
                                <span class="toggle-titulo"><?php esc_html_e( 'Realçar Todos os Links', 'acessibilidade-completa' ); ?></span>
                                <span class="toggle-desc"><?php esc_html_e( 'Adiciona borda e destaque visual em todos os links', 'acessibilidade-completa' ); ?></span>
                            </div>
                            <div class="toggle-switch" aria-hidden="true"></div>
                        </button>
                    </div>

                    <!-- Máscara de Leitura -->
                    <div class="opcao-grupo">
                        <label id="label-mascara">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="2" width="20" height="7" rx="1" fill="currentColor" opacity="0.35" stroke="none"/><rect x="2" y="15" width="20" height="7" rx="1" fill="currentColor" opacity="0.35" stroke="none"/><rect x="2" y="9" width="20" height="6" rx="1"/></svg>
                            <?php esc_html_e( 'Máscara de Leitura', 'acessibilidade-completa' ); ?>
                        </label>
                        <button class="toggle-row" id="toggle-mascara" type="button" role="switch" aria-checked="false" aria-labelledby="label-mascara">
                            <div class="toggle-info">
                                <span class="toggle-titulo"><?php esc_html_e( 'Foco na Linha Atual', 'acessibilidade-completa' ); ?></span>
                                <span class="toggle-desc"><?php esc_html_e( 'Escurece o restante da tela, destacando a área de leitura', 'acessibilidade-completa' ); ?></span>
                            </div>
                            <div class="toggle-switch" aria-hidden="true"></div>
                        </button>
                    </div>

                    <!-- Guia de Leitura -->
                    <div class="opcao-grupo">
                        <label id="label-guia">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="2" y1="12" x2="22" y2="12"/><polyline points="7,7 2,12 7,17"/><polyline points="17,7 22,12 17,17"/></svg>
                            <?php esc_html_e( 'Guia de Leitura', 'acessibilidade-completa' ); ?>
                        </label>
                        <button class="toggle-row" id="toggle-guia" type="button" role="switch" aria-checked="false" aria-labelledby="label-guia">
                            <div class="toggle-info">
                                <span class="toggle-titulo"><?php esc_html_e( 'Linha Guia no Cursor', 'acessibilidade-completa' ); ?></span>
                                <span class="toggle-desc"><?php esc_html_e( 'Exibe uma linha colorida que acompanha o ponteiro na tela', 'acessibilidade-completa' ); ?></span>
                            </div>
                            <div class="toggle-switch" aria-hidden="true"></div>
                        </button>
                    </div>

                    <!-- Reset -->
                    <div class="opcao-grupo opcao-reset">
                        <button type="button" class="btn-reset" aria-label="<?php esc_attr_e( 'Restaurar todas as configurações de acessibilidade para o padrão', 'acessibilidade-completa' ); ?>">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                            <?php esc_html_e( 'Restaurar Padrão', 'acessibilidade-completa' ); ?>
                        </button>
                    </div>

                </div><!-- .painel-content -->

                <div class="painel-footer">
                    <small><?php esc_html_e( 'Configurações salvas automaticamente', 'acessibilidade-completa' ); ?></small>
                </div>
            </div><!-- #painel-acessibilidade -->
        </div><!-- #barra-acessibilidade -->

        <!-- ════════════════════════════════════════
             ANUNCIADOR ARIA — Live Region para screen readers
             Invisível visualmente mas anunciado por AT em cada ação.
             aria-live="polite" — WCAG SC 4.1.3 Level AA:
               Mudanças de contraste, fonte e saturação são feedback de status
               (não alertas de erro urgentes). "polite" aguarda pausa natural do
               leitor de tela para anunciar, sem interromper leitura em curso.
               Reservar "assertive" para erros críticos ou avisos de segurança.
        ═════════════════════════════════════════ -->
        <div
            id="acc-announcer"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0"
        ></div>
        <?php
    }
}
