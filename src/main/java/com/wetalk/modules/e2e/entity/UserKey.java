package com.wetalk.modules.e2e.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("user_key")
public class UserKey {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String userId;
    private String publicKey;      // Curve25519 public key (base64)
    private String keyType;        // "identity" / "signed-pre" / "one-time-pre"
    private String signature;      // Signature of the key
    private Long createdAt;
    private Long updatedAt;
}
