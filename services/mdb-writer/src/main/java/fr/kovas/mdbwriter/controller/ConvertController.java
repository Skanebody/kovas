package fr.kovas.mdbwriter.controller;

import fr.kovas.mdbwriter.config.ApiKeyProperties;
import fr.kovas.mdbwriter.model.LicielPivot;
import fr.kovas.mdbwriter.service.MdbConverter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * KOVAS — Endpoint REST principal du microservice mdb-writer.
 *
 * <p>{@code POST /convert} : prend un JSON pivot {@link LicielPivot} en body,
 * retourne le .mdb binaire (Content-Type {@code application/x-msaccess}).</p>
 *
 * <p>Auth : header {@code X-API-Key} comparé par {@link MessageDigest#isEqual(byte[], byte[])}
 * pour éviter les timing attacks.</p>
 */
@RestController
@RequestMapping("/convert")
public class ConvertController {

    private static final Logger log = LoggerFactory.getLogger(ConvertController.class);
    private static final MediaType APPLICATION_MSACCESS =
            MediaType.parseMediaType("application/x-msaccess");

    private final MdbConverter converter;
    private final ApiKeyProperties props;

    public ConvertController(MdbConverter converter, ApiKeyProperties props) {
        this.converter = converter;
        this.props = props;
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> convert(
            @RequestHeader(value = "X-API-Key", required = false) String apiKey,
            @RequestBody LicielPivot pivot) {
        if (!isAuthorized(apiKey)) {
            log.warn("Rejected /convert request — missing or invalid X-API-Key");
            return ResponseEntity.status(401).body(null);
        }

        if (pivot == null) {
            return ResponseEntity.badRequest().body(null);
        }

        try {
            byte[] mdb = converter.toMdb(pivot);
            String filename = "kovas-mission-" + safe(pivot.kovasMissionId()) + ".mdb";
            return ResponseEntity.ok()
                    .contentType(APPLICATION_MSACCESS)
                    .header(
                            HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + filename + "\"")
                    .header("X-Kovas-Schema-Version", pivot.schemaVersion())
                    .body(mdb);
        } catch (IllegalArgumentException e) {
            log.warn("Bad request: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Bad request: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            log.error("Failed to write .mdb", e);
            return ResponseEntity.status(500)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("Internal error while writing .mdb".getBytes(StandardCharsets.UTF_8));
        }
    }

    /**
     * Constant-time comparison of the provided X-API-Key against the configured one.
     * Returns false if no API key is configured (fail-closed in prod).
     */
    private boolean isAuthorized(String provided) {
        String expected = props.apiKey();
        if (expected == null || expected.isBlank()) {
            // Fail-closed: API key MUST be configured in prod
            return false;
        }
        if (provided == null) return false;
        byte[] a = provided.getBytes(StandardCharsets.UTF_8);
        byte[] b = expected.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(a, b);
    }

    private static String safe(String s) {
        if (s == null) return "unknown";
        return s.replaceAll("[^a-zA-Z0-9_-]", "_");
    }
}
