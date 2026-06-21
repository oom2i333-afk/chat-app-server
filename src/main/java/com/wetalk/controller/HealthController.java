package com.wetalk.controller;

import com.wetalk.common.ApiResponse;
import com.wetalk.config.InMemoryRedisTemplate;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.concurrent.TimeUnit;

@RestController
public class HealthController {

    private final StringRedisTemplate redis;

    public HealthController(@Qualifier("stringRedisTemplate") StringRedisTemplate redis) {
        this.redis = redis;
    }

    @GetMapping("/api/health")
    public ApiResponse<Map<String, Object>> health() {
        return ApiResponse.success(Map.of(
            "status", "ok",
            "timestamp", System.currentTimeMillis(),
            "version", "v4.0-java-60149ca"
        ));
    }

    @GetMapping("/api/v1/diag/redis")
    public ApiResponse<Map<String, Object>> diagRedis() {
        try {
            // Test 1: what type is redis?
            String type = redis.getClass().getName();

            // Test 2: opsForValue - is it null?
            var ops = redis.opsForValue();
            String opsType = ops == null ? "null" : ops.getClass().getName();

            // Test 3: set & get
            String testVal = "hello_diag_" + System.currentTimeMillis();
            ops.set("diag:test", testVal, 5, TimeUnit.MINUTES);
            String readBack = ops.get("diag:test");

            // Test 4: hasKey check
            boolean hasKey = Boolean.TRUE.equals(redis.hasKey("diag:test"));

            return ApiResponse.success(Map.of(
                "redisType", type,
                "opsType", opsType,
                "setValue", testVal,
                "readBack", readBack,
                "hasKey", hasKey,
                "status", "ok"
            ));
        } catch (Exception e) {
            return ApiResponse.success(Map.of(
                "error", e.getClass().getName() + ": " + e.getMessage(),
                "status", "fail"
            ));
        }
    }
}
