package com.wetalk.modules.message.controller;

import com.wetalk.auth.UserPrincipal;
import com.wetalk.common.ApiResponse;
import com.wetalk.modules.message.entity.Message;
import com.wetalk.modules.message.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/message")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;

    @GetMapping("/sync")
    public ApiResponse<List<Message>> sync(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam long fromSeq,
            @RequestParam(required = false) Long toSeq,
            @RequestParam(defaultValue = "500") int limit) {
        return ApiResponse.success(
                messageService.syncMessages(user.getUserId(), fromSeq, toSeq, limit));
    }

    @GetMapping("/history")
    public ApiResponse<List<Message>> history(
            @RequestParam String chatId,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") long offset) {
        return ApiResponse.success(messageService.getMessages(chatId, limit, offset));
    }

    @PostMapping("/recall")
    public ApiResponse<Void> recall(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestBody Map<String, String> body) {
        boolean ok = messageService.recallMessage(body.get("msgId"), user.getUserId());
        return ok ? ApiResponse.success(null) : ApiResponse.error("消息不存在或无权操作");
    }

    @DeleteMapping("/{msgId}")
    public ApiResponse<Void> delete(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable String msgId) {
        messageService.deleteMessage(msgId, user.getUserId());
        return ApiResponse.success(null);
    }
}
