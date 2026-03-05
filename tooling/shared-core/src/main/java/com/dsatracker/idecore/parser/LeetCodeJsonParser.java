package com.dsatracker.idecore.parser;

import com.dsatracker.idecore.model.LeetCodeProblem;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class LeetCodeJsonParser {
    private final ObjectMapper objectMapper;

    public LeetCodeJsonParser() {
        this(new ObjectMapper());
    }

    public LeetCodeJsonParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public List<LeetCodeProblem> parse(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode source = root;

            if (root.has("data") && root.get("data").isArray()) {
                source = root.get("data");
            } else if (root.has("questions") && root.get("questions").isArray()) {
                source = root.get("questions");
            }

            if (!source.isArray()) {
                return List.of();
            }

            List<LeetCodeProblem> problems = new ArrayList<>();
            for (JsonNode node : source) {
                problems.add(objectMapper.treeToValue(node, LeetCodeProblem.class));
            }
            return problems;
        } catch (IOException e) {
            throw new IllegalArgumentException("Invalid LeetCode JSON payload", e);
        }
    }
}
