package com.dsatracker.backend.service;

import com.dsatracker.backend.dto.ProgressUpsertRequest;
import com.dsatracker.backend.model.ProgressRecord;
import com.dsatracker.backend.model.QuestionCatalogItem;
import com.dsatracker.backend.model.UserHandle;
import com.dsatracker.backend.repository.ProgressRecordRepository;
import com.dsatracker.backend.repository.QuestionCatalogRepository;
import com.dsatracker.backend.repository.UserHandleRepository;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Recover;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ProgressService {
    private final ProgressRecordRepository progressRepository;
    private final UserHandleRepository userRepository;
    private final QuestionCatalogRepository questionRepository;

    public ProgressService(ProgressRecordRepository progressRepository, UserHandleRepository userRepository, QuestionCatalogRepository questionRepository) {
        this.progressRepository = progressRepository;
        this.userRepository = userRepository;
        this.questionRepository = questionRepository;
    }

    @Retryable(maxAttempts = 3, backoff = @Backoff(delay = 200, multiplier = 2.0), include = RuntimeException.class)
    public List<ProgressRecord> getForHandle(String handle) {
        UserHandle user = userRepository.findByHandle(handle)
                .orElseThrow(() -> new IllegalArgumentException("Handle not found"));
        return progressRepository.findByUser(user);
    }

    @Retryable(maxAttempts = 3, backoff = @Backoff(delay = 200, multiplier = 2.0), include = RuntimeException.class)
    public ProgressRecord upsertProgress(String handle, ProgressUpsertRequest request) {
        UserHandle user = userRepository.findByHandle(handle)
                .orElseThrow(() -> new IllegalArgumentException("Handle not found"));
        QuestionCatalogItem question = questionRepository.findByLeetcodeId(request.leetcodeId())
                .orElseThrow(() -> new IllegalArgumentException("Question not found in catalog"));

        ProgressRecord record = progressRepository.findByUserAndQuestion(user, question)
                .orElseGet(ProgressRecord::new);

        record.setUser(user);
        record.setQuestion(question);
        record.setCompleted(request.completed());
        return progressRepository.save(record);
    }

    @Recover
    public ProgressRecord recoverProgress(Exception ex, String handle, ProgressUpsertRequest request) {
        throw new IllegalStateException("Progress persistence failed after retries", ex);
    }
}
