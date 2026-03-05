package com.dsatracker.idecore.client;

import com.dsatracker.idecore.auth.TokenStore;
import com.dsatracker.idecore.model.AuthResponse;
import com.dsatracker.idecore.model.QuestionV1;
import com.dsatracker.idecore.model.QuestionV2;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

public class DsaBackendClient {
    private final BackendClientConfig config;
    private final ObjectMapper objectMapper;
    private final TokenStore tokenStore;

    public DsaBackendClient(BackendClientConfig config, TokenStore tokenStore) {
        this(config, new ObjectMapper(), tokenStore);
    }

    public DsaBackendClient(BackendClientConfig config, ObjectMapper objectMapper, TokenStore tokenStore) {
        this.config = config;
        this.objectMapper = objectMapper;
        this.tokenStore = tokenStore;
    }

    public AuthResponse login(String handle, String password) {
        String payload = writeJson(Map.of("handle", handle, "password", password));
        HttpRequest request = baseRequest("/api/auth/login")
                .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                .build();

        String body = send(request);
        AuthResponse authResponse = readJson(body, AuthResponse.class);
        tokenStore.saveToken(authResponse.token());
        return authResponse;
    }

    public List<QuestionV1> listQuestionsV1() {
        HttpRequest request = baseRequest("/api/v1/questions").GET().build();
        return readJson(send(request), new TypeReference<>() {
        });
    }

    public List<QuestionV2> listQuestionsV2() {
        HttpRequest request = authorizedRequest("/api/v2/questions").GET().build();
        return readJson(send(request), new TypeReference<>() {
        });
    }

    private HttpRequest.Builder baseRequest(String path) {
        URI uri = config.baseUri().resolve(path);
        return HttpRequest.newBuilder(uri)
                .timeout(config.timeout())
                .header("Accept", "application/json")
                .header("Content-Type", "application/json");
    }

    private HttpRequest.Builder authorizedRequest(String path) {
        String token = tokenStore.getToken()
                .orElseThrow(() -> new IllegalStateException("No JWT token found in secure storage"));

        return baseRequest(path).header("Authorization", "Bearer " + token);
    }

    private String send(HttpRequest request) {
        try {
            HttpResponse<String> response = config.httpClient().send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ApiException(response.statusCode(), response.body());
            }
            return response.body();
        } catch (IOException e) {
            throw new RuntimeException("I/O error while calling backend", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Interrupted while calling backend", e);
        }
    }

    private String writeJson(Object body) {
        try {
            return objectMapper.writeValueAsString(body);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Could not serialize request payload", e);
        }
    }

    private <T> T readJson(String body, Class<T> type) {
        try {
            return objectMapper.readValue(body, type);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Could not parse backend response", e);
        }
    }

    private <T> T readJson(String body, TypeReference<T> type) {
        try {
            return objectMapper.readValue(body, type);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Could not parse backend response", e);
        }
    }
}
