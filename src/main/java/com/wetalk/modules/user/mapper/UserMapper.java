package com.wetalk.modules.user.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.wetalk.modules.user.entity.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface UserMapper extends BaseMapper<User> {
    User findByPhoneHash(@Param("phoneHash") String phoneHash);
    User findByUid(@Param("uid") String uid);
}
