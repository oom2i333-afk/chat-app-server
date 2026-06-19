package com.wetalk.modules.message.controller;

import com.wetalk.auth.JwtTokenProvider;
import com.wetalk.auth.UserPrincipal;
import com.wetalk.modules.message.entity.Message;
import com.wetalk.modules.message.event.MessageEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@RestController
@RequiredArgsConstructor
public class SSEController {

    private final JwtTokenProvider jwtTokenProvider;
    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();

    @GetMapping("/api/v1/events")
    public SseEmitter subscribe(@RequestHeader(value = "Authorization", required = false) String auth,
                                 @RequestParam(value = "token", required = false) String tokenParam) {
        // Support both Authorization header and token query param (EventSource doesn't support custom headers)
        String authValue = auth;
        if ((authValue == null || authValue.isBlank()) && tokenParam != null && !tokenParam.isBlank()) {
            authValue = "Bearer " + tokenParam;
        }
        String userId = extractUserId(authValue);
        if (userId == null) {
            SseEmitter errorEmitter = new SseEmitter(0L);
            try {
                errorEmitter.send(SseEmitter.event()
                        .name("error")
                        .data("Invalid token"));
            } catch (IOException e) {
                // ignore
            }
            errorEmitter.complete();
            return errorEmitter;
        }

        SseEmitter emitter = new SseEmitter(0L); // never timeout
        emitters.put(userId, emitter);

        emitter.onCompletion(() -> {
            emitters.remove(userId);
            log.debug("SSE completed and removed userId={}", userId);
        });
        emitter.onTimeout(() -> {
            emitters.remove(userId);
            log.debug("SSE timed out and removed userId={}", userId);
        });
        emitter.onError(e -> {
            emitters.remove(userId);
            log.debug("SSE error and removed userId={}: {}", userId, e.getMessage());
        });

        // Send an initial connected event so the client knows it's ready
        try {
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data(Map.of("userId", userId, "timestamp", System.currentTimeMillis())));
        } catch (IOException e) {
            emitters.remove(userId);
            log.warn("Failed to send initial SSE event for userId={}", userId);
        }

        log.info("SSE subscribed userId={}, total emitters={}", userId, emitters.size());
        return emitter;
    }

    @EventListener
    public void onMessage(MessageEvent event) {
        Message message = event.getMessage();

        // Push to recipient
        String toUid = message.getToUid();
        SseEmitter recipientEmitter = emitters.get(toUid);
        if (recipientEmitter != null) {
            try {
                recipientEmitter.send(SseEmitter.event()
                        .name("new-message")
                        .data(message));
            } catch (IOException e) {
                emitters.remove(toUid);
                log.warn("Failed to send new-message to recipient userId={}", toUid);
            }
        }

        // Push status to sender's other devices
        String fromUid = message.getFromUid();
        SseEmitter senderEmitter = emitters.get(fromUid);
        if (senderEmitter != null && !fromUid.equals(toUid)) {
            try {
                senderEmitter.send(SseEmitter.event()
                        .name("message-status")
                        .data(Map.of(
                                "msgId", message.getMsgId(),
                                "seqId", message.getSeqId(),
                                "status", message.getStatus(),
                                "createdAt", message.getCreatedAt()
                        )));
            } catch (IOException e) {
                emitters.remove(fromUid);
                log.warn("Failed to send message-status to sender userId={}", fromUid);
            }
        }
    }

    /**
     * Extract user ID from the Authorization header (Bearer token).
     * Falls back to checking the raw header value as the token string.
     */
    private String extractUserId(String auth) {
        if (auth == null || auth.isBlank()) {
            return null;
        }
        String token;
        if (auth.startsWith("Bearer ")) {
            token = auth.substring(7);
        } else {
            token = auth;
        }
        UserPrincipal principal = jwtTokenProvider.validateAccessToken(token);
        return principal != null ? principal.getUserId() : null;
    }
}
