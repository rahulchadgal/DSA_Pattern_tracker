package com.dsatracker.backend.dto;

import java.util.List;

public record DashboardV1Response(
        String mode,
        String handle,
        DatabaseRuntimeInfoResponse database,
        List<QuestionV1Response> questions,
        List<ProgressResponse> progress,
        List<QuestionV2Response> customQuestions
) {
}
