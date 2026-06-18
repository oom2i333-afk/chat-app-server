package com.wetalk.modules.payment.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;

@Data
@TableName("red_packet")
public class RedPacket {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String packetId;
    private String senderUid;
    private String chatId;
    private Integer type;
    private BigDecimal totalAmount;
    private Integer totalCount;
    private BigDecimal remainAmount;
    private Integer remainCount;
    private String blessing;
    private Integer status;
    private Long expireAt;
    private Long createdAt;
    private Long updatedAt;
}
