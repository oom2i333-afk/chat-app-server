package com.wetalk.modules.user.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ProfileRequest {
    @Size(max = 12, message = "昵称不能超过12个字符")
    private String nickname;
    private Integer gender;
    private String avatar;
}
