<?php
/**
 * Plugin Name:       Acessibilidade Completa
 * Plugin URI:        https://github.com/MiguelFerreira31/acessibilidade-completa
 * Description:       VLibras + Tipografia granular + Visão & Cores + Daltonismo. Acessibilidade WCAG 2.1 AA para WordPress + Elementor.
 * Version:           3.9.1
 * Author:            Miguel Ferreira
 * Author URI:        https://github.com/MiguelFerreira31
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       acessibilidade-completa
 * Domain Path:       /languages
 * Requires at least: 5.9
 * Requires PHP:      7.4
 *
 * @package AcessibilidadeCompleta
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/* ══════════════════════════════════════════════
   CONSTANTES GLOBAIS DO PLUGIN
══════════════════════════════════════════════ */

/** Versão atual do plugin */
define( 'ACC_VERSION',     '3.9.1' );

/** Caminho absoluto para o arquivo principal */
define( 'ACC_PLUGIN_FILE', __FILE__ );

/** Caminho absoluto para o diretório do plugin (com trailing slash) */
define( 'ACC_PLUGIN_DIR',  plugin_dir_path( __FILE__ ) );

/** URL pública do diretório do plugin (com trailing slash) */
define( 'ACC_PLUGIN_URL',  plugin_dir_url( __FILE__ ) );

/** Slug do plugin no formato pasta/arquivo.php */
define( 'ACC_PLUGIN_SLUG', plugin_basename( __FILE__ ) );

/**
 * GitHub — repositório oficial do plugin.
 * O sistema de auto-update usa esses valores para consultar releases.
 */
define( 'ACC_GITHUB_USER', 'MiguelFerreira31' );
define( 'ACC_GITHUB_REPO', 'acessibilidade-completa' );

/* ══════════════════════════════════════════════
   AUTOLOAD DAS CLASSES
══════════════════════════════════════════════ */

require_once ACC_PLUGIN_DIR . 'includes/class-plugin.php';
require_once ACC_PLUGIN_DIR . 'includes/class-github-updater.php';

/* ══════════════════════════════════════════════
   BOOTSTRAP
   Inicializado após todos os plugins serem carregados.
══════════════════════════════════════════════ */

add_action( 'plugins_loaded', static function () {

    // Instância singleton do plugin principal
    AcessibilidadeCompleta_Plugin::get_instance();

    // Sistema de atualização automática via GitHub Releases
    new AcessibilidadeCompleta_GitHub_Updater(
        ACC_PLUGIN_FILE,
        ACC_GITHUB_USER,
        ACC_GITHUB_REPO
    );

} );
