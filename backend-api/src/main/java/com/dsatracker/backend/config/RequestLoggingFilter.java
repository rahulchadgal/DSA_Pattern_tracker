package com.dsatracker.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
public class RequestLoggingFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(RequestLoggingFilter.class);
    private static final String REQUEST_ID_KEY = "requestId";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return "/actuator/health".equals(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        long start = System.currentTimeMillis();
        String requestId = request.getHeader("X-Request-Id");
        if (requestId == null || requestId.isBlank()) {
            requestId = UUID.randomUUID().toString();
        }

        MDC.put(REQUEST_ID_KEY, requestId);
        try {
            filterChain.doFilter(request, response);
        } catch (Exception ex) {
            log.error(
                    "Request failed method={} path={} query={} message={}",
                    request.getMethod(),
                    request.getRequestURI(),
                    request.getQueryString(),
                    ex.getMessage(),
                    ex
            );
            throw ex;
        } finally {
            long durationMs = System.currentTimeMillis() - start;
            log.info(
                    "Request completed method={} path={} query={} status={} durationMs={}",
                    request.getMethod(),
                    request.getRequestURI(),
                    request.getQueryString(),
                    response.getStatus(),
                    durationMs
            );
            MDC.remove(REQUEST_ID_KEY);
        }
    }
}
