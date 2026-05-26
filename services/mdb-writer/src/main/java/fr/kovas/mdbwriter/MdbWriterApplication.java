package fr.kovas.mdbwriter;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * KOVAS — Microservice de génération .mdb Jet 4.0 (format Liciel ZIP V4).
 *
 * <p>Service stateless : consomme un JSON pivot validé côté Next.js (Zod schema
 * {@code apps/web/src/lib/liciel/zip-v4-schema.ts}) et retourne les bytes binaires
 * d'un fichier Microsoft Access compatible Liciel V4.</p>
 *
 * <p>Déploiement : Railway (Hobby plan suffit, ~$5/mois). Local : {@code ./gradlew bootRun}.</p>
 *
 * <p>Sécurité : auth par header {@code X-API-Key} (env var {@code KOVAS_MDB_WRITER_API_KEY}).
 * Pas de DB, pas de session — conversion in-memory uniquement.</p>
 */
@SpringBootApplication
public class MdbWriterApplication {

    public static void main(String[] args) {
        SpringApplication.run(MdbWriterApplication.class, args);
    }
}
