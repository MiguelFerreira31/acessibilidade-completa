<?php
/**
 * Sistema de atualização automática via GitHub Releases.
 *
 * Integra-se com a WordPress Update API para detectar novas versões
 * publicadas como GitHub Releases e permitir atualização automática
 * diretamente pelo painel do WordPress.
 *
 * Fluxo:
 *  1. Hook `pre_set_site_transient_update_plugins` verifica nova versão.
 *  2. Se houver update, injeta dados no transient do WP.
 *  3. Hook `plugins_api` fornece info para o modal de detalhes.
 *  4. Após instalação, `upgrader_post_install` renomeia a pasta extraída.
 *  5. Cache de 12h via WP Transients evita excesso de requests à API.
 *
 * @package AcessibilidadeCompleta
 * @since   3.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class AcessibilidadeCompleta_GitHub_Updater {

    /* ──────────────────────────────────────────
       PROPRIEDADES
    ────────────────────────────────────────── */

    /** @var string  Caminho absoluto para o arquivo principal do plugin */
    private $plugin_file;

    /** @var string  Slug do plugin: pasta/arquivo.php */
    private $plugin_slug;

    /** @var string  Usuário ou organização no GitHub */
    private $github_user;

    /** @var string  Nome do repositório no GitHub */
    private $github_repo;

    /** @var array|null  Cache dos dados do cabeçalho do plugin */
    private $plugin_data = null;

    /** @var object|null  Cache em memória da resposta da API GitHub */
    private $github_response = null;

    /** @var string  Chave do WP Transient de cache */
    private $transient_key;

    /** @var int  Tempo de vida do cache em segundos (12 horas) */
    private $transient_ttl;

    /* ──────────────────────────────────────────
       CONSTRUTOR
    ────────────────────────────────────────── */

    /**
     * @param string $plugin_file  Caminho absoluto para o arquivo principal do plugin.
     * @param string $github_user  Usuário ou organização no GitHub.
     * @param string $github_repo  Nome do repositório no GitHub.
     */
    public function __construct( $plugin_file, $github_user, $github_repo ) {
        $this->plugin_file   = $plugin_file;
        $this->plugin_slug   = plugin_basename( $plugin_file );
        $this->github_user   = sanitize_text_field( $github_user );
        $this->github_repo   = sanitize_text_field( $github_repo );
        $this->transient_key = 'acc_gh_upd_' . substr( md5( $plugin_file ), 0, 12 );

        /**
         * Filtro: acc_updater_cache_ttl
         * Ajusta o tempo de vida do cache de verificação de update em segundos.
         * Padrão: 43200 (12 horas). Reduzir em staging/dev para testes rápidos.
         *
         * Exemplo:
         *   add_filter( 'acc_updater_cache_ttl', fn() => 300 ); // 5 minutos em dev
         *
         * @param int $ttl Tempo em segundos. Mínimo recomendado: 300.
         */
        $ttl = (int) apply_filters( 'acc_updater_cache_ttl', 12 * HOUR_IN_SECONDS );
        $this->transient_ttl = max( 300, $ttl ); /* mínimo absoluto de 5 minutos */

        $this->init_hooks();
    }

    /* ──────────────────────────────────────────
       HOOKS
    ────────────────────────────────────────── */

    /** Registra todos os hooks necessários para integrar com o WP Update System. */
    private function init_hooks() {
        // Verificação de update (executa quando o WP verifica atualizações)
        add_filter( 'pre_set_site_transient_update_plugins', array( $this, 'check_for_update' ) );

        // Popula o modal de informações do plugin no admin
        add_filter( 'plugins_api', array( $this, 'plugin_popup' ), 10, 3 );

        // Pós-instalação: renomeia pasta e reativa plugin
        add_filter( 'upgrader_post_install', array( $this, 'after_install' ), 10, 3 );

        // Purga cache quando admin força re-checagem
        add_action( 'admin_init', array( $this, 'purge_cache_maybe' ) );
    }

    /* ──────────────────────────────────────────
       DADOS DO PLUGIN
    ────────────────────────────────────────── */

    /**
     * Retorna (e cacheia em memória) os dados do cabeçalho do plugin.
     *
     * @return array
     */
    private function get_plugin_data() {
        if ( null !== $this->plugin_data ) {
            return $this->plugin_data;
        }

        if ( ! function_exists( 'get_plugin_data' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $this->plugin_data = get_plugin_data( $this->plugin_file, false, false );
        return $this->plugin_data;
    }

    /* ──────────────────────────────────────────
       COMUNICAÇÃO COM GITHUB API
    ────────────────────────────────────────── */

    /**
     * Consulta a API do GitHub e retorna os dados da última release.
     *
     * Usa WP Transient como camada de cache (TTL: 12h) para minimizar
     * requisições à API. O cache é invalidado ao forçar re-checagem.
     *
     * @return object|false  Objeto da release ou false em caso de erro.
     */
    private function get_github_release() {
        // Já está em memória neste request
        if ( null !== $this->github_response ) {
            return $this->github_response;
        }

        // Tenta obter do transient (cache persistente)
        $cached = get_transient( $this->transient_key );
        if ( false !== $cached ) {
            $this->github_response = $cached;
            return $this->github_response;
        }

        // Consulta a API do GitHub
        $api_url = sprintf(
            'https://api.github.com/repos/%s/%s/releases/latest',
            rawurlencode( $this->github_user ),
            rawurlencode( $this->github_repo )
        );

        $response = wp_remote_get(
            $api_url,
            array(
                'timeout'   => 10,
                'sslverify' => true,
                'headers'   => array(
                    'Accept'     => 'application/vnd.github+json',
                    'User-Agent' => 'WordPress/' . get_bloginfo( 'version' ) . '; ' . get_bloginfo( 'url' ),
                ),
            )
        );

        if ( is_wp_error( $response ) ) {
            $this->log( 'Erro ao consultar GitHub API: ' . $response->get_error_message() );
            return false;
        }

        $http_code = (int) wp_remote_retrieve_response_code( $response );
        if ( 200 !== $http_code ) {
            $this->log( 'GitHub API retornou HTTP ' . $http_code . ' para o repo ' . $this->github_repo );
            return false;
        }

        $release = json_decode( wp_remote_retrieve_body( $response ) );

        if ( ! is_object( $release ) || empty( $release->tag_name ) ) {
            $this->log( 'Resposta inválida da GitHub API para o repo ' . $this->github_repo );
            return false;
        }

        /*
         * Ignora pre-releases e drafts.
         *
         * Um draft acidentalmente publicado ou uma pre-release de teste
         * não deve acionar atualização em instalações de produção.
         * Apenas releases estáveis (prerelease = false, draft = false)
         * são elegíveis para distribuição via WordPress update.
         */
        if ( ! empty( $release->prerelease ) || ! empty( $release->draft ) ) {
            $this->log( 'Release ' . $release->tag_name . ' é prerelease ou draft — ignorando.' );
            return false;
        }

        // Salva no transient
        set_transient( $this->transient_key, $release, $this->transient_ttl );
        $this->github_response = $release;

        return $this->github_response;
    }

    /* ──────────────────────────────────────────
       UTILITÁRIOS
    ────────────────────────────────────────── */

    /**
     * Normaliza um tag_name do GitHub para versão comparável.
     * Ex: 'v3.9.0' → '3.9.0'
     *
     * @param  string $tag
     * @return string
     */
    private function normalize_version( $tag ) {
        return ltrim( $tag, 'vV' );
    }

    /**
     * Retorna a URL de download do ZIP da release.
     *
     * Prioridade:
     *  1. Asset explícito com extensão .zip (melhor para repos com CI/CD)
     *  2. zipball_url automático do GitHub (fallback universal)
     *
     * Segurança: valida que a URL pertence a um dos domínios autorizados do GitHub
     * antes de retorná-la para o WordPress Upgrader — previne redirecionamentos
     * maliciosos caso a resposta da API seja adulterada.
     *
     * @param  object $release
     * @return string|false
     */
    private function get_download_url( $release ) {
        $allowed_hosts = array( 'github.com', 'api.github.com', 'objects.githubusercontent.com', 'codeload.github.com' );

        // Procura asset com extensão .zip entre os uploads da release
        if ( ! empty( $release->assets ) && is_array( $release->assets ) ) {
            foreach ( $release->assets as $asset ) {
                $name = isset( $asset->name ) ? strtolower( $asset->name ) : '';
                $type = isset( $asset->content_type ) ? $asset->content_type : '';

                $is_zip = ( substr( $name, -4 ) === '.zip' )
                       || ( false !== strpos( $type, 'zip' ) );

                if ( $is_zip && ! empty( $asset->browser_download_url ) ) {
                    $url  = $asset->browser_download_url;
                    $host = wp_parse_url( $url, PHP_URL_HOST );
                    if ( ! in_array( $host, $allowed_hosts, true ) ) {
                        $this->log( 'URL de asset rejeitada (host não autorizado): ' . esc_url( $url ) );
                        continue;
                    }
                    return $url;
                }
            }
        }

        // Fallback: zipball automático do GitHub
        if ( ! empty( $release->zipball_url ) ) {
            $url  = $release->zipball_url;
            $host = wp_parse_url( $url, PHP_URL_HOST );
            if ( ! in_array( $host, $allowed_hosts, true ) ) {
                $this->log( 'URL de zipball rejeitada (host não autorizado): ' . esc_url( $url ) );
                return false;
            }
            return $url;
        }

        return false;
    }

    /**
     * Registra uma mensagem de log no error_log do PHP (apenas em WP_DEBUG).
     *
     * @param string $message
     */
    private function log( $message ) {
        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
            error_log( '[Acessibilidade Completa Updater] ' . $message );
        }
    }

    /* ──────────────────────────────────────────
       HOOKS PÚBLICOS
    ────────────────────────────────────────── */

    /**
     * Hook: pre_set_site_transient_update_plugins
     *
     * Verifica se há nova versão no GitHub e injeta no transient de
     * atualizações do WordPress quando necessário.
     *
     * @param  object $transient  Objeto de atualizações do WordPress.
     * @return object
     */
    public function check_for_update( $transient ) {
        if ( empty( $transient->checked ) ) {
            return $transient;
        }

        $release = $this->get_github_release();
        if ( ! $release ) {
            return $transient;
        }

        $plugin_data     = $this->get_plugin_data();
        $current_version = isset( $plugin_data['Version'] ) ? $plugin_data['Version'] : '0.0.0';
        $latest_version  = $this->normalize_version( $release->tag_name );
        $download_url    = $this->get_download_url( $release );

        if ( version_compare( $current_version, $latest_version, '<' ) && $download_url ) {
            $transient->response[ $this->plugin_slug ] = (object) array(
                'slug'         => dirname( $this->plugin_slug ),
                'plugin'       => $this->plugin_slug,
                'new_version'  => $latest_version,
                'url'          => sprintf(
                    'https://github.com/%s/%s',
                    $this->github_user,
                    $this->github_repo
                ),
                'package'      => $download_url,
                'requires'     => isset( $plugin_data['RequiresWP'] )  ? $plugin_data['RequiresWP']  : '5.9',
                'requires_php' => isset( $plugin_data['RequiresPHP'] ) ? $plugin_data['RequiresPHP'] : '7.4',
                'tested'       => get_bloginfo( 'version' ),
                'icons'        => array(
                    'default' => sprintf(
                        'https://raw.githubusercontent.com/%s/%s/main/assets/icon-128x128.png',
                        $this->github_user,
                        $this->github_repo
                    ),
                ),
            );

            $this->log( sprintf(
                'Update disponível: %s → %s',
                $current_version,
                $latest_version
            ) );
        }

        return $transient;
    }

    /**
     * Hook: plugins_api
     *
     * Fornece os detalhes do plugin para o modal de informações no
     * painel de atualizações do WordPress.
     *
     * @param  false|object|array $result
     * @param  string             $action
     * @param  object             $args
     * @return false|object
     */
    public function plugin_popup( $result, $action, $args ) {
        if ( 'plugin_information' !== $action ) {
            return $result;
        }

        $plugin_folder = dirname( $this->plugin_slug );
        if ( ! isset( $args->slug ) || $args->slug !== $plugin_folder ) {
            return $result;
        }

        $release     = $this->get_github_release();
        $plugin_data = $this->get_plugin_data();

        if ( ! $release ) {
            return $result;
        }

        // Formata o changelog da release como HTML
        $changelog = '';
        if ( ! empty( $release->body ) ) {
            $changelog = '<pre style="white-space:pre-wrap">' . esc_html( $release->body ) . '</pre>';
        } else {
            $changelog = '<p>' . esc_html__( 'Consulte o repositório no GitHub para detalhes desta versão.', 'acessibilidade-completa' ) . '</p>';
        }

        $result = (object) array(
            'name'              => isset( $plugin_data['Name'] )        ? $plugin_data['Name']        : 'Acessibilidade Completa',
            'slug'              => $plugin_folder,
            'version'           => $this->normalize_version( $release->tag_name ),
            'author'            => isset( $plugin_data['AuthorName'] )  ? $plugin_data['AuthorName']  : 'Miguel',
            'author_profile'    => isset( $plugin_data['AuthorURI'] )   ? $plugin_data['AuthorURI']   : '',
            'homepage'          => sprintf( 'https://github.com/%s/%s', $this->github_user, $this->github_repo ),
            'short_description' => isset( $plugin_data['Description'] ) ? $plugin_data['Description'] : '',
            'sections'          => array(
                'description' => isset( $plugin_data['Description'] ) ? $plugin_data['Description'] : '',
                'changelog'   => $changelog,
            ),
            'download_link'     => $this->get_download_url( $release ),
            'requires'          => isset( $plugin_data['RequiresWP'] )  ? $plugin_data['RequiresWP']  : '5.9',
            'requires_php'      => isset( $plugin_data['RequiresPHP'] ) ? $plugin_data['RequiresPHP'] : '7.4',
            'tested'            => get_bloginfo( 'version' ),
            'last_updated'      => isset( $release->published_at ) ? $release->published_at : '',
        );

        return $result;
    }

    /**
     * Hook: upgrader_post_install
     *
     * Após a instalação do ZIP do GitHub, renomeia a pasta extraída
     * (que costuma ter o formato user-repo-hash) para o nome correto
     * do diretório do plugin.
     *
     * @param  bool   $response
     * @param  array  $hook_extra  Dados extras do upgrader.
     * @param  array  $result      Resultado da instalação.
     * @return array  $result com o destination atualizado.
     */
    public function after_install( $response, $hook_extra, $result ) {
        global $wp_filesystem;

        // Executa apenas para este plugin
        if ( ! isset( $hook_extra['plugin'] ) || $hook_extra['plugin'] !== $this->plugin_slug ) {
            return $result;
        }

        $correct_dir = WP_PLUGIN_DIR . DIRECTORY_SEPARATOR . dirname( $this->plugin_slug );

        // Renomeia a pasta extraída para o nome correto
        if ( isset( $result['destination'] ) && $result['destination'] !== $correct_dir ) {
            $wp_filesystem->move( $result['destination'], $correct_dir, true );
            $result['destination'] = $correct_dir;
        }

        // Reativa o plugin após a atualização (evita deativação acidental)
        if ( is_plugin_active( $this->plugin_slug ) ) {
            activate_plugin( $this->plugin_slug );
        }

        // Invalida o cache para que o WP mostre a versão correta
        delete_transient( $this->transient_key );
        $this->github_response = null;
        $this->plugin_data     = null;

        $this->log( 'Plugin atualizado com sucesso. Cache invalidado.' );

        return $result;
    }

    /**
     * Invalida o cache de update quando o admin acessa
     * a página de atualizações com ?force-check=1.
     *
     * Segurança: segue o padrão do WordPress core (wp-admin/update-core.php),
     * que também usa apenas capability check sem nonce para esta ação —
     * pois invalidar o cache de update é uma ação idempotente e de baixo risco.
     * A capability `update_plugins` garante que apenas administradores
     * autenticados podem disparar a ação.
     */
    public function purge_cache_maybe() {
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- segue padrão WP core (update-core.php)
        if ( isset( $_GET['force-check'] ) && current_user_can( 'update_plugins' ) ) {
            delete_transient( $this->transient_key );
            $this->github_response = null;
            $this->log( 'Cache de update invalidado manualmente.' );
        }
    }
}
