package com.getjob.backend.application.controller;

import com.getjob.backend.application.dto.ApplicationDto;
import com.getjob.backend.application.service.ApplicationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/applications")
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationService applicationService;

    @GetMapping
    public ResponseEntity<?> getApplications(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        if (page != null) {
            int pageSize = size != null ? size : 10;
            return ResponseEntity.ok(applicationService.getApplications(
                    org.springframework.data.domain.PageRequest.of(page, pageSize, org.springframework.data.domain.Sort.by("id").descending())
            ));
        }
        return ResponseEntity.ok(applicationService.getApplications());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApplicationDto> getApplication(@PathVariable String id) {
        return applicationService.getApplicationById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
