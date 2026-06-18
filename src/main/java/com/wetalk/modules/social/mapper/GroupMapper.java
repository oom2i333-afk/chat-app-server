package com.wetalk.modules.social.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.wetalk.modules.social.entity.GroupInfo;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface GroupMapper extends BaseMapper<GroupInfo> {
}
