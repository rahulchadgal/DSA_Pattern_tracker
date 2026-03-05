package com.dsatracker.backend.repository;

import com.dsatracker.backend.model.ProgressRecord;
import com.dsatracker.backend.model.QuestionCatalogItem;
import com.dsatracker.backend.model.UserHandle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProgressRecordRepository extends JpaRepository<ProgressRecord, Long> {
    List<ProgressRecord> findByUser(UserHandle user);
    Optional<ProgressRecord> findByUserAndQuestion(UserHandle user, QuestionCatalogItem question);
}
