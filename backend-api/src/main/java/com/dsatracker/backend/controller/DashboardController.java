package com.dsatracker.backend.controller;

import com.dsatracker.backend.dto.*;
import com.dsatracker.backend.service.ProgressService;
import com.dsatracker.backend.service.QuestionService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/v1")
public class DashboardController {
    private static final Pattern JDBC_PATTERN = Pattern.compile("^jdbc:postgresql://([^:/?]+)(?::(\\d+))?/([^?]+).*$");

    private final QuestionService questionService;
    private final ProgressService progressService;
    private final Environment environment;
    private final String datasourceUrl;

    public DashboardController(
            QuestionService questionService,
            ProgressService progressService,
            Environment environment,
            @Value("${spring.datasource.url:}") String datasourceUrl
    ) {
        this.questionService = questionService;
        this.progressService = progressService;
        this.environment = environment;
        this.datasourceUrl = datasourceUrl;
    }

    @GetMapping("/dashboard")
    public DashboardV1Response dashboard(
            @RequestParam(required = false) String handle,
            @RequestParam(defaultValue = "SERVER") String mode,
            Authentication authentication
    ) {
        String resolvedHandle = resolveOptionalHandle(authentication, handle);
        List<QuestionV1Response> questions = questionService.getV1Questions();
        List<ProgressResponse> progress = resolvedHandle == null
                ? List.of()
                : progressService.getForHandle(resolvedHandle).stream().map(progressService::toResponse).toList();
        List<QuestionV2Response> custom = resolvedHandle == null
                ? List.of()
                : questionService.getV2Questions(true, resolvedHandle);

        return new DashboardV1Response(
                normalizeMode(mode),
                resolvedHandle,
                parseDbInfo(),
                questions,
                progress,
                custom
        );
    }

    private String resolveOptionalHandle(Authentication authentication, String fallbackHandle) {
        if (authentication != null && authentication.getName() != null && !authentication.getName().isBlank()) {
            return authentication.getName().trim().toLowerCase();
        }
        if (fallbackHandle != null && !fallbackHandle.isBlank()) {
            return fallbackHandle.trim().toLowerCase();
        }
        return null;
    }

    private String normalizeMode(String mode) {
        if (mode == null || mode.isBlank()) {
            return "SERVER";
        }
        return mode.trim().toUpperCase();
    }

    private DatabaseRuntimeInfoResponse parseDbInfo() {
        String profile = environment.getActiveProfiles().length > 0
                ? environment.getActiveProfiles()[0]
                : "default";

        Matcher matcher = JDBC_PATTERN.matcher(datasourceUrl == null ? "" : datasourceUrl);
        if (!matcher.matches()) {
            return new DatabaseRuntimeInfoResponse(profile, "unknown", "unknown", "unknown");
        }

        String host = matcher.group(1);
        String port = matcher.group(2) == null ? "5432" : matcher.group(2);
        String database = matcher.group(3);
        return new DatabaseRuntimeInfoResponse(profile, host, port, database);
    }
}
