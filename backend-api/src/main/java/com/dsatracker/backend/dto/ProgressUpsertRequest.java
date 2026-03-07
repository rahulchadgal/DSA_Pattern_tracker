package com.dsatracker.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record ProgressUpsertRequest(@NotBlank String leetcodeId, boolean completed, String handle) {}
