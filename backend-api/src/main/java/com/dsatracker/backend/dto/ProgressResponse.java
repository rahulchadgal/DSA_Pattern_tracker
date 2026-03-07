package com.dsatracker.backend.dto;

import java.time.LocalDateTime;

public record ProgressResponse(
        String leetcodeId,
        boolean completed,
        LocalDateTime updatedAt,
        LocalDateTime completedAt
) {
}
