package com.wetalk.modules.user.controller;

import com.wetalk.common.ApiResponse;
import com.wetalk.modules.user.service.CaptchaService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class CaptchaController {

    private final CaptchaService captchaService;

    @PostMapping("/captcha")
    public ApiResponse<Map<String, String>> generateCaptcha() {
        String result = captchaService.generateCaptcha();
        String[] parts = result.split(":", 2);
        return ApiResponse.success(Map.of(
            "captchaId", parts[0],
            "code", parts.length > 1 ? parts[1] : ""
        ));
    }

    @PostMapping("/send-sms")
    public ApiResponse<Void> sendSms(@RequestBody Map<String, String> body) {
        String phone = body.get("phone");
        if (phone == null || !phone.matches("^1[3-9]\\d{9}$")) {
            return ApiResponse.error("请输入有效手机号");
        }
        captchaService.sendSmsCode(phone);
        return ApiResponse.success(null);
    }
}
