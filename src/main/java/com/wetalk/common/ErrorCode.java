package com.wetalk.common;

public enum ErrorCode {
    SUCCESS(0, "成功"),
    BAD_REQUEST(400, "请求参数错误"),
    UNAUTHORIZED(401, "未登录或登录已过期"),
    FORBIDDEN(403, "无权限操作"),
    NOT_FOUND(404, "资源不存在"),
    RATE_LIMITED(429, "请求过于频繁"),
    INTERNAL_ERROR(500, "服务器内部错误"),

    // Auth
    USER_NOT_FOUND(1001, "账号未注册"),
    PASSWORD_ERROR(1002, "密码错误"),
    ACCOUNT_BANNED(1003, "账号已被封禁"),
    ACCOUNT_LOCKED(1004, "账号已锁定，请稍后再试"),
    PHONE_EXISTS(1005, "该手机号已注册"),
    INVITE_CODE_INVALID(1006, "邀请码无效"),
    CAPTCHA_INVALID(1007, "验证码错误或已过期"),
    TOKEN_EXPIRED(1008, "令牌已过期，请重新登录"),
    MFA_REQUIRED(1009, "需要二次验证"),

    // Social
    FRIEND_ALREADY(2001, "已是好友"),
    FRIEND_REQUEST_EXISTS(2002, "已发送过请求"),
    FRIEND_NOT_FOUND(2003, "好友不存在"),
    GROUP_NOT_FOUND(2101, "群组不存在"),
    GROUP_ALREADY_MEMBER(2102, "已在群中"),
    GROUP_NO_PERMISSION(2103, "无权限操作"),
    GROUP_FULL(2104, "群成员已满"),

    // Message
    MSG_TOO_FREQUENT(3001, "消息发送过于频繁"),
    MSG_TOO_LONG(3002, "消息内容过长"),
    MSG_TYPE_INVALID(3003, "不支持的消息类型"),

    // Payment
    INSUFFICIENT_BALANCE(4001, "余额不足"),
    RED_PACKET_EXPIRED(4002, "红包已过期"),
    RED_PACKET_CLAIMED(4003, "红包已被领取"),
    RED_PACKET_SELF(4004, "不能抢自己的红包"),
    PAY_PWD_ERROR(4005, "支付密码错误");

    private final int code;
    private final String message;

    ErrorCode(int code, String message) {
        this.code = code;
        this.message = message;
    }

    public int getCode() { return code; }
    public String getMessage() { return message; }
}
