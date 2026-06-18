package com.wetalk.modules.social.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.wetalk.common.BusinessException;
import com.wetalk.common.ErrorCode;
import com.wetalk.modules.social.entity.FriendRelation;
import com.wetalk.modules.social.entity.FriendRequest;
import com.wetalk.modules.social.mapper.FriendMapper;
import com.wetalk.modules.social.service.FriendService;
import com.wetalk.modules.user.entity.User;
import com.wetalk.modules.user.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FriendServiceImpl implements FriendService {

    private final FriendMapper friendMapper;
    private final com.wetalk.modules.social.mapper.FriendRequestMapper friendRequestMapper;
    private final UserMapper userMapper;

    @Override
    @Transactional
    public void addFriend(String userId, String friendId, int source) {
        if (userId.equals(friendId)) throw new BusinessException(ErrorCode.FRIEND_NOT_FOUND);
        checkRelation(userId, friendId, ErrorCode.FRIEND_ALREADY);

        FriendRelation rel = new FriendRelation();
        rel.setUserId(userId); rel.setFriendId(friendId);
        rel.setSource(source); rel.setStatus(1);
        rel.setCreatedAt(System.currentTimeMillis());
        friendMapper.insert(rel);

        // Bidirectional
        FriendRelation rel2 = new FriendRelation();
        rel2.setUserId(friendId); rel2.setFriendId(userId);
        rel2.setSource(source); rel2.setStatus(1);
        rel2.setCreatedAt(System.currentTimeMillis());
        friendMapper.insert(rel2);
    }

    @Override
    @Transactional
    public void removeFriend(String userId, String friendId) {
        friendMapper.delete(new LambdaQueryWrapper<FriendRelation>()
                .eq(FriendRelation::getUserId, userId)
                .eq(FriendRelation::getFriendId, friendId));
        friendMapper.delete(new LambdaQueryWrapper<FriendRelation>()
                .eq(FriendRelation::getUserId, friendId)
                .eq(FriendRelation::getFriendId, userId));
    }

    @Override
    @Transactional
    public void blockFriend(String userId, String friendId) {
        FriendRelation rel = friendMapper.findByUserAndFriend(userId, friendId);
        if (rel == null) throw new BusinessException(ErrorCode.FRIEND_NOT_FOUND);
        rel.setStatus(2);
        friendMapper.updateById(rel);
    }

    @Override
    @Transactional
    public void unblockFriend(String userId, String friendId) {
        FriendRelation rel = friendMapper.findByUserAndFriend(userId, friendId);
        if (rel == null) throw new BusinessException(ErrorCode.FRIEND_NOT_FOUND);
        rel.setStatus(1);
        friendMapper.updateById(rel);
    }

    @Override
    public List<Map<String, Object>> getFriendList(String userId) {
        List<String> friendIds = friendMapper.findFriendIds(userId);
        return friendIds.stream().map(fid -> {
            User u = userMapper.findByUid(fid);
            if (u == null) return null;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("uid", u.getUid());
            m.put("nickname", u.getNickname());
            m.put("avatar", u.getAvatar());
            m.put("gender", u.getGender());
            return m;
        }).filter(Objects::nonNull).collect(Collectors.toList());
    }

    @Override
    public List<String> getFriendIds(String userId) {
        return friendMapper.findFriendIds(userId);
    }

    @Override
    public List<Map<String, Object>> searchUsers(String userId, String keyword) {
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<User>()
                .like(User::getNickname, keyword)
                .or(w -> w.like(User::getUid, keyword))
                .eq(User::getDeletedAt, null)
                .ne(User::getUid, userId)
                .last("LIMIT 20");
        return userMapper.selectList(wrapper).stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("uid", u.getUid());
            m.put("nickname", u.getNickname());
            m.put("avatar", u.getAvatar());
            return m;
        }).collect(Collectors.toList());
    }

    @Override
    public List<Map<String, Object>> getFriendRequests(String userId) {
        LambdaQueryWrapper<FriendRequest> wrapper = new LambdaQueryWrapper<FriendRequest>()
                .eq(FriendRequest::getToUid, userId)
                .orderByDesc(FriendRequest::getCreatedAt);
        return friendRequestMapper.selectList(wrapper).stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("fromUid", r.getFromUid());
            m.put("remark", r.getRemark());
            m.put("status", r.getStatus());
            m.put("createdAt", r.getCreatedAt());
            User u = userMapper.findByUid(r.getFromUid());
            m.put("nickname", u != null ? u.getNickname() : "未知");
            m.put("avatar", u != null ? u.getAvatar() : null);
            return m;
        }).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void sendFriendRequest(String fromUid, String toUid, String remark) {
        checkRelation(fromUid, toUid, ErrorCode.FRIEND_ALREADY);

        long count = friendRequestMapper.selectCount(new LambdaQueryWrapper<FriendRequest>()
                .eq(FriendRequest::getFromUid, fromUid)
                .eq(FriendRequest::getToUid, toUid)
                .eq(FriendRequest::getStatus, 0));
        if (count > 0) throw new BusinessException(ErrorCode.FRIEND_REQUEST_EXISTS);

        FriendRequest req = new FriendRequest();
        req.setFromUid(fromUid); req.setToUid(toUid);
        req.setRemark(remark != null ? remark : "");
        req.setStatus(0);
        req.setCreatedAt(System.currentTimeMillis());
        friendRequestMapper.insert(req);
    }

    @Override
    @Transactional
    public void acceptFriendRequest(String userId, String fromUid) {
        FriendRequest req = friendRequestMapper.selectOne(
                new LambdaQueryWrapper<FriendRequest>()
                        .eq(FriendRequest::getFromUid, fromUid)
                        .eq(FriendRequest::getToUid, userId)
                        .eq(FriendRequest::getStatus, 0));
        if (req == null) throw new BusinessException(ErrorCode.FRIEND_NOT_FOUND);
        req.setStatus(1);
        req.setHandledAt(System.currentTimeMillis());
        friendRequestMapper.updateById(req);

        addFriend(userId, fromUid, 1);
    }

    @Override
    @Transactional
    public void rejectFriendRequest(String userId, String fromUid) {
        FriendRequest req = friendRequestMapper.selectOne(
                new LambdaQueryWrapper<FriendRequest>()
                        .eq(FriendRequest::getFromUid, fromUid)
                        .eq(FriendRequest::getToUid, userId)
                        .eq(FriendRequest::getStatus, 0));
        if (req == null) throw new BusinessException(ErrorCode.FRIEND_NOT_FOUND);
        req.setStatus(2);
        req.setHandledAt(System.currentTimeMillis());
        friendRequestMapper.updateById(req);
    }

    private void checkRelation(String userId, String friendId, ErrorCode error) {
        FriendRelation existing = friendMapper.findByUserAndFriend(userId, friendId);
        if (existing != null && existing.getStatus() == 1) {
            throw new BusinessException(error);
        }
    }
}
