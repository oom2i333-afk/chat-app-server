package com.wetalk.modules.social.controller;

import com.wetalk.auth.UserPrincipal;
import com.wetalk.common.ApiResponse;
import com.wetalk.modules.social.service.GroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/social")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;

    @PostMapping("/group/create")
    public ApiResponse<Map<String, Object>> createGroup(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        @SuppressWarnings("unchecked")
        List<String> members = (List<String>) body.get("memberIds");
        return ApiResponse.success(groupService.createGroup(user.getUserId(), name, members));
    }

    @GetMapping("/groups")
    public ApiResponse<List<Map<String, Object>>> getGroups(
            @AuthenticationPrincipal UserPrincipal user) {
        return ApiResponse.success(groupService.getUserGroups(user.getUserId()));
    }

    @GetMapping("/group/{groupId}")
    public ApiResponse<Map<String, Object>> getGroupInfo(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable String groupId) {
        return ApiResponse.success(groupService.getGroupInfo(groupId, user.getUserId()));
    }

    @GetMapping("/group/{groupId}/members")
    public ApiResponse<List<Map<String, Object>>> getMembers(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable String groupId) {
        return ApiResponse.success(groupService.getGroupMembers(groupId, user.getUserId()));
    }

    @PostMapping("/group/{groupId}/member")
    public ApiResponse<Void> addMember(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable String groupId,
            @RequestBody Map<String, String> body) {
        groupService.addMember(groupId, user.getUserId(), body.get("userId"));
        return ApiResponse.success(null);
    }

    @DeleteMapping("/group/{groupId}/member/{targetId}")
    public ApiResponse<Void> removeMember(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable String groupId,
            @PathVariable String targetId) {
        groupService.removeMember(groupId, user.getUserId(), targetId);
        return ApiResponse.success(null);
    }

    @PostMapping("/group/{groupId}/leave")
    public ApiResponse<Void> leaveGroup(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable String groupId) {
        groupService.leaveGroup(groupId, user.getUserId());
        return ApiResponse.success(null);
    }

    @PostMapping("/group/{groupId}/dissolve")
    public ApiResponse<Void> dissolveGroup(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable String groupId) {
        groupService.dissolveGroup(groupId, user.getUserId());
        return ApiResponse.success(null);
    }

    @PostMapping("/group/{groupId}/role")
    public ApiResponse<Void> setRole(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable String groupId,
            @RequestBody Map<String, Object> body) {
        groupService.setRole(groupId, user.getUserId(),
                (String) body.get("userId"), (Integer) body.get("role"));
        return ApiResponse.success(null);
    }

    @PostMapping("/group/{groupId}/mute")
    public ApiResponse<Void> setMute(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable String groupId,
            @RequestBody Map<String, Object> body) {
        groupService.setMute(groupId, user.getUserId(),
                (String) body.get("userId"),
                (Integer) body.getOrDefault("muted", 1),
                body.get("until") != null ? ((Number) body.get("until")).longValue() : null);
        return ApiResponse.success(null);
    }

    @PostMapping("/group/{groupId}/mute-all")
    public ApiResponse<Void> setMuteAll(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable String groupId,
            @RequestBody Map<String, Boolean> body) {
        groupService.setGroupMuteAll(groupId, user.getUserId(),
                body.getOrDefault("muted", true));
        return ApiResponse.success(null);
    }

    @PostMapping("/group/{groupId}/transfer")
    public ApiResponse<Void> transfer(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable String groupId,
            @RequestBody Map<String, String> body) {
        groupService.transferGroup(groupId, user.getUserId(), body.get("toUid"));
        return ApiResponse.success(null);
    }

    @PutMapping("/group/{groupId}/notice")
    public ApiResponse<Void> setNotice(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable String groupId,
            @RequestBody Map<String, String> body) {
        groupService.setNotice(groupId, user.getUserId(), body.get("notice"));
        return ApiResponse.success(null);
    }
}
