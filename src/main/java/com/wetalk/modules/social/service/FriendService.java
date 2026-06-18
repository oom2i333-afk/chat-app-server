package com.wetalk.modules.social.service;

import java.util.List;
import java.util.Map;

public interface FriendService {
    void addFriend(String userId, String friendId, int source);
    void removeFriend(String userId, String friendId);
    void blockFriend(String userId, String friendId);
    void unblockFriend(String userId, String friendId);
    List<Map<String, Object>> getFriendList(String userId);
    List<String> getFriendIds(String userId);
    List<Map<String, Object>> searchUsers(String userId, String keyword);
    List<Map<String, Object>> getFriendRequests(String userId);
    void sendFriendRequest(String fromUid, String toUid, String remark);
    void acceptFriendRequest(String userId, String fromUid);
    void rejectFriendRequest(String userId, String fromUid);
}
