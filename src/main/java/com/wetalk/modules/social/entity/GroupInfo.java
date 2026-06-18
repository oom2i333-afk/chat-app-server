package com.wetalk.modules.social.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("group_info")
public class GroupInfo {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String groupId;
    private String name;
    private String avatar;
    private String notice;
    private String ownerUid;
    private Integer maxMembers;
    private Integer joinMode;
    private Integer status;
    private Long createdAt;
    private Long dissolvedAt;
}
