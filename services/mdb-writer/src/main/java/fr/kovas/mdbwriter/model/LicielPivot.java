package fr.kovas.mdbwriter.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * KOVAS — Schéma JSON pivot Liciel V4 (miroir de
 * {@code apps/web/src/lib/liciel/zip-v4-schema.ts}).
 *
 * <p>Ce POJO est consommé par {@code ConvertController} et transformé en .mdb
 * Jet 4.0 via Jackcess. Le contrat versionné par {@code schemaVersion} (actuellement "4.0").</p>
 *
 * <p>{@code @JsonIgnoreProperties(ignoreUnknown = true)} pour rester compatible avec
 * les évolutions mineures non breaking côté Next.js (ex: nouveaux champs additionnels).</p>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record LicielPivot(
        @JsonProperty("schema_version") String schemaVersion,
        @JsonProperty("kovas_mission_id") String kovasMissionId,
        @JsonProperty("exported_at") String exportedAt,
        @JsonProperty("diagnostician") Diagnostician diagnostician,
        @JsonProperty("property") Property property,
        @JsonProperty("transaction_context") String transactionContext,
        @JsonProperty("contacts") List<Contact> contacts,
        @JsonProperty("rooms") List<RoomMeasurement> rooms,
        @JsonProperty("photos") List<PhotoRef> photos,
        @JsonProperty("equipments") List<Equipment> equipments,
        @JsonProperty("diagnostics") List<DiagnosticResult> diagnostics,
        @JsonProperty("voice_notes") List<VoiceNote> voiceNotes,
        @JsonProperty("kovas_audit") KovasAudit kovasAudit
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Diagnostician(
            @JsonProperty("full_name") String fullName,
            @JsonProperty("company_name") String companyName,
            @JsonProperty("siret") String siret,
            @JsonProperty("cofrac_number") String cofracNumber,
            @JsonProperty("rcpro_policy_number") String rcproPolicyNumber
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Property(
            @JsonProperty("type") String type,
            @JsonProperty("address") Address address,
            @JsonProperty("year_built") Integer yearBuilt,
            @JsonProperty("surface_total_m2") Double surfaceTotalM2,
            @JsonProperty("cadastre_parcelle_id") String cadastreParcelleId
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Address(
            @JsonProperty("full") String full,
            @JsonProperty("street_number") String streetNumber,
            @JsonProperty("street_name") String streetName,
            @JsonProperty("postcode") String postcode,
            @JsonProperty("city") String city,
            @JsonProperty("insee_code") String inseeCode,
            @JsonProperty("country") String country
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Contact(
            @JsonProperty("role") String role,
            @JsonProperty("civilite") String civilite,
            @JsonProperty("first_name") String firstName,
            @JsonProperty("last_name") String lastName,
            @JsonProperty("email") String email,
            @JsonProperty("phone") String phone
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RoomMeasurement(
            @JsonProperty("room_id") String roomId,
            @JsonProperty("room_name") String roomName,
            @JsonProperty("surface_brute_m2") Double surfaceBruteM2,
            @JsonProperty("surface_carrez_m2") Double surfaceCarrezM2,
            @JsonProperty("surface_boutin_m2") Double surfaceBoutinM2,
            @JsonProperty("hauteur_sous_plafond_m") Double hauteurSousPlafondM,
            @JsonProperty("is_annexe") Boolean isAnnexe
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PhotoRef(
            @JsonProperty("file_ref") String fileRef,
            @JsonProperty("room_id") String roomId,
            @JsonProperty("caption") String caption,
            @JsonProperty("exif_lat") Double exifLat,
            @JsonProperty("exif_lng") Double exifLng,
            @JsonProperty("exif_taken_at") String exifTakenAt,
            @JsonProperty("width_px") Integer widthPx,
            @JsonProperty("height_px") Integer heightPx
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Equipment(
            @JsonProperty("type") String type,
            @JsonProperty("brand") String brand,
            @JsonProperty("model") String model,
            @JsonProperty("power_kw") Double powerKw,
            @JsonProperty("energy_class") String energyClass,
            @JsonProperty("year_install") Integer yearInstall,
            @JsonProperty("serial_number") String serialNumber,
            @JsonProperty("photo_refs") List<String> photoRefs
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DiagnosticResult(
            @JsonProperty("type") String type,
            @JsonProperty("result_summary") String resultSummary,
            @JsonProperty("energy_class") String energyClass,
            @JsonProperty("ges_class") String gesClass,
            @JsonProperty("consumption_kwhep_m2_year") Double consumptionKwhepM2Year,
            @JsonProperty("emissions_kg_co2_m2_year") Double emissionsKgCo2M2Year,
            @JsonProperty("reserves") List<String> reserves,
            @JsonProperty("observations") String observations
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record VoiceNote(
            @JsonProperty("room_id") String roomId,
            @JsonProperty("transcript") String transcript,
            @JsonProperty("confidence") Double confidence,
            @JsonProperty("recorded_at") String recordedAt
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record KovasAudit(
            @JsonProperty("conformity_score") Integer conformityScore,
            @JsonProperty("anomalies") List<String> anomalies,
            @JsonProperty("validated_by_diagnostician") Boolean validatedByDiagnostician,
            @JsonProperty("validated_at") String validatedAt
    ) {}
}
