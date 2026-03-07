package com.dsatracker.backend.service;

import com.dsatracker.backend.dto.ProgressUpsertRequest;
import com.dsatracker.backend.dto.ProgressResponse;
import com.dsatracker.backend.model.ProgressRecord;
import com.dsatracker.backend.model.QuestionCatalogItem;
import com.dsatracker.backend.model.UserHandle;
import com.dsatracker.backend.repository.ProgressRecordRepository;
import com.dsatracker.backend.repository.QuestionCatalogRepository;
import com.dsatracker.backend.repository.UserHandleRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Recover;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class ProgressService {
    private final ProgressRecordRepository progressRepository;
    private final UserHandleRepository userRepository;
    private final QuestionCatalogRepository questionRepository;
    private final PasswordEncoder passwordEncoder;

    public ProgressService(
            ProgressRecordRepository progressRepository,
            UserHandleRepository userRepository,
            QuestionCatalogRepository questionRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.progressRepository = progressRepository;
        this.userRepository = userRepository;
        this.questionRepository = questionRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Retryable(maxAttempts = 3, backoff = @Backoff(delay = 200, multiplier = 2.0), include = RuntimeException.class)
    public List<ProgressRecord> getForHandle(String handle) {
        UserHandle user = resolveOrCreateUser(handle);
        return progressRepository.findByUser(user);
    }

    @Retryable(maxAttempts = 3, backoff = @Backoff(delay = 200, multiplier = 2.0), include = RuntimeException.class)
    public ProgressRecord upsertProgress(String handle, ProgressUpsertRequest request) {
        UserHandle user = resolveOrCreateUser(handle);
        QuestionCatalogItem question = questionRepository.findByLeetcodeId(request.leetcodeId())
                .orElseThrow(() -> new IllegalArgumentException("Question not found in catalog"));

        ProgressRecord record = progressRepository.findByUserAndQuestion(user, question)
                .orElseGet(ProgressRecord::new);

        record.setUser(user);
        record.setQuestion(question);
        record.setCompleted(request.completed());
        return progressRepository.save(record);
    }

    public ProgressResponse toResponse(ProgressRecord record) {
        return new ProgressResponse(
                record.getQuestion().getLeetcodeId(),
                record.isCompleted(),
                record.getUpdatedAt(),
                record.getCompletedAt()
        );
    }

    private UserHandle resolveOrCreateUser(String rawHandle) {
        String handle = normalizeHandle(rawHandle);
        return userRepository.findByHandle(handle).orElseGet(() -> {
            String emailLocalPart = handle.replaceAll("[^a-z0-9._-]", "-");
            if (emailLocalPart.isBlank()) {
                emailLocalPart = "user-" + UUID.randomUUID();
            }
            UserHandle user = new UserHandle();
            user.setHandle(handle);
            user.setEmail(emailLocalPart + "@local.dsa");
            user.setFullName(handle);
            user.setPasswordHash(passwordEncoder.encode("shadow-" + UUID.randomUUID()));
            return userRepository.save(user);
        });
    }

    private String normalizeHandle(String rawHandle) {
        if (rawHandle == null || rawHandle.isBlank()) {
            throw new IllegalArgumentException("Handle is required");
        }
        return rawHandle.trim().toLowerCase();
    }

    @Recover
    public ProgressRecord recoverProgress(Exception ex, String handle, ProgressUpsertRequest request) {
        throw new IllegalStateException("Progress persistence failed after retries", ex);
    }
}
