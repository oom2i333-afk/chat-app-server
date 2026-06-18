package com.wetalk.modules.user.controller;

import com.wetalk.common.ApiResponse;
import com.wetalk.modules.user.dto.*;
import com.wetalk.modules.user.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    @PostMapping("/register")
    public ApiResponse<UserVO> register(@Valid @RequestBody RegisterRequest req,
                                         HttpServletRequest request) {
        UserVO user = userService.register(req, request.getRemoteAddr());
        return ApiResponse.success(user);
    }

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest req,
                                             HttpServletRequest request) {
        LoginResponse resp = userService.login(req, request.getRemoteAddr());
        return ApiResponse.success(resp);
    }
}
