package com.wetalk.modules.payment.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.wetalk.modules.payment.entity.WalletTransaction;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface WalletTransactionMapper extends BaseMapper<WalletTransaction> {
}
