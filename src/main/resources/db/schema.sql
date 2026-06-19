-- ─── 用户表 ──────────────────────────────────────────
CREATE TABLE `user` (
    `id`            BIGINT          NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    `uid`           VARCHAR(32)     NOT NULL COMMENT '对外展示ID，可自定义',
    `phone_aes`     VARBINARY(256)  DEFAULT NULL COMMENT '手机号AES加密',
    `phone_hash`    VARCHAR(64)     DEFAULT NULL COMMENT '手机号SHA256(索引用)',
    `password_hash` VARCHAR(256)    NOT NULL COMMENT 'bcrypt(12)哈希',
    `pay_pwd_hash`  VARCHAR(256)    DEFAULT NULL COMMENT '支付密码PBKDF2哈希',
    `nickname`      VARCHAR(32)     DEFAULT NULL COMMENT '昵称',
    `avatar`        VARCHAR(512)    DEFAULT NULL COMMENT '头像URL',
    `gender`        TINYINT         DEFAULT 0 COMMENT '0未设置 1男 2女',
    `real_name_aes` VARBINARY(256)  DEFAULT NULL COMMENT '真实姓名AES加密',
    `id_card_aes`   VARBINARY(256)  DEFAULT NULL COMMENT '身份证号AES加密',
    `verify_status` TINYINT         DEFAULT 0 COMMENT '0未认证 1审核中 2已认证 3已拒绝',
    `balance`       DECIMAL(12,2)   DEFAULT 0.00 COMMENT '钱包余额',
    `points`        INT             DEFAULT 0 COMMENT '积分',
    `status`        TINYINT         DEFAULT 1 COMMENT '1正常 0封禁 2冻结',
    `invite_code`   VARCHAR(10)     DEFAULT NULL COMMENT '注册邀请码',
    `reg_ip`        VARCHAR(45)     DEFAULT NULL COMMENT '注册IP',
    `reg_device`    VARCHAR(128)    DEFAULT NULL COMMENT '注册设备指纹',
    `last_login_at` BIGINT          DEFAULT NULL COMMENT '最后登录时间',
    `last_login_ip` VARCHAR(45)     DEFAULT NULL COMMENT '最后登录IP',
    `created_at`    BIGINT          NOT NULL COMMENT '创建时间',
    `deleted_at`    BIGINT          DEFAULT NULL COMMENT '软删除时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_uid` (`uid`),
    UNIQUE KEY `uk_phone_hash` (`phone_hash`),
    KEY `idx_nickname` (`nickname`),
    KEY `idx_status` (`status`),
    KEY `idx_created` (`created_at`)
) ENGINE=InnoDB COMMENT='用户表';

