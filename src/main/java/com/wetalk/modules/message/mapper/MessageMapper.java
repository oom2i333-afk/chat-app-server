package com.wetalk.modules.message.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.wetalk.modules.message.entity.Message;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface MessageMapper extends BaseMapper<Message> {
    List<Message> findBySeqRange(@Param("uid") String uid,
                                  @Param("fromSeq") long fromSeq,
                                  @Param("toSeq") long toSeq,
                                  @Param("limit") int limit);
}
