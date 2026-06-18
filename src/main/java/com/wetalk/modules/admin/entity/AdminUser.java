package com.wetalk.modules.admin.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("admin_user")
public class AdminUser {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String username;
    private String passwordHash;
    private String nickname;
    private String role;
    private String mfaSecret;
    private Integer mfaEnabled;
    private Integer status;
    private String lastLoginIp;
    private Long lastLoginAt;
    private Long createdAt;
    private Long updatedAt;
}
