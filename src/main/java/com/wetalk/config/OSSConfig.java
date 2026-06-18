package com.wetalk.config;

import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OSSConfig {

    @Bean
    public OSS ossClient(@Value("${oss.endpoint}") String endpoint,
                          @Value("${oss.access-key}") String accessKey,
                          @Value("${oss.secret-key}") String secretKey) {
        return new OSSClientBuilder().build(endpoint, accessKey, secretKey);
    }
}
