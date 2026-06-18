package com.wetalk.modules.social.service;

import java.util.List;
import java.util.Map;

public interface GroupService {
    Map<String, Object> createGroup(String userId, String name, List<String> memberIds);
    void dissolveGroup(String groupId, String userId);
    void leaveGroup(String groupId, String userId);
    void addMember(String groupId, String operatorId, String userId);
    void removeMember(String groupId, String operatorId, String targetId);
    void setRole(String groupId, String operatorId, String targetId, int role);
    void setMute(String groupId, String operatorId, String targetId, int muted, Long until);
    void setGroupMuteAll(String groupId, String operatorId, boolean muted);
    void transferGroup(String groupId, String operatorId, String targetId);
    void setNotice(String groupId, String operatorId, String notice);
    Map<String, Object> getGroupInfo(String groupId, String userId);
    List<Map<String, Object>> getUserGroups(String userId);
    List<Map<String, Object>> getGroupMembers(String groupId, String userId);
    void saveGroupMembersToRedis(String groupId);
}
