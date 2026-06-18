package com.wetalk.modules.user.service;

public interface CaptchaService {
    String generateCaptcha();
    boolean verifyCaptcha(String captchaId, String code);
    String sendSmsCode(String phone);
    boolean verifySmsCode(String phone, String code);
}
