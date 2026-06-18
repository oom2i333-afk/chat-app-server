package com.wetalk.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Configuration
public class RateLimitConfig implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(loginRateLimit())
                .addPathPatterns("/api/v1/auth/login");
        registry.addInterceptor(registerRateLimit())
                .addPathPatterns("/api/v1/auth/register");
        registry.addInterceptor(generalRateLimit())
                .addPathPatterns("/api/v1/**");
    }

    @Bean
    public HandlerInterceptor loginRateLimit() {
        return new SlidingWindowRateLimiter(5, 60);
    }

    @Bean
    public HandlerInterceptor registerRateLimit() {
        return new SlidingWindowRateLimiter(3, 60);
    }

    @Bean
    public HandlerInterceptor generalRateLimit() {
        return new SlidingWindowRateLimiter(120, 60);
    }

    static class SlidingWindowRateLimiter implements HandlerInterceptor {
        private final Map<String, long[]> store = new ConcurrentHashMap<>();
        private final int limit;
        private final long windowMs;

        SlidingWindowRateLimiter(int limit, int windowSeconds) {
            this.limit = limit;
            this.windowMs = windowSeconds * 1000L;
        }

        @Override
        public boolean preHandle(HttpServletRequest request,
                                 HttpServletResponse response,
                                 Object handler) throws Exception {
            String key = request.getRemoteAddr();
            long now = System.currentTimeMillis();

            long[] timestamps = store.computeIfAbsent(key, k -> new long[limit]);
            synchronized (timestamps) {
                int count = 0;
                for (long t : timestamps) {
                    if (now - t < windowMs) count++;
                }
                if (count >= limit) {
                    response.setStatus(429);
                    response.setContentType("application/json;charset=UTF-8");
                    response.getWriter().write(
                        "{\"success\":false,\"error\":\"请求过于频繁\",\"timestamp\":" + now + "}");
                    return false;
                }
                // Shift and add current timestamp
                System.arraycopy(timestamps, 0, timestamps, 1, timestamps.length - 1);
                timestamps[0] = now;
            }
            return true;
        }
    }
}
