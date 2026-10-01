package com.getjob.backend.cv.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CvDraftValidatorTest {
    private final CvDraftValidator validator = new CvDraftValidator(new ObjectMapper());

    @Test
    void identityAndEmptySectionPlaceholdersAreNotACompletedCv() {
        String empty = """
                {"identity":{"fullName":"Candidate","email":"candidate@example.com"},
                 "experiences":[{}],"education":[{}],"projects":[{}],
                 "skills":[],"summary":""}
                """;

        assertThat(validator.isDraftMeaningful(empty)).isFalse();
    }

    @Test
    void ARealExperienceIsMeaningful() {
        assertThat(validator.isDraftMeaningful("{" +
                "\"identity\":{\"fullName\":\"Candidate\"}," +
                "\"experiences\":[{\"position\":\"Développeur\"}]}"))
                .isTrue();
    }
}
