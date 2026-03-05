package com.dsatracker.idecore.client;

public class ApiException extends RuntimeException {
    private final int statusCode;
    private final String body;

    public ApiException(int statusCode, String body) {
        super("Backend API error: status=" + statusCode);
        this.statusCode = statusCode;
        this.body = body;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public String getBody() {
        return body;
    }
}
