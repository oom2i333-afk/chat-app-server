package com.wetalk.modules.user.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class RegisterRequest {
    @NotBlank(message = "手机号不能为空")
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "请输入有效手机号")
    private String phone;

    @NotBlank(message = "密码不能为空")
    @Size(min = 8, max = 64, message = "密码长度需8-64位")
    private String password;

    @NotBlank(message = "验证码不能为空")
    private String captcha;

    @NotBlank(message = "验证码ID不能为空")
    private String captchaId;

    @NotBlank(message = "邀请码不能为空")
    @Size(min = 6, max = 6, message = "邀请码为6位数字")
    private String inviteCode;
}
