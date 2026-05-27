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

    /* ═══════════════════════════════════════════════════════════════════
       COLOR MANAGER — Sistema Adaptativo de Cores WCAG 2.1
       ═══════════════════════════════════════════════════════════════════
       Problema:
         O plugin herda variáveis CSS do Elementor Global Colors / theme.json.
         Quando o tema usa cores claras, pastéis, brancas ou com baixo
         contraste, a UI do painel fica "lavada" — cards invisíveis, botões
         ilegíveis, texto sem separação visual.

       Solução:
         1. Lê cada variável CSS via probe element (getComputedStyle resolve
            toda a cadeia var() e retorna o rgb() final).
         2. Calcula luminância relativa WCAG 2.1 e proporção de contraste.
         3. Detecta o "polo" do tema (light / dark / zona cinza ambígua).
         4. Ajusta cada cor via HSL para o mínimo de contraste exigido,
            preservando matiz e saturação sempre que possível.
         5. Injeta um <style id="acc-color-patch"> com as variáveis corrigidas,
            que por vir APÓS o CSS enfileirado (em document order) vence
            na cascata sem necessidade de !important.

       Contraste mínimo aplicado:
         • --acc-color-contrast vs --acc-color-base  → 7:1  (WCAG AAA)
         • --acc-color-muted     vs --acc-color-base  → 4.5:1 (WCAG AA)
         • --acc-color-muted     vs --acc-color-surface → 4.5:1 (WCAG AA)
         • --acc-color-border    vs --acc-color-surface → 3:1   (UI component)
         • --acc-color-secondary vs --acc-color-base  → 3:1   (UI component)
         • texto branco          vs --acc-color-secondary → 4.5:1 (texto btn-reset)
    ═══════════════════════════════════════════════════════════════════ */
    var ColorManager = {

        /* ── Paleta de fallback — sempre WCAG AAA entre si ─── */
        SAFE: {
            dark:    { r: 17,  g: 24,  b: 39  },   /* #111827 — Tailwind gray-900  */
            medium:  { r: 55,  g: 65,  b: 81  },   /* #374151 — Tailwind gray-700  */
            light:   { r: 255, g: 255, b: 255 },   /* #ffffff — branco puro        */
            surface: { r: 249, g: 250, b: 251 },   /* #f9fafb — Tailwind gray-50   */
            surfaceDark: { r: 31, g: 41, b: 55 },  /* #1f2937 — Tailwind gray-800  */
            border:  { r: 209, g: 213, b: 219 },   /* #d1d5db — Tailwind gray-300  */
            borderDark: { r: 75, g: 85, b: 99 },   /* #4b5563 — Tailwind gray-600  */
            muted:   { r: 107, g: 114, b: 128 },   /* #6b7280 — Tailwind gray-500  */
            mutedDark: { r: 156, g: 163, b: 175 }, /* #9ca3af — Tailwind gray-400  */
            blue:    { r: 37,  g: 99,  b: 235  }   /* #2563eb — Tailwind blue-600  */
        },

        /* Limiares de contraste WCAG */
        MIN_AA:  4.5,   /* Texto normal */
        MIN_UI:  3.0,   /* Componentes UI / texto grande */
        MIN_AAA: 7.0,   /* Texto pequeno AAA */

        /* ══════════════════════════════════════════
           UTILITÁRIOS MATEMÁTICOS DE COR
        ══════════════════════════════════════════ */

        /**
         * Parseia `rgb(r,g,b)` ou `rgba(r,g,b,a)` retornado por getComputedStyle.
         * Retorna null para transparent (alpha = 0) ou string inválida.
         */
        _parseRgb: function (str) {
            if (!str || str === 'transparent') return null;
            var m = str.match(
                /rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*([\d.]+))?\s*\)/
            );
            if (!m) return null;
            if (m[4] !== undefined && parseFloat(m[4]) < 0.05) return null; /* alpha ≈ 0 */
            return {
                r: Math.round(parseFloat(m[1])),
                g: Math.round(parseFloat(m[2])),
                b: Math.round(parseFloat(m[3]))
            };
        },

        /** Converte {r,g,b} para string CSS `rgb(r,g,b)`. */
        _toRgb: function (c) {
            return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
        },

        /**
         * Luminância relativa WCAG 2.1 (IEC 61966-2-1 sRGB linearisation).
         * @returns {number} 0 (preto absoluto) … 1 (branco absoluto)
         */
        _lum: function (c) {
            var lin = function (v) {
                v /= 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            };
            return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
        },

        /**
         * Proporção de contraste WCAG 2.1 entre dois {r,g,b}.
         * @returns {number} 1.0 (sem contraste) … 21.0 (preto sobre branco)
         */
        _contrast: function (c1, c2) {
            var l1 = this._lum(c1), l2 = this._lum(c2);
            var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
            return (hi + 0.05) / (lo + 0.05);
        },

        /** Converte {r,g,b} → {h:0-360, s:0-100, l:0-100}. */
        _rgbToHsl: function (c) {
            var r = c.r / 255, g = c.g / 255, b = c.b / 255;
            var max = Math.max(r, g, b), min = Math.min(r, g, b);
            var h = 0, s = 0, l = (max + min) / 2;
            if (max !== min) {
                var d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                    case g: h = ((b - r) / d + 2) / 6;                break;
                    case b: h = ((r - g) / d + 4) / 6;                break;
                }
            }
            return { h: h * 360, s: s * 100, l: l * 100 };
        },

        /** Converte HSL (h:0-360, s:0-100, l:0-100) → {r,g,b}. */
        _hslToRgb: function (h, s, l) {
            h /= 360; s /= 100; l /= 100;
            var r, g, b;
            if (s === 0) {
                r = g = b = l;
            } else {
                var hue2 = function (p, q, t) {
                    if (t < 0) t += 1; if (t > 1) t -= 1;
                    if (t < 1 / 6) return p + (q - p) * 6 * t;
                    if (t < 1 / 2) return q;
                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                    return p;
                };
                var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                var p = 2 * l - q;
                r = hue2(p, q, h + 1 / 3);
                g = hue2(p, q, h);
                b = hue2(p, q, h - 1 / 3);
            }
            return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
        },

        /**
         * Ajusta `fg` (escurecendo se goDark=true, clareando se false) até que
         * contraste(fg, bg) ≥ minRatio. Preserva matiz e saturação da cor original.
         *
         * Algoritmo: percorre L em passos de 1.5% na direção correta.
         * Retorna preto puro / branco puro como último recurso absoluto.
         *
         * @param {object}  fg       — {r,g,b} cor a ajustar
         * @param {object}  bg       — {r,g,b} background de referência
         * @param {number}  minRatio — contraste mínimo exigido
         * @param {boolean} goDark   — true = escurece fg; false = clareia
         * @returns {object} {r,g,b} ajustado
         */
        _makeSafe: function (fg, bg, minRatio, goDark) {
            if (this._contrast(fg, bg) >= minRatio) return fg; /* já OK */

            var hsl  = this._rgbToHsl(fg);
            var step = goDark ? -1.5 : 1.5;
            var l    = hsl.l;

            for (var i = 0; i < 80; i++) {
                l = Math.max(0, Math.min(100, l + step));
                var candidate = this._hslToRgb(hsl.h, hsl.s, l);
                if (this._contrast(candidate, bg) >= minRatio) return candidate;
                if (l <= 0 || l >= 100) break;
            }
            /* Último recurso — não preserva matiz mas garante contraste */
            return goDark ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
        },

        /* ══════════════════════════════════════════
           RESOLUÇÃO DE VARIÁVEIS CSS
        ══════════════════════════════════════════ */

        /**
         * Resolve o valor computado de uma CSS custom property no contexto de
         * #barra-acessibilidade, usando a técnica "probe element":
         *
         *   div.style.color = 'var(--acc-color-contrast)'
         *   getComputedStyle(div).color  →  'rgb(r, g, b)'
         *
         * O browser resolve toda a cadeia var() (incluindo Elementor Global Colors
         * e WordPress theme.json) e retorna o rgb() final — mesmo que a variável
         * CSS contenha múltiplos fallbacks aninhados.
         *
         * @param {string} varName — ex: '--acc-color-contrast'
         * @returns {object|null} {r,g,b} ou null se inválida / transparent
         */
        _resolve: function (varName) {
            var bar = document.getElementById('barra-acessibilidade');
            if (!bar) return null;

            var probe = document.createElement('div');
            /* display:none impede reflow; color é o canal mais confiável para
               resolver uma cor arbitrária via var() */
            probe.setAttribute('style',
                'display:none;position:absolute;color:var(' + varName + ')');
            bar.appendChild(probe);
            var computed = window.getComputedStyle(probe).color;
            bar.removeChild(probe);

            return this._parseRgb(computed);
        },

        /* ══════════════════════════════════════════
           ANÁLISE E CORREÇÃO DE CORES
        ══════════════════════════════════════════ */

        /**
         * Ponto de entrada: resolve todas as variáveis acc-*, valida os pares
         * de contraste WCAG e injeta overrides via <style id="acc-color-patch">.
         *
         * Idempotente — pode ser chamado várias vezes (atualiza o patch
         * existente em vez de criar um novo).
         */
        _analyzeAndPatch: function () {
            /* ── 1. Resolver variáveis CSS (fallback para SAFE se inválidas) ── */
            var base      = this._resolve('--acc-color-base')      || this.SAFE.light;
            var contrast  = this._resolve('--acc-color-contrast')  || this.SAFE.dark;
            var surface   = this._resolve('--acc-color-surface')   || this.SAFE.surface;
            var border    = this._resolve('--acc-color-border')    || this.SAFE.border;
            var muted     = this._resolve('--acc-color-muted')     || this.SAFE.muted;
            var secondary = this._resolve('--acc-color-secondary') || this.SAFE.blue;
            var accent    = this._resolve('--acc-color-accent')    || { r: 26, g: 188, b: 156 };

            var baseLum = this._lum(base);

            /* ── 2. Detectar polo do tema e normalizar base ── */
            /*
             * Luminância do fundo define se o tema é light ou dark:
             *   < 0.18  → dark mode (fundo escuro)
             *   ≥ 0.75  → light mode (fundo claro)
             *   0.18–0.75 → "zona cinza" — problemática:
             *     • escura demais para texto claro ter AA
             *     • clara demais para texto escuro ter AAA confortável
             *   Solução: empurrar a base para o polo mais próximo.
             */
            var isDark;
            var safeBase = base;

            if (baseLum < 0.18) {
                isDark = true;
                /* Se dark mas ainda muito acinzentado, escurece mais */
                if (baseLum > 0.04) {
                    var bh0 = this._rgbToHsl(base);
                    safeBase = this._hslToRgb(bh0.h, bh0.s * 0.5, 7);
                }
            } else if (baseLum >= 0.75) {
                isDark = false;
                /* Base já é claramente claro — mantém */
            } else {
                /* Zona cinza (0.18–0.75) → força para claro */
                isDark = false;
                var bh1 = this._rgbToHsl(base);
                /* Preserva o matiz sutil mas empurra lightness para ≥ 96% */
                safeBase = this._hslToRgb(bh1.h, bh1.s * 0.2, 97);
            }

            /* ── 3. Validar e corrigir --acc-color-contrast ──
             * Usado como background do cabeçalho do painel, do botão toggle
             * e dos botões ativos. Texto sobre ele é --acc-color-base.
             * Exigência: contraste(contrast, safeBase) ≥ AAA (7:1).
             */
            var safeContrast = this._makeSafe(contrast, safeBase, this.MIN_AAA, !isDark);

            /*
             * Verificação adicional: se após ajuste a cor ainda ficou clara demais
             * em tema light, ou escura demais em dark, usa o safe hardcoded.
             * Ex: contraste neon #00ff00 → escurece para ~#005900, mas se o
             * algoritmo convergiu para um cinza neutro, usa dark/light seguro.
             */
            if (!isDark && this._lum(safeContrast) > 0.10) {
                safeContrast = this._makeSafe(this.SAFE.dark, safeBase, this.MIN_AAA, true);
            }
            if (isDark && this._lum(safeContrast) < 0.70) {
                safeContrast = this._makeSafe(this.SAFE.light, safeBase, this.MIN_AAA, false);
            }

            /* ── 4. Surface: background de cards e botões ──
             * Deve ser visualmente distinto de safeBase (identificar cards),
             * mas não de forma drástica (manter identidade visual).
             * Ideal: contraste(surface, safeBase) entre 1.06 e 2.0.
             */
            var safeSurface = surface;
            var sc = this._contrast(safeBase, surface);
            if (sc < 1.06) {
                /* Surface quase idêntica à base — gera shade sutil */
                var bh2 = this._rgbToHsl(safeBase);
                safeSurface = isDark
                    ? this._hslToRgb(bh2.h, bh2.s, Math.min(100, bh2.l + 6))
                    : this._hslToRgb(bh2.h, bh2.s, Math.max(0,   bh2.l - 4));
            } else if (!isDark && this._lum(safeSurface) < 0.60) {
                /* Surface escura demais em tema claro → substitui por safe */
                safeSurface = this.SAFE.surface;
            } else if (isDark && this._lum(safeSurface) > 0.30) {
                /* Surface clara demais em tema dark → substitui por safe dark */
                safeSurface = this.SAFE.surfaceDark;
            }

            /* ── 5. Border: visibilidade como separador visual ──
             * WCAG SC 1.4.11 (UI component): contraste ≥ 3:1 contra surface.
             */
            var safeBorder = border;
            if (this._contrast(border, safeSurface) < this.MIN_UI) {
                var sh = this._rgbToHsl(safeSurface);
                safeBorder = isDark
                    ? this._hslToRgb(sh.h, sh.s, Math.min(100, sh.l + 24))
                    : this._hslToRgb(sh.h, sh.s, Math.max(0,   sh.l - 22));
                /* Se ainda insuficiente, usa safe hardcoded */
                if (this._contrast(safeBorder, safeSurface) < this.MIN_UI) {
                    safeBorder = isDark ? this.SAFE.borderDark : this.SAFE.border;
                }
            }

            /* ── 6. Muted: texto secundário, labels, rodapé ──
             * Deve ter contraste ≥ 4.5:1 em AMBOS safeBase E safeSurface.
             * (Textos muted aparecem em ambos os contextos.)
             */
            var safeMuted = muted;
            if (this._contrast(safeMuted, safeBase) < this.MIN_AA) {
                safeMuted = this._makeSafe(safeMuted, safeBase, this.MIN_AA, !isDark);
            }
            if (this._contrast(safeMuted, safeSurface) < this.MIN_AA) {
                /* Re-ajusta para satisfazer ambos os backgrounds */
                safeMuted = this._makeSafe(safeMuted, safeSurface, this.MIN_AA, !isDark);
                /* Verifica se ainda satisfaz safeBase depois do segundo ajuste */
                if (this._contrast(safeMuted, safeBase) < this.MIN_AA) {
                    safeMuted = isDark ? this.SAFE.mutedDark : this.SAFE.muted;
                }
            }

            /* ── 7. Secondary: botão reset ──
             * O CSS usa:
             *   background-color: var(--acc-color-secondary)  ← fundo do botão
             *   color:            var(--acc-color-base)        ← texto = fundo do painel
             *
             * Dois requisitos:
             *  (a) secondary se destaca contra safeBase como botão: contraste ≥ 3:1
             *  (b) safeBase (texto) é legível sobre secondary: contraste ≥ 4.5:1
             *
             * Em light mode: safeBase ≈ branco → secondary deve ser escuro.
             * Em dark mode:  safeBase ≈ escuro → secondary deve ser claro/médio.
             * A mesma função _makeSafe com goDark=!isDark cobre ambos os casos.
             */
            var safeSecondary = secondary;
            if (this._contrast(safeSecondary, safeBase) < this.MIN_UI) {
                safeSecondary = this._makeSafe(safeSecondary, safeBase, this.MIN_UI, !isDark);
            }
            /* (b) Texto (safeBase) sobre secondary deve ter AA */
            if (this._contrast(safeBase, safeSecondary) < this.MIN_AA) {
                safeSecondary = this._makeSafe(safeSecondary, safeBase, this.MIN_AA, !isDark);
            }

            /* ── 8. Accent: pontos de nível, indicadores ──
             * Contraste ≥ 3:1 contra safeBase (visibilidade como indicador UI).
             */
            var safeAccent = accent;
            if (this._contrast(safeAccent, safeBase) < this.MIN_UI) {
                safeAccent = this._makeSafe(safeAccent, safeBase, this.MIN_UI, !isDark);
            }

            /* ── 9. Injetar CSS corrigido ── */
            this._inject(safeBase, safeContrast, safeSecondary, safeSurface, safeBorder, safeMuted, safeAccent);
        },

        /**
         * Injeta (ou atualiza) <style id="acc-color-patch"> no <head>.
         * Por estar APÓS os stylesheets enfileirados na ordem do documento,
         * vence na cascata CSS sem precisar de !important.
         */
        _inject: function (base, contrast, secondary, surface, border, muted, accent) {
            var t = this;
            var css = (
                '#barra-acessibilidade{' +
                    '--acc-color-base:'      + t._toRgb(base)      + ';' +
                    '--acc-color-contrast:'  + t._toRgb(contrast)  + ';' +
                    '--acc-color-secondary:' + t._toRgb(secondary) + ';' +
                    '--acc-color-surface:'   + t._toRgb(surface)   + ';' +
                    '--acc-color-border:'    + t._toRgb(border)    + ';' +
                    '--acc-color-muted:'     + t._toRgb(muted)     + ';' +
                    '--acc-color-accent:'    + t._toRgb(accent)    + ';' +
                '}'
            );

            var el = document.getElementById('acc-color-patch');
            if (el) {
                el.textContent = css; /* atualiza patch existente */
                return;
            }
            var style = document.createElement('style');
            style.id          = 'acc-color-patch';
            style.textContent = css;
            document.head.appendChild(style);
        },

        /** Ponto de entrada público — chamado em Acessibilidade.init(). */
        init: function () {
            this._analyzeAndPatch();
        }
    };

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
            ColorManager.init();            /* Valida e corrige cores WCAG antes de renderizar */
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

        /*
         * Re-analisa cores após load completo.
         * Elementor Pro / theme builders podem atualizar CSS custom properties
         * via JavaScript após DOMContentLoaded (ex: modo escuro dinâmico,
         * font/color tokens injetados por JS). O segundo _analyzeAndPatch
         * captura essas mudanças.
         */
        ColorManager._analyzeAndPatch();

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
