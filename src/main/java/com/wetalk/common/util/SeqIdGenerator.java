package com.wetalk.common.util;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SeqIdGenerator {

    private final StringRedisTemplate redis;

    public long nextSeqId(String userId) {
        Long val = redis.opsForValue().increment("im:seq:" + userId);
        return val != null ? val : 0;
    }

    public long currentSeqId(String userId) {
        String val = redis.opsForValue().get("im:seq:" + userId);
        return val != null ? Long.parseLong(val) : 0;
    }
}
