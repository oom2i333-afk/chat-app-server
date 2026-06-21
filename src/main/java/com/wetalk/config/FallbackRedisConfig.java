package com.wetalk.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * Dev profile: 使用 InMemoryRedisTemplate 替代真实 Redis。
 * 独立外部类，不涉及 @Configuration CGLIB 代理问题。
 */
@Configuration
@Profile("dev")
public class FallbackRedisConfig {

    @Bean
    @Primary
    public StringRedisTemplate stringRedisTemplate() {
        return new InMemoryRedisTemplate();
    }
}
