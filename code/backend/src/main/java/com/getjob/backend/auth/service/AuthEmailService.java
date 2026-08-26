package com.getjob.backend.auth.service;

import jakarta.mail.Message;
import jakarta.mail.PasswordAuthentication;
import jakarta.mail.Session;
import jakarta.mail.Transport;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeBodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Properties;
import java.util.concurrent.CompletableFuture;

import org.springframework.beans.factory.annotation.Qualifier;
import java.util.concurrent.Executor;

@Service
@Slf4j
public class AuthEmailService {

    @Value("${mail.host:smtp.gmail.com}")
    private String host;

    @Value("${mail.port:587}")
    private String port;

    @Value("${mail.username:africayamoo@gmail.com}")
    private String username;

    @Value("${mail.password:nkfntlxwumllmylj}")
    private String password;

    @Value("${app.frontend-url:http://localhost:4200}")
    private String frontendUrl;

    private final Executor emailExecutor;

    public AuthEmailService(@Qualifier("emailTaskExecutor") Executor emailExecutor) {
        this.emailExecutor = emailExecutor;
    }

    /**
     * Envoie le lien de confirmation d'email + code de manière asynchrone via le pool dédié.
     */
    public void sendEmailVerificationCode(String toEmail, String code) {
        log.info("📧 Envoi de l'email de validation ({}) à {}", code, toEmail);

        CompletableFuture.runAsync(() -> {
            try {
                String encodedEmail = URLEncoder.encode(toEmail, StandardCharsets.UTF_8);
                String activationLink = String.format("%s/login?mode=verify-email&email=%s&code=%s&autoverify=true",
                        frontendUrl, encodedEmail, code);

                String subject = "JobPilot — Activez votre compte candidat (Code : " + code + ")";
                String htmlContent = buildVerificationHtml(toEmail, code, activationLink);
                sendHtmlMail(toEmail, subject, htmlContent);
            } catch (Exception e) {
                log.error("Erreur lors de la préparation de l'email de validation : {}", e.getMessage());
            }
        }, emailExecutor);
    }

    /**
     * Envoie le lien de réinitialisation de mot de passe + code de manière asynchrone via le pool dédié.
     */
    public void sendPasswordResetCode(String toEmail, String code) {
        log.info("🔑 Envoi de l'email de réinitialisation ({}) à {}", code, toEmail);

        CompletableFuture.runAsync(() -> {
            try {
                String encodedEmail = URLEncoder.encode(toEmail, StandardCharsets.UTF_8);
                String resetLink = String.format("%s/login?mode=reset-password&email=%s&code=%s",
                        frontendUrl, encodedEmail, code);

                String subject = "JobPilot — Réinitialisation de mot de passe (Code : " + code + ")";
                String htmlContent = buildPasswordResetHtml(toEmail, code, resetLink);
                sendHtmlMail(toEmail, subject, htmlContent);
            } catch (Exception e) {
                log.error("Erreur lors de la préparation de l'email de réinitialisation : {}", e.getMessage());
            }
        }, emailExecutor);
    }

