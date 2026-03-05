package com.dsatracker.idecore.tree;

import com.dsatracker.idecore.model.PatternNode;
import com.dsatracker.idecore.model.QuestionV2;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class PatternTreeBuilder {
    public List<PatternNode> build(List<QuestionV2> questions) {
        Map<String, Map<String, List<QuestionV2>>> grouped = new LinkedHashMap<>();

        for (QuestionV2 question : questions) {
            String main = safe(question.mainPattern(), "Uncategorized");
            String sub = safe(question.subPattern(), "General");
            grouped.computeIfAbsent(main, ignored -> new LinkedHashMap<>())
                    .computeIfAbsent(sub, ignored -> new ArrayList<>())
                    .add(question);
        }

        List<PatternNode> roots = new ArrayList<>();
        grouped.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(mainEntry -> {
                    PatternNode mainNode = PatternNode.pattern(mainEntry.getKey());

                    mainEntry.getValue().entrySet().stream()
                            .sorted(Map.Entry.comparingByKey())
                            .forEach(subEntry -> {
                                PatternNode subNode = PatternNode.subPattern(subEntry.getKey());
                                subEntry.getValue().stream()
                                        .sorted(Comparator.comparing(QuestionV2::title, String.CASE_INSENSITIVE_ORDER))
                                        .map(PatternNode::problem)
                                        .forEach(subNode::addChild);
                                mainNode.addChild(subNode);
                            });

                    roots.add(mainNode);
                });

        return roots;
    }

    private static String safe(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