-- ─── 管理员表 ─────────────────────────────────────────
CREATE TABLE `admin_user` (
    `id`            BIGINT      NOT NULL AUTO_INCREMENT,
    `username`      VARCHAR(32) NOT NULL COMMENT '管理员账号',
    `password_hash` VARCHAR(256) NOT NULL COMMENT 'bcrypt(12)哈希',
    `nickname`      VARCHAR(32) DEFAULT NULL COMMENT '管理员姓名',
    `role`          VARCHAR(32) NOT NULL DEFAULT 'CUSTOMER' COMMENT '角色',
    `mfa_secret`    VARCHAR(64) DEFAULT NULL COMMENT 'MFA密钥',
    `mfa_enabled`   TINYINT     DEFAULT 0 COMMENT '是否开启MFA',
    `status`        TINYINT     DEFAULT 1 COMMENT '1正常 0禁用',
    `last_login_ip` VARCHAR(45) DEFAULT NULL,
    `last_login_at` BIGINT      DEFAULT NULL,
    `created_at`    BIGINT      NOT NULL,
    `updated_at`    BIGINT      NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB COMMENT='管理员表';

-- ─── 好友关系表 ───────────────────────────────────────
CREATE TABLE `friend_relation` (
    `id`            BIGINT      NOT NULL AUTO_INCREMENT,
    `user_id`       VARCHAR(32) NOT NULL COMMENT '用户',
    `friend_id`     VARCHAR(32) NOT NULL COMMENT '好友',
    `remark`        VARCHAR(64) DEFAULT NULL COMMENT '备注名',
    `source`        TINYINT     DEFAULT 1 COMMENT '来源:1搜索 2扫一扫 3群聊 4推荐',
    `status`        TINYINT     DEFAULT 1 COMMENT '1好友 0已删除 2黑名单',
    `created_at`    BIGINT      NOT NULL,
    `deleted_at`    BIGINT      DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_relationship` (`user_id`, `friend_id`),
    KEY `idx_user_status` (`user_id`, `status`),
    KEY `idx_friend` (`friend_id`)
) ENGINE=InnoDB COMMENT='好友关系表';

-- ─── 好友请求表 ───────────────────────────────────────
CREATE TABLE `friend_request` (
    `id`            BIGINT      NOT NULL AUTO_INCREMENT,
    `from_uid`      VARCHAR(32) NOT NULL COMMENT '请求发起方',
    `to_uid`        VARCHAR(32) NOT NULL COMMENT '请求接收方',
    `remark`        VARCHAR(100) DEFAULT NULL COMMENT '请求附言',
    `status`        TINYINT     DEFAULT 0 COMMENT '0待处理 1已通过 2已拒绝 3已过期',
    `created_at`    BIGINT      NOT NULL,
    `handled_at`    BIGINT      DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_to_status` (`to_uid`, `status`),
    KEY `idx_from` (`from_uid`),
    KEY `idx_created` (`created_at`)
) ENGINE=InnoDB COMMENT='好友请求表';

-- ─── 群组表 ───────────────────────────────────────────
CREATE TABLE `group_info` (
    `id`            BIGINT      NOT NULL AUTO_INCREMENT,
    `group_id`      VARCHAR(32) NOT NULL COMMENT '群组ID(展示用)',
    `name`          VARCHAR(64) NOT NULL COMMENT '群名称',
    `avatar`        VARCHAR(512) DEFAULT NULL COMMENT '群头像',
    `notice`        VARCHAR(500) DEFAULT NULL COMMENT '群公告',
    `owner_uid`     VARCHAR(32) NOT NULL COMMENT '群主UID',
    `max_members`   INT         DEFAULT 500 COMMENT '最大成员数',
    `join_mode`     TINYINT     DEFAULT 0 COMMENT '0需审核 1直接加入 2禁止加群',
    `status`        TINYINT     DEFAULT 1 COMMENT '1正常 0已解散',
    `created_at`    BIGINT      NOT NULL,
    `dissolved_at`  BIGINT      DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_group_id` (`group_id`),
    KEY `idx_owner` (`owner_uid`)
) ENGINE=InnoDB COMMENT='群组表';

-- ─── 群成员表 ─────────────────────────────────────────
CREATE TABLE `group_member` (
    `id`            BIGINT      NOT NULL AUTO_INCREMENT,
    `group_id`      VARCHAR(32) NOT NULL COMMENT '群组ID',
    `user_id`       VARCHAR(32) NOT NULL COMMENT '用户UID',
    `role`          TINYINT     DEFAULT 0 COMMENT '0成员 1管理员 2群主',
    `group_nick`    VARCHAR(32) DEFAULT NULL COMMENT '群昵称',
    `muted`         TINYINT     DEFAULT 0 COMMENT '0正常 1禁言',
    `muted_until`   BIGINT      DEFAULT NULL COMMENT '禁言到期时间',
    `joined_at`     BIGINT      NOT NULL COMMENT '加入时间',
    `leaved_at`     BIGINT      DEFAULT NULL COMMENT '离开时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_member` (`group_id`, `user_id`),
    KEY `idx_user` (`user_id`),
    KEY `idx_role` (`group_id`, `role`)
) ENGINE=InnoDB COMMENT='群成员表';

-- ─── 消息表 ───────────────────────────────────────────
CREATE TABLE `message` (
    `id`            BIGINT      NOT NULL AUTO_INCREMENT,
    `msg_id`        VARCHAR(64) NOT NULL COMMENT '全局唯一消息ID',
    `seq_id`        BIGINT      NOT NULL COMMENT '用户维度递增序号(多端同步用)',
    `from_uid`      VARCHAR(32) NOT NULL COMMENT '发送方UID',
    `to_uid`        VARCHAR(32) NOT NULL COMMENT '接收方(单聊:对方uid 群聊:groupId)',
    `chat_type`     TINYINT     NOT NULL COMMENT '1单聊 2群聊',
    `msg_type`      TINYINT     NOT NULL COMMENT '1文本 2图片 3语音 4文件 5红包 6系统 7视频通话 8语音通话',
    `content_aes`   MEDIUMBLOB  DEFAULT NULL COMMENT 'E2E加密后的消息内容',
    `file_url`      VARCHAR(512) DEFAULT NULL COMMENT '文件/图片URL',
    `file_size`     INT         DEFAULT 0 COMMENT '文件大小(字节)',
    `file_name`     VARCHAR(256) DEFAULT NULL COMMENT '文件名',
    `duration`      INT         DEFAULT 0 COMMENT '语音/视频时长(秒)',
    `ref_msg_id`    VARCHAR(64) DEFAULT NULL COMMENT '回复引用的消息ID',
    `status`        TINYINT     DEFAULT 0 COMMENT '0发送中 1已送达 2已读 3已撤回',
    `is_mentioned`  TINYINT     DEFAULT 0 COMMENT '群聊@消息 0否 1是',
    `created_at`    BIGINT      NOT NULL,
    `updated_at`    BIGINT      DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_msg_id` (`msg_id`),
    KEY `idx_chat` (`to_uid`, `created_at`),
    KEY `idx_seq_from` (`from_uid`, `seq_id`),
    KEY `idx_seq_to` (`to_uid`, `seq_id`)
) ENGINE=InnoDB COMMENT='消息表';

-- ─── 红包表 ───────────────────────────────────────────
CREATE TABLE `red_packet` (
    `id`            BIGINT          NOT NULL AUTO_INCREMENT,
    `packet_id`     VARCHAR(64)     NOT NULL COMMENT '红包ID',
    `sender_uid`    VARCHAR(32)     NOT NULL COMMENT '发送者UID',
    `chat_id`       VARCHAR(64)     NOT NULL COMMENT '所在聊天',
    `type`          TINYINT         DEFAULT 1 COMMENT '1普通红包 2拼手气群红包 3专属红包',
    `total_amount`  DECIMAL(12,2)   NOT NULL COMMENT '总金额',
    `total_count`   INT             NOT NULL COMMENT '总个数',
    `remain_amount` DECIMAL(12,2)   NOT NULL COMMENT '剩余金额',
    `remain_count`  INT             NOT NULL COMMENT '剩余个数',
    `blessing`      VARCHAR(100)    DEFAULT NULL COMMENT '祝福语',
    `status`        TINYINT         DEFAULT 0 COMMENT '0待领取 1已领完 2已过期 3已退回',
    `expire_at`     BIGINT          NOT NULL COMMENT '过期时间',
    `created_at`    BIGINT          NOT NULL,
    `updated_at`    BIGINT          DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_packet_id` (`packet_id`),
    KEY `idx_sender` (`sender_uid`),
    KEY `idx_chat` (`chat_id`),
    KEY `idx_status` (`status`, `expire_at`)
) ENGINE=InnoDB COMMENT='红包表';

-- ─── 红包领取记录表 ───────────────────────────────────
CREATE TABLE `red_packet_record` (
    `id`            BIGINT          NOT NULL AUTO_INCREMENT,
    `packet_id`     VARCHAR(64)     NOT NULL COMMENT '红包ID',
    `user_id`       VARCHAR(32)     NOT NULL COMMENT '领取用户UID',
    `amount`        DECIMAL(12,2)   NOT NULL COMMENT '领取金额',
    `created_at`    BIGINT          NOT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_packet` (`packet_id`),
    KEY `idx_user` (`user_id`),
    UNIQUE KEY `uk_packet_user` (`packet_id`, `user_id`)
) ENGINE=InnoDB COMMENT='红包领取记录表';

-- ─── 钱包流水表 ───────────────────────────────────────
CREATE TABLE `wallet_transaction` (
    `id`             BIGINT          NOT NULL AUTO_INCREMENT,
    `tx_id`          VARCHAR(64)     NOT NULL COMMENT '交易ID',
    `user_id`        VARCHAR(32)     NOT NULL COMMENT '用户UID',
    `type`           TINYINT         NOT NULL COMMENT '1充值 2提现 3红包收入 4红包支出 5转账收入 6转账支出',
    `amount`         DECIMAL(12,2)   NOT NULL COMMENT '金额',
    `balance_before` DECIMAL(12,2)   NOT NULL COMMENT '交易前余额',
    `balance_after`  DECIMAL(12,2)   NOT NULL COMMENT '交易后余额',
    `rela_id`        VARCHAR(64)     DEFAULT NULL COMMENT '关联ID(红包ID/转账ID)',
    `remark`         VARCHAR(200)    DEFAULT NULL COMMENT '备注',
    `status`         TINYINT         DEFAULT 1 COMMENT '1成功 0处理中 2失败',
    `created_at`     BIGINT          NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_tx_id` (`tx_id`),
    KEY `idx_user` (`user_id`, `created_at`)
) ENGINE=InnoDB COMMENT='钱包流水表';

-- ─── 审计日志表 ───────────────────────────────────────
CREATE TABLE `audit_log` (
    `id`            BIGINT      NOT NULL AUTO_INCREMENT,
    `log_id`        VARCHAR(64) NOT NULL,
    `operator`      VARCHAR(32) NOT NULL COMMENT '操作人UID',
    `action`        VARCHAR(64) NOT NULL COMMENT '操作类型',
    `target_type`   VARCHAR(32) DEFAULT NULL COMMENT '操作对象类型',
    `target_id`     VARCHAR(64) DEFAULT NULL COMMENT '操作对象ID',
    `detail`        JSON        DEFAULT NULL COMMENT '操作详情(自动脱敏)',
    `ip`            VARCHAR(45) DEFAULT NULL,
    `user_agent`    VARCHAR(256) DEFAULT NULL,
    `result`        TINYINT     DEFAULT 1 COMMENT '1成功 0失败',
    `created_at`    BIGINT      NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_log_id` (`log_id`),
    KEY `idx_operator` (`operator`, `created_at`),
    KEY `idx_action` (`action`, `created_at`),
    KEY `idx_created` (`created_at`)
) ENGINE=InnoDB COMMENT='审计日志表';

-- ─── 管理员操作日志表 ─────────────────────────────────
CREATE TABLE `admin_operation_log` (
    `id`            BIGINT      NOT NULL AUTO_INCREMENT,
    `log_id`        VARCHAR(64) NOT NULL,
    `admin_id`      BIGINT      NOT NULL COMMENT '管理员ID',
    `admin_name`    VARCHAR(32) NOT NULL COMMENT '管理员用户名',
    `action`        VARCHAR(64) NOT NULL COMMENT '操作类型',
    `target_type`   VARCHAR(32) DEFAULT NULL,
    `target_id`     VARCHAR(64) DEFAULT NULL,
    `detail`        JSON        DEFAULT NULL,
    `ip`            VARCHAR(45) NOT NULL,
    `user_agent`    VARCHAR(256) DEFAULT NULL,
    `result`        TINYINT     DEFAULT 1,
    `created_at`    BIGINT      NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_log_id` (`log_id`),
    KEY `idx_admin` (`admin_id`, `created_at`),
    KEY `idx_action` (`action`, `created_at`)
) ENGINE=InnoDB COMMENT='管理员操作日志表';

-- ─── 敏感词表 ─────────────────────────────────────────
CREATE TABLE `sensitive_word` (
    `id`         BIGINT      NOT NULL AUTO_INCREMENT,
    `word`       VARCHAR(64) NOT NULL COMMENT '敏感词',
    `category`   VARCHAR(32) DEFAULT 'general' COMMENT '分类',
    `created_at` BIGINT      NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_word` (`word`)
) ENGINE=InnoDB COMMENT='敏感词表';

-- ─── 收藏表 ───────────────────────────────────────────
CREATE TABLE `favorites` (
    `id`         BIGINT      NOT NULL AUTO_INCREMENT,
    `user_id`    VARCHAR(32) NOT NULL,
    `msg_id`     VARCHAR(64) NOT NULL,
    `chat_id`    VARCHAR(64) NOT NULL,
    `msg_type`   TINYINT     NOT NULL,
    `content`    TEXT        DEFAULT NULL,
    `file_url`   VARCHAR(512) DEFAULT NULL,
    `created_at` BIGINT      NOT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_user` (`user_id`, `created_at`)
) ENGINE=InnoDB COMMENT='收藏表';

-- ─── 签到表 ───────────────────────────────────────────
CREATE TABLE `sign_in` (
    `id`         BIGINT      NOT NULL AUTO_INCREMENT,
    `user_id`    VARCHAR(32) NOT NULL,
    `date`       VARCHAR(10) NOT NULL COMMENT 'yyyy-MM-dd',
    `streak`     INT         DEFAULT 0 COMMENT '连续签到天数',
    `points`     INT         DEFAULT 0 COMMENT '获得积分',
    `created_at` BIGINT      NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_date` (`user_id`, `date`)
) ENGINE=InnoDB COMMENT='签到表';

-- ─── 聊天设置表 ───────────────────────────────────────
CREATE TABLE `chat_settings` (
    `id`         BIGINT      NOT NULL AUTO_INCREMENT,
    `user_id`    VARCHAR(32) NOT NULL,
    `chat_id`    VARCHAR(64) NOT NULL,
    `pinned`     TINYINT     DEFAULT 0 COMMENT '是否置顶',
    `muted`      TINYINT     DEFAULT 0 COMMENT '是否免打扰',
    `group_nick` VARCHAR(32) DEFAULT NULL COMMENT '群昵称',
    `updated_at` BIGINT      NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_chat` (`user_id`, `chat_id`)
) ENGINE=InnoDB COMMENT='聊天设置表';

-- ─── 系统配置表 ───────────────────────────────────────
CREATE TABLE `system_config` (
    `id`           BIGINT       NOT NULL AUTO_INCREMENT,
    `config_key`   VARCHAR(64)  NOT NULL COMMENT '配置键',
    `config_value` TEXT         NOT NULL COMMENT '配置值',
    `description`  VARCHAR(200) DEFAULT NULL COMMENT '配置描述',
    `updated_at`   BIGINT       NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_key` (`config_key`)
) ENGINE=InnoDB COMMENT='系统配置表';

-- ─── 系统配置初始数据 ─────────────────────────────────
INSERT INTO `system_config` (`config_key`, `config_value`, `description`, `updated_at`) VALUES
('invite_codes', '["888888","666666","123456"]', '默认邀请码列表', UNIX_TIMESTAMP()*1000),
('redpacket_max_amount', '200', '红包单次最大金额', UNIX_TIMESTAMP()*1000),
('redpacket_daily_limit', '2000', '每日红包总限额', UNIX_TIMESTAMP()*1000),
('msg_rate_limit', '10', '消息发送频率限制(秒)', UNIX_TIMESTAMP()*1000),
('file_max_size', '52428800', '文件上传最大字节(50MB)', UNIX_TIMESTAMP()*1000),
('register_ip_limit', '20', '同一IP每日注册上限', UNIX_TIMESTAMP()*1000);

INSERT INTO `sensitive_word` (`word`, `category`, `created_at`) VALUES
('暴力', 'general', UNIX_TIMESTAMP()*1000),
('赌博', 'general', UNIX_TIMESTAMP()*1000),
('毒品', 'general', UNIX_TIMESTAMP()*1000),
('枪', 'general', UNIX_TIMESTAMP()*1000);

-- 管理员账号由 DataInitializer 在 dev 模式下自动创建
