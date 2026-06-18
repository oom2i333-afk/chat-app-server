package com.wetalk.modules.social.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("friend_request")
public class FriendRequest {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String fromUid;
    private String toUid;
    private String remark;
    private Integer status;
    private Long createdAt;
    private Long handledAt;
}
