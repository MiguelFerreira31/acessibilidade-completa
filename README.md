# Acessibilidade Completa

> Plugin WordPress de acessibilidade WCAG 2.1 AA com suporte nativo ao Elementor.

[![Versão](https://img.shields.io/badge/vers%C3%A3o-3.9.0-blue)](https://github.com/MiguelFerreira31/acessibilidade-completa/releases)
[![WordPress](https://img.shields.io/badge/WordPress-5.9%2B-21759b)](https://wordpress.org)
[![PHP](https://img.shields.io/badge/PHP-7.4%2B-8892be)](https://php.net)
[![Licença](https://img.shields.io/badge/licen%C3%A7a-GPL--2.0--or--later-green)](LICENSE)

---

## Visão Geral

O **Acessibilidade Completa** é um plugin WordPress que adiciona uma barra lateral flutuante com ferramentas de acessibilidade completas, projetado especificamente para funcionar com o **Elementor** e temas que definem estilos em `px` fixo.

Diferente de soluções genéricas que apenas alteram o `font-size` do elemento `<html>` (o que só funciona para unidades `rem`/`em`), este plugin usa uma abordagem baseada em valores computados para garantir que **todos os textos** sejam escalados corretamente — incluindo widgets, headings, menus e botões do Elementor.

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
| **Simulação de Daltonismo** | Protanopia, Deuteranopia, Tritanopia via filtros SVG |

### 🖱 Navegação
| Recurso | Detalhes |
|---|---|
| **Cursor Grande** | Cursor SVG personalizado 64×64px |
| **Lupa de Navegação** | Bubble com texto ampliado ao passar o mouse |
| **Máscara de Leitura** | Escurece a tela, destaca linha de leitura |
| **Guia de Leitura** | Linha horizontal que segue o cursor |
| **Destaque de Links** | Borda + background em todos os links |

### ♿ Extras
- **VLibras** — Interpretação em Língua de Sinais Brasileira (LIBRAS)
- **Persistência** — Preferências salvas em `localStorage`
- **WCAG 2.1 AA** — `aria-*`, `role`, foco visível, redução de movimento

---

## Requisitos

| Componente | Versão Mínima |
|---|---|
| WordPress | 5.9 |
| PHP | 7.4 |
| jQuery | Qualquer versão incluída no WordPress |

> **Elementor** é suportado mas **não obrigatório**. O plugin funciona com qualquer tema WordPress.

---

## Instalação

### Via GitHub (recomendado para atualizações automáticas)

1. Acesse [Releases](https://github.com/MiguelFerreira31/acessibilidade-completa/releases)
2. Baixe o arquivo `.zip` da versão mais recente
3. No painel WordPress: **Plugins → Adicionar Novo → Enviar Plugin**
4. Faça upload do `.zip` e ative o plugin

### Manual (FTP/SSH)

```bash
# Clone o repositório na pasta de plugins
cd wp-content/plugins/
git clone https://github.com/MiguelFerreira31/acessibilidade-completa.git
```

Ative o plugin em **Plugins → Plugins Instalados**.

---

## Configuração

### Auto-Update via GitHub

Para habilitar atualizações automáticas, edite as constantes no arquivo principal:

```php
// acessibilidade-completa.php
define( 'ACC_GITHUB_USER', 'MiguelFerreira31-github' );
define( 'ACC_GITHUB_REPO', 'acessibilidade-completa' );
```

Após configurar, novas versões aparecerão automaticamente em:
**Painel → Atualizações** e **Plugins → Plugins Instalados**

### Verificar Atualizações Manualmente

Acesse **Painel → Atualizações** e clique em **"Verificar novamente"**.  
Ou adicione `?force-check=1` à URL da página de atualizações para limpar o cache.

---

## Como Funciona

### Escalamento de Fonte

O plugin usa `window.getComputedStyle(el).fontSize` para capturar o tamanho real em `px` de cada elemento — independente de qual unidade CSS o tema usa (`rem`, `em`, `px`, `vw`). Em seguida, aplica o fator de escala via:

```javascript
el.style.setProperty('font-size', (origPx * scale).toFixed(2) + 'px', 'important');
```

O uso de `'important'` como terceiro parâmetro de `setProperty` supera qualquer `!important` no CSS do Elementor, garantindo que os textos sejam escalados corretamente.

### Proteção de Ícones

Elementos com classes de ícones (`fa`, `fas`, `dashicons`, `eicon`, etc.) e elementos SVG são automaticamente excluídos do escalamento, evitando distorção visual.

### Persistência de Preferências

Todas as configurações são salvas em `localStorage` sob a chave `acessibilidade_prefs` como JSON. São restauradas automaticamente em cada carregamento de página.

---

## Integração com Elementor

O plugin foi desenvolvido e testado especificamente para superar as limitações do Elementor:

| Desafio | Solução |
|---|---|
| Font-size em `px` fixo | Leitura via `getComputedStyle` + override com `!important` |
| Inline styles específicos | `el.style.setProperty(..., 'important')` supera inline styles |
| Widgets renderizados após DOM ready | `window.load` re-aplica a escala |
| Ícones Elementor (`eicon-*`) | Filtro `ACC_ICON_RE` exclui por classe |

**Seletores Elementor cobertos:**
`.elementor-heading-title`, `.elementor-button-text`, `.elementor-icon-box-title`,
`.elementor-image-box-title`, `.elementor-testimonial__content`,
`.elementor-tab-title`, `.elementor-price-table__heading`,
`.elementor-nav-menu a` e outros.

---

## Sistema de Auto-Update

O plugin usa a classe `AcessibilidadeCompleta_GitHub_Updater` para:

1. **Verificar** a API `https://api.github.com/repos/{user}/{repo}/releases/latest`
2. **Comparar** versão instalada com `tag_name` da última release
3. **Injetar** dados no transient `update_plugins` do WordPress
4. **Exibir** notificação no painel de atualizações
5. **Instalar** baixando o ZIP da release e renomeando a pasta extraída
6. **Cachear** resultados por 12h via WP Transients (chave: `acc_gh_upd_*`)

Para publicar uma nova versão:

```bash
# 1. Atualizar ACC_VERSION em acessibilidade-completa.php
# 2. Atualizar CHANGELOG.md
# 3. Commitar e criar tag
git tag v3.9.0
git push origin v3.9.0

# 4. Criar GitHub Release com o ZIP do plugin
# O WordPress detectará automaticamente na próxima verificação
```

---

## Screenshots

> *(Adicione screenshots em `assets/screenshots/` e referencie aqui)*

| Barra fechada | Painel aberto | Tipografia | Visão & Cores |
|---|---|---|---|
| ![Barra](assets/screenshots/01-barra.png) | ![Painel](assets/screenshots/02-painel.png) | ![Tipografia](assets/screenshots/03-tipografia.png) | ![Cores](assets/screenshots/04-cores.png) |

---

## Para Desenvolvedores

### Estrutura de Pastas

```
acessibilidade-completa/
├── acessibilidade-completa.php   ← Loader: constantes + bootstrap
├── includes/
│   ├── class-plugin.php          ← Classe principal (singleton)
│   └── class-github-updater.php  ← Sistema de auto-update
├── assets/
│   ├── acessibilidade.css        ← Estilos do widget
│   └── acessibilidade.js         ← Lógica de acessibilidade
├── .gitignore
├── CHANGELOG.md
├── README.md
└── DOCUMENTACAO.md
```

### Adicionar Novos Seletores Elementor

Em `assets/acessibilidade.js`, adicione ao `ACC_TEXT_SEL`:

```javascript
var ACC_TEXT_SEL = (
    // ... seletores existentes ...
    '.novo-widget-elementor,' +
    '.outro-seletor'
);
```

### Adicionar Suporte a Novo Tipo de Ícone

Em `assets/acessibilidade.js`, adicione ao `ACC_ICON_RE`:

```javascript
var ACC_ICON_RE = /\b(fa|fas|...|nova-classe-icone)\b/;
```

### Hooks Disponíveis

*(Em versões futuras — atualmente o plugin não expõe hooks públicos.  
Contribuições são bem-vindas via Pull Request.)*

---

## Changelog

Veja [CHANGELOG.md](CHANGELOG.md) para histórico completo de versões.

---

## Licença

GPL-2.0-or-later — veja [LICENSE](https://www.gnu.org/licenses/gpl-2.0.html) para detalhes.

---

## Autor

**Miguel** — [@MiguelFerreira31](https://github.com/MiguelFerreira31)
