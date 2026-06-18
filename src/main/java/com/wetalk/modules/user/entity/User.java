package com.wetalk.modules.user.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;

@Data
@TableName("user")
public class User {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String uid;
    private byte[] phoneAes;
    private String phoneHash;
    private String passwordHash;
    private String payPwdHash;
    private String nickname;
    private String avatar;
    private Integer gender;
    private byte[] realNameAes;
    private byte[] idCardAes;
    private Integer verifyStatus;
    private BigDecimal balance;
    private Integer points;
    private Integer status;
    private String inviteCode;
    private String regIp;
    private String regDevice;
    private Long lastLoginAt;
    private String lastLoginIp;
    private Long createdAt;
    @TableLogic
    private Long deletedAt;
}
