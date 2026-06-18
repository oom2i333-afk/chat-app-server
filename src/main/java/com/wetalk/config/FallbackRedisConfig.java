package com.wetalk.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.*;

import java.util.Collections;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@Configuration
@Profile("dev")
public class FallbackRedisConfig {

    @Bean
    @Primary
    public StringRedisTemplate stringRedisTemplate() {
        StringRedisTemplate mock = mock(StringRedisTemplate.class);

        ValueOperations<String, String> valueOps = mock(ValueOperations.class);
        when(valueOps.increment(anyString())).thenReturn(1L);

        SetOperations<String, String> setOps = mock(SetOperations.class);
        when(setOps.members(anyString())).thenReturn(Collections.emptySet());

        when(mock.opsForValue()).thenReturn(valueOps);
        when(mock.opsForSet()).thenReturn(setOps);
        when(mock.hasKey(anyString())).thenReturn(false);
        when(mock.delete(anyString())).thenReturn(true);
        when(mock.getExpire(anyString())).thenReturn(-1L);
        when(mock.expire(anyString(), anyLong(), any())).thenReturn(true);

        return mock;
    }
}
