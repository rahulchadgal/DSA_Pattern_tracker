package com.dsatracker.backend.dto;

public record DatabaseRuntimeInfoResponse(
        String activeProfile,
        String host,
        String port,
        String database
) {
}