    /**
     * Envoie un email HTML via SMTP Gmail (authentification STARTTLS).
     */
    private void sendHtmlMail(String recipientEmail, String subject, String htmlBody) {
        try {
            Properties props = new Properties();
            props.put("mail.smtp.auth", "true");
            props.put("mail.smtp.starttls.enable", "true");
            props.put("mail.smtp.ssl.trust", host);
            props.put("mail.smtp.host", host);
            props.put("mail.smtp.port", port);

            Session session = Session.getInstance(props, new jakarta.mail.Authenticator() {
                @Override
                protected PasswordAuthentication getPasswordAuthentication() {
                    return new PasswordAuthentication(username, password);
                }
            });

            Message message = new MimeMessage(session);
            message.setFrom(new InternetAddress(username, "JobPilot"));
            message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(recipientEmail));
            message.setSubject(subject);
            message.setSentDate(new Date());

            MimeBodyPart mimeBodyPart = new MimeBodyPart();
            mimeBodyPart.setContent(htmlBody, "text/html; charset=utf-8");

            MimeMultipart multipart = new MimeMultipart();
            multipart.addBodyPart(mimeBodyPart);
            message.setContent(multipart);

            Transport.send(message);
            log.info("✅ Email envoyé avec succès à {}", recipientEmail);
        } catch (Exception e) {
            log.error("❌ Échec de l'envoi d'email à {} : {}", recipientEmail, e.getMessage(), e);
        }
    }

    private String buildVerificationHtml(String recipientEmail, String code, String activationLink) {
        return "<!DOCTYPE html>" +
                "<html>" +
                "<head><meta charset='UTF-8'></head>" +
                "<body style='margin: 0; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;'>" +
                "  <div style='max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 36px 32px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);'>" +
                "    <div style='text-align: center; margin-bottom: 28px;'>" +
                "      <div style='display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 14px; background: linear-gradient(135deg, #6366f1, #4338ca); color: #ffffff; font-weight: bold; font-size: 24px;'>⚡</div>" +
                "      <h1 style='font-size: 22px; font-weight: 800; color: #0f172a; margin: 14px 0 4px 0;'>JobPilot</h1>" +
                "      <p style='font-size: 13px; color: #64748b; margin: 0;'>Activation de votre compte candidat</p>" +
                "    </div>" +
                "    <p style='font-size: 15px; line-height: 1.6; color: #334155;'>Bonjour,</p>" +
                "    <p style='font-size: 15px; line-height: 1.6; color: #334155;'>Merci de votre inscription sur <strong>JobPilot</strong>. Pour valider votre adresse email et commencer à piloter vos candidatures, cliquez directement sur le bouton ci-dessous :</p>" +
                "    <div style='margin: 28px 0; text-align: center;'>" +
                "      <a href='" + activationLink + "' style='display: inline-block; padding: 14px 32px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 15px; font-weight: 700; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.3);'>👉 Valider mon compte en 1 clic</a>" +
                "    </div>" +
                "    <p style='font-size: 13px; color: #64748b; line-height: 1.5; margin: 24px 0 10px 0;'>Si vous préférez saisir le code manuellement sur l'application :</p>" +
                "    <div style='text-align: center; margin-bottom: 24px;'>" +
                "      <div style='display: inline-block; padding: 12px 24px; background: #f1f5f9; border-radius: 10px; font-family: monospace; font-size: 26px; font-weight: 800; letter-spacing: 6px; color: #4338ca; border: 2px dashed #cbd5e1;'>" +
                code +
                "      </div>" +
                "    </div>" +
                "    <p style='font-size: 12px; color: #94a3b8; text-align: center;'>Ce lien et ce code sont valables pendant <strong>15 minutes</strong>.</p>" +
                "    <hr style='border: none; border-top: 1px solid #f1f5f9; margin: 28px 0 20px 0;' />" +
                "    <p style='font-size: 11px; color: #94a3b8; line-height: 1.5; margin: 0; text-align: center;'>" +
                "      Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.<br />" +
                "      JobPilot · Plateforme d'automatisation de candidatures IA" +
                "    </p>" +
                "  </div>" +
                "</body>" +
                "</html>";
    }

    private String buildPasswordResetHtml(String recipientEmail, String code, String resetLink) {
        return "<!DOCTYPE html>" +
                "<html>" +
                "<head><meta charset='UTF-8'></head>" +
                "<body style='margin: 0; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;'>" +
                "  <div style='max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 36px 32px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);'>" +
                "    <div style='text-align: center; margin-bottom: 28px;'>" +
                "      <div style='display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 14px; background: linear-gradient(135deg, #ef4444, #b91c1c); color: #ffffff; font-weight: bold; font-size: 24px;'>🔑</div>" +
                "      <h1 style='font-size: 22px; font-weight: 800; color: #0f172a; margin: 14px 0 4px 0;'>JobPilot</h1>" +
                "      <p style='font-size: 13px; color: #64748b; margin: 0;'>Réinitialisation de votre mot de passe</p>" +
                "    </div>" +
                "    <p style='font-size: 15px; line-height: 1.6; color: #334155;'>Bonjour,</p>" +
                "    <p style='font-size: 15px; line-height: 1.6; color: #334155;'>Une demande de réinitialisation de mot de passe a été demandée pour votre compte. Cliquez sur le bouton ci-dessous pour choisir votre nouveau mot de passe :</p>" +
                "    <div style='margin: 28px 0; text-align: center;'>" +
                "      <a href='" + resetLink + "' style='display: inline-block; padding: 14px 32px; background: #dc2626; color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 15px; font-weight: 700; box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.3);'>👉 Réinitialiser mon mot de passe</a>" +
                "    </div>" +
                "    <p style='font-size: 13px; color: #64748b; line-height: 1.5; margin: 24px 0 10px 0;'>Ou utilisez votre code de sécurité manuel :</p>" +
                "    <div style='text-align: center; margin-bottom: 24px;'>" +
                "      <div style='display: inline-block; padding: 12px 24px; background: #fef2f2; border-radius: 10px; font-family: monospace; font-size: 26px; font-weight: 800; letter-spacing: 6px; color: #dc2626; border: 2px dashed #fecaca;'>" +
                code +
                "      </div>" +
                "    </div>" +
                "    <p style='font-size: 12px; color: #94a3b8; text-align: center;'>Ce lien et ce code sont valables pendant <strong>15 minutes</strong>.</p>" +
                "    <hr style='border: none; border-top: 1px solid #f1f5f9; margin: 28px 0 20px 0;' />" +
                "    <p style='font-size: 11px; color: #94a3b8; line-height: 1.5; margin: 0; text-align: center;'>" +
                "      Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe actuel reste inchangé.<br />" +
                "      JobPilot · Plateforme d'automatisation de candidatures IA" +
                "    </p>" +
                "  </div>" +
                "</body>" +
                "</html>";
    }
}
