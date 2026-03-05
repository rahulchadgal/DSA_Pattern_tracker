package com.dsatracker.backend.repository;

import com.dsatracker.backend.model.QuestionCatalogItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface QuestionCatalogRepository extends JpaRepository<QuestionCatalogItem, Long> {
    Optional<QuestionCatalogItem> findByLeetcodeId(String leetcodeId);
}
