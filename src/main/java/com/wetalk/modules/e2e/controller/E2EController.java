package com.wetalk.modules.e2e.controller;

import com.wetalk.auth.UserPrincipal;
import com.wetalk.common.ApiResponse;
import com.wetalk.modules.e2e.service.E2EKeyService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/e2e")
@RequiredArgsConstructor
public class E2EController {

    private final E2EKeyService e2eKeyService;

    @PostMapping("/keys")
    public ApiResponse<Void> uploadKeys(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestBody Map<String, Object> body) {
        String publicKey = (String) body.get("publicKey");
        String keyType = (String) body.get("keyType");
        String signature = (String) body.get("signature");
        e2eKeyService.registerPublicKey(user.getUserId(), publicKey, keyType, signature);
        return ApiResponse.success(null);
    }

    @GetMapping("/keys/{targetUserId}")
    public ApiResponse<Map<String, Object>> getKeys(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable String targetUserId) {
        String publicKey = e2eKeyService.getPublicKey(targetUserId);
        List<Map<String, String>> preKeys = e2eKeyService.getPreKeys(targetUserId);
        return ApiResponse.success(Map.of(
            "identityKey", publicKey,
            "preKeys", preKeys
        ));
    }
}
