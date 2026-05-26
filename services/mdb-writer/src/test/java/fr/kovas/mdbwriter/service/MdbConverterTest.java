package fr.kovas.mdbwriter.service;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.healthmarketscience.jackcess.Database;
import com.healthmarketscience.jackcess.DatabaseBuilder;
import com.healthmarketscience.jackcess.Row;
import com.healthmarketscience.jackcess.Table;
import fr.kovas.mdbwriter.model.LicielPivot;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * KOVAS — Tests unitaires du convertisseur Jackcess.
 *
 * <p>Couvre : validation schema_version, conversion minimale (1 DPE),
 * écriture multi-tables, gestion des champs nullables, échec sur input invalide.</p>
 */
class MdbConverterTest {

    private final MdbConverter converter = new MdbConverter();

    @Test
    void rejects_null_pivot() {
        assertThrows(IllegalArgumentException.class, () -> converter.toMdb(null));
    }

    @Test
    void rejects_wrong_schema_version() {
        LicielPivot wrong = minimalPivot("3.0");
        assertThrows(IllegalArgumentException.class, () -> converter.toMdb(wrong));
    }

    @Test
    void produces_valid_mdb_bytes_for_minimal_dpe() throws IOException {
        LicielPivot pivot = minimalPivot("4.0");

        byte[] bytes = converter.toMdb(pivot);
        assertNotNull(bytes);
        assertTrue(bytes.length > 0, "mdb output must be non-empty");

        // Jet 4.0 file format magic header (offset 4..18)
        // "Standard Jet DB" — Jackcess writes this for V2003 file format
        byte[] header = new byte[15];
        System.arraycopy(bytes, 4, header, 0, 15);
        String marker = new String(header, java.nio.charset.StandardCharsets.US_ASCII);
        assertTrue(
                marker.startsWith("Standard Jet DB") || marker.startsWith("Standard ACE DB"),
                "Expected Jet/ACE marker, got: " + marker);
    }

    @Test
    void round_trip_writes_dossier_and_diagnostic_rows() throws IOException {
        LicielPivot pivot = minimalPivot("4.0");
        byte[] bytes = converter.toMdb(pivot);

        // Round-trip: write to temp, re-open with Jackcess, count rows
        Path tmp = Files.createTempFile("kovas-test-", ".mdb");
        Files.write(tmp, bytes);
        try (Database db = new DatabaseBuilder(tmp.toFile()).open()) {
            Set<String> tables = db.getTableNames();
            assertTrue(tables.contains("Dossier"), "Dossier table must exist");
            assertTrue(tables.contains("Diagnostics"), "Diagnostics table must exist");

            Table dossier = db.getTable("Dossier");
            Row dossierRow = dossier.iterator().next();
            assertEquals(pivot.kovasMissionId(), dossierRow.getString("mission_id"));
            assertEquals("vente", dossierRow.getString("transaction_context"));

            Table diags = db.getTable("Diagnostics");
            Row diagRow = diags.iterator().next();
            assertEquals("DPE", diagRow.getString("type"));
            assertEquals("D", diagRow.getString("energy_class"));
        } finally {
            Files.deleteIfExists(tmp);
        }
    }

    @Test
    void writes_multiple_diagnostics_in_diagnostics_table() throws IOException {
        LicielPivot pivot = new LicielPivot(
                "4.0",
                "00000000-0000-4000-8000-000000000002",
                "2026-05-26T10:00:00.000Z",
                minimalDiagnostician(),
                minimalProperty(),
                "vente",
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(
                        new LicielPivot.DiagnosticResult(
                                "DPE", "Classe C", "C", "C", 150.0, 25.0, List.of(), null),
                        new LicielPivot.DiagnosticResult(
                                "AMIANTE",
                                "Absence d'amiante",
                                null,
                                null,
                                null,
                                null,
                                List.of(),
                                "RAS sur toiture"),
                        new LicielPivot.DiagnosticResult(
                                "ERP",
                                "Aucun risque identifié",
                                null,
                                null,
                                null,
                                null,
                                List.of(),
                                null)),
                List.of(),
                null);

        byte[] bytes = converter.toMdb(pivot);
        Path tmp = Files.createTempFile("kovas-test-multi-", ".mdb");
        Files.write(tmp, bytes);
        try (Database db = new DatabaseBuilder(tmp.toFile()).open()) {
            Table diags = db.getTable("Diagnostics");
            int rowCount = 0;
            for (Row r : diags) {
                rowCount++;
                assertNotNull(r.getString("type"));
            }
            assertEquals(3, rowCount, "Expected 3 diagnostic rows");
        } finally {
            Files.deleteIfExists(tmp);
        }
    }

    /* ────────────────────────────────────────────────────────────────────── */
    /* Fixtures                                                                */
    /* ────────────────────────────────────────────────────────────────────── */

    private static LicielPivot minimalPivot(String schemaVersion) {
        return new LicielPivot(
                schemaVersion,
                "00000000-0000-4000-8000-000000000001",
                "2026-05-26T12:00:00.000Z",
                minimalDiagnostician(),
                minimalProperty(),
                "vente",
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(
                        new LicielPivot.DiagnosticResult(
                                "DPE",
                                "Classe D",
                                "D",
                                "D",
                                220.0,
                                45.0,
                                List.of(),
                                "RAS")),
                List.of(),
                null);
    }

    private static LicielPivot.Diagnostician minimalDiagnostician() {
        return new LicielPivot.Diagnostician("Benjamin Bel", "Nexus 1993", null, null, null);
    }

    private static LicielPivot.Property minimalProperty() {
        return new LicielPivot.Property(
                "maison",
                new LicielPivot.Address(
                        "12 rue de la mer, 76200 Dieppe",
                        "12",
                        "rue de la mer",
                        "76200",
                        "Dieppe",
                        "76217",
                        "FR"),
                1985,
                95.0,
                null);
    }
}
