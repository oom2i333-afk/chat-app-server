package com.wetalk.modules.user.dto;

import lombok.Data;

@Data
public class LoginResponse {
    private String accessToken;
    private String refreshToken;
    private UserVO user;
}
