import { useState, useCallback, useEffect } from 'react';

export const useSpeech = () => {
  const [isListening, setIsListening] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const updateVoices = () => {
      const v = window.speechSynthesis.getVoices();
      setVoices(v);
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }, []);

  const speak = useCallback((text: string, options?: { voiceType?: 'A' | 'B', accent?: 'UK' | 'US' }) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options?.accent === 'UK' ? 'en-GB' : 'en-US';
    utterance.rate = 0.95;

    if (voices.length > 0) {
      let candidateVoices = voices.filter(v => v.lang.startsWith(options?.accent === 'UK' ? 'en-G' : 'en-U'));
      if (candidateVoices.length === 0) {
        candidateVoices = voices.filter(v => v.lang.startsWith('en'));
      }

      if (options?.voiceType) {
        const females = candidateVoices.filter(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('samantha'));
        const males = candidateVoices.filter(v => v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('alex'));
        
        if (options.voiceType === 'A' && females.length > 0) {
          utterance.voice = females[0];
        } else if (options.voiceType === 'B' && males.length > 0) {
          utterance.voice = males[0];
        } else if (candidateVoices.length > 0) {
          utterance.voice = options.voiceType === 'A' ? candidateVoices[0] : candidateVoices[candidateVoices.length - 1];
        }
      } else if (candidateVoices.length > 0) {
        utterance.voice = candidateVoices[0];
      }
    }

    window.speechSynthesis.speak(utterance);
  }, [voices]);

  const cancel = useCallback(() => {
    window.speechSynthesis.cancel();
  }, []);

  const listen = useCallback((onResult: (text: string) => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser doesn't support speech recognition.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      onResult(text);
    };

    recognition.start();
  }, []);

  return { speak, listen, isListening, cancel };
};
