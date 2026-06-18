package com.wetalk.modules.social.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("friend_relation")
public class FriendRelation {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String userId;
    private String friendId;
    private String remark;
    private Integer source;
    private Integer status;
    private Long createdAt;
    @TableLogic
    private Long deletedAt;
}
