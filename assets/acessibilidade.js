(function ($) {
    'use strict';

    /* ─────────────────────────────────────────────
       CONFIGURAÇÃO DOS NÍVEIS DE FONTE
    ───────────────────────────────────────────── */
    var FONT_LEVELS = {
        '-1': { classe: 'acc-font-m1', label: '−10%',  demo: '13px' },
         '0': { classe: null,          label: 'Normal', demo: '18px' },
         '1': { classe: 'acc-font-1',  label: '+10%',  demo: '21px' },
         '2': { classe: 'acc-font-2',  label: '+25%',  demo: '24px' },
         '3': { classe: 'acc-font-3',  label: '+50%',  demo: '29px' }
    };
    var FONT_MIN = -1;
    var FONT_MAX = 3;

    /**
     * Fatores de escala por nível. Aplicados via JS diretamente nos elementos,
     * garantindo compatibilidade com Elementor e temas que definem font-size em px.
     */
    var FONT_SCALES = {
        '-1': 0.90,
         '0': 1.00,
         '1': 1.10,
         '2': 1.25,
         '3': 1.50
    };

    /** Atributo data que preserva o font-size computado original (em px) antes da primeira escala */
    var ACC_FS_ATTR = 'data-acc-orig-fs';

    /**
     * Seletor abrangente de elementos que portam texto no site.
     * Ícones, SVG e a barra de acessibilidade são filtrados em _shouldSkipEl().
     * Inclui elementos Elementor e WordPress Blocks mais comuns.
     */
    var ACC_TEXT_SEL = (
        /* Headings e parágrafos */
        'h1,h2,h3,h4,h5,h6,' +
        'p,blockquote,pre,address,' +
        /* Listas e tabelas */
        'li,dt,dd,' +
        'td,th,caption,figcaption,' +
        /* Elementos interativos com texto */
        'a,button,label,' +
        /* Formulários */
        'textarea,select,' +
        'input:not([type=hidden]):not([type=submit]):not([type=button])' +
            ':not([type=reset]):not([type=image]):not([type=checkbox]):not([type=radio]),' +
        /* Elementor — widgets de conteúdo textual */
        '.elementor-heading-title,' +
        '.elementor-button-text,' +
        '.elementor-icon-box-title,' +
        '.elementor-icon-box-description,' +
        '.elementor-image-box-title,' +
        '.elementor-image-box-description,' +
        '.elementor-testimonial__content,' +
        '.elementor-testimonial__name,' +
        '.elementor-tab-title,' +
        '.elementor-price-table__heading,' +
        '.elementor-price-table__subheading,' +
        '.elementor-countdown__label,' +
        '.elementor-alert__title,' +
        '.elementor-alert__description,' +
        '.elementor-nav-menu a,' +
        /* WordPress Blocks */
        '.wp-block-paragraph,' +
        '.wp-block-heading,' +
        '.wp-block-list li,' +
        '.wp-block-quote p,' +
        '.wp-block-button__link,' +
        '.wp-block-pullquote p,' +
        '.wp-block-table td,' +
        '.wp-block-table th,' +
        /* Navegação e menus */
        '.menu-item>a,' +
        '.sub-menu a,' +
        '.nav-menu a,' +
        /* Estrutura do tema */
        '.site-title,' +
        '.site-description,' +
        '.entry-title,' +
        '.entry-content p,' +
        '.entry-content li,' +
        /* Widgets */
        '.widget-title,' +
        '.widgettitle,' +
        '.widget p,' +
        '.widget li'
    );

    /** RegExp que identifica classes de ícones — esses elementos NÃO devem escalar */
    var ACC_ICON_RE = /\b(fa|fas|far|fab|fal|fad|fass|dashicons|genericon|glyphicon|material-icons|wp-menu-image|eicon|icon)\b/;

    /* Tags semânticas com texto significativo (lupa) */
    var SEMANTIC_TAGS = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'BUTTON',
                         'LABEL', 'LI', 'TD', 'TH', 'CAPTION', 'FIGCAPTION',
                         'BLOCKQUOTE', 'CITE', 'STRONG', 'EM', 'SPAN', 'DT', 'DD'];

    /* Altura da faixa transparente da máscara (px acima e abaixo do cursor) */
    var MASCARA_BANDA = 90;

    /* ─────────────────────────────────────────────
       OBJETO PRINCIPAL
    ───────────────────────────────────────────── */
    var Acessibilidade = {

        _vlibrasInit:       false,
        _lupaTimer:         null,
        _navHandlersActive: false,
        _mutationObserver:  null,
        _mutationTimer:     null,

        /* Estado atual de todas as opções */
        estado: {
            fontLevel:       0,
            dislexia:        false,
            linha:           'normal',   // normal | media | ampla
            letra:           'normal',   // normal | media | ampla
            contraste:       'normal',   // normal | alto  | invertido
            saturacao:       'normal',   // normal | cinza | sepia
            daltonismo:      'normal',   // normal | protan | deuter | tritan
            cursor:          'normal',   // normal | grande
            lupa:            false,
            linksDestacados: false,
            mascara:         false,
            guia:            false
        },

        /* ── Inicialização ─────────────────────── */
        init: function () {
            this._injectSvgFilters();       /* Filtros SVG para simulação de daltonismo */
            this.initVLibras();
            this.bindEvents();
            this.loadPreferences();
            this._initMutationObserver();   /* Captura conteúdo dinâmico Elementor */
        },

        /* ── VLibras ───────────────────────────── */
        initVLibras: function () {
            var self = this;

            var tentar = function () {
                if (self._vlibrasInit) return;
                if (typeof window.VLibras === 'undefined') return;
                try {
                    new window.VLibras.Widget('https://vlibras.gov.br/app');
                    self._vlibrasInit = true;
                } catch (e) { /* polling vai tentar novamente */ }
            };

            if (typeof window.VLibras !== 'undefined') {
                tentar();
            } else {
                var tentativas = 0;
                var poll = setInterval(function () {
                    tentativas++;
                    tentar();
                    if (self._vlibrasInit || tentativas >= 20) {
                        clearInterval(poll);
                        if (!self._vlibrasInit) {
                            console.warn('Acessibilidade: VLibras não carregou após 10s.');
                        }
                    }
                }, 500);
            }
        },

        /* ── Filtros SVG de daltonismo ─────────────
           Injeta um <svg> invisível com três filtros feColorMatrix
           (protanopia, deuteranopia, tritanopia) no início do <body>.
           Esses filtros são referenciados por url(#id) em composeBodyFilter.
           Deve ser chamado ANTES de qualquer aplicação de filtro.
        ───────────────────────────────────────────── */
        _injectSvgFilters: function () {
            if (document.getElementById('acc-svg-filters')) return;

            var div = document.createElement('div');
            div.innerHTML = (
                '<svg id="acc-svg-filters" xmlns="http://www.w3.org/2000/svg"' +
                ' aria-hidden="true" focusable="false"' +
                ' style="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none">' +
                '<defs>' +

                /* Protanopia — insensibilidade ao vermelho */
                '<filter id="acc-protan" color-interpolation-filters="linearRGB"' +
                ' x="0" y="0" width="100%" height="100%">' +
                '<feColorMatrix type="matrix" values="' +
                    '0.567 0.433 0     0 0 ' +
                    '0.558 0.442 0     0 0 ' +
                    '0     0.242 0.758 0 0 ' +
                    '0     0     0     1 0' +
                '"/></filter>' +

                /* Deuteranopia — insensibilidade ao verde */
                '<filter id="acc-deuter" color-interpolation-filters="linearRGB"' +
                ' x="0" y="0" width="100%" height="100%">' +
                '<feColorMatrix type="matrix" values="' +
                    '0.625 0.375 0   0 0 ' +
                    '0.7   0.3   0   0 0 ' +
                    '0     0.3   0.7 0 0 ' +
                    '0     0     0   1 0' +
                '"/></filter>' +

                /* Tritanopia — insensibilidade ao azul */
                '<filter id="acc-tritan" color-interpolation-filters="linearRGB"' +
                ' x="0" y="0" width="100%" height="100%">' +
                '<feColorMatrix type="matrix" values="' +
                    '0.95  0.05  0     0 0 ' +
                    '0     0.433 0.567 0 0 ' +
                    '0     0.475 0.525 0 0 ' +
                    '0     0     0     1 0' +
                '"/></filter>' +

                '</defs></svg>'
            );
            document.body.insertBefore(div.firstChild, document.body.firstChild);
        },

        /* ── Eventos ───────────────────────────── */
        bindEvents: function () {
            var self = this;

            /* Toggle do painel */
            $('#toggle-acessibilidade').on('click', function (e) {
                e.stopPropagation();
                var $painel = $('#painel-acessibilidade');
                var abrindo = $painel.hasClass('painel-hidden');
                $painel.toggleClass('painel-hidden');
                $(this).attr('aria-expanded', abrindo ? 'true' : 'false');
                if (abrindo) {
                    setTimeout(function () { $('#fechar-painel').trigger('focus'); }, 150);
                }
            });

            $('#fechar-painel').on('click', function () {
                $('#painel-acessibilidade').addClass('painel-hidden');
                $('#toggle-acessibilidade').attr('aria-expanded', 'false').trigger('focus');
            });

            /* Botões de opção */
            $(document).on('click', '.btn-acessibilidade', function () {
                var $btn = $(this);
                var acao = $btn.data('acao');
                $btn.closest('.opcao-botoes')
                    .find('.btn-acessibilidade')
                    .removeClass('ativo')
                    .attr('aria-pressed', 'false');
                $btn.addClass('ativo').attr('aria-pressed', 'true');
                self.aplicarAcao(acao);
            });

            /* Stepper de fonte */
            $('#btn-fonte-inc').on('click', function () {
                if (self.estado.fontLevel < FONT_MAX) {
                    self.estado.fontLevel++;
                    self.aplicarFontLevel(self.estado.fontLevel);
                    self.savePreferences();
                }
            });

            $('#btn-fonte-dec').on('click', function () {
                if (self.estado.fontLevel > FONT_MIN) {
                    self.estado.fontLevel--;
                    self.aplicarFontLevel(self.estado.fontLevel);
                    self.savePreferences();
                }
            });

            /* Toggles individuais */
            $(document).on('click', '#toggle-dislexia', function () {
                self.estado.dislexia = !self.estado.dislexia;
                self.aplicarDislexia(self.estado.dislexia);
                self.savePreferences();
            });

            $(document).on('click', '#toggle-lupa', function () {
                self.estado.lupa = !self.estado.lupa;
                self.aplicarLupa(self.estado.lupa);
                self.savePreferences();
            });

            $(document).on('click', '#toggle-links', function () {
                self.estado.linksDestacados = !self.estado.linksDestacados;
                self.aplicarLinksDestacados(self.estado.linksDestacados);
                self.savePreferences();
            });

            $(document).on('click', '#toggle-mascara', function () {
                self.estado.mascara = !self.estado.mascara;
                self.aplicarMascara(self.estado.mascara);
                self.savePreferences();
            });

            $(document).on('click', '#toggle-guia', function () {
                self.estado.guia = !self.estado.guia;
                self.aplicarGuia(self.estado.guia);
                self.savePreferences();
            });

            /* Botão reset */
            $(document).on('click', '.btn-reset', function () {
                self.resetTudo();
            });

            /* Fechar ao clicar fora */
            $(document).on('click', function (e) {
                if (!$(e.target).closest('#barra-acessibilidade').length) {
                    $('#painel-acessibilidade').addClass('painel-hidden');
                    $('#toggle-acessibilidade').attr('aria-expanded', 'false');
                }
            });

            /* ESC para fechar */
            $(document).on('keydown', function (e) {
                if (e.key === 'Escape' && !$('#painel-acessibilidade').hasClass('painel-hidden')) {
                    $('#painel-acessibilidade').addClass('painel-hidden');
                    $('#toggle-acessibilidade').attr('aria-expanded', 'false').trigger('focus');
                }
            });
        },

        /* ── Despacho de ações ─────────────────── */
        aplicarAcao: function (acao) {
            var e = this.estado;

            if (acao.indexOf('contraste-') === 0) {
                e.contraste = acao.replace('contraste-', '');
                this.aplicarContraste(e.contraste);

            } else if (acao.indexOf('satur-') === 0) {
                e.saturacao = acao.replace('satur-', '');
                this.composeBodyFilter();

            } else if (acao.indexOf('dalton-') === 0) {
                e.daltonismo = acao.replace('dalton-', '');
                this.composeBodyFilter();

            } else if (acao.indexOf('linha-') === 0) {
                e.linha = acao.replace('linha-', '');
                this.aplicarLinha(e.linha);

            } else if (acao.indexOf('letra-') === 0) {
                e.letra = acao.replace('letra-', '');
                this.aplicarLetra(e.letra);

            } else if (acao === 'cursor-normal') {
                e.cursor = 'normal';
                $('body').removeClass('cursor-grande');

            } else if (acao === 'cursor-grande') {
                e.cursor = 'grande';
                $('body').addClass('cursor-grande');
            }

            this.savePreferences();
        },

        /* ── Contraste ─────────────────────────── */
        aplicarContraste: function (modo) {
            var $body = $('body');
            $body.removeClass('contraste-alto contraste-invertido');

            /* Restaura overrides JS do alto contraste antes de mudar o modo */
            this._restoreContrasteAltoJS();

            if (modo === 'alto') {
                $body.addClass('contraste-alto');
                /*
                 * CSS !important cobre elementos sem inline style.
                 * JS cobre elementos Elementor com inline !important que CSS
                 * de folha de estilos não consegue superar (mesmo especificidade,
                 * último declarado vence — e o Elementor declara depois do nosso CSS).
                 * Guard garante que rAF não aplica se o modo já foi trocado.
                 */
                var self = this;
                requestAnimationFrame(function () {
                    if (self.estado.contraste === 'alto') {
                        self._applyContrasteAltoJS();
                    }
                });

            } else if (modo === 'invertido') {
                $body.addClass('contraste-invertido');
            }

            this.composeBodyFilter();
        },

        /* ── Composição do filtro visual global ────
           Aplica ao <html> (documentElement), não ao <body>.

           POR QUE <html> E NÃO <body>?
           Quando filter é aplicado a <body>, elementos com
           position:fixed (headers sticky, modais e popups do
           Elementor) passam a se posicionar relativos ao <body>
           filtrado e podem "escapar" visualmente do filtro.
           Ao aplicar em <html> (que tem dimensões ≈ viewport),
           position:fixed continua correto E todo o conteúdo recebe
           o filtro — incluindo sticky navbars e modais Elementor.

           Combina: invertido + saturação + daltonismo
        ───────────────────────────────────────────── */
        composeBodyFilter: function () {
            var e = this.estado;
            var filtros = [];

            if (e.contraste === 'invertido') {
                filtros.push('invert(1) hue-rotate(180deg)');
            }

            if (e.saturacao === 'cinza') {
                filtros.push('grayscale(100%)');
            } else if (e.saturacao === 'sepia') {
                filtros.push('sepia(75%)');
            }

            if (e.daltonismo === 'protan') {
                filtros.push('url(#acc-protan)');
            } else if (e.daltonismo === 'deuter') {
                filtros.push('url(#acc-deuter)');
            } else if (e.daltonismo === 'tritan') {
                filtros.push('url(#acc-tritan)');
            }

            var val = filtros.length > 0 ? filtros.join(' ') : '';
            /* Aplica em <html> para cobertura total (ver comentário acima) */
            document.documentElement.style.filter = val;
            /* Limpa filtro legado que versões anteriores aplicavam em body */
            document.body.style.filter = '';
        },

        /* ── Alto contraste — override via inline style JS ──────────
           Alvo: elementos com inline styles (Elementor e temas definem
           background-color/color via style="" com !important).
           CSS !important em folha de estilos NÃO consegue superar um
           inline !important porque a especificidade é a mesma e o
           Elementor declara depois. A única solução é sobrescrever
           diretamente o inline style do elemento via setProperty,
           que substitui o valor Elementor pelo de alto contraste.
        ───────────────────────────────────────────── */
        _applyContrasteAltoJS: function () {
            var els = document.querySelectorAll('body [style]');
            for (var i = 0, len = els.length; i < len; i++) {
                var el = els[i];
                if (typeof el.closest === 'function') {
                    if (el.closest('#barra-acessibilidade')) continue;
                    if (el.closest('[vw]'))                  continue;
                }
                /* Preserva valores originais apenas na primeira aplicação */
                if (!el.hasAttribute('data-acc-orig-color')) {
                    el.setAttribute('data-acc-orig-bg',    el.style.backgroundColor || '');
                    el.setAttribute('data-acc-orig-color',  el.style.color           || '');
                    el.setAttribute('data-acc-orig-bgi',    el.style.backgroundImage  || '');
                }
                el.style.setProperty('background-color',  '#000000', 'important');
                el.style.setProperty('color',              '#ffffff', 'important');
                el.style.setProperty('background-image',   'none',    'important');
            }
        },

        _restoreContrasteAltoJS: function () {
            var els = document.querySelectorAll('[data-acc-orig-color]');
            for (var i = 0, len = els.length; i < len; i++) {
                var el    = els[i];
                var origBg  = el.getAttribute('data-acc-orig-bg')    || '';
                var origClr = el.getAttribute('data-acc-orig-color')  || '';
                var origBgi = el.getAttribute('data-acc-orig-bgi')    || '';

                el.style.removeProperty('background-color');
                el.style.removeProperty('color');
                el.style.removeProperty('background-image');

                /* Restaura inline styles originais (se existiam) */
                if (origBg)  el.style.backgroundColor = origBg;
                if (origClr) el.style.color            = origClr;
                if (origBgi) el.style.backgroundImage  = origBgi;

                el.removeAttribute('data-acc-orig-bg');
                el.removeAttribute('data-acc-orig-color');
                el.removeAttribute('data-acc-orig-bgi');
            }
        },

        /* ── Linha / Letra ─────────────────────── */
        aplicarLinha: function (nivel) {
            $('body').removeClass('linha-media linha-ampla');
            if (nivel !== 'normal') $('body').addClass('linha-' + nivel);
        },

        aplicarLetra: function (nivel) {
            $('body').removeClass('letra-media letra-ampla');
            if (nivel !== 'normal') $('body').addClass('letra-' + nivel);
        },

        /* ── Dislexia ──────────────────────────── */
        aplicarDislexia: function (ativo) {
            var $toggle = $('#toggle-dislexia');
            if (ativo) {
                $('body').addClass('fonte-dislexia');
                $toggle.attr('aria-checked', 'true');
            } else {
                $('body').removeClass('fonte-dislexia');
                $toggle.attr('aria-checked', 'false');
            }
        },

        /* ── Stepper de fonte ──────────────────── */
        aplicarFontLevel: function (level) {
            var cfg   = FONT_LEVELS[String(level)];
            var scale = (FONT_SCALES[String(level)] !== undefined)
                        ? FONT_SCALES[String(level)]
                        : 1;

            /* Escala os textos do site via inline style (supera px fixo do Elementor) */
            this._scaleFonts(scale);

            /* Atualiza indicadores visuais do stepper */
            var label    = cfg ? cfg.label : 'Normal';
            var demoSize = cfg ? cfg.demo  : '18px';
            $('#fonte-nivel-label').text(label);
            $('#fonte-demo').css('font-size', demoSize);

            $('.nivel-dot').removeClass('ativo');
            $('.nivel-dot[data-level="' + level + '"]').addClass('ativo');

            $('#btn-fonte-dec').prop('disabled', level <= FONT_MIN);
            $('#btn-fonte-inc').prop('disabled', level >= FONT_MAX);
        },

        /* ── Filtro de elementos ────────────────── */
        /**
         * Retorna true para elementos que NÃO devem ter font-size alterado:
         *   • Barra de acessibilidade e VLibras (UI do plugin)
         *   • Elementos SVG e seus descendentes
         *   • Ícones de fonte (Font Awesome, Dashicons, Material Icons…)
         *   • Tags não-visuais (script, style, noscript…)
         */
        _shouldSkipEl: function (el) {
            var tag = (el.tagName || '').toUpperCase();

            /* Tags sem renderização de texto visível */
            if (!tag || /^(SCRIPT|STYLE|NOSCRIPT|META|LINK|HEAD|HTML|BODY|SVG|PATH|CIRCLE|RECT|POLYGON|POLYLINE|LINE|ELLIPSE|DEFS|USE|SYMBOL|G|MARKER|FILTER|PATTERN|TSPAN|ANIMATE|STOP)$/.test(tag)) {
                return true;
            }

            /* Dentro da barra de acessibilidade ou do VLibras */
            if (typeof el.closest === 'function') {
                if (el.closest('#barra-acessibilidade')) return true;
                if (el.closest('[vw]'))                  return true;
                /* Descendente de SVG inline */
                if (el.closest('svg'))                   return true;
            }

            /* Ícones de fonte identificados por classe */
            var cls = el.className;
            if (cls && typeof cls === 'string' && ACC_ICON_RE.test(cls)) return true;

            return false;
        },

        /* ── Escalamento de fonte — núcleo ─────── */
        /**
         * Aplica ou remove escalonamento de font-size em todos os elementos
         * de texto do site capturados por ACC_TEXT_SEL.
         *
         * Estratégia:
         *  1. Na primeira aplicação, o font-size computado (px) é guardado em
         *     ACC_FS_ATTR ("data-acc-orig-fs") — captura os valores reais do tema,
         *     independente de rem, em, px ou qualquer outra unidade.
         *  2. Em cada mudança de nível o override é recalculado como origPx × scale.
         *  3. Usa el.style.setProperty(..., 'important') para superar inline styles
         *     e regras !important do Elementor.
         *  4. Na restauração (scale=1) remove o override; o CSS do tema reassume.
         *
         * @param {number} scale  Fator multiplicador. 1 = restaurar.
         */
        _scaleFonts: function (scale) {
            var self    = this;
            var isReset = (scale === 1);
            var els     = document.querySelectorAll(ACC_TEXT_SEL);

            for (var i = 0, len = els.length; i < len; i++) {
                var el = els[i];

                if (self._shouldSkipEl(el)) continue;

                /* ── Restaurar original ── */
                if (isReset) {
                    el.style.removeProperty('font-size');
                    /* Mantém ACC_FS_ATTR para reuso eficiente se o usuário
                       ativar a escala novamente sem recarregar a página */
                    continue;
                }

                /* ── Capturar tamanho original (apenas uma vez por elemento) ── */
                var origPx;
                var stored = el.getAttribute(ACC_FS_ATTR);

                if (stored) {
                    origPx = parseFloat(stored);
                } else {
                    /* getComputedStyle sempre retorna px — funciona para rem, em, %, vw, etc. */
                    origPx = parseFloat(window.getComputedStyle(el).fontSize);
                    if (!origPx || origPx !== origPx /* guard NaN */) continue;
                    el.setAttribute(ACC_FS_ATTR, origPx.toFixed(3));
                }

                /* ── Aplicar escala ── */
                /* setProperty com 'important' supera qualquer inline style ou !important externo */
                el.style.setProperty(
                    'font-size',
                    (origPx * scale).toFixed(2) + 'px',
                    'important'
                );
            }
        },

        /* ── Lupa de navegação ─────────────────── */
        aplicarLupa: function (ativo) {
            var self = this;
            var $toggle = $('#toggle-lupa');

            if (ativo) {
                $toggle.attr('aria-checked', 'true');
                $(document).on('mousemove.acc-lupa', function (e) {
                    self._lupaMouseMove(e);
                });
                $(document).on('mouseleave.acc-lupa', function () {
                    self._hideLupa();
                });
            } else {
                $toggle.attr('aria-checked', 'false');
                $(document).off('mousemove.acc-lupa mouseleave.acc-lupa');
                this._hideLupa();
            }
        },

        _lupaMouseMove: function (e) {
            var self = this;
            clearTimeout(self._lupaTimer);
            self._lupaTimer = setTimeout(function () {
                var el = document.elementFromPoint(e.clientX, e.clientY);
                var text = self._getElementText(el);
                if (text) {
                    self._showLupa(text, e.clientX, e.clientY);
                } else {
                    self._hideLupa();
                }
            }, 60);
        },

        _getElementText: function (el) {
            if (!el || el === document.body || el === document.documentElement) return '';
            if ($(el).closest('#barra-acessibilidade').length) return '';
            if ($(el).closest('[vw]').length) return '';
            if (el.id === 'acc-lupa-bubble') return '';

            if (el.tagName === 'IMG') return el.alt || '';
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                return el.placeholder || el.getAttribute('aria-label') || '';
            }

            var texto   = '';
            var current = el;

            for (var i = 0; i < 5; i++) {
                if (!current || current === document.body) break;

                var tag       = current.tagName;
                var innerText = (current.innerText || current.textContent || '').trim();

                if (innerText.length >= 3) {
                    texto = innerText;
                    if (SEMANTIC_TAGS.indexOf(tag) !== -1) break;
                }

                current = current.parentElement;
            }

            texto = texto.replace(/\s+/g, ' ').trim();
            return texto.length > 200 ? texto.substring(0, 200) + '…' : texto;
        },

        _showLupa: function (text, mouseX, mouseY) {
            var $bubble = $('#acc-lupa-bubble');
            if (!text) { this._hideLupa(); return; }

            $bubble.text(text).removeClass('acc-lupa-below');

            var bubbleW = $bubble.outerWidth(true)  || 340;
            var bubbleH = $bubble.outerHeight(true) || 80;
            var margin  = 12;
            var offsetY = 18;

            var left = mouseX - 20;
            var top  = mouseY - bubbleH - offsetY;

            if (top < margin) {
                top = mouseY + 30;
                $bubble.addClass('acc-lupa-below');
            }

            var vpW = window.innerWidth;
            if (left + bubbleW + margin > vpW) left = vpW - bubbleW - margin;
            if (left < margin) left = margin;

            $bubble.css({ left: left + 'px', top: top + 'px' })
                   .removeClass('acc-lupa-hidden');
        },

        _hideLupa: function () {
            clearTimeout(this._lupaTimer);
            $('#acc-lupa-bubble').addClass('acc-lupa-hidden');
        },

        /* ── Links destacados ──────────────────── */
        aplicarLinksDestacados: function (ativo) {
            var $toggle = $('#toggle-links');
            if (ativo) {
                $('body').addClass('links-destacados');
                $toggle.attr('aria-checked', 'true');
            } else {
                $('body').removeClass('links-destacados');
                $toggle.attr('aria-checked', 'false');
            }
        },

        /* ── Máscara de leitura ────────────────── */
        aplicarMascara: function (ativo) {
            var $toggle = $('#toggle-mascara');

            if (ativo) {
                $toggle.attr('aria-checked', 'true');
                $('#acc-mascara-top, #acc-mascara-bottom').removeClass('acc-mascara-hidden');
            } else {
                $toggle.attr('aria-checked', 'false');
                $('#acc-mascara-top').css('height', '0');
                $('#acc-mascara-bottom').css('height', '0');
                $('#acc-mascara-top, #acc-mascara-bottom').addClass('acc-mascara-hidden');
            }

            this._updateNavHandlers();
        },

        /* ── Guia de leitura ───────────────────── */
        aplicarGuia: function (ativo) {
            var $toggle = $('#toggle-guia');

            if (ativo) {
                $toggle.attr('aria-checked', 'true');
                $('#acc-guia').removeClass('acc-guia-hidden');
            } else {
                $toggle.attr('aria-checked', 'false');
                $('#acc-guia').addClass('acc-guia-hidden');
            }

            this._updateNavHandlers();
        },

        /* ── Gerenciamento de handlers de navegação
           (máscara + guia compartilham um único
            listener de mousemove para performance)
        ───────────────────────────────────────── */
        _updateNavHandlers: function () {
            var self  = this;
            var needs = this.estado.mascara || this.estado.guia;

            if (needs) {
                if (!this._navHandlersActive) {
                    $(document).on('mousemove.acc-nav', function (e) {
                        self._navMouseMove(e);
                    });
                    $(document).on('mouseleave.acc-nav', function () {
                        self._navMouseLeave();
                    });
                    this._navHandlersActive = true;
                }
            } else {
                $(document).off('mousemove.acc-nav mouseleave.acc-nav');
                this._navHandlersActive = false;
            }
        },

        _navMouseMove: function (e) {
            var y  = e.clientY;
            var vh = window.innerHeight;

            if (this.estado.mascara) {
                var topH = Math.max(0, y - MASCARA_BANDA);
                var botH = Math.max(0, vh - y - MASCARA_BANDA);
                document.getElementById('acc-mascara-top').style.height    = topH + 'px';
                document.getElementById('acc-mascara-bottom').style.height = botH + 'px';
            }

            if (this.estado.guia) {
                document.getElementById('acc-guia').style.top = y + 'px';
            }
        },

        _navMouseLeave: function () {
            /* Ao sair da janela, colapsa a máscara (guia mantém última posição) */
            if (this.estado.mascara) {
                document.getElementById('acc-mascara-top').style.height    = '0';
                document.getElementById('acc-mascara-bottom').style.height = '0';
            }
        },

        /* ── Reset total ───────────────────────── */
        resetTudo: function () {
            this.estado = {
                fontLevel: 0, dislexia: false,
                linha: 'normal', letra: 'normal',
                contraste: 'normal', saturacao: 'normal',
                daltonismo: 'normal', cursor: 'normal',
                lupa: false, linksDestacados: false,
                mascara: false, guia: false
            };

            $('body').removeClass(
                'contraste-alto contraste-invertido ' +
                'linha-media linha-ampla ' +
                'letra-media letra-ampla ' +
                'fonte-dislexia cursor-grande ' +
                'links-destacados'
            );

            /* Limpa filtros visuais em ambos (html = atual, body = legado) */
            document.documentElement.style.filter = '';
            document.body.style.filter            = '';

            /* Restaura inline styles que _applyContrasteAltoJS sobrescreveu */
            this._restoreContrasteAltoJS();

            $('html').removeClass('acc-font-m1 acc-font-1 acc-font-2 acc-font-3');

            /* Lupa */
            $(document).off('mousemove.acc-lupa mouseleave.acc-lupa');
            this._hideLupa();

            /* Máscara + Guia */
            $(document).off('mousemove.acc-nav mouseleave.acc-nav');
            this._navHandlersActive = false;
            $('#acc-mascara-top, #acc-mascara-bottom').css('height', '0').addClass('acc-mascara-hidden');
            $('#acc-guia').addClass('acc-guia-hidden');

            localStorage.removeItem('acessibilidade_prefs');

            this.aplicarFontLevel(0);
            this.aplicarDislexia(false);
            this.marcarBotoesAtivos();
        },

        /* ── Persistência ──────────────────────── */
        savePreferences: function () {
            localStorage.setItem('acessibilidade_prefs', JSON.stringify(this.estado));
        },

        loadPreferences: function () {
            var salvo = localStorage.getItem('acessibilidade_prefs');
            if (!salvo) {
                this.marcarBotoesAtivos();
                this.aplicarFontLevel(0);
                return;
            }

            try {
                var prefs = JSON.parse(salvo);

                if (prefs.classes && Array.isArray(prefs.classes)) {
                    this._migrarPrefsLegadas(prefs.classes);
                    this.savePreferences();
                    this.aplicarTudoDoEstado();
                    return;
                }

                $.extend(this.estado, prefs);
                this.aplicarTudoDoEstado();

            } catch (e) {
                localStorage.removeItem('acessibilidade_prefs');
                this.marcarBotoesAtivos();
                this.aplicarFontLevel(0);
            }
        },

        /* Reconstrói toda a aplicação a partir do estado */
        aplicarTudoDoEstado: function () {
            var e = this.estado;

            this.aplicarFontLevel(e.fontLevel || 0);
            this.aplicarDislexia(!!e.dislexia);
            this.aplicarLinha(e.linha || 'normal');
            this.aplicarLetra(e.letra || 'normal');
            this.aplicarContraste(e.contraste || 'normal');
            this.composeBodyFilter();
            this.aplicarLupa(!!e.lupa);
            this.aplicarLinksDestacados(!!e.linksDestacados);
            this.aplicarMascara(!!e.mascara);
            this.aplicarGuia(!!e.guia);

            if (e.cursor === 'grande') {
                $('body').addClass('cursor-grande');
            } else {
                $('body').removeClass('cursor-grande');
            }

            this.marcarBotoesAtivos();
        },

        /* Migra prefs do formato v1/v2 (array de classes) */
        _migrarPrefsLegadas: function (classes) {
            if (classes.indexOf('contraste-alto') !== -1)      this.estado.contraste = 'alto';
            if (classes.indexOf('contraste-invertido') !== -1) this.estado.contraste = 'invertido';
            if (classes.indexOf('fonte-aumentar') !== -1)      this.estado.fontLevel = 2;
            if (classes.indexOf('fonte-diminuir') !== -1)      this.estado.fontLevel = -1;
            if (classes.indexOf('espaco-aumentado') !== -1)    { this.estado.linha = 'ampla'; this.estado.letra = 'media'; }
            if (classes.indexOf('cursor-grande') !== -1)       this.estado.cursor    = 'grande';
        },

        /* ── MutationObserver — conteúdo dinâmico ──
           Captura elementos adicionados APÓS o carregamento
           (modais Elementor, lazy-load, AJAX, popups) e re-aplica
           o alto contraste JS quando o modo está ativo.
           Só processa addedNodes para evitar falsos positivos.
           Debounce de 250ms absorve bursts de mutações.
        ───────────────────────────────────────────── */
        _initMutationObserver: function () {
            if (!window.MutationObserver) return;
            var self = this;

            self._mutationObserver = new MutationObserver(function (mutations) {
                /* Early exit — só actua quando alto contraste JS está ativo */
                if (self.estado.contraste !== 'alto') return;

                for (var i = 0; i < mutations.length; i++) {
                    if (mutations[i].addedNodes.length) {
                        clearTimeout(self._mutationTimer);
                        self._mutationTimer = setTimeout(function () {
                            if (self.estado.contraste === 'alto') {
                                self._applyContrasteAltoJS();
                            }
                        }, 250);
                        break;
                    }
                }
            });

            self._mutationObserver.observe(document.body, {
                childList: true,
                subtree:   true
            });
        },

        /* ── Marca botões ativos ────────────────── */
        marcarBotoesAtivos: function () {
            var e = this.estado;

            $('.btn-acessibilidade').removeClass('ativo').attr('aria-pressed', 'false');

            $('[data-acao="contraste-' + (e.contraste  || 'normal') + '"]').addClass('ativo').attr('aria-pressed', 'true');
            $('[data-acao="satur-'     + (e.saturacao  || 'normal') + '"]').addClass('ativo').attr('aria-pressed', 'true');
            $('[data-acao="dalton-'    + (e.daltonismo || 'normal') + '"]').addClass('ativo').attr('aria-pressed', 'true');
            $('[data-acao="linha-'     + (e.linha      || 'normal') + '"]').addClass('ativo').attr('aria-pressed', 'true');
            $('[data-acao="letra-'     + (e.letra      || 'normal') + '"]').addClass('ativo').attr('aria-pressed', 'true');
            $('[data-acao="cursor-'    + (e.cursor     || 'normal') + '"]').addClass('ativo').attr('aria-pressed', 'true');

            $('#toggle-lupa').attr(   'aria-checked', e.lupa            ? 'true' : 'false');
            $('#toggle-links').attr(  'aria-checked', e.linksDestacados ? 'true' : 'false');
            $('#toggle-mascara').attr('aria-checked', e.mascara         ? 'true' : 'false');
            $('#toggle-guia').attr(   'aria-checked', e.guia            ? 'true' : 'false');
        }
    };

    /* ─────────────────────────────────────────────
       BOOT
    ───────────────────────────────────────────── */
    $(document).ready(function () {
        Acessibilidade.init();
    });

    /**
     * Re-aplica modos ativos após carregamento completo da página.
     * Garante que elementos renderizados pelo Elementor JS (widgets, popups,
     * lazy-loaded sections) também sejam cobertos pelos modos de acessibilidade.
     */
    $(window).on('load', function () {
        var e     = Acessibilidade.estado;
        var level = e.fontLevel;

        /* Re-aplica escala de fonte para widgets Elementor assíncronos */
        if (level !== 0) {
            var scale = (FONT_SCALES[String(level)] !== undefined)
                        ? FONT_SCALES[String(level)]
                        : 1;
            Acessibilidade._scaleFonts(scale);
        }

        /* Re-aplica alto contraste JS para elementos carregados assincronamente */
        if (e.contraste === 'alto') {
            Acessibilidade._applyContrasteAltoJS();
        }
    });

})(jQuery);
