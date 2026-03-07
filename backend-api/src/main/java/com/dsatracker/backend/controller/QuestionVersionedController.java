package com.dsatracker.backend.controller;

import com.dsatracker.backend.dto.QuestionUpsertRequest;
import com.dsatracker.backend.dto.QuestionV1Response;
import com.dsatracker.backend.dto.QuestionV2Response;
import com.dsatracker.backend.model.QuestionCatalogItem;
import com.dsatracker.backend.service.QuestionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class QuestionVersionedController {
    private final QuestionService questionService;

    public QuestionVersionedController(QuestionService questionService) {
        this.questionService = questionService;
    }

    @GetMapping("/v1/questions")
    public List<QuestionV1Response> listV1Questions() {
        return questionService.getV1Questions();
    }

    @GetMapping("/v2/questions")
    public List<QuestionV2Response> listV2Questions(
            @RequestParam(required = false) Boolean customOnly,
            @RequestParam(required = false) String importedByHandle
    ) {
        return questionService.getV2Questions(customOnly, importedByHandle);
    }

    @PostMapping("/v2/questions")
    public QuestionCatalogItem upsertQuestionV2(@RequestBody @Valid QuestionUpsertRequest request) {
        return questionService.upsertQuestion(request);
    }
}
