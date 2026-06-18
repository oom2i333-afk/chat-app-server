package com.wetalk.modules.social.controller;

import com.wetalk.auth.UserPrincipal;
import com.wetalk.common.ApiResponse;
import com.wetalk.modules.social.service.FriendService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/social")
@RequiredArgsConstructor
public class FriendController {

    private final FriendService friendService;

    @GetMapping("/friends")
    public ApiResponse<List<Map<String, Object>>> getFriends(
            @AuthenticationPrincipal UserPrincipal user) {
        return ApiResponse.success(friendService.getFriendList(user.getUserId()));
    }

    @GetMapping("/friends/search")
    public ApiResponse<List<Map<String, Object>>> searchUsers(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam String keyword) {
        return ApiResponse.success(friendService.searchUsers(user.getUserId(), keyword));
    }

    @PostMapping("/friend/add")
    public ApiResponse<Void> addFriend(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestBody Map<String, String> body) {
        friendService.addFriend(user.getUserId(), body.get("friendId"), 1);
        return ApiResponse.success(null);
    }

    @PostMapping("/friend/request")
    public ApiResponse<Void> sendRequest(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestBody Map<String, String> body) {
        friendService.sendFriendRequest(user.getUserId(),
                body.get("toUid"), body.get("remark"));
        return ApiResponse.success(null);
    }

    @PostMapping("/friend/accept")
    public ApiResponse<Void> acceptRequest(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestBody Map<String, String> body) {
        friendService.acceptFriendRequest(user.getUserId(), body.get("fromUid"));
        return ApiResponse.success(null);
    }

    @PostMapping("/friend/reject")
    public ApiResponse<Void> rejectRequest(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestBody Map<String, String> body) {
        friendService.rejectFriendRequest(user.getUserId(), body.get("fromUid"));
        return ApiResponse.success(null);
    }

    @GetMapping("/friend/requests")
    public ApiResponse<List<Map<String, Object>>> getRequests(
            @AuthenticationPrincipal UserPrincipal user) {
        return ApiResponse.success(friendService.getFriendRequests(user.getUserId()));
    }

    @DeleteMapping("/friend/{friendId}")
    public ApiResponse<Void> removeFriend(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable String friendId) {
        friendService.removeFriend(user.getUserId(), friendId);
        return ApiResponse.success(null);
    }

    @PostMapping("/friend/{friendId}/block")
    public ApiResponse<Void> blockFriend(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable String friendId) {
        friendService.blockFriend(user.getUserId(), friendId);
        return ApiResponse.success(null);
    }
}
