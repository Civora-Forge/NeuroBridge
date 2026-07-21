/**
 * useVoiceRecording Hook
 * 
 * Captures user's voice while reading using Web Audio API and Web Speech API.
 * Records audio for pronunciation analysis without storing raw audio files.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const useVoiceRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [recordingError, setRecordingError] = useState(null);
  const [recognitionWarning, setRecognitionWarning] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const volumeRef = useRef(0);

  // Initialize speech recognition on mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setRecordingError('Speech recognition not supported in this browser. Try Chrome, Edge, or Safari.');
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setRecordingError(null); // Clear previous errors on successful start
      setRecognitionWarning(null); // Clear warnings
    };

    recognitionRef.current.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      let avgConfidence = 0;
      let resultCount = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
          avgConfidence += event.results[i][0].confidence;
          resultCount++;
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscript(finalTranscript || interimTranscript);
      if (resultCount > 0) {
        setConfidence(Math.round((avgConfidence / resultCount) * 100));
      }
    };

    recognitionRef.current.onerror = (event) => {
      // Don't treat network/service errors as critical - recording can continue
      const isNetworkError = event.error === 'network' || event.error === 'service-not-allowed';
      
      let message = '';
      
      switch (event.error) {
        case 'network':
          message = '⚠️ Speech-to-text unavailable (no internet). Audio is still being recorded, but you won\'t see a live transcript.';
          break;
        case 'no-speech':
          // This is normal, don't show as error
          return;
        case 'audio-capture':
          message = 'Microphone not found or not working. Check your microphone connection.';
          break;
        case 'not-allowed':
          message = 'Microphone permission denied. Enable microphone access in browser settings.';
          break;
        case 'service-not-allowed':
          message = '⚠️ Speech-to-text unavailable (requires HTTPS/internet). Audio is still being recorded.';
          break;
        default:
          message = `Speech recognition error: ${event.error}`;
      }
      
      // Network errors are warnings (recording continues), others are errors (stop recording)
      if (isNetworkError) {
        setRecognitionWarning(message);
      } else {
        setRecordingError(message);
      }
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };
  }, []);

  /**
   * Start recording user's voice with retry logic
   */
  const startRecording = useCallback(async () => {
    try {
      setRecordingError(null);
      setRecognitionWarning(null);
      audioChunksRef.current = [];
      setTranscript('');
      setConfidence(0);
      setRecordingTime(0);

      // Check if SpeechRecognition is available
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setRecordingError('Speech recognition not supported. Try using Chrome, Edge, or Safari browser.');
        return false;
      }

      // Request microphone access with better error handling
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (error) {
        let micError = 'Microphone error';
        if (error.name === 'NotAllowedError') {
          micError = 'Microphone permission denied. Please enable microphone access in browser settings.';
        } else if (error.name === 'NotFoundError') {
          micError = 'No microphone found. Please connect a microphone.';
        } else if (error.name === 'NotReadableError') {
          micError = 'Microphone in use by another application. Close other apps and try again.';
        }
        setRecordingError(micError);
        return false;
      }

      streamRef.current = stream;

      // Setup audio context for volume visualization
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Setup media recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start speech recognition with retry on network errors
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.warn('Speech recognition start error (will retry):', error);
          // Retry after a brief delay
          setTimeout(() => {
            try {
              recognitionRef.current?.start();
            } catch (e) {
              setRecordingError('Could not start speech recognition. Try again.');
            }
          }, 500);
        }
      }

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      return true;
    } catch (error) {
      const errorMsg = `Recording error: ${error.message}`;
      setRecordingError(errorMsg);
      setIsRecording(false);
      return false;
    }
  }, []);

  /**
   * Stop recording and return audio data
   */
  const stopRecording = useCallback(async () => {
    return new Promise((resolve) => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.onstop = async () => {
          // Stop speech recognition
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }

          // Stop timer
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }

          // Close audio stream
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
          }

          // Close audio context
          if (audioContextRef.current) {
            audioContextRef.current.close();
          }

          setIsRecording(false);

          // Create blob from recorded chunks
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

          resolve({
            audioBlob,
            duration: recordingTime,
            transcript,
            confidence
          });
        };

        mediaRecorderRef.current.stop();
      } else {
        resolve(null);
      }
    });
  }, [isRecording, recordingTime, transcript, confidence]);

  /**
   * Cancel recording without saving
   */
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      setIsRecording(false);
      setTranscript('');
      setConfidence(0);
      setRecordingTime(0);
      audioChunksRef.current = [];
    }
  }, [isRecording]);

  /**
   * Get current volume level (0-1)
   */
  const getVolume = useCallback(() => {
    if (!analyserRef.current) return 0;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    volumeRef.current = average / 255;
    return volumeRef.current;
  }, []);

  /**
   * Format recording time as MM:SS
   */
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    // State
    isRecording,
    isListening,
    recordingTime,
    transcript,
    confidence,
    recordingError,
    recognitionWarning,
    volume: volumeRef.current,

    // Controls
    startRecording,
    stopRecording,
    cancelRecording,

    // Utilities
    getVolume,
    formatTime,

    // Refs
    analyserRef
  };
};

export default useVoiceRecording;
