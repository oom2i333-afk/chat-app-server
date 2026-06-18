package com.wetalk.modules.admin.controller;

import com.wetalk.auth.JwtTokenProvider;
import com.wetalk.common.ApiResponse;
import com.wetalk.modules.admin.entity.AdminUser;
import com.wetalk.modules.admin.mapper.AdminUserMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminAuthController {

    private final AdminUserMapper adminUserMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@RequestBody Map<String, String> body,
                                                   HttpServletRequest request) {
        String username = body.get("username");
        String password = body.get("password");

        AdminUser admin = adminUserMapper.findByUsername(username);
        if (admin == null || !passwordEncoder.matches(password, admin.getPasswordHash())) {
            return ApiResponse.error("账号或密码错误");
        }

        String token = jwtTokenProvider.generateAccessToken(
                "admin_" + admin.getId(), "ROLE_ADMIN");

        admin.setLastLoginAt(System.currentTimeMillis());
        admin.setLastLoginIp(request.getRemoteAddr());
        adminUserMapper.updateById(admin);

        return ApiResponse.success(Map.of(
            "token", token,
            "nickname", admin.getNickname(),
            "role", admin.getRole()
        ));
    }

    @GetMapping("/me")
    public ApiResponse<Map<String, Object>> me(HttpServletRequest request) {
        String userId = (String) request.getAttribute("userId");
        if (userId == null || !userId.startsWith("admin_")) {
            return ApiResponse.error("未登录");
        }
        Long adminId = Long.parseLong(userId.replace("admin_", ""));
        AdminUser admin = adminUserMapper.selectById(adminId);
        if (admin == null) return ApiResponse.error("管理员不存在");
        return ApiResponse.success(Map.of(
            "nickname", admin.getNickname(),
            "role", admin.getRole()
        ));
    }
}
