package com.dsatracker.backend.service;

import com.dsatracker.backend.dto.QuestionUpsertRequest;
import com.dsatracker.backend.dto.QuestionV1Response;
import com.dsatracker.backend.dto.QuestionV2Response;
import com.dsatracker.backend.model.QuestionCatalogItem;
import com.dsatracker.backend.repository.QuestionCatalogRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class QuestionService {
    private final QuestionCatalogRepository questionRepository;

    public QuestionService(QuestionCatalogRepository questionRepository) {
        this.questionRepository = questionRepository;
    }

    public List<QuestionV1Response> getV1Questions() {
        return questionRepository.findAll().stream()
                .map(q -> new QuestionV1Response(q.getLeetcodeId(), q.getTitle(), q.getDifficulty(), q.getMainPattern(), q.getSubPattern(), q.getLink()))
                .toList();
    }

    public List<QuestionV2Response> getV2Questions(Boolean customOnly, String importedByHandle) {
        List<QuestionCatalogItem> source;
        if (Boolean.TRUE.equals(customOnly)) {
            String normalizedHandle = normalizeOptionalHandle(importedByHandle);
            source = normalizedHandle == null
                    ? questionRepository.findByCustomImportedTrue()
                    : questionRepository.findByCustomImportedTrueAndImportedByHandle(normalizedHandle);
        } else {
            source = questionRepository.findAll();
        }

        return source.stream()
                .map(q -> new QuestionV2Response(
                        q.getLeetcodeId(),
                        q.getTitle(),
                        q.getDifficulty(),
                        q.getMainPattern(),
                        q.getSubPattern(),
                        q.getLink(),
                        q.isDefaultQuestion(),
                        q.isCustomImported(),
                        q.getImportedByHandle(),
                        q.getContentType(),
                        q.getMetadataJson(),
                        q.getUpdatedAt()))
                .toList();
    }

    public QuestionCatalogItem upsertQuestion(QuestionUpsertRequest request) {
        QuestionCatalogItem item = questionRepository.findByLeetcodeId(request.leetcodeId())
                .orElseGet(QuestionCatalogItem::new);

        item.setLeetcodeId(request.leetcodeId().trim());
        item.setTitle(request.title().trim());
        item.setDifficulty(request.difficulty().trim());
        item.setMainPattern(request.mainPattern().trim());
        item.setSubPattern(request.subPattern().trim());
        item.setLink(request.link().trim());
        item.setDefaultQuestion(request.defaultQuestion());
        item.setCustomImported(request.customImported());
        item.setImportedByHandle(normalizeOptionalHandle(request.importedByHandle()));
        item.setContentType(request.contentType() == null || request.contentType().isBlank() ? "QUESTION_ONLY" : request.contentType().trim());
        item.setMetadataJson(request.metadataJson());

        return questionRepository.save(item);
    }

    private String normalizeOptionalHandle(String handle) {
        if (handle == null || handle.isBlank()) {
            return null;
        }
        return handle.trim().toLowerCase();
    }
}
