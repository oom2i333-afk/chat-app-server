package com.wetalk.modules.payment.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;

@Data
@TableName("red_packet_record")
public class RedPacketRecord {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String packetId;
    private String userId;
    private BigDecimal amount;
    private Long createdAt;
}
