package com.wetalk.controller;

import com.wetalk.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HealthController {

    @GetMapping("/api/health")
    public ApiResponse<Map<String, Object>> health() {
        return ApiResponse.success(Map.of(
            "status", "ok",
            "timestamp", System.currentTimeMillis(),
            "version", "v4.0-java-60149ca"
        ));
    }
}
