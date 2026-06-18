package com.wetalk.modules.user.service.impl;

import com.wetalk.modules.user.service.CaptchaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class CaptchaServiceImpl implements CaptchaService {

    private final StringRedisTemplate redis;
    private static final SecureRandom RANDOM = new SecureRandom();

    @Override
    public String generateCaptcha() {
        String captchaId = "cap_" + System.currentTimeMillis() + "_" + RANDOM.nextInt(10000);
        String code = randomString(6).toUpperCase();
        redis.opsForValue().set("captcha:" + captchaId, code, 5, TimeUnit.MINUTES);
        return captchaId + ":" + code;
    }

    @Override
    public boolean verifyCaptcha(String captchaId, String code) {
        String key = "captcha:" + captchaId;
        String stored = redis.opsForValue().get(key);
        if (stored == null) return false;
        redis.delete(key);
        return stored.equalsIgnoreCase(code);
    }

    @Override
    public String sendSmsCode(String phone) {
        String code = String.format("%06d", RANDOM.nextInt(1000000));
        redis.opsForValue().set("sms:" + phone, code, 5, TimeUnit.MINUTES);
        log.info("SMS code for {}: {}", phone, code);
        return code;
    }

    @Override
    public boolean verifySmsCode(String phone, String code) {
        String key = "sms:" + phone;
        String stored = redis.opsForValue().get(key);
        if (stored == null) return false;
        redis.delete(key);
        return stored.equals(code);
    }

    private String randomString(int len) {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) {
            sb.append(chars.charAt(RANDOM.nextInt(chars.length())));
        }
        return sb.toString();
    }
}
