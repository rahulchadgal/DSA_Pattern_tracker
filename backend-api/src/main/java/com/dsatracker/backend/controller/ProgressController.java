package com.dsatracker.backend.controller;

import com.dsatracker.backend.dto.ProgressUpsertRequest;
import com.dsatracker.backend.dto.ProgressResponse;
import com.dsatracker.backend.service.ProgressService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/progress")
public class ProgressController {
    private final ProgressService progressService;

    public ProgressController(ProgressService progressService) {
        this.progressService = progressService;
    }

    @GetMapping
    public List<ProgressResponse> getMyProgress(
            @RequestParam(required = false) String handle,
            Authentication authentication
    ) {
        return progressService.getForHandle(resolveHandle(authentication, handle)).stream()
                .map(progressService::toResponse)
                .toList();
    }

    @PostMapping
    public ProgressResponse upsertProgress(@RequestBody @Valid ProgressUpsertRequest request, Authentication authentication) {
        return progressService.toResponse(progressService.upsertProgress(resolveHandle(authentication, request.handle()), request));
    }

    private String resolveHandle(Authentication authentication, String fallbackHandle) {
        if (authentication != null && authentication.getName() != null && !authentication.getName().isBlank()) {
            return authentication.getName().trim().toLowerCase();
        }
        if (fallbackHandle != null && !fallbackHandle.isBlank()) {
            return fallbackHandle.trim().toLowerCase();
        }
        throw new IllegalArgumentException("Handle is required when not authenticated");
    }
}
