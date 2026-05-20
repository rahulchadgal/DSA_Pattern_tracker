package com.dsatracker.backend.repository;

import com.dsatracker.backend.model.QuestionCatalogItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface QuestionCatalogRepository extends JpaRepository<QuestionCatalogItem, Long> {
    Optional<QuestionCatalogItem> findByLeetcodeId(String leetcodeId);
    @Query("""
            SELECT q
            FROM QuestionCatalogItem q
            WHERE q.defaultQuestion = true
               OR q.importedByHandle IS NULL
               OR q.importedByHandle <> 'system-company-import'
            ORDER BY q.id ASC
            """)
    List<QuestionCatalogItem> findPatternCatalogQuestions();
    List<QuestionCatalogItem> findByCustomImportedTrue();
    List<QuestionCatalogItem> findByCustomImportedTrueAndImportedByHandle(String importedByHandle);
}
