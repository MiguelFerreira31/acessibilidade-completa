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
        '.widget li,' +
        /* WooCommerce — páginas de produto, carrinho e checkout */
        '.product_title,' +
        '.woocommerce-loop-product__title,' +
        '.price,' +
        '.woocommerce-product-details__short-description p,' +
        '.woocommerce-product-details__short-description li,' +
        '.cart_item td,' +
        '.order-total td,' +
        '.woocommerce-checkout-review-order-table td,' +
        '.woocommerce-error li,' +
        '.woocommerce-message,' +
        '.woocommerce-info'
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

        /**
         * Resolve múltiplas CSS custom properties em uma única operação DOM.
         *
         * Problema que resolve:
         *   Chamar _resolve() 7 vezes = 7 appends + 7 getComputedStyle + 7 removes.
         *   Cada getComputedStyle antes de um removeChild pode forçar um style
         *   recalculation separado — até 7 recalculations no pior caso.
         *
         * Solução (batch probe):
         *   1. Cria um container com display:none (sem reflow).
         *   2. Appenda N filhos de uma só vez (uma única inserção no DOM).
         *   3. Lê getComputedStyle de cada filho — browser pode agrupar em 1 pass.
         *   4. Remove o container em uma única operação.
         *   Total: 1 insert + N reads + 1 remove = ~60% menos overhead vs 7×_resolve().
         *
         * @param {string[]} varNames  Array de nomes de variável, ex: ['--acc-color-base', ...]
         * @returns {Object}  Mapa varName → {r,g,b} | null
         */
        _resolveBatch: function (varNames) {
            var bar = document.getElementById('barra-acessibilidade');
            if (!bar) {
                var empty = {};
                for (var n = 0; n < varNames.length; n++) empty[varNames[n]] = null;
                return empty;
            }

            /* Container com display:none — não dispara layout */
            var container = document.createElement('div');
            container.setAttribute('style', 'display:none;position:absolute');

            var probes = [];
            for (var i = 0; i < varNames.length; i++) {
                var probe = document.createElement('div');
                probe.setAttribute('style', 'color:var(' + varNames[i] + ')');
                container.appendChild(probe);
                probes.push(probe);
            }

            bar.appendChild(container);

            /* Leitura em batch — browser resolve tudo antes de retornar */
            var out = {};
            for (var j = 0; j < varNames.length; j++) {
                out[varNames[j]] = this._parseRgb(window.getComputedStyle(probes[j]).color);
            }

            bar.removeChild(container);
            return out;
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
            /* ── 1. Resolver variáveis CSS em batch (1 operação DOM em vez de 7) ── */
            var vars = this._resolveBatch([
                '--acc-color-base',
                '--acc-color-contrast',
                '--acc-color-surface',
                '--acc-color-border',
                '--acc-color-muted',
                '--acc-color-secondary',
                '--acc-color-accent'
            ]);
            var base      = vars['--acc-color-base']      || this.SAFE.light;
            var contrast  = vars['--acc-color-contrast']  || this.SAFE.dark;
            var surface   = vars['--acc-color-surface']   || this.SAFE.surface;
            var border    = vars['--acc-color-border']    || this.SAFE.border;
            var muted     = vars['--acc-color-muted']     || this.SAFE.muted;
            var secondary = vars['--acc-color-secondary'] || this.SAFE.blue;
            var accent    = vars['--acc-color-accent']    || { r: 26, g: 188, b: 156 };

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
        _suppressAnnounce:  false,   /* true durante loadPreferences/reset para silenciar live region */
        _fontEls:           null,    /* cache de elementos de texto — null = inválido, array = válido */

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
                    var cfgInc = FONT_LEVELS[String(self.estado.fontLevel)];
                    self._announce('Fonte: ' + (cfgInc ? cfgInc.label : 'Normal'));
                    self.savePreferences();
                }
            });

            $('#btn-fonte-dec').on('click', function () {
                if (self.estado.fontLevel > FONT_MIN) {
                    self.estado.fontLevel--;
                    self.aplicarFontLevel(self.estado.fontLevel);
                    var cfgDec = FONT_LEVELS[String(self.estado.fontLevel)];
                    self._announce('Fonte: ' + (cfgDec ? cfgDec.label : 'Normal'));
                    self.savePreferences();
                }
            });

            /* Toggles individuais */
            $(document).on('click', '#toggle-dislexia', function () {
                self.estado.dislexia = !self.estado.dislexia;
                self.aplicarDislexia(self.estado.dislexia);
                self._announce(self.estado.dislexia ? 'Fonte para dislexia ativada' : 'Fonte para dislexia desativada');
                self.savePreferences();
            });

            $(document).on('click', '#toggle-lupa', function () {
                self.estado.lupa = !self.estado.lupa;
                self.aplicarLupa(self.estado.lupa);
                self._announce(self.estado.lupa ? 'Lupa de navegação ativada' : 'Lupa de navegação desativada');
                self.savePreferences();
            });

            $(document).on('click', '#toggle-links', function () {
                self.estado.linksDestacados = !self.estado.linksDestacados;
                self.aplicarLinksDestacados(self.estado.linksDestacados);
                self._announce(self.estado.linksDestacados ? 'Destaque de links ativado' : 'Destaque de links desativado');
                self.savePreferences();
            });

            $(document).on('click', '#toggle-mascara', function () {
                self.estado.mascara = !self.estado.mascara;
                self.aplicarMascara(self.estado.mascara);
                self._announce(self.estado.mascara ? 'Máscara de leitura ativada' : 'Máscara de leitura desativada');
                self.savePreferences();
            });

            $(document).on('click', '#toggle-guia', function () {
                self.estado.guia = !self.estado.guia;
                self.aplicarGuia(self.estado.guia);
                self._announce(self.estado.guia ? 'Guia de leitura ativado' : 'Guia de leitura desativado');
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

            /*
             * Focus Trap — WCAG 2.1 SC 2.1.2 (No Keyboard Trap, Level A)
             *
             * Enquanto o painel estiver aberto, Tab e Shift+Tab navegam APENAS
             * entre os elementos focáveis internos, wrapping do último ao primeiro.
             * O usuário nunca fica preso: ESC sempre fecha e devolve foco ao toggle.
             *
             * Por que não usar :focus-within?
             *   :focus-within é CSS-only e não pode conter o foco — apenas estilizar.
             *   O trap precisa de interceptação ativa do evento keydown.
             */
            $(document).on('keydown.acc-trap', function (e) {
                if (e.key !== 'Tab') return;

                var $painel = $('#painel-acessibilidade');
                if ($painel.hasClass('painel-hidden')) return;

                /* Elementos focáveis visíveis dentro do diálogo */
                var $focusable = $painel.find(
                    'button:not([disabled]),' +
                    '[href],' +
                    'input:not([disabled]),' +
                    'select:not([disabled]),' +
                    'textarea:not([disabled]),' +
                    '[tabindex]:not([tabindex="-1"])'
                ).filter(':visible');

                if (!$focusable.length) return;

                var first = $focusable.first()[0];
                var last  = $focusable.last()[0];

                if (e.shiftKey) {
                    /* Shift+Tab no primeiro elemento → vai para o último */
                    if (document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    /* Tab no último elemento → vai para o primeiro */
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            });
        },

        /* ── Despacho de ações ─────────────────── */
        aplicarAcao: function (acao) {
            var e = this.estado;

            if (acao.indexOf('contraste-') === 0) {
                e.contraste = acao.replace('contraste-', '');
                this.aplicarContraste(e.contraste);
                var labC = { normal: 'Contraste normal', alto: 'Alto contraste ativado', invertido: 'Contraste invertido ativado' };
                this._announce(labC[e.contraste] || e.contraste);

            } else if (acao.indexOf('satur-') === 0) {
                e.saturacao = acao.replace('satur-', '');
                this.composeBodyFilter();
                var labS = { normal: 'Saturação normal', cinza: 'Escala de cinza ativada', sepia: 'Sépia ativada' };
                this._announce(labS[e.saturacao] || e.saturacao);

            } else if (acao.indexOf('dalton-') === 0) {
                e.daltonismo = acao.replace('dalton-', '');
                this.composeBodyFilter();
                var labD = { normal: 'Visão normal', protan: 'Simulação protanopia', deuter: 'Simulação deuteranopia', tritan: 'Simulação tritanopia' };
                this._announce(labD[e.daltonismo] || e.daltonismo);

            } else if (acao.indexOf('linha-') === 0) {
                e.linha = acao.replace('linha-', '');
                this.aplicarLinha(e.linha);
                var labL = { normal: 'Espaço entre linhas normal', media: 'Espaço entre linhas médio', ampla: 'Espaço entre linhas amplo' };
                this._announce(labL[e.linha] || e.linha);

            } else if (acao.indexOf('letra-') === 0) {
                e.letra = acao.replace('letra-', '');
                this.aplicarLetra(e.letra);
                var labLt = { normal: 'Espaço entre letras normal', media: 'Espaço entre letras médio', ampla: 'Espaço entre letras amplo' };
                this._announce(labLt[e.letra] || e.letra);

            } else if (acao === 'cursor-normal') {
                e.cursor = 'normal';
                $('body').removeClass('cursor-grande');
                this._announce('Cursor normal');

            } else if (acao === 'cursor-grande') {
                e.cursor = 'grande';
                $('body').addClass('cursor-grande');
                this._announce('Cursor grande ativado');
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
                /* Preserva valores originais apenas na primeira aplicação.
                   border-color incluído: Elementor define bordas via inline style
                   (ex: seções com border decorativo) que ficam visíveis sobre fundo preto. */
                if (!el.hasAttribute('data-acc-orig-color')) {
                    el.setAttribute('data-acc-orig-bg',     el.style.backgroundColor || '');
                    el.setAttribute('data-acc-orig-color',  el.style.color            || '');
                    el.setAttribute('data-acc-orig-bgi',    el.style.backgroundImage  || '');
                    el.setAttribute('data-acc-orig-border', el.style.borderColor      || '');
                }
                el.style.setProperty('background-color',  '#000000', 'important');
                el.style.setProperty('color',              '#ffffff', 'important');
                el.style.setProperty('background-image',   'none',    'important');
                el.style.setProperty('border-color',       '#ffffff', 'important');
            }
        },

        _restoreContrasteAltoJS: function () {
            var els = document.querySelectorAll('[data-acc-orig-color]');
            for (var i = 0, len = els.length; i < len; i++) {
                var el      = els[i];
                var origBg  = el.getAttribute('data-acc-orig-bg')     || '';
                var origClr = el.getAttribute('data-acc-orig-color')   || '';
                var origBgi = el.getAttribute('data-acc-orig-bgi')     || '';
                var origBdr = el.getAttribute('data-acc-orig-border')  || '';

                el.style.removeProperty('background-color');
                el.style.removeProperty('color');
                el.style.removeProperty('background-image');
                el.style.removeProperty('border-color');

                /* Restaura inline styles originais (se existiam) */
                if (origBg)  el.style.backgroundColor = origBg;
                if (origClr) el.style.color            = origClr;
                if (origBgi) el.style.backgroundImage  = origBgi;
                if (origBdr) el.style.borderColor       = origBdr;

                el.removeAttribute('data-acc-orig-bg');
                el.removeAttribute('data-acc-orig-color');
                el.removeAttribute('data-acc-orig-bgi');
                el.removeAttribute('data-acc-orig-border');
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

        /* ── Cache de elementos de texto ─────────
           _fontEls é populado na primeira chamada de _scaleFonts (lazy build).
           O MutationObserver usa _extendFontCache para adicionar apenas novos nós,
           evitando o querySelectorAll completo em cada inserção dinâmica.
        ───────────────────────────────────────── */

        /**
         * Constrói o cache inicial de todos os elementos de texto do DOM atual.
         * Executado uma única vez por "sessão de escala" (quando o usuário ativa
         * pela primeira vez ou após um reset).
         *
         * Complexidade: O(n) onde n = total de nós que correspondem a ACC_TEXT_SEL.
         * Nas chamadas seguintes, _scaleFonts itera sobre _fontEls (cache) em O(m)
         * onde m ≤ n — elementos desconectados são pulados mas não removidos aqui.
         */
        _buildFontCache: function () {
            var raw  = document.querySelectorAll(ACC_TEXT_SEL);
            var list = [];
            for (var i = 0, len = raw.length; i < len; i++) {
                if (!this._shouldSkipEl(raw[i])) {
                    list.push(raw[i]);
                }
            }
            this._fontEls = list;
        },

        /**
         * Adiciona apenas os novos nós inseridos via MutationObserver ao cache.
         *
         * Compactação automática: se _fontEls crescer além de 800 entradas,
         * remove silenciosamente os elementos desconectados (removidos do DOM)
         * antes de adicionar os novos. Previne crescimento ilimitado em páginas
         * com heavy DOM churn (ex: infinite scroll, tabs que destroem/reconstroem).
         *
         * @param {Node[]} addedNodes  Array de nós adicionados (de mutations[].addedNodes)
         */
        _extendFontCache: function (addedNodes) {
            if (this._fontEls === null) return; /* cache inválido — full scan na próxima chamada */

            /* Compactação lazy: só executa quando o cache fica grande */
            if (this._fontEls.length > 800) {
                var alive = [];
                for (var k = 0; k < this._fontEls.length; k++) {
                    /* isConnected: false = removido do DOM. undefined = IE11 (preserva) */
                    if (this._fontEls[k].isConnected !== false) {
                        alive.push(this._fontEls[k]);
                    }
                }
                this._fontEls = alive;
            }

            for (var i = 0; i < addedNodes.length; i++) {
                var node = addedNodes[i];
                if (!node || node.nodeType !== 1 /* ELEMENT_NODE */) continue;

                /* O próprio nó adicionado (se corresponde ao seletor) */
                if (node.matches && node.matches(ACC_TEXT_SEL) && !this._shouldSkipEl(node)) {
                    this._fontEls.push(node);
                }

                /* Descendentes do nó (ex: Elementor injeta um wrapper com vários filhos) */
                if (node.querySelectorAll) {
                    var children = node.querySelectorAll(ACC_TEXT_SEL);
                    for (var j = 0; j < children.length; j++) {
                        if (!this._shouldSkipEl(children[j])) {
                            this._fontEls.push(children[j]);
                        }
                    }
                }
            }
        },

        /**
         * Aplica ou remove escala de font-size em um único elemento.
         * Extrai a lógica repetida de _scaleFonts para uso no MutationObserver.
         *
         * @param {Element} el     Elemento alvo.
         * @param {number}  scale  Fator multiplicador (sempre !== 1 aqui).
         */
        _applyScaleToEl: function (el, scale) {
            var stored = el.getAttribute(ACC_FS_ATTR);
            var origPx;
            if (stored) {
                origPx = parseFloat(stored);
            } else {
                origPx = parseFloat(window.getComputedStyle(el).fontSize);
                if (!origPx || origPx !== origPx /* NaN guard */) return;
                el.setAttribute(ACC_FS_ATTR, origPx.toFixed(3));
            }
            el.style.setProperty('font-size', (origPx * scale).toFixed(2) + 'px', 'important');
        },

        /* ── Escalamento de fonte — núcleo ─────── */
        /**
         * Aplica ou remove escalonamento de font-size nos elementos de texto do site.
         *
         * Estratégia com cache:
         *  1. Na primeira chamada (scale !== 1), _buildFontCache() varre o DOM
         *     uma única vez e popula _fontEls.
         *  2. Chamadas subsequentes iteram sobre _fontEls — sem querySelectorAll.
         *  3. _applyScaleToEl lê/guarda ACC_FS_ATTR (tamanho original em px).
         *  4. Na restauração (scale=1): busca apenas elementos já escalonados via
         *     querySelectorAll('[ACC_FS_ATTR]') — subset muito menor que ACC_TEXT_SEL.
         *     Invalida _fontEls para forçar rebuild na próxima ativação.
         *
         * Compatibilidade Elementor:
         *  setProperty(..., 'important') supera inline !important do Elementor.
         *  getComputedStyle retorna sempre px, independente da unidade original.
         *
         * @param {number} scale  Fator multiplicador. 1 = restaurar ao original.
         */
        _scaleFonts: function (scale) {
            var self    = this;
            var isReset = (scale === 1);

            /* ── Restaurar: opera apenas nos elementos que foram escalonados ── */
            if (isReset) {
                /* Invalida cache — próxima ativação refaz o scan do DOM atual */
                this._fontEls = null;
                var scaled = document.querySelectorAll('[' + ACC_FS_ATTR + ']');
                for (var j = 0, jl = scaled.length; j < jl; j++) {
                    scaled[j].style.removeProperty('font-size');
                    /* Mantém o atributo para reuso eficiente se escala for
                       reativada sem recarregar a página */
                }
                return;
            }

            /* ── Build lazy do cache na primeira chamada ── */
            if (this._fontEls === null) {
                this._buildFontCache();
            }

            /* ── Aplicar escala via cache — sem querySelectorAll ── */
            for (var i = 0, len = this._fontEls.length; i < len; i++) {
                var el = this._fontEls[i];
                /* isConnected === false = removido do DOM; undefined = IE11 (mantém) */
                if (el.isConnected === false) continue;
                self._applyScaleToEl(el, scale);
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

        /* ── Anunciador para screen readers ──────
           Injeta texto na live region #acc-announcer para que leitores
           de tela (NVDA, JAWS, VoiceOver) anunciem o resultado de cada ação.

           Por que limpar e reinjetar?
             Algumas implementações de AT só disparam o anúncio quando o
             conteúdo da live region MUDA. Se o mesmo texto for injetado
             duas vezes seguidas (ex: usuário clica "Alto" duas vezes),
             sem o clear o AT não reanunciaria. O padrão clear → setTimeout → set
             garante que o browser enxergue uma mudança real no DOM.

           Por que assertive e não polite?
             Mudanças de contraste e fonte afetam a visibilidade imediata do
             conteúdo. O usuário precisa saber agora, não na próxima pausa.
             'polite' seria mais gentil mas menos confiável para feedback de ação.

           _suppressAnnounce:
             true durante aplicarTudoDoEstado() (restore de prefs no load)
             e durante resetTudo() (anúncio único ao final). Evita flood de
             mensagens no carregamento da página.
        ───────────────────────────────────────── */
        _announce: function (msg) {
            if (this._suppressAnnounce) return;
            var $ann = $('#acc-announcer');
            if (!$ann.length) return;
            /* Clear primeiro para garantir que o browser detecte a mudança */
            $ann.text('');
            setTimeout(function () { $ann.text(msg); }, 50);
        },

        /* ── Reset total ───────────────────────── */
        resetTudo: function () {
            /* Suprime anúncios individuais durante o reset */
            this._suppressAnnounce = true;

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

            /* Reativa anúncios e confirma o reset ao usuário */
            this._suppressAnnounce = false;
            this._announce('Todas as configurações restauradas ao padrão');
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

            /*
             * Silencia a live region durante a restauração inicial.
             * O usuário não precisa ouvir "Contraste normal… Saturação normal…"
             * toda vez que recarrega a página com preferências salvas.
             */
            this._suppressAnnounce = true;

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

            this._suppressAnnounce = false;

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
           (modais Elementor, lazy-load, AJAX, popups, LMS, WooCommerce)
           e aplica os modos ativos SOMENTE nos novos elementos.

           Modos cobertos:
             • fontLevel !== 0  → escala apenas os novos nós via _extendFontCache
             • contraste === 'alto' → _applyContrasteAltoJS (re-scan de [style] é rápido)

           Por que childList + subtree mas NÃO attributes?
             _scaleFonts e _applyContrasteAltoJS modificam atributos (style,
             data-acc-orig-*). Observar attributes causaria loop infinito de
             mutações. childList detecta apenas inserções/remoções de nós.

           Processamento incremental (vs. full scan):
             _pendingNodes acumula os nós adicionados durante o burst do Elementor.
             Após o debounce de 250ms:
               — Se _fontEls existe: usa _extendFontCache → escala apenas os novos nós.
               — Se _fontEls é null (cache inválido): chama _scaleFonts → full scan uma vez.
             Resultado: para uma escala ativa com 400 elementos cacheados, inserir 10 novos
             nós escala apenas esses 10 em vez de re-iterar os 400.

           Debounce de 250ms:
             Elementor pode disparar dezenas de mutações em bursts (ex: abrir um popup
             injeta 20+ nós). O debounce agrupa tudo em uma execução 250ms após o burst.
        ───────────────────────────────────────────── */
        _initMutationObserver: function () {
            if (!window.MutationObserver) return;
            var self = this;

            /*
             * Buffer local de nós adicionados entre disparos do MutationObserver.
             * Accumula durante o burst; é drenado e zerado no callback do setTimeout.
             * Declarado aqui (closure) para não poluir o objeto Acessibilidade.
             */
            var _pendingNodes = [];

            self._mutationObserver = new MutationObserver(function (mutations) {
                /* Early exit — só processa quando algum modo visual está ativo */
                var needsFont     = (self.estado.fontLevel !== 0);
                var needsContrast = (self.estado.contraste === 'alto');
                if (!needsFont && !needsContrast) return;

                /* Coleta todos os nós adicionados neste burst de mutações */
                var hasAdded = false;
                for (var i = 0; i < mutations.length; i++) {
                    for (var j = 0; j < mutations[i].addedNodes.length; j++) {
                        _pendingNodes.push(mutations[i].addedNodes[j]);
                        hasAdded = true;
                    }
                }
                if (!hasAdded) return;

                /* Debounce: agrupa bursts consecutivos em uma única execução */
                clearTimeout(self._mutationTimer);
                self._mutationTimer = setTimeout(function () {
                    /* Drena o buffer — novos nós podem chegar enquanto processamos */
                    var nodesToProcess = _pendingNodes.slice();
                    _pendingNodes = [];

                    /* ── Escala de fonte incremental ── */
                    if (self.estado.fontLevel !== 0) {
                        var scale = (FONT_SCALES[String(self.estado.fontLevel)] !== undefined)
                                    ? FONT_SCALES[String(self.estado.fontLevel)] : 1;

                        if (scale !== 1) {
                            if (self._fontEls !== null) {
                                /*
                                 * Cache existe → modo incremental.
                                 * Registra a posição atual do cache, adiciona os novos nós
                                 * e escala APENAS eles (prevLen..length-1).
                                 */
                                var prevLen = self._fontEls.length;
                                self._extendFontCache(nodesToProcess);
                                for (var k = prevLen; k < self._fontEls.length; k++) {
                                    if (self._fontEls[k].isConnected !== false) {
                                        self._applyScaleToEl(self._fontEls[k], scale);
                                    }
                                }
                            } else {
                                /* Cache inválido → full scan (constrói cache e aplica) */
                                self._scaleFonts(scale);
                            }
                        }
                    }

                    /* ── Alto contraste: re-scan de [style] nos novos elementos ── */
                    if (self.estado.contraste === 'alto') {
                        /*
                         * _applyContrasteAltoJS já verifica data-acc-orig-color antes de
                         * sobrescrever — reaplicar em todo body [style] é seguro e idempotente.
                         * O seletor 'body [style]' retorna apenas o subconjunto com inline style,
                         * que em geral é muito menor que ACC_TEXT_SEL.
                         */
                        self._applyContrasteAltoJS();
                    }
                }, 250);
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

    /* ═══════════════════════════════════════════════════════════════════
       API PÚBLICA — window.ACC
       ═══════════════════════════════════════════════════════════════════
       Interface estável para integração com Elementor addons, LMS,
       automações e qualquer código externo.

       Por que dentro da IIFE?
         `window.ACC` é atribuído dentro do wrapper (function($){...})(jQuery)
         para ter acesso ao objeto `Acessibilidade` e às constantes locais
         (FONT_MIN, FONT_MAX, FONT_SCALES). O objeto é público via window.

       Contrato:
         - Todos os setters validam input e ignoram valores inválidos.
         - `getState()` retorna cópia (JSON.parse/stringify) — sem acesso
           direto ao estado interno.
         - Chamadas antes de document.ready são processadas mas podem
           não ter efeito se o HTML ainda não existir no DOM.

       Exemplos de uso:
         window.ACC.setFontLevel(2);           // +25%
         window.ACC.setContraste('alto');       // alto contraste
         window.ACC.setDislexia(true);          // fonte dislexia
         var state = window.ACC.getState();     // cópia do estado atual
         window.ACC.reset();                    // restaura tudo
         window.ACC.openPanel();               // abre o painel programaticamente
    ═══════════════════════════════════════════════════════════════════ */
    window.ACC = {

        /** @param {number} level  Nível de fonte. Aceita -1 a 3. */
        setFontLevel: function (level) {
            var lvl = parseInt(level, 10);
            if (isNaN(lvl) || lvl < FONT_MIN || lvl > FONT_MAX) return;
            Acessibilidade.estado.fontLevel = lvl;
            Acessibilidade.aplicarFontLevel(lvl);
            Acessibilidade.savePreferences();
            Acessibilidade.marcarBotoesAtivos();
        },

        /** @param {string} modo  'normal' | 'alto' | 'invertido' */
        setContraste: function (modo) {
            if (['normal', 'alto', 'invertido'].indexOf(modo) === -1) return;
            Acessibilidade.estado.contraste = modo;
            Acessibilidade.aplicarContraste(modo);
            Acessibilidade.savePreferences();
            Acessibilidade.marcarBotoesAtivos();
        },

        /** @param {string} modo  'normal' | 'cinza' | 'sepia' */
        setSaturacao: function (modo) {
            if (['normal', 'cinza', 'sepia'].indexOf(modo) === -1) return;
            Acessibilidade.estado.saturacao = modo;
            Acessibilidade.composeBodyFilter();
            Acessibilidade.savePreferences();
            Acessibilidade.marcarBotoesAtivos();
        },

        /** @param {string} modo  'normal' | 'protan' | 'deuter' | 'tritan' */
        setDaltonismo: function (modo) {
            if (['normal', 'protan', 'deuter', 'tritan'].indexOf(modo) === -1) return;
            Acessibilidade.estado.daltonismo = modo;
            Acessibilidade.composeBodyFilter();
            Acessibilidade.savePreferences();
            Acessibilidade.marcarBotoesAtivos();
        },

        /** @param {string} nivel  'normal' | 'media' | 'ampla' */
        setLinha: function (nivel) {
            if (['normal', 'media', 'ampla'].indexOf(nivel) === -1) return;
            Acessibilidade.estado.linha = nivel;
            Acessibilidade.aplicarLinha(nivel);
            Acessibilidade.savePreferences();
            Acessibilidade.marcarBotoesAtivos();
        },

        /** @param {string} nivel  'normal' | 'media' | 'ampla' */
        setLetra: function (nivel) {
            if (['normal', 'media', 'ampla'].indexOf(nivel) === -1) return;
            Acessibilidade.estado.letra = nivel;
            Acessibilidade.aplicarLetra(nivel);
            Acessibilidade.savePreferences();
            Acessibilidade.marcarBotoesAtivos();
        },

        /** @param {boolean} ativo */
        setDislexia: function (ativo) {
            Acessibilidade.estado.dislexia = !!ativo;
            Acessibilidade.aplicarDislexia(!!ativo);
            Acessibilidade.savePreferences();
        },

        /** Restaura todas as configurações ao padrão. */
        reset: function () {
            Acessibilidade.resetTudo();
        },

        /**
         * Retorna cópia imutável do estado atual.
         * @returns {{ fontLevel: number, dislexia: boolean, contraste: string, ... }}
         */
        getState: function () {
            return JSON.parse(JSON.stringify(Acessibilidade.estado));
        },

        /** Abre o painel de acessibilidade. */
        openPanel: function () {
            var $painel = $('#painel-acessibilidade');
            if ($painel.hasClass('painel-hidden')) {
                $painel.removeClass('painel-hidden');
                $('#toggle-acessibilidade').attr('aria-expanded', 'true');
                setTimeout(function () { $('#fechar-painel').trigger('focus'); }, 150);
            }
        },

        /** Fecha o painel de acessibilidade. */
        closePanel: function () {
            $('#painel-acessibilidade').addClass('painel-hidden');
            $('#toggle-acessibilidade').attr('aria-expanded', 'false');
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

        /* Re-aplica escala de fonte para widgets Elementor assíncronos.
         * Invalida o cache antes do rescan: widgets injetados após DOMContentLoaded
         * (lazy sections, carousels, popups) não estavam no cache original.
         * _scaleFonts com cache null → _buildFontCache → scan completo do DOM final. */
        if (level !== 0) {
            var scale = (FONT_SCALES[String(level)] !== undefined)
                        ? FONT_SCALES[String(level)]
                        : 1;
            Acessibilidade._fontEls = null; /* força rebuild com DOM completo */
            Acessibilidade._scaleFonts(scale);
        }

        /* Re-aplica alto contraste JS para elementos carregados assincronamente */
        if (e.contraste === 'alto') {
            Acessibilidade._applyContrasteAltoJS();
        }
    });

})(jQuery);
