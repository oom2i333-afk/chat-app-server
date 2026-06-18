package com.wetalk.modules.social.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("group_member")
public class GroupMember {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String groupId;
    private String userId;
    private Integer role;
    private String groupNick;
    private Integer muted;
    private Long mutedUntil;
    private Long joinedAt;
    private Long leavedAt;
}
