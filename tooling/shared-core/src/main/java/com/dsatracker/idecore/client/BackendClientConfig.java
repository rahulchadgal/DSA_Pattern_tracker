package com.dsatracker.idecore.client;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;

public record BackendClientConfig(URI baseUri, Duration timeout, HttpClient httpClient) {
    public BackendClientConfig {
        if (baseUri == null) {
            throw new IllegalArgumentException("baseUri is required");
        }
        if (timeout == null) {
            timeout = Duration.ofSeconds(15);
        }
        if (httpClient == null) {
            httpClient = HttpClient.newBuilder().connectTimeout(timeout).build();
        }
    }
}
