package com.getjob.backend.cv.interview.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class InterviewStateMachineServiceTest {

    private InterviewStateMachineService stateMachine;

    @BeforeEach
    void setUp() {
        stateMachine = new InterviewStateMachineService();
    }

    @Test
    void testSectionOrder() {
        assertEquals("TARGET", stateMachine.getNextSection("IDENTITY"));
        assertEquals("EXPERIENCE", stateMachine.getNextSection("TARGET"));
        assertEquals("PROJECTS", stateMachine.getNextSection("EXPERIENCE"));
        assertEquals("EDUCATION", stateMachine.getNextSection("PROJECTS"));
        assertEquals("SKILLS", stateMachine.getNextSection("EDUCATION"));
        assertEquals("LANGUAGES", stateMachine.getNextSection("SKILLS"));
        assertEquals("FINALIZE", stateMachine.getNextSection("LANGUAGES"));
        assertEquals("REVIEW", stateMachine.getNextSection("FINALIZE"));
        assertEquals("DONE", stateMachine.getNextSection("REVIEW"));
    }

    @Test
    void testMaxTurnsConfiguration() {
        assertEquals(3, stateMachine.getMaxTurnsForState("IDENTITY"));
        assertEquals(4, stateMachine.getMaxTurnsForState("TARGET"));
        assertEquals(6, stateMachine.getMaxTurnsForState("EXPERIENCE"));
        assertEquals(4, stateMachine.getMaxTurnsForState("PROJECTS"));
        assertEquals(4, stateMachine.getMaxTurnsForState("EDUCATION"));
        assertEquals(4, stateMachine.getMaxTurnsForState("SKILLS"));
        assertEquals(3, stateMachine.getMaxTurnsForState("LANGUAGES"));
    }

    @Test
    void testValidUserStopIntent() {
        assertTrue(stateMachine.isValidUserStopIntent("Je veux arrêter ici", null));
        assertTrue(stateMachine.isValidUserStopIntent(null, "Arrête l'entretien"));
        assertTrue(stateMachine.isValidUserStopIntent("On peut terminer l'entretien", "Je dois y aller"));
        assertTrue(stateMachine.isValidUserStopIntent("Je préfère continuer plus tard", null));
        assertTrue(stateMachine.isValidUserStopIntent("C'est bon, stop", null));
        assertTrue(stateMachine.isValidUserStopIntent("Je veux quitter", null));
    }

    @Test
    void testInvalidUserStopIntent_ContinuationAndRefusal() {
        // Ces phrases ne doivent JAMAIS arrêter l'entretien (Spec V2, Section 2.3 & 14)
        assertFalse(stateMachine.isValidUserStopIntent("Je n'ai rien d'autre à dire sur cette expérience.", null));
        assertFalse(stateMachine.isValidUserStopIntent(null, "Je n'ai pas de projet."));
        assertFalse(stateMachine.isValidUserStopIntent("On peut passer à la suite.", null));
        assertFalse(stateMachine.isValidUserStopIntent("C'est tout pour cette partie.", null));
        assertFalse(stateMachine.isValidUserStopIntent(null, "Je ne sais pas trop."));
        assertFalse(stateMachine.isValidUserStopIntent("Non c'est bon pour moi", null));
        assertFalse(stateMachine.isValidUserStopIntent("Rien de plus", null));
        assertFalse(stateMachine.isValidUserStopIntent("", "   "));
        assertFalse(stateMachine.isValidUserStopIntent(null, null));
    }

    @Test
    void testBuildControlMessage() {
        String msg = stateMachine.buildControlMessage(
                "EXPERIENCE",
                0,
                2,
                Map.of("company", "TotalEnergies", "position", "Chef de projet"),
                List.of("chiffre ou métrique clé", "dates exactes")
        );

        assertNotNull(msg);
        assertTrue(msg.contains("[INTERVIEW_STATE]"));
        assertTrue(msg.contains("Section active : EXPERIENCE #1"));
        assertTrue(msg.contains("TotalEnergies"));
        assertTrue(msg.contains("Chef de projet"));
        assertTrue(msg.contains("chiffre ou métrique clé"));
        assertTrue(msg.contains("Ne conclus JAMAIS l'entretien de toi-même"));
    }

    @Test
    void testBuildControlMessage_LastTurnWarning() {
        // Pour EXPERIENCE (max_turns = 6), au tour 5 (max - 1), l'avertissement doit être présent
        String msg = stateMachine.buildControlMessage(
                "EXPERIENCE",
                0,
                5,
                Collections.emptyMap(),
                Collections.emptyList()
        );

        assertTrue(msg.contains("Dernier tour recommandé sur cette section"));
    }
}
