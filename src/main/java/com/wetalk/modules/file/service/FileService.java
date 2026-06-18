package com.wetalk.modules.file.service;

import org.springframework.web.multipart.MultipartFile;

public interface FileService {
    String upload(MultipartFile file, String path);
    String upload(byte[] data, String fileName);
    String getSignedUrl(String objectKey, long expires);
    void delete(String objectKey);
}
