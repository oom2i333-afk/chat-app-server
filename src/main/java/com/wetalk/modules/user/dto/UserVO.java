package com.wetalk.modules.user.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class UserVO {
    private String uid;
    private String nickname;
    private String avatar;
    private Integer gender;
    private String phone;
    private Integer verifyStatus;
    private BigDecimal balance;
    private Integer points;
    private Long createdAt;
}
