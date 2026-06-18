package com.wetalk.modules.payment.controller;

import com.wetalk.auth.UserPrincipal;
import com.wetalk.common.ApiResponse;
import com.wetalk.modules.payment.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/wallet")
@RequiredArgsConstructor
public class WalletController {

    private final WalletService walletService;

    @GetMapping("/balance")
    public ApiResponse<Map<String, Object>> getBalance(
            @AuthenticationPrincipal UserPrincipal user) {
        BigDecimal bal = walletService.getBalance(user.getUserId());
        return ApiResponse.success(Map.of("balance", bal));
    }

    @GetMapping("/transactions")
    public ApiResponse<?> getTransactions(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam(defaultValue = "20") int limit) {
        return ApiResponse.success(walletService.getTransactions(user.getUserId(), limit));
    }
}
