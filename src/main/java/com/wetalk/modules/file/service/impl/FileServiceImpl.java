package com.wetalk.modules.file.service.impl;

import com.aliyun.oss.OSS;
import com.aliyun.oss.model.ObjectMetadata;
import com.wetalk.modules.file.service.FileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Date;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class FileServiceImpl implements FileService {

    private final OSS ossClient;

    @Value("${oss.bucket}")
    private String bucket;

    @Value("${oss.endpoint}")
    private String endpoint;

    @Override
    public String upload(MultipartFile file, String path) {
        try {
            String key = path + "/" + UUID.randomUUID().toString().substring(0, 8) + "_" + file.getOriginalFilename();
            ObjectMetadata meta = new ObjectMetadata();
            meta.setContentLength(file.getSize());
            meta.setContentType(file.getContentType());
            ossClient.putObject(bucket, key, file.getInputStream(), meta);
            String url = "https://" + bucket + "." + endpoint + "/" + key;
            log.info("File uploaded: {}", url);
            return url;
        } catch (IOException e) {
            throw new RuntimeException("File upload failed", e);
        }
    }

    @Override
    public String upload(byte[] data, String fileName) {
        String key = "files/" + UUID.randomUUID().toString().substring(0, 8) + "_" + fileName;
        ossClient.putObject(bucket, key, new ByteArrayInputStream(data));
        String url = "https://" + bucket + "." + endpoint + "/" + key;
        log.info("File uploaded: {} ({} bytes)", url, data.length);
        return url;
    }

    @Override
    public String getSignedUrl(String objectKey, long expires) {
        Date expiration = new Date(System.currentTimeMillis() + expires * 1000);
        return ossClient.generatePresignedUrl(bucket, objectKey, expiration).toString();
    }

    @Override
    public void delete(String objectKey) {
        ossClient.deleteObject(bucket, objectKey);
        log.info("File deleted: {}", objectKey);
    }
}
