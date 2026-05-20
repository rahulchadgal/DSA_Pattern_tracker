package com.dsatracker.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record QuestionUpsertRequest(
        @NotBlank String leetcodeId,
        @NotBlank String title,
        @NotBlank String difficulty,
        @NotBlank String mainPattern,
        @NotBlank String subPattern,
        @NotBlank String link,
        boolean defaultQuestion,
        boolean customImported,
        String importedByHandle,
        String contentType,
        String metadataJson
) {}
