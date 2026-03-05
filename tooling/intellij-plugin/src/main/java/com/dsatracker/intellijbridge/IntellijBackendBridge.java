package com.dsatracker.intellijbridge;

import com.dsatracker.idecore.client.BackendClientConfig;
import com.dsatracker.idecore.client.DsaBackendClient;
import com.dsatracker.idecore.model.PatternNode;
import com.dsatracker.idecore.model.QuestionV2;
import com.dsatracker.idecore.tree.PatternTreeBuilder;

import java.net.URI;
import java.time.Duration;
import java.util.List;

public class IntellijBackendBridge {
    private final DsaBackendClient client;

    public IntellijBackendBridge(String backendUrl) {
        this.client = new DsaBackendClient(
                new BackendClientConfig(URI.create(backendUrl), Duration.ofSeconds(15), null),
                new IntellijTokenStore()
        );
    }

    public List<PatternNode> loadPatternTree() {
        List<QuestionV2> questions = client.listQuestionsV2();
        return new PatternTreeBuilder().build(questions);
    }
}
