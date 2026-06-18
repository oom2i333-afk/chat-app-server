package com.wetalk.modules.file.controller;

import com.wetalk.auth.UserPrincipal;
import com.wetalk.common.ApiResponse;
import com.wetalk.modules.file.service.FileService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/file")
@RequiredArgsConstructor
public class FileController {

    private final FileService fileService;

    @PostMapping("/upload")
    public ApiResponse<Map<String, String>> upload(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam("file") MultipartFile file) {
        String url = fileService.upload(file, "uploads/" + user.getUserId());
        return ApiResponse.success(Map.of("url", url));
    }

    @PostMapping("/upload/image")
    public ApiResponse<Map<String, String>> uploadImage(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam("file") MultipartFile file) {
        String url = fileService.upload(file, "images/" + user.getUserId());
        return ApiResponse.success(Map.of("url", url));
    }

    @PostMapping("/upload/voice")
    public ApiResponse<Map<String, String>> uploadVoice(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam("file") MultipartFile file) {
        String url = fileService.upload(file, "voice/" + user.getUserId());
        return ApiResponse.success(Map.of("url", url));
    }
}
