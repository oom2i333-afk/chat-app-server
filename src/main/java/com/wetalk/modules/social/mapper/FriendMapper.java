package com.wetalk.modules.social.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.wetalk.modules.social.entity.FriendRelation;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface FriendMapper extends BaseMapper<FriendRelation> {
    List<String> findFriendIds(@Param("userId") String userId);
    FriendRelation findByUserAndFriend(@Param("userId") String userId, @Param("friendId") String friendId);
}
