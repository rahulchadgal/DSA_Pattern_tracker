package com.dsatracker.backend.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "question_catalog", indexes = {
        @Index(name = "idx_question_catalog_leetcode_id", columnList = "leetcodeId", unique = true)
})
public class QuestionCatalogItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 32)
    private String leetcodeId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, length = 16)
    private String difficulty;

    @Column(nullable = false, length = 120)
    private String mainPattern;

    @Column(nullable = false, length = 120)
    private String subPattern;

    @Column(nullable = false)
    private String link;

    @Column(nullable = false)
    private boolean defaultQuestion = true;

    @Column(nullable = false)
    private boolean customImported = false;

    @Column(length = 64)
    private String importedByHandle;

    @Column(length = 32)
    private String contentType = "QUESTION_ONLY";

    @Column(columnDefinition = "TEXT")
    private String metadataJson;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getLeetcodeId() { return leetcodeId; }
    public void setLeetcodeId(String leetcodeId) { this.leetcodeId = leetcodeId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }
    public String getMainPattern() { return mainPattern; }
    public void setMainPattern(String mainPattern) { this.mainPattern = mainPattern; }
    public String getSubPattern() { return subPattern; }
    public void setSubPattern(String subPattern) { this.subPattern = subPattern; }
    public String getLink() { return link; }
    public void setLink(String link) { this.link = link; }
    public boolean isDefaultQuestion() { return defaultQuestion; }
    public void setDefaultQuestion(boolean defaultQuestion) { this.defaultQuestion = defaultQuestion; }
    public boolean isCustomImported() { return customImported; }
    public void setCustomImported(boolean customImported) { this.customImported = customImported; }
    public String getImportedByHandle() { return importedByHandle; }
    public void setImportedByHandle(String importedByHandle) { this.importedByHandle = importedByHandle; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public String getMetadataJson() { return metadataJson; }
    public void setMetadataJson(String metadataJson) { this.metadataJson = metadataJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
