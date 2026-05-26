package fr.kovas.mdbwriter.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * KOVAS — Active la liaison Spring Boot des {@link ApiKeyProperties}.
 *
 * <p>L'auth réelle est appliquée dans {@code ConvertController} via un check
 * d'égalité constante sur {@code X-API-Key} — pas besoin de chaîne Spring Security
 * complète pour un service stateless avec une seule route protégée.</p>
 */
@Configuration
@EnableConfigurationProperties(ApiKeyProperties.class)
public class SecurityConfig {
}
