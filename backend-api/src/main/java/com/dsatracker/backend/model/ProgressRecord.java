package com.dsatracker.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "progress_records", uniqueConstraints = {
        @UniqueConstraint(name = "uk_progress_user_question", columnNames = {"user_id", "question_id"})
})
public class ProgressRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private UserHandle user;

    @ManyToOne(optional = false)
    @JoinColumn(name = "question_id")
    private QuestionCatalogItem question;

    @Column(nullable = false)
    private boolean completed;

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Column
    private LocalDateTime completedAt;

    @PrePersist
    @PreUpdate
    public void touch() {
        this.updatedAt = LocalDateTime.now();
        this.completedAt = completed ? LocalDateTime.now() : null;
    }

    public Long getId() { return id; }
    public UserHandle getUser() { return user; }
    public void setUser(UserHandle user) { this.user = user; }
    public QuestionCatalogItem getQuestion() { return question; }
    public void setQuestion(QuestionCatalogItem question) { this.question = question; }
    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
}
