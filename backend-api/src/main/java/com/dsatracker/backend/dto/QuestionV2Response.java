package com.dsatracker.backend.dto;

import java.time.LocalDateTime;

public record QuestionV2Response(
        String leetcodeId,
        String title,
        String difficulty,
        String mainPattern,
        String subPattern,
        String link,
        boolean defaultQuestion,
        boolean customImported,
        String importedByHandle,
        String contentType,
        String metadataJson,
        LocalDateTime updatedAt
) {}
