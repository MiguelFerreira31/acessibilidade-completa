<?php
/**
 * Executado pelo WordPress quando o plugin é DESINSTALADO (não apenas desativado).
 *
 * Diferença entre desativação e desinstalação:
 *  - Desativação (register_deactivation_hook): plugin desligado mas dados mantidos.
 *    Limpa apenas dados voláteis (transients de update).
 *  - Desinstalação (uninstall.php): plugin removido pelo usuário.
 *    Remove TODOS os dados persistentes criados pelo plugin.
 *
 * O WordPress só executa este arquivo se:
 *  1. O arquivo existe na raiz do plugin.
 *  2. O usuário clicou em "Excluir" no painel de plugins.
 *  3. WP_UNINSTALL_PLUGIN está definido (verificação de segurança).
 *
 * @package AcessibilidadeCompleta
 * @since   3.9.1
 */

/* Segurança: só executa quando chamado pelo WordPress via uninstall */
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}

/* ══════════════════════════════════════════════
   LIMPEZA DE TRANSIENTS
   O plugin cria transients com prefixo acc_gh_upd_
   para cachear respostas da GitHub API.
   Não usamos um nome fixo pois a chave é derivada
   de md5(plugin_file) para suportar múltiplas instâncias.
══════════════════════════════════════════════ */

global $wpdb;

/*
 * Remove todos os transients do plugin.
 *
 * Padrão da chave: acc_gh_upd_{12-char-md5}
 * Usamos DELETE direto via $wpdb pois delete_transient() requer o nome exato,
 * e WP não expõe uma API para deletar por prefixo.
 *
 * Em multisite: cada site tem sua própria tabela de opções, então
 * executamos apenas para o site atual. Em instalações com muitos sites,
 * considerar usar switch_to_blog() para todos os blogs.
 */

// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
$wpdb->query(
    $wpdb->prepare(
        "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
        '_transient_acc_gh_upd_%',
        '_transient_timeout_acc_gh_upd_%'
    )
);

/*
 * Multisite: limpa transients em todos os sites da rede.
 * Executado apenas se for multisite E o plugin estava ativado para a rede.
 */
if ( is_multisite() ) {
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
    $wpdb->query(
        $wpdb->prepare(
            "DELETE FROM {$wpdb->sitemeta} WHERE meta_key LIKE %s OR meta_key LIKE %s",
            '_site_transient_acc_gh_upd_%',
            '_site_transient_timeout_acc_gh_upd_%'
        )
    );
}

/*
 * Nota sobre dados do usuário (localStorage):
 * As preferências de acessibilidade são salvas em localStorage do navegador
 * sob a chave 'acessibilidade_prefs'. Esses dados NÃO estão no banco de dados
 * do WordPress — ficam no dispositivo do usuário e não podem ser removidos
 * pelo servidor. Documentamos aqui para transparência.
 *
 * Chave localStorage: 'acessibilidade_prefs'
 * Formato: JSON com estado das opções de acessibilidade do usuário.
 */
