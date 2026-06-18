package com.wetalk.modules.social.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.wetalk.modules.social.entity.GroupMember;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface GroupMemberMapper extends BaseMapper<GroupMember> {
    List<String> findMemberIds(@Param("groupId") String groupId);
}
