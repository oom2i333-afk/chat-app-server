package com.wetalk.modules.message.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("message")
public class Message {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String msgId;
    private Long seqId;
    private String fromUid;
    private String toUid;
    private Integer chatType;
    private Integer msgType;
    private byte[] contentAes;
    private String fileUrl;
    private Integer fileSize;
    private String fileName;
    private Integer duration;
    private String refMsgId;
    private Integer status;
    private Integer isMentioned;
    private Long createdAt;
    private Long updatedAt;
}
