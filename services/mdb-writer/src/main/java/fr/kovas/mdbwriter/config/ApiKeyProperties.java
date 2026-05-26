package fr.kovas.mdbwriter.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * KOVAS — Propriétés de configuration loaded depuis {@code application.yml}.
 *
 * <p>Mappe le bloc {@code kovas.*} (clé API + safety cap).</p>
 */
@ConfigurationProperties(prefix = "kovas")
public record ApiKeyProperties(String apiKey, long maxPayloadBytes) {
    public ApiKeyProperties {
        if (maxPayloadBytes <= 0) {
            maxPayloadBytes = 26_214_400L; // 25 MB default
        }
    }
}
