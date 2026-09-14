import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioPcmEngineService {
  // Capture Microphone (16 kHz PCM Linear 16-bit Mono)
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private silentGainNode: GainNode | null = null;

  // Lecture Audio (24 kHz PCM 16-bit)
  private playbackCtx: AudioContext | null = null;
  private warmFilter: BiquadFilterNode | null = null;
  private nextPlayTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private pendingSourceCount = 0;
  private isMuted = false;
  // Débit posé et calme (~96% de la vitesse standard pour une élocution nette et articulée)
  private speechSpeed = 0.96;

  setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  setSpeechSpeed(speed: number): void {
    if (speed >= 0.75 && speed <= 1.5) {
      this.speechSpeed = speed;
    }
  }

  /**
   * Démarre la capture microphone et émet des chunks PCM 16-bit base64.
   */
  async startMicrophone(onAudioChunk: (base64Pcm: string) => void): Promise<void> {
    this.stopMicrophone();

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({ sampleRate: 16000 });
      await this.audioCtx.resume();

      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.scriptNode = this.audioCtx.createScriptProcessor(4096, 1, 1);

      this.scriptNode.onaudioprocess = (event) => {
        if (this.isMuted) return;
        const inputData = event.inputBuffer.getChannelData(0);
        const pcm16 = this.floatTo16BitPCM(inputData);
        const base64 = this.arrayBufferToBase64(pcm16.buffer);
        onAudioChunk(base64);
      };

      this.silentGainNode = this.audioCtx.createGain();
      this.silentGainNode.gain.value = 0;

      source.connect(this.scriptNode);
      this.scriptNode.connect(this.silentGainNode);
      this.silentGainNode.connect(this.audioCtx.destination);
    } catch (err) {
      console.error('[AudioEngine] Erreur accès microphone:', err);
      throw new Error('Impossible d’accéder au microphone. Vérifiez vos autorisations.');
    }
  }

  /**
   * Arrête la capture microphone et libère les ressources audio.
   */
  stopMicrophone(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }
    if (this.silentGainNode) {
      this.silentGainNode.disconnect();
      this.silentGainNode = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }

  /**
   * Initialise le contexte de lecture audio haute fidélité (24 kHz) avec égalisation chaleureuse.
   */
  initPlayback(): void {
    if (this.playbackCtx && this.playbackCtx.state !== 'closed') {
      // Contexte déjà actif, juste le reprendre
      if (this.playbackCtx.state === 'suspended') {
        this.playbackCtx.resume().catch(() => {});
      }
      return;
    }
    // Nettoyer les sources orphelines avant de créer un nouveau contexte
    this.activeSources = [];
    this.pendingSourceCount = 0;
    this.nextPlayTime = 0;
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    this.playbackCtx = new AudioCtxClass({ sampleRate: 24000 });

    // Filtre acoustique chaleureux : rehaussement subtil des bas-médiums (chaleur & présence vocale)
    try {
      this.warmFilter = this.playbackCtx.createBiquadFilter();
      this.warmFilter.type = 'peaking';
      this.warmFilter.frequency.value = 320; // Fréquence fondamentale de la voix masculine
      this.warmFilter.Q.value = 1.0;
      this.warmFilter.gain.value = 2.5; // +2.5 dB de rondeur naturelle
      this.warmFilter.connect(this.playbackCtx.destination);
    } catch {
      this.warmFilter = null;
    }
  }

  /**
   * Joue un chunk audio PCM 24kHz reçu du serveur en streaming continu sans coupure.
   */
  playPcmChunk(base64Audio: string, onAudioEnd?: () => void): void {
    if (!base64Audio) return;

    this.initPlayback();
    if (!this.playbackCtx) return;

    const raw = atob(base64Audio);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }

    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    const audioBuffer = this.playbackCtx.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = this.playbackCtx.createBufferSource();
    source.buffer = audioBuffer;

    // Débit d'élocution posé (0.96x)
    source.playbackRate.value = this.speechSpeed;

    // Connexion à travers le filtre chaleureux
    if (this.warmFilter) {
      source.connect(this.warmFilter);
    } else {
      source.connect(this.playbackCtx.destination);
    }

    const now = this.playbackCtx.currentTime;
    if (this.nextPlayTime < now) {
      this.nextPlayTime = now + 0.03;
    }

    source.start(this.nextPlayTime);
    // Durée effective proportionnelle au débit de parole
    const effectiveDuration = audioBuffer.duration / this.speechSpeed;
    this.nextPlayTime += effectiveDuration;

    this.activeSources.push(source);
    this.pendingSourceCount++;

    source.onended = () => {
      this.pendingSourceCount = Math.max(0, this.pendingSourceCount - 1);
      const index = this.activeSources.indexOf(source);
      if (index !== -1) {
        this.activeSources.splice(index, 1);
      }
      if (this.pendingSourceCount === 0 && onAudioEnd) {
        onAudioEnd();
      }
    };
  }

  /**
   * Interrompt immédiatement toute lecture audio en cours (ex: utilisateur reprend la parole).
   */
  interruptPlayback(): void {
    for (const s of this.activeSources) {
      try {
        s.onended = null;
        s.stop();
        s.disconnect();
      } catch {}
    }
    this.activeSources = [];
    this.pendingSourceCount = 0;
    this.nextPlayTime = 0;
  }

  /**
   * Ferme et nettoie l'ensemble du moteur audio.
   */
  destroy(): void {
    this.stopMicrophone();
    this.interruptPlayback();
    if (this.warmFilter) {
      try {
        this.warmFilter.disconnect();
      } catch {}
      this.warmFilter = null;
    }
    if (this.playbackCtx) {
      const ctx = this.playbackCtx;
      this.playbackCtx = null; // nullifier immédiatement pour bloquer tout nouveau playPcmChunk
      this.nextPlayTime = 0;
      ctx.close().catch(() => {});
    }
  }

  // --- Utilitaires de conversion ---

  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
