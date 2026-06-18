package com.wetalk.modules.user.controller;

import com.wetalk.auth.UserPrincipal;
import com.wetalk.common.ApiResponse;
import com.wetalk.modules.user.dto.*;
import com.wetalk.modules.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/profile")
    public ApiResponse<UserVO> getProfile(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.success(userService.getProfile(principal.getUserId()));
    }

    @PutMapping("/profile")
    public ApiResponse<UserVO> updateProfile(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ProfileRequest req) {
        return ApiResponse.success(userService.updateProfile(principal.getUserId(), req));
    }
}
