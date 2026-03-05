package com.dsatracker.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Size(min = 3, max = 64) String handle,
        @NotBlank @Email @Size(max = 120) String email,
        @NotBlank @Size(min = 2, max = 120) String fullName,
        @Size(max = 1000) String bio,
        @Size(max = 500) String avatarUrl,
        @NotBlank @Size(min = 8, max = 120) String password
) {}
