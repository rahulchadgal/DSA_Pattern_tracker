package com.dsatracker.backend.controller;

import com.dsatracker.backend.dto.ProgressUpsertRequest;
import com.dsatracker.backend.model.ProgressRecord;
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
    public List<ProgressRecord> getMyProgress(Authentication authentication) {
        return progressService.getForHandle(authentication.getName());
    }

    @PostMapping
    public ProgressRecord upsertProgress(@RequestBody @Valid ProgressUpsertRequest request, Authentication authentication) {
        return progressService.upsertProgress(authentication.getName(), request);
    }
}
