package com.dsatracker.idecore.model;

import com.fasterxml.jackson.annotation.JsonAlias;

import java.util.List;

/**
 * Flexible model to parse typical LeetCode export/import payloads.
 */
public record LeetCodeProblem(
        @JsonAlias({"id", "frontendQuestionId", "questionId"}) String id,
        String title,
        String difficulty,
        @JsonAlias({"url", "link"}) String link,
        @JsonAlias({"topicTags", "tags", "patterns"}) List<String> tags,
        @JsonAlias({"starterCode", "codeSnippet"}) String starterCode
) {
}
