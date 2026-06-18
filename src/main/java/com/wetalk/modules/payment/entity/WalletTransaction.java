package com.wetalk.modules.payment.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;

@Data
@TableName("wallet_transaction")
public class WalletTransaction {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String txId;
    private String userId;
    private Integer type;
    private BigDecimal amount;
    private BigDecimal balanceBefore;
    private BigDecimal balanceAfter;
    private String relaId;
    private String remark;
    private Integer status;
    private Long createdAt;
}
