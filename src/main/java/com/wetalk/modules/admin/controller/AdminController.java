package com.wetalk.modules.admin.controller;

import com.wetalk.common.ApiResponse;
import com.wetalk.modules.message.entity.Message;
import com.wetalk.modules.message.mapper.MessageMapper;
import com.wetalk.modules.payment.entity.RedPacket;
import com.wetalk.modules.payment.entity.WalletTransaction;
import com.wetalk.modules.payment.mapper.RedPacketMapper;
import com.wetalk.modules.payment.mapper.WalletTransactionMapper;
import com.wetalk.modules.social.entity.GroupInfo;
import com.wetalk.modules.social.mapper.GroupMapper;
import com.wetalk.modules.user.entity.User;
import com.wetalk.modules.user.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserMapper userMapper;
    private final GroupMapper groupMapper;
    private final MessageMapper messageMapper;
    private final RedPacketMapper redPacketMapper;
    private final WalletTransactionMapper transactionMapper;

    @GetMapping("/dashboard")
    public ApiResponse<Map<String, Object>> dashboard() {
        long totalUsers = userMapper.selectCount(null);
        long totalGroups = groupMapper.selectCount(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<GroupInfo>()
                        .eq(GroupInfo::getStatus, 1));
        long totalMessages = messageMapper.selectCount(null);

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalUsers", totalUsers);
        stats.put("totalGroups", totalGroups);
        stats.put("totalMessages", totalMessages);
        stats.put("timestamp", System.currentTimeMillis());
        return ApiResponse.success(stats);
    }

    @GetMapping("/users")
    public ApiResponse<List<Map<String, Object>>> users(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword) {
        List<User> users = userMapper.selectList(null);
        List<Map<String, Object>> result = users.stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("uid", u.getUid());
            m.put("nickname", u.getNickname());
            m.put("status", u.getStatus());
            m.put("verifyStatus", u.getVerifyStatus());
            m.put("balance", u.getBalance());
            m.put("createdAt", u.getCreatedAt());
            return m;
        }).collect(Collectors.toList());
        return ApiResponse.success(result);
    }

    @PostMapping("/users/{uid}/ban")
    public ApiResponse<Void> banUser(@PathVariable String uid,
                                      @RequestBody Map<String, String> body) {
        User user = userMapper.findByUid(uid);
        if (user == null) return ApiResponse.error("用户不存在");
        user.setStatus(0);
        userMapper.updateById(user);
        return ApiResponse.success(null);
    }

    @PostMapping("/users/{uid}/unban")
    public ApiResponse<Void> unbanUser(@PathVariable String uid) {
        User user = userMapper.findByUid(uid);
        if (user == null) return ApiResponse.error("用户不存在");
        user.setStatus(1);
        userMapper.updateById(user);
        return ApiResponse.success(null);
    }

    @GetMapping("/groups")
    public ApiResponse<List<Map<String, Object>>> groups() {
        List<GroupInfo> groups = groupMapper.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<GroupInfo>()
                        .eq(GroupInfo::getStatus, 1));
        List<Map<String, Object>> result = groups.stream().map(g -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("groupId", g.getGroupId());
            m.put("name", g.getName());
            m.put("ownerUid", g.getOwnerUid());
            m.put("createdAt", g.getCreatedAt());
            return m;
        }).collect(Collectors.toList());
        return ApiResponse.success(result);
    }

    @GetMapping("/redpackets")
    public ApiResponse<List<RedPacket>> redPackets() {
        return ApiResponse.success(redPacketMapper.selectList(null));
    }

    @GetMapping("/transactions")
    public ApiResponse<List<WalletTransaction>> transactions(
            @RequestParam(defaultValue = "50") int limit) {
        return ApiResponse.success(transactionMapper.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<WalletTransaction>()
                        .orderByDesc(WalletTransaction::getCreatedAt)
                        .last("LIMIT " + limit)));
    }
}
