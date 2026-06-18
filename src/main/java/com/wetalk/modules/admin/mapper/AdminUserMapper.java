package com.wetalk.modules.admin.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.wetalk.modules.admin.entity.AdminUser;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface AdminUserMapper extends BaseMapper<AdminUser> {
    AdminUser findByUsername(@Param("username") String username);
}
