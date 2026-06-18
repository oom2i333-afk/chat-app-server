package com.wetalk.modules.payment.controller;

import com.wetalk.auth.UserPrincipal;
import com.wetalk.common.ApiResponse;
import com.wetalk.modules.payment.service.RedPacketService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/redpacket")
@RequiredArgsConstructor
public class RedPacketController {

    private final RedPacketService redPacketService;

    @PostMapping("/send")
    public ApiResponse<Map<String, Object>> send(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestBody Map<String, Object> body) {
        String chatId = (String) body.get("chatId");
        BigDecimal amount = new BigDecimal(body.get("amount").toString());
        Integer count = body.get("count") != null ? ((Number) body.get("count")).intValue() : 1;
        String blessing = (String) body.get("blessing");
        Integer type = body.get("type") != null ? (Integer) body.get("type") : 1;

        return ApiResponse.success(
                redPacketService.sendRedPacket(user.getUserId(), chatId, amount, count, blessing, type));
    }

    @PostMapping("/open")
    public ApiResponse<Map<String, Object>> open(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestBody Map<String, String> body) {
        return ApiResponse.success(
                redPacketService.openRedPacket(user.getUserId(), body.get("packetId")));
    }

    @GetMapping("/{packetId}")
    public ApiResponse<?> info(@PathVariable String packetId) {
        return ApiResponse.success(redPacketService.getRedPacket(packetId));
    }

    @GetMapping("/{packetId}/records")
    public ApiResponse<?> records(@PathVariable String packetId) {
        return ApiResponse.success(redPacketService.getRecords(packetId));
    }
}
