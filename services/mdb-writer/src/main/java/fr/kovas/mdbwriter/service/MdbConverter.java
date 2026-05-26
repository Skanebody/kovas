package fr.kovas.mdbwriter.service;

import com.healthmarketscience.jackcess.ColumnBuilder;
import com.healthmarketscience.jackcess.DataType;
import com.healthmarketscience.jackcess.Database;
import com.healthmarketscience.jackcess.DatabaseBuilder;
import com.healthmarketscience.jackcess.Table;
import com.healthmarketscience.jackcess.TableBuilder;
import fr.kovas.mdbwriter.model.LicielPivot;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * KOVAS — Cœur du convertisseur : JSON pivot Liciel V4 → .mdb Jet 4.0.
 *
 * <p>Utilise Jackcess pour écrire un fichier Access {@code V2003} (Jet 4.0)
 * compatible avec l'import "format ZIP" Liciel. Le fichier temporaire est
 * créé sur disque (Jackcess l'exige), lu en bytes, puis supprimé immédiatement —
 * le service reste stateless.</p>
 *
 * <p>Schéma de tables minimal pour V0 (couvre les 9 diagnostic types + dossier
 * + contacts + pièces). Les tables additionnelles Liciel (audit, équipements
 * détaillés, etc.) seront ajoutées au Sprint MVP J11-J12 sur la base des fixtures
 * du repo séparé {@code kovas-discovery-log}.</p>
 */
@Service
public class MdbConverter {

    private static final Logger log = LoggerFactory.getLogger(MdbConverter.class);

    /**
     * Convertit le pivot en .mdb et retourne les bytes binaires.
     *
     * @param pivot payload JSON désérialisé (validé Zod côté Next.js)
     * @return bytes binaires .mdb prêts à être renvoyés en HTTP response
     * @throws IOException si la création/écriture du fichier temporaire échoue
     */
    public byte[] toMdb(LicielPivot pivot) throws IOException {
        if (pivot == null) {
            throw new IllegalArgumentException("pivot is required");
        }
        if (!"4.0".equals(pivot.schemaVersion())) {
            throw new IllegalArgumentException(
                    "Unsupported schema_version: " + pivot.schemaVersion() + " (expected 4.0)");
        }

        File tempFile = File.createTempFile("kovas-mdb-", ".mdb");
        // Jackcess exige que le fichier n'existe pas — create() le créera
        if (!tempFile.delete()) {
            log.warn("Could not pre-delete temp file {}", tempFile);
        }

        try {
            try (Database db = new DatabaseBuilder(tempFile)
                    .setFileFormat(Database.FileFormat.V2003)
                    .create()) {
                writeDossierTable(db, pivot);
                writeContactsTable(db, pivot);
                writePiecesTable(db, pivot);
                writeEquipementsTable(db, pivot);
                writePhotosTable(db, pivot);
                writeDiagnosticsTable(db, pivot);
                writeVoiceNotesTable(db, pivot);
            }

            byte[] bytes = Files.readAllBytes(tempFile.toPath());
            log.info(
                    "Wrote .mdb for mission {} ({} bytes, {} diagnostics)",
                    pivot.kovasMissionId(),
                    bytes.length,
                    sizeOf(pivot.diagnostics()));
            return bytes;
        } finally {
            try {
                Files.deleteIfExists(tempFile.toPath());
            } catch (IOException cleanup) {
                log.warn("Failed to delete temp .mdb {}: {}", tempFile, cleanup.getMessage());
            }
        }
    }

    /* ────────────────────────────────────────────────────────────────────── */
    /* Tables                                                                  */
    /* ────────────────────────────────────────────────────────────────────── */

    private void writeDossierTable(Database db, LicielPivot pivot) throws IOException {
        Table t = new TableBuilder("Dossier")
                .addColumn(textCol("mission_id", 50))
                .addColumn(textCol("reference", 100))
                .addColumn(new ColumnBuilder("exported_at").setType(DataType.SHORT_DATE_TIME))
                .addColumn(textCol("transaction_context", 20))
                .addColumn(textCol("property_type", 30))
                .addColumn(textCol("address_full", 255))
                .addColumn(textCol("postcode", 5))
                .addColumn(textCol("city", 100))
                .addColumn(textCol("insee_code", 5))
                .addColumn(new ColumnBuilder("year_built").setType(DataType.LONG))
                .addColumn(new ColumnBuilder("surface_total_m2").setType(DataType.DOUBLE))
                .addColumn(textCol("cadastre_parcelle_id", 50))
                .addColumn(textCol("diagnostician_name", 150))
                .addColumn(textCol("diagnostician_company", 150))
                .addColumn(textCol("diagnostician_siret", 14))
                .addColumn(textCol("diagnostician_cofrac", 50))
                .toTable(db);

        LicielPivot.Property p = pivot.property();
        LicielPivot.Address a = p != null ? p.address() : null;
        LicielPivot.Diagnostician d = pivot.diagnostician();

        t.addRow(
                pivot.kovasMissionId(),
                pivot.kovasMissionId(),
                parseDate(pivot.exportedAt()),
                pivot.transactionContext(),
                p != null ? p.type() : null,
                a != null ? a.full() : null,
                a != null ? a.postcode() : null,
                a != null ? a.city() : null,
                a != null ? a.inseeCode() : null,
                p != null ? p.yearBuilt() : null,
                p != null ? p.surfaceTotalM2() : null,
                p != null ? p.cadastreParcelleId() : null,
                d != null ? d.fullName() : null,
                d != null ? d.companyName() : null,
                d != null ? d.siret() : null,
                d != null ? d.cofracNumber() : null);
    }

    private void writeContactsTable(Database db, LicielPivot pivot) throws IOException {
        Table t = new TableBuilder("Contacts")
                .addColumn(textCol("mission_id", 50))
                .addColumn(textCol("role", 30))
                .addColumn(textCol("civilite", 10))
                .addColumn(textCol("first_name", 100))
                .addColumn(textCol("last_name", 100))
                .addColumn(textCol("email", 255))
                .addColumn(textCol("phone", 30))
                .toTable(db);

        if (pivot.contacts() == null) return;
        for (LicielPivot.Contact c : pivot.contacts()) {
            t.addRow(
                    pivot.kovasMissionId(),
                    c.role(),
                    c.civilite(),
                    c.firstName(),
                    c.lastName(),
                    c.email(),
                    c.phone());
        }
    }

    private void writePiecesTable(Database db, LicielPivot pivot) throws IOException {
        Table t = new TableBuilder("Pieces")
                .addColumn(textCol("mission_id", 50))
                .addColumn(textCol("room_id", 50))
                .addColumn(textCol("room_name", 100))
                .addColumn(new ColumnBuilder("surface_brute_m2").setType(DataType.DOUBLE))
                .addColumn(new ColumnBuilder("surface_carrez_m2").setType(DataType.DOUBLE))
                .addColumn(new ColumnBuilder("surface_boutin_m2").setType(DataType.DOUBLE))
                .addColumn(new ColumnBuilder("hauteur_sous_plafond_m").setType(DataType.DOUBLE))
                .addColumn(new ColumnBuilder("is_annexe").setType(DataType.BOOLEAN))
                .toTable(db);

        if (pivot.rooms() == null) return;
        for (LicielPivot.RoomMeasurement r : pivot.rooms()) {
            t.addRow(
                    pivot.kovasMissionId(),
                    r.roomId(),
                    r.roomName(),
                    r.surfaceBruteM2(),
                    r.surfaceCarrezM2(),
                    r.surfaceBoutinM2(),
                    r.hauteurSousPlafondM(),
                    Boolean.TRUE.equals(r.isAnnexe()));
        }
    }

    private void writeEquipementsTable(Database db, LicielPivot pivot) throws IOException {
        Table t = new TableBuilder("Equipements")
                .addColumn(textCol("mission_id", 50))
                .addColumn(textCol("type", 50))
                .addColumn(textCol("brand", 100))
                .addColumn(textCol("model", 100))
                .addColumn(new ColumnBuilder("power_kw").setType(DataType.DOUBLE))
                .addColumn(textCol("energy_class", 2))
                .addColumn(new ColumnBuilder("year_install").setType(DataType.LONG))
                .addColumn(textCol("serial_number", 100))
                .toTable(db);

        if (pivot.equipments() == null) return;
        for (LicielPivot.Equipment e : pivot.equipments()) {
            t.addRow(
                    pivot.kovasMissionId(),
                    e.type(),
                    e.brand(),
                    e.model(),
                    e.powerKw(),
                    e.energyClass(),
                    e.yearInstall(),
                    e.serialNumber());
        }
    }

    private void writePhotosTable(Database db, LicielPivot pivot) throws IOException {
        Table t = new TableBuilder("Photos")
                .addColumn(textCol("mission_id", 50))
                .addColumn(textCol("file_ref", 255))
                .addColumn(textCol("room_id", 50))
                .addColumn(textCol("caption", 255))
                .addColumn(new ColumnBuilder("exif_lat").setType(DataType.DOUBLE))
                .addColumn(new ColumnBuilder("exif_lng").setType(DataType.DOUBLE))
                .addColumn(textCol("exif_taken_at", 50))
                .addColumn(new ColumnBuilder("width_px").setType(DataType.LONG))
                .addColumn(new ColumnBuilder("height_px").setType(DataType.LONG))
                .toTable(db);

        if (pivot.photos() == null) return;
        for (LicielPivot.PhotoRef p : pivot.photos()) {
            t.addRow(
                    pivot.kovasMissionId(),
                    p.fileRef(),
                    p.roomId(),
                    p.caption(),
                    p.exifLat(),
                    p.exifLng(),
                    p.exifTakenAt(),
                    p.widthPx(),
                    p.heightPx());
        }
    }

    private void writeDiagnosticsTable(Database db, LicielPivot pivot) throws IOException {
        Table t = new TableBuilder("Diagnostics")
                .addColumn(textCol("mission_id", 50))
                .addColumn(textCol("type", 20))
                .addColumn(textCol("result_summary", 255))
                .addColumn(textCol("energy_class", 2))
                .addColumn(textCol("ges_class", 2))
                .addColumn(new ColumnBuilder("consumption_kwhep_m2_year").setType(DataType.DOUBLE))
                .addColumn(new ColumnBuilder("emissions_kg_co2_m2_year").setType(DataType.DOUBLE))
                .addColumn(new ColumnBuilder("observations").setType(DataType.MEMO))
                .addColumn(new ColumnBuilder("reserves").setType(DataType.MEMO))
                .toTable(db);

        if (pivot.diagnostics() == null) return;
        for (LicielPivot.DiagnosticResult d : pivot.diagnostics()) {
            t.addRow(
                    pivot.kovasMissionId(),
                    d.type(),
                    d.resultSummary(),
                    d.energyClass(),
                    d.gesClass(),
                    d.consumptionKwhepM2Year(),
                    d.emissionsKgCo2M2Year(),
                    d.observations(),
                    joinReserves(d.reserves()));
        }
    }

    private void writeVoiceNotesTable(Database db, LicielPivot pivot) throws IOException {
        Table t = new TableBuilder("VoiceNotes")
                .addColumn(textCol("mission_id", 50))
                .addColumn(textCol("room_id", 50))
                .addColumn(new ColumnBuilder("transcript").setType(DataType.MEMO))
                .addColumn(new ColumnBuilder("confidence").setType(DataType.DOUBLE))
                .addColumn(textCol("recorded_at", 50))
                .toTable(db);

        if (pivot.voiceNotes() == null) return;
        for (LicielPivot.VoiceNote v : pivot.voiceNotes()) {
            t.addRow(
                    pivot.kovasMissionId(),
                    v.roomId(),
                    v.transcript(),
                    v.confidence(),
                    v.recordedAt());
        }
    }

    /* ────────────────────────────────────────────────────────────────────── */
    /* Helpers                                                                 */
    /* ────────────────────────────────────────────────────────────────────── */

    private static ColumnBuilder textCol(String name, int len) {
        return new ColumnBuilder(name).setType(DataType.TEXT).setLengthInUnits(len);
    }

    private static java.util.Date parseDate(String iso) {
        if (iso == null || iso.isBlank()) return null;
        try {
            return java.util.Date.from(java.time.OffsetDateTime.parse(iso).toInstant());
        } catch (Exception e) {
            try {
                return java.util.Date.from(java.time.Instant.parse(iso));
            } catch (Exception e2) {
                return null;
            }
        }
    }

    private static String joinReserves(List<String> reserves) {
        if (reserves == null || reserves.isEmpty()) return null;
        return String.join("\n• ", reserves.toArray(new String[0]));
    }

    private static int sizeOf(List<?> list) {
        return Optional.ofNullable(list).map(List::size).orElse(0);
    }

    /** Exposed for tests — assert file exists at given path. */
    public boolean isMdbFile(Path path) throws IOException {
        if (!Files.exists(path)) return false;
        byte[] head = Files.readAllBytes(path);
        // Jet 4.0 magic: bytes 0..15 contain "\x00\x01\x00\x00Standard Jet DB"
        if (head.length < 16) return false;
        String marker = new String(head, 4, 15);
        return marker.startsWith("Standard Jet DB") || marker.startsWith("Standard ACE DB");
    }
}
