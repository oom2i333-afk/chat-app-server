package com.wetalk.modules.social.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.wetalk.common.BusinessException;
import com.wetalk.common.ErrorCode;
import com.wetalk.modules.social.entity.GroupInfo;
import com.wetalk.modules.social.entity.GroupMember;
import com.wetalk.modules.social.mapper.GroupMapper;
import com.wetalk.modules.social.mapper.GroupMemberMapper;
import com.wetalk.modules.social.service.GroupService;
import com.wetalk.modules.user.entity.User;
import com.wetalk.modules.user.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupServiceImpl implements GroupService {

    private final GroupMapper groupMapper;
    private final GroupMemberMapper memberMapper;
    private final UserMapper userMapper;
    private final StringRedisTemplate redis;

    @Override
    @Transactional
    public Map<String, Object> createGroup(String userId, String name, List<String> memberIds) {
        String groupId = "g_" + UUID.randomUUID().toString().substring(0, 8);
        Set<String> allIds = new LinkedHashSet<>();
        allIds.add(userId);
        if (memberIds != null) allIds.addAll(memberIds);

        GroupInfo group = new GroupInfo();
        group.setGroupId(groupId);
        group.setName(name.length() > 20 ? name.substring(0, 20) : name);
        group.setOwnerUid(userId);
        group.setMaxMembers(500);
        group.setStatus(1);
        group.setCreatedAt(System.currentTimeMillis());
        groupMapper.insert(group);

        int i = 0;
        for (String uid : allIds) {
            GroupMember m = new GroupMember();
            m.setGroupId(groupId);
            m.setUserId(uid);
            m.setRole(uid.equals(userId) ? 2 : 0);
            m.setJoinedAt(System.currentTimeMillis());
            memberMapper.insert(m);
        }

        saveGroupMembersToRedis(groupId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("groupId", groupId);
        result.put("name", group.getName());
        result.put("memberCount", allIds.size());
        return result;
    }

    @Override
    @Transactional
    public void dissolveGroup(String groupId, String userId) {
        GroupInfo group = getGroupOrThrow(groupId);
        if (!group.getOwnerUid().equals(userId)) {
            throw new BusinessException(ErrorCode.GROUP_NO_PERMISSION);
        }
        group.setStatus(0);
        group.setDissolvedAt(System.currentTimeMillis());
        groupMapper.updateById(group);
        redis.delete("group:members:" + groupId);
    }

    @Override
    @Transactional
    public void leaveGroup(String groupId, String userId) {
        GroupInfo group = getGroupOrThrow(groupId);
        if (group.getOwnerUid().equals(userId)) {
            throw new BusinessException(ErrorCode.GROUP_NO_PERMISSION);
        }
        memberMapper.delete(new LambdaQueryWrapper<GroupMember>()
                .eq(GroupMember::getGroupId, groupId)
                .eq(GroupMember::getUserId, userId));
        saveGroupMembersToRedis(groupId);
    }

    @Override
    @Transactional
    public void addMember(String groupId, String operatorId, String targetId) {
        GroupInfo group = getGroupOrThrow(groupId);
        checkAdmin(groupId, operatorId);

        long count = memberMapper.selectCount(new LambdaQueryWrapper<GroupMember>()
                .eq(GroupMember::getGroupId, groupId)
                .eq(GroupMember::getUserId, targetId)
                .isNull(GroupMember::getLeavedAt));
        if (count > 0) throw new BusinessException(ErrorCode.GROUP_ALREADY_MEMBER);

        if (group.getMaxMembers() != null && count >= group.getMaxMembers()) {
            throw new BusinessException(ErrorCode.GROUP_FULL);
        }

        GroupMember m = new GroupMember();
        m.setGroupId(groupId); m.setUserId(targetId);
        m.setRole(0); m.setJoinedAt(System.currentTimeMillis());
        memberMapper.insert(m);
        saveGroupMembersToRedis(groupId);
    }

    @Override
    @Transactional
    public void removeMember(String groupId, String operatorId, String targetId) {
        getGroupOrThrow(groupId);
        checkAdmin(groupId, operatorId);
        memberMapper.delete(new LambdaQueryWrapper<GroupMember>()
                .eq(GroupMember::getGroupId, groupId)
                .eq(GroupMember::getUserId, targetId));
        saveGroupMembersToRedis(groupId);
    }

    @Override
    @Transactional
    public void setRole(String groupId, String operatorId, String targetId, int role) {
        GroupInfo group = getGroupOrThrow(groupId);
        if (!group.getOwnerUid().equals(operatorId)) {
            throw new BusinessException(ErrorCode.GROUP_NO_PERMISSION);
        }
        GroupMember m = getMemberOrThrow(groupId, targetId);
        m.setRole(role);
        memberMapper.updateById(m);
    }

    @Override
    @Transactional
    public void setMute(String groupId, String operatorId, String targetId, int muted, Long until) {
        checkAdmin(groupId, operatorId);
        GroupMember m = getMemberOrThrow(groupId, targetId);
        m.setMuted(muted);
        m.setMutedUntil(until);
        memberMapper.updateById(m);
    }

    @Override
    @Transactional
    public void setGroupMuteAll(String groupId, String operatorId, boolean muted) {
        GroupInfo group = getGroupOrThrow(groupId);
        if (!group.getOwnerUid().equals(operatorId)) {
            throw new BusinessException(ErrorCode.GROUP_NO_PERMISSION);
        }
        memberMapper.update(null, new LambdaUpdateWrapper<GroupMember>()
                .eq(GroupMember::getGroupId, groupId)
                .ne(GroupMember::getUserId, operatorId)
                .set(GroupMember::getMuted, muted ? 1 : 0)
                .set(GroupMember::getMutedUntil, null));
    }

    @Override
    @Transactional
    public void transferGroup(String groupId, String operatorId, String targetId) {
        GroupInfo group = getGroupOrThrow(groupId);
        if (!group.getOwnerUid().equals(operatorId)) {
            throw new BusinessException(ErrorCode.GROUP_NO_PERMISSION);
        }
        getMemberOrThrow(groupId, targetId);
        group.setOwnerUid(targetId);
        groupMapper.updateById(group);

        memberMapper.update(null, new LambdaUpdateWrapper<GroupMember>()
                .eq(GroupMember::getGroupId, groupId)
                .eq(GroupMember::getUserId, operatorId)
                .set(GroupMember::getRole, 0));
        memberMapper.update(null, new LambdaUpdateWrapper<GroupMember>()
                .eq(GroupMember::getGroupId, groupId)
                .eq(GroupMember::getUserId, targetId)
                .set(GroupMember::getRole, 2));
    }

    @Override
    @Transactional
    public void setNotice(String groupId, String operatorId, String notice) {
        GroupInfo group = getGroupOrThrow(groupId);
        checkAdmin(groupId, operatorId);
        group.setNotice(notice != null ? notice.substring(0, Math.min(notice.length(), 500)) : "");
        groupMapper.updateById(group);
    }

    @Override
    public Map<String, Object> getGroupInfo(String groupId, String userId) {
        GroupInfo group = getGroupOrThrow(groupId);
        checkMember(groupId, userId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("groupId", group.getGroupId());
        result.put("name", group.getName());
        result.put("avatar", group.getAvatar());
        result.put("notice", group.getNotice());
        result.put("ownerUid", group.getOwnerUid());
        result.put("maxMembers", group.getMaxMembers());
        result.put("memberCount", memberMapper.selectCount(
                new LambdaQueryWrapper<GroupMember>()
                        .eq(GroupMember::getGroupId, groupId)
                        .isNull(GroupMember::getLeavedAt)));
        return result;
    }

    @Override
    public List<Map<String, Object>> getUserGroups(String userId) {
        List<GroupMember> members = memberMapper.selectList(
                new LambdaQueryWrapper<GroupMember>()
                        .eq(GroupMember::getUserId, userId)
                        .isNull(GroupMember::getLeavedAt));

        return members.stream().map(m -> {
            GroupInfo g = groupMapper.selectOne(
                    new LambdaQueryWrapper<GroupInfo>()
                            .eq(GroupInfo::getGroupId, m.getGroupId())
                            .eq(GroupInfo::getStatus, 1));
            if (g == null) return null;
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("groupId", g.getGroupId());
            result.put("name", g.getName());
            result.put("avatar", g.getAvatar());
            result.put("memberCount", memberMapper.selectCount(
                    new LambdaQueryWrapper<GroupMember>()
                            .eq(GroupMember::getGroupId, m.getGroupId())
                            .isNull(GroupMember::getLeavedAt)));
            return result;
        }).filter(Objects::nonNull).collect(Collectors.toList());
    }

    @Override
    public List<Map<String, Object>> getGroupMembers(String groupId, String userId) {
        getGroupOrThrow(groupId);
        checkMember(groupId, userId);

        List<GroupMember> members = memberMapper.selectList(
                new LambdaQueryWrapper<GroupMember>()
                        .eq(GroupMember::getGroupId, groupId)
                        .isNull(GroupMember::getLeavedAt));

        return members.stream().map(m -> {
            User u = userMapper.findByUid(m.getUserId());
            if (u == null) return null;
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("uid", m.getUserId());
            result.put("nickname", u.getNickname());
            result.put("avatar", u.getAvatar());
            result.put("role", m.getRole());
            result.put("groupNick", m.getGroupNick());
            result.put("muted", m.getMuted());
            return result;
        }).filter(Objects::nonNull).collect(Collectors.toList());
    }

    @Override
    public void saveGroupMembersToRedis(String groupId) {
        List<String> memberIds = memberMapper.findMemberIds(groupId);
        if (memberIds.isEmpty()) {
            redis.delete("group:members:" + groupId);
        } else {
            redis.opsForSet().add("group:members:" + groupId,
                    memberIds.toArray(new String[0]));
            redis.expire("group:members:" + groupId, 1, TimeUnit.HOURS);
        }
    }

    private GroupInfo getGroupOrThrow(String groupId) {
        GroupInfo group = groupMapper.selectOne(
                new LambdaQueryWrapper<GroupInfo>()
                        .eq(GroupInfo::getGroupId, groupId)
                        .eq(GroupInfo::getStatus, 1));
        if (group == null) throw new BusinessException(ErrorCode.GROUP_NOT_FOUND);
        return group;
    }

    private GroupMember getMemberOrThrow(String groupId, String userId) {
        GroupMember m = memberMapper.selectOne(
                new LambdaQueryWrapper<GroupMember>()
                        .eq(GroupMember::getGroupId, groupId)
                        .eq(GroupMember::getUserId, userId)
                        .isNull(GroupMember::getLeavedAt));
        if (m == null) throw new BusinessException(ErrorCode.GROUP_NOT_FOUND);
        return m;
    }

    private void checkAdmin(String groupId, String userId) {
        GroupMember m = getMemberOrThrow(groupId, userId);
        if (m.getRole() < 1) throw new BusinessException(ErrorCode.GROUP_NO_PERMISSION);
    }

    private void checkMember(String groupId, String userId) {
        long count = memberMapper.selectCount(
                new LambdaQueryWrapper<GroupMember>()
                        .eq(GroupMember::getGroupId, groupId)
                        .eq(GroupMember::getUserId, userId)
                        .isNull(GroupMember::getLeavedAt));
        if (count == 0) throw new BusinessException(ErrorCode.GROUP_NOT_FOUND);
    }
}
