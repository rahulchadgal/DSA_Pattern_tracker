package com.dsatracker.idecore.model;

public record QuestionV1(
        String leetcodeId,
        String title,
        String difficulty,
        String mainPattern,
        String subPattern,
        String link
) {
}
