package com.dsatracker.idecore.model;

import java.util.ArrayList;
import java.util.List;

public class PatternNode {
    private final String name;
    private final NodeType type;
    private final QuestionV2 question;
    private final List<PatternNode> children = new ArrayList<>();

    public PatternNode(String name, NodeType type, QuestionV2 question) {
        this.name = name;
        this.type = type;
        this.question = question;
    }

    public static PatternNode pattern(String name) {
        return new PatternNode(name, NodeType.PATTERN, null);
    }

    public static PatternNode subPattern(String name) {
        return new PatternNode(name, NodeType.SUB_PATTERN, null);
    }

    public static PatternNode problem(QuestionV2 question) {
        return new PatternNode(question.title(), NodeType.PROBLEM, question);
    }

    public String getName() {
        return name;
    }

    public NodeType getType() {
        return type;
    }

    public QuestionV2 getQuestion() {
        return question;
    }

    public List<PatternNode> getChildren() {
        return children;
    }

    public void addChild(PatternNode child) {
        this.children.add(child);
    }

    public enum NodeType {
        PATTERN,
        SUB_PATTERN,
        PROBLEM
    }
}
