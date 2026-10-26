const chatForm = document.querySelector("#chat-form");
const messageInput = document.querySelector("#message-input");
const messagesElement = document.querySelector("#messages");
const welcomeMessage = document.querySelector("#welcome-message");
const chatWidget = document.querySelector("#chat-widget");
const chatLauncher = document.querySelector("#chat-launcher");
const launcherLabel = chatLauncher.querySelector(".launcher-label");
const closeChatButton = document.querySelector("#close-chat");
const sendButton = document.querySelector("#send-button");
const sendLabel = document.querySelector("#send-label");
const clearButton = document.querySelector("#clear-chat");
const micButton = document.querySelector("#mic-button");
const voiceChatButton = document.querySelector("#voice-chat-button");
const voiceStatus = document.querySelector("#voice-status");
const replyLanguageSelect = document.querySelector("#reply-language");
const imageModeButton = document.querySelector("#image-mode-button");
const imageInput = document.querySelector("#image-input");
const attachButton = document.querySelector("#attach-button");
const cameraButton = document.querySelector("#camera-button");
const imagePreview = document.querySelector("#image-preview");
const attachmentStatus = document.querySelector("#attachment-status");
const cameraDialog = document.querySelector("#camera-dialog");
const cameraVideo = document.querySelector("#camera-video");
const cameraPlaceholder = document.querySelector("#camera-placeholder");
const cameraStatus = document.querySelector("#camera-status");
const startCameraButton = document.querySelector("#start-camera");
const switchCameraButton = document.querySelector("#switch-camera");
const capturePhotoButton = document.querySelector("#capture-photo");
const closeCameraButton = document.querySelector("#close-camera");
const textModelName = document.querySelector("#text-model-name");
const visionModelName = document.querySelector("#vision-model-name");
const searchWebToggle = document.querySelector("#search-web");
const searchStatus = document.querySelector("#search-status");
const searchResultStatus = document.querySelector("#search-result-status");

const conversation = [];
let isWaitingForReply = false;
let selectedImage;
let isPreparingImage = false;
let searchAvailable = false;
let mediaRecorder;
let microphoneStream;
let voiceDetectionContext;
let voiceDetectionInterval;
let audioChunks = [];
let recordingTimer;
let activeUtterance;
let handsFreeActive = false;
let imageGenerationMode = false;
let imageGenerationAvailable = false;
let cameraStream;
let cameraFacingMode = "environment";
let isCapturingPhoto = false;
const MAX_RECORDING_SECONDS = 60;

function setChatOpen(open) {
  chatWidget.hidden = !open;
  chatLauncher.setAttribute("aria-expanded", String(open));
  chatLauncher.setAttribute(
    "aria-label",
    open ? "Close AI assistant chat" : "Open AI assistant chat",
  );
  launcherLabel.textContent = open ? "Close chat" : "Let’s chat";

  if (open) {
    messageInput.focus();
  } else {
    chatLauncher.focus();
  }
}

function addMessage(role, content, isError = false, imageDataUrl) {
  const message = document.createElement("div");
  message.className = `message ${role}${isError ? " error" : ""}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = role === "user" ? "Y" : "✦";

  const text = document.createElement("div");
  text.className = "message-content";
  text.textContent = content;

  if (imageDataUrl) {
    const image = document.createElement("img");
    image.className = "message-image";
    image.src = imageDataUrl;
    image.alt = "Image attached to this message";
    text.prepend(image);
  }

  const contentGroup = document.createElement("div");
  contentGroup.append(text);

  if (role === "assistant" && !isError && content !== "Thinking...") {
    appendListenButton(contentGroup, content);
  }

  message.append(avatar, contentGroup);
  messagesElement.append(message);
  messagesElement.scrollTop = messagesElement.scrollHeight;
  return message;
}

function appendListenButton(contentGroup, content) {
  if (!content.trim()) {
    return;
  }

  const actions = document.createElement("div");
  actions.className = "message-actions";
  const listenButton = document.createElement("button");
  listenButton.className = "listen-button";
  listenButton.type = "button";
  listenButton.textContent = "Listen";
  listenButton.setAttribute("aria-label", "Read this reply aloud");
  listenButton.addEventListener("click", () => speakReply(content, listenButton));
  actions.append(listenButton);
  contentGroup.append(actions);
  return listenButton;
}

async function readChatStream(response, textElement, onDelta) {
  if (!response.body) {
    throw new Error("The local server did not start a reply stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pendingText = "";
  let sources = [];
  let completed = false;

  function readEvent(line) {
    if (!line.trim()) {
      return;
    }

    let event;
    try {
      event = JSON.parse(line);
    } catch {
      throw new Error("The local server sent an invalid reply stream.");
    }

    if (event.type === "sources") {
      sources = event.sources || [];
    } else if (event.type === "delta" && typeof event.content === "string") {
      onDelta(event.content);
      textElement.classList.remove("typing-indicator");
      textElement.textContent += event.content;
      messagesElement.scrollTop = messagesElement.scrollHeight;
    } else if (event.type === "error") {
      throw new Error(event.error || "The reply stream ended unexpectedly.");
    } else if (event.type === "done") {
      completed = true;
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    pendingText += decoder.decode(value, { stream: !done });

    const lines = pendingText.split("\n");
    pendingText = lines.pop();
    for (const line of lines) {
      readEvent(line);
    }

    if (done) {
      if (pendingText.trim()) {
        readEvent(pendingText);
      }
      break;
    }
  }

  if (!completed) {
    throw new Error("The reply stream ended before the answer was complete.");
  }

  return sources;
}

function appendSources(message, sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return;
  }

  const section = document.createElement("section");
  section.className = "source-list";

  const heading = document.createElement("h4");
  heading.textContent = "Sources";

  const list = document.createElement("ol");
  sources.forEach((source) => {
    let url;
    try {
      url = new URL(source.url);
    } catch {
      return;
    }

    if (url.protocol !== "https:") {
      return;
    }

    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = source.title;
    item.append(link);
    list.append(item);
  });

  if (list.childElementCount > 0) {
    section.append(heading, list);
    message.lastElementChild.append(section);
  }
}

function getSpeechLanguage(content) {
  const locales = {
    English: "en-US",
    Hindi: "hi-IN",
    Telugu: "te-IN",
    Tamil: "ta-IN",
    Spanish: "es-ES",
    French: "fr-FR",
    German: "de-DE",
    Arabic: "ar-SA",
    Japanese: "ja-JP",
    Chinese: "zh-CN",
  };
  const selectedLanguage = replyLanguageSelect.value;
  if (selectedLanguage !== "auto") {
    return locales[selectedLanguage] || "en-US";
  }

  if (/[\u0c00-\u0c7f]/u.test(content)) return "te-IN";
  if (/[\u0b80-\u0bff]/u.test(content)) return "ta-IN";
  if (/[\u0900-\u097f]/u.test(content)) return "hi-IN";
  if (/[\u0600-\u06ff]/u.test(content)) return "ar-SA";
  if (/[\u3040-\u30ff]/u.test(content)) return "ja-JP";
  if (/[\u4e00-\u9fff]/u.test(content)) return "zh-CN";
  return navigator.language || "en-US";
}

function speakReply(content, button, resumeHandsFree = false) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    voiceStatus.textContent = "Spoken replies are not supported in this browser.";
    return;
  }

  if (activeUtterance?.text === content) {
    speechSynthesis.cancel();
    activeUtterance = undefined;
    button.textContent = "Listen";
    return;
  }

  speechSynthesis.cancel();
  document.querySelectorAll(".listen-button").forEach((item) => {
    item.textContent = "Listen";
  });

  const utterance = new SpeechSynthesisUtterance(content);
  utterance.lang = getSpeechLanguage(content);
  activeUtterance = utterance;
  if (button) button.textContent = "Stop";
  voiceStatus.textContent = "Reading reply aloud using your browser's installed voice.";

  utterance.onend = () => {
    if (activeUtterance === utterance) {
      activeUtterance = undefined;
      if (button) button.textContent = "Listen";
      if (resumeHandsFree && handsFreeActive) {
        voiceStatus.textContent = "Listening for your next message...";
        const resumeListening = () => {
          if (!handsFreeActive) return;
          if (isWaitingForReply) {
            setTimeout(resumeListening, 250);
          } else {
            startVoiceRecording();
          }
        };
        setTimeout(resumeListening, 250);
      }
    }
  };

  utterance.onerror = () => {
    if (activeUtterance === utterance) {
      activeUtterance = undefined;
      if (button) button.textContent = "Listen";
      voiceStatus.textContent = "Could not play the spoken reply.";
      if (resumeHandsFree) setHandsFreeActive(false);
    }
  };

  speechSynthesis.speak(utterance);
}

function stopRecording() {
  clearTimeout(recordingTimer);
  stopVoiceActivityDetection();

  if (mediaRecorder?.state === "recording") {
    mediaRecorder.stop();
  }

  function stopVoiceActivityDetection() {
    clearInterval(voiceDetectionInterval);
    voiceDetectionInterval = undefined;
    if (voiceDetectionContext) {
      const context = voiceDetectionContext;
      voiceDetectionContext = undefined;
      context.close();
    }
  }

  function startVoiceActivityDetection(stream) {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;

    try {
      const context = new AudioContextConstructor();
      const analyser = context.createAnalyser();
      const source = context.createMediaStreamSource(stream);
      const samples = new Uint8Array(analyser.fftSize);
      source.connect(analyser);
      voiceDetectionContext = context;

      let speechStartedAt = 0;
      let lastVoiceAt = 0;
      voiceDetectionInterval = setInterval(() => {
        if (!handsFreeActive || mediaRecorder?.state !== "recording") {
          stopVoiceActivityDetection();
          return;
        }

        analyser.getByteTimeDomainData(samples);
        const meanSquare =
          samples.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) /
          samples.length;
        const now = Date.now();
        if (Math.sqrt(meanSquare) > 0.035) {
          if (!speechStartedAt) speechStartedAt = now;
          lastVoiceAt = now;
        } else if (
          speechStartedAt &&
          now - speechStartedAt > 800 &&
          now - lastVoiceAt > 1400
        ) {
          stopRecording();
        }
      }, 200);
    } catch (error) {
      console.error("Could not start voice activity detection:", error.message);
    }
  }

  micButton.disabled = true;
  micButton.classList.remove("recording");
  micButton.setAttribute("aria-label", "Start voice input");
  micButton.title = "Record a voice message";
}

function encodePcm16Wav(samples, sampleRate) {
  const bytesPerSample = 2;
  const audioBytes = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + audioBytes);
  const view = new DataView(buffer);
  const writeText = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + audioBytes, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, audioBytes, true);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(
      44 + index * bytesPerSample,
      sample < 0 ? sample * 32768 : sample * 32767,
      true,
    );
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function transcribeRecording(audioBlob, automatic = false) {
  micButton.disabled = true;

  if (!audioBlob.size) {
    voiceStatus.textContent = "No audio was recorded. Try again.";
    micButton.disabled = isWaitingForReply || handsFreeActive;
    if (automatic && handsFreeActive) setHandsFreeActive(false);
    return;
  }

  voiceStatus.textContent = "Preparing your audio for cloud transcription...";

  let audioContext;
  try {
    audioContext = new AudioContext();
    const decodedAudio = await audioContext.decodeAudioData(await audioBlob.arrayBuffer());
    const targetSampleRate = 16000;
    const sampleCount = Math.ceil(
      (decodedAudio.length * targetSampleRate) / decodedAudio.sampleRate,
    );
    const offlineContext = new OfflineAudioContext(1, sampleCount, targetSampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = decodedAudio;
    source.connect(offlineContext.destination);
    source.start();

    const resampledAudio = await offlineContext.startRendering();
    const wavBlob = encodePcm16Wav(
      resampledAudio.getChannelData(0),
      targetSampleRate,
    );
    const response = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "audio/wav" },
      body: wavBlob,
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Cloud transcription failed.");
    }

    if (automatic && handsFreeActive) {
      voiceStatus.textContent = "Sending your spoken message...";
      await sendMessage(result.transcript, undefined, false, {
        autoSpeak: true,
      });
    } else {
      messageInput.value = result.transcript;
      messageInput.dispatchEvent(new Event("input"));
      messageInput.focus();
      voiceStatus.textContent = "Transcript ready. Review it, then press Enter to send.";
    }
  } catch (error) {
    voiceStatus.textContent = error.message;
    if (automatic && handsFreeActive) setHandsFreeActive(false);
  } finally {
    await audioContext?.close();
    micButton.disabled = isWaitingForReply || handsFreeActive;
  }
}

function setWaiting(waiting) {
  isWaitingForReply = waiting;
  sendButton.disabled = waiting;
  messageInput.disabled = waiting;
  micButton.disabled = waiting;
  attachButton.disabled = waiting;
  cameraButton.disabled = waiting;
  searchWebToggle.disabled = waiting || imageGenerationMode;
  replyLanguageSelect.disabled = waiting;
  imageModeButton.disabled = waiting || !imageGenerationAvailable;
  sendLabel.textContent = waiting ? "Thinking..." : "Send";
}

function updateSearchStatus() {
  if (imageGenerationMode) {
    searchStatus.textContent = "Web search is available in chat mode";
    return;
  }
  if (!searchAvailable) {
    searchStatus.textContent = searchWebToggle.checked
      ? "Add a Tavily API key to use web search"
      : "Off · add a Tavily API key to enable web search";
    return;
  }

  searchStatus.textContent = searchWebToggle.checked
    ? "On · the query goes to Tavily; excerpts are sent to Gemini"
    : "Off · chat messages and images are sent to Gemini";
}

function appendGeneratedImage(message, prompt, imageDataUrl, mimeType) {
  const content = message.querySelector(".message-content");
  content.classList.remove("typing-indicator");
  content.textContent = `Created from: ${prompt}`;

  const image = document.createElement("img");
  image.className = "generated-image";
  image.src = imageDataUrl;
  image.alt = `AI-generated image: ${prompt}`;

  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
  const download = document.createElement("a");
  download.className = "download-image";
  download.href = imageDataUrl;
  download.download = `mellowmind-image.${extension}`;
  download.textContent = "Download image";
  content.append(image, download);
}

async function sendMessage(
  text,
  image,
  searchWeb,
  { autoSpeak = false, createImage = false } = {},
) {
  if (isWaitingForReply || (!text.trim() && !image)) {
    return;
  }

  const previousImages = image
    ? conversation.flatMap((message, index) =>
        message.images ? [{ index, images: message.images }] : [],
      )
    : [];
  if (image) {
    previousImages.forEach(({ index }) => {
      delete conversation[index].images;
    });
  }

  const userMessage = {
    role: "user",
    content: text.trim() || "What is in this picture?",
    ...(image ? { images: [image.base64] } : {}),
  };
  if (!createImage) conversation.push(userMessage);
  welcomeMessage.hidden = true;
  addMessage("user", userMessage.content, false, image?.dataUrl);

  const thinkingMessage = addMessage("assistant", "Thinking...");
  const replyElement = thinkingMessage.querySelector(".message-content");
  replyElement.classList.add("typing-indicator");
  let partialReply = "";
  setWaiting(true);

  try {
    if (createImage) {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text.trim() }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Google could not generate that image.");
      }
      appendGeneratedImage(
        thinkingMessage,
        text.trim(),
        result.imageDataUrl,
        result.mimeType,
      );
      return;
    }

    const now = new Date();
    const offsetMinutes = -now.getTimezoneOffset();
    const offsetSign = offsetMinutes >= 0 ? "+" : "-";
    const offsetHours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, "0");
    const offsetRemainder = String(Math.abs(offsetMinutes) % 60).padStart(2, "0");
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: conversation,
        searchWeb,
        replyLanguage: replyLanguageSelect.value,
        currentTime: {
          iso: now.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          offset: `UTC${offsetSign}${offsetHours}:${offsetRemainder}`,
        },
      }),
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Gemini could not answer.");
    }

    const sources = await readChatStream(response, replyElement, (content) => {
      partialReply += content;
    });
    replyElement.classList.remove("typing-indicator");
    const listenButton = appendListenButton(
      thinkingMessage.lastElementChild,
      partialReply,
    );
    conversation.push({ role: "assistant", content: partialReply });
    appendSources(thinkingMessage, sources);
    if (autoSpeak && partialReply.trim()) {
      speakReply(partialReply, listenButton, true);
    }
  } catch (error) {
    if (partialReply) {
      replyElement.classList.remove("typing-indicator");
      appendListenButton(thinkingMessage.lastElementChild, partialReply);
      conversation.push({ role: "assistant", content: partialReply });
    } else {
      thinkingMessage.remove();
      if (!createImage) conversation.pop();
    }
    previousImages.forEach(({ index, images }) => {
      if (conversation[index]) {
        conversation[index].images = images;
      }
    });
    addMessage("assistant", error.message, true);
    if (autoSpeak) setHandsFreeActive(false);
  } finally {
    setWaiting(false);
    if (!handsFreeActive) {
      voiceStatus.textContent = "Enter to send · Shift + Enter for a new line";
    }
    searchResultStatus.textContent = "";
    messageInput.focus();
  }
}

function setHandsFreeActive(active) {
  handsFreeActive = active;
  voiceChatButton.setAttribute("aria-pressed", String(active));
  voiceChatButton.setAttribute(
    "aria-label",
    active ? "Stop hands-free voice chat" : "Start hands-free voice chat",
  );
  voiceChatButton.title = active ? "Stop voice chat" : "Start hands-free voice chat";
  voiceStatus.textContent = active
    ? "Voice chat is on. Speak after the listening message."
    : "Voice chat stopped.";
}

async function startVoiceRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    voiceStatus.textContent = "Voice recording is not supported in this browser.";
    if (handsFreeActive) setHandsFreeActive(false);
    return;
  }

  micButton.disabled = true;
  try {
    microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
      MediaRecorder.isTypeSupported(type),
    );
    mediaRecorder = mimeType
      ? new MediaRecorder(microphoneStream, { mimeType })
      : new MediaRecorder(microphoneStream);
    audioChunks = [];
    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    });
    mediaRecorder.addEventListener("stop", () => {
      const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
      audioChunks = [];
      microphoneStream?.getTracks().forEach((track) => track.stop());
      microphoneStream = undefined;
      transcribeRecording(audioBlob, handsFreeActive);
    }, { once: true });
    mediaRecorder.start();
    if (handsFreeActive) startVoiceActivityDetection(microphoneStream);
    micButton.disabled = handsFreeActive;
    micButton.classList.add("recording");
    micButton.setAttribute("aria-label", "Stop voice recording");
    micButton.title = handsFreeActive
      ? "Hands-free voice chat is listening"
      : "Stop recording";
    voiceStatus.textContent = handsFreeActive
      ? `Listening... speak, then pause to send (up to ${MAX_RECORDING_SECONDS} seconds).`
      : `Recording... click the microphone to stop (up to ${MAX_RECORDING_SECONDS} seconds).`;
    recordingTimer = setTimeout(() => {
      if (mediaRecorder?.state === "recording") {
        stopRecording();
        voiceStatus.textContent = handsFreeActive
          ? "Recording limit reached. Sending your message..."
          : "Recording limit reached. Preparing cloud transcription...";
      }
    }, MAX_RECORDING_SECONDS * 1000);
  } catch (error) {
    microphoneStream?.getTracks().forEach((track) => track.stop());
    microphoneStream = undefined;
    micButton.disabled = isWaitingForReply;
    voiceStatus.textContent = error.name === "NotAllowedError"
      ? "Microphone permission was not granted."
      : "Could not start the microphone. Check that it is connected.";
    if (handsFreeActive) setHandsFreeActive(false);
  }
}

function displaySelectedImage(file, dataUrl) {
  imagePreview.replaceChildren();
  imagePreview.hidden = false;

  const image = document.createElement("img");
  image.src = dataUrl;
  image.alt = file.name;

  const details = document.createElement("span");
  details.className = "image-preview-name";
  details.textContent = file.name;

  const removeButton = document.createElement("button");
  removeButton.className = "remove-image-button";
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.setAttribute("aria-label", "Remove attached image");
  removeButton.addEventListener("click", clearSelectedImage);

  imagePreview.append(image, details, removeButton);
}

function clearSelectedImage() {
  selectedImage = undefined;
  imageInput.value = "";
  imagePreview.replaceChildren();
  imagePreview.hidden = true;
  imagePreview.setAttribute("aria-label", "");
  attachmentStatus.textContent = "";
}

function stopCamera() {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = undefined;
  cameraVideo.srcObject = null;
  cameraPlaceholder.hidden = false;
  capturePhotoButton.disabled = true;
  switchCameraButton.disabled = true;
  startCameraButton.disabled = false;
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraStatus.textContent =
      "Camera access is unavailable here. Open the app over HTTPS or localhost, or attach an image instead.";
    return;
  }

  startCameraButton.disabled = true;
  cameraStatus.textContent = "Asking your browser to open the camera...";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: cameraFacingMode },
        width: { ideal: 1280 },
        height: { ideal: 960 },
      },
    });
    cameraStream = stream;
    cameraVideo.srcObject = stream;
    await cameraVideo.play();
    cameraPlaceholder.hidden = true;
    capturePhotoButton.disabled = false;
    switchCameraButton.disabled = false;
    startCameraButton.disabled = true;
    cameraStatus.textContent = "Camera is ready. Frame your photo, then take it.";
  } catch (error) {
    stopCamera();
    cameraStatus.textContent =
      error.name === "NotAllowedError"
        ? "Camera permission was not granted. Allow camera access in your browser settings, or attach an image instead."
        : error.name === "NotFoundError"
          ? "No camera was found on this device. You can attach an image instead."
          : "Could not start the camera. Check that it is connected and not being used by another app.";
  }
}

async function capturePhoto() {
  if (!cameraStream || isCapturingPhoto) {
    return;
  }

  if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) {
    cameraStatus.textContent = "The camera is still starting. Please wait a moment.";
    return;
  }

  isCapturingPhoto = true;
  capturePhotoButton.disabled = true;
  cameraStatus.textContent = "Preparing your photo...";

  try {
    const canvas = document.createElement("canvas");
    canvas.width = cameraVideo.videoWidth;
    canvas.height = cameraVideo.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Your browser could not capture the photo.");
    }
    context.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);

    const photoBlob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Your browser could not save the photo."));
          }
        },
        "image/jpeg",
        0.88,
      );
    });
    const photoFile = new File([photoBlob], `camera-photo-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    const optimizedImage = await prepareImageForVision(photoFile);

    selectedImage = {
      name: photoFile.name,
      dataUrl: optimizedImage.dataUrl,
      base64: optimizedImage.base64,
    };
    displaySelectedImage(photoFile, optimizedImage.dataUrl);
    attachmentStatus.textContent =
      "Photo ready. Add a question, or send it as-is to ask what’s in the picture.";
    if (!messageInput.value.trim()) {
      messageInput.value = "What can you tell me about this photo?";
      messageInput.dispatchEvent(new Event("input"));
    }
    cameraDialog.close();
    messageInput.focus();
  } catch (error) {
    cameraStatus.textContent = error.message;
    capturePhotoButton.disabled = false;
  } finally {
    isCapturingPhoto = false;
  }
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Could not prepare that image. Try another file."));
      }
    });
    reader.addEventListener("error", () => {
      reject(new Error("Could not read that image. Try another file."));
    });
    reader.readAsDataURL(blob);
  });
}

async function prepareImageForVision(file) {
  const bitmap = await createImageBitmap(file);
  const maximumDimension = 1280;
  const scale = Math.min(
    1,
    maximumDimension / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Your browser could not prepare the image.");
  }

  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const optimizedBlob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Your browser could not compress the image."));
        }
      },
      "image/jpeg",
      0.82,
    );
  });

  if (optimizedBlob.size > 5 * 1024 * 1024) {
    throw new Error("The prepared image is still too large. Choose a smaller photo.");
  }

  const dataUrl = await readBlobAsDataUrl(optimizedBlob);
  const base64 = dataUrl.split(",")[1];
  if (!base64) {
    throw new Error("Could not prepare that image. Try another file.");
  }

  return { dataUrl, base64, width: canvas.width, height: canvas.height };
}

async function updateImageStatus() {
  try {
    const response = await fetch("/api/status");
    const status = await response.json();
    textModelName.textContent = `${status.textModel} · cloud`;
    imageGenerationAvailable = status.imageGenerationAvailable === true;
    imageModeButton.disabled = !imageGenerationAvailable;
    imageModeButton.title = imageGenerationAvailable
      ? `Generate with ${status.imageModel}`
      : "Set GEMINI_API_KEY to enable image generation";
    searchAvailable = status.searchAvailable;
    if (status.searchMode === "keyless") {
      searchStatus.textContent = searchWebToggle.checked
        ? "On · free keyless search; the query goes to Tavily"
        : "Off · free keyless search available, no account or card needed";
    } else if (status.searchMode === "key") {
      searchStatus.textContent = searchWebToggle.checked
        ? "On · the query goes to Tavily; excerpts are sent to Gemini"
        : "Off · chat messages and images are sent to Gemini";
    } else {
      updateSearchStatus();
    }
    updateSearchStatus();

    if (status.geminiAvailable) {
      visionModelName.textContent = `${status.visionModel} ready`;
      attachmentStatus.textContent =
        "Image chat is ready. Images are sent to Google Gemini for analysis.";
      if (imageGenerationAvailable) {
        attachmentStatus.textContent +=
          ` Image generation uses ${status.imageModel} and may have separate quota or availability.`;
      }
    } else {
      textModelName.textContent = "Gemini API key not configured";
      visionModelName.textContent = "Gemini API key not configured";
      attachmentStatus.textContent =
        "Set GEMINI_API_KEY in PowerShell, then restart the app to enable chat, images, and voice.";
    }
  } catch {
    imageGenerationAvailable = false;
    imageModeButton.disabled = true;
    visionModelName.textContent = "Could not check Gemini setup";
    attachmentStatus.textContent = "Could not check the Gemini API setup.";
    searchAvailable = false;
    searchStatus.textContent = "Off · could not check web search setup";
  }
}

searchWebToggle.addEventListener("change", updateSearchStatus);

imageModeButton.addEventListener("click", () => {
  imageGenerationMode = !imageGenerationMode;
  imageModeButton.setAttribute("aria-pressed", String(imageGenerationMode));
  imageModeButton.textContent = imageGenerationMode
    ? "✧ Image mode on"
    : "✧ Create image";
  imageModeButton.title = imageGenerationMode
    ? "Send a description to generate an image"
    : "Switch to image generation";
  messageInput.placeholder = imageGenerationMode
    ? "Describe the image you want to create..."
    : "Ask anything...";
  searchWebToggle.disabled = isWaitingForReply || imageGenerationMode;
  updateSearchStatus();
  messageInput.focus();
});

cameraButton.addEventListener("click", () => {
  cameraStatus.textContent = "Your camera starts only when you tap “Start camera”.";
  cameraDialog.showModal();
});

startCameraButton.addEventListener("click", startCamera);

switchCameraButton.addEventListener("click", async () => {
  cameraFacingMode = cameraFacingMode === "environment" ? "user" : "environment";
  stopCamera();
  await startCamera();
});

capturePhotoButton.addEventListener("click", capturePhoto);
closeCameraButton.addEventListener("click", () => cameraDialog.close());
cameraDialog.addEventListener("close", stopCamera);
cameraDialog.addEventListener("cancel", stopCamera);

chatLauncher.addEventListener("click", () => {
  setChatOpen(chatWidget.hidden);
});

closeChatButton.addEventListener("click", () => setChatOpen(false));

document.addEventListener("keydown", (event) => {
  if (cameraDialog.open) {
    return;
  }

  if (event.key === "Escape" && !chatWidget.hidden) {
    setChatOpen(false);
  }
});

attachButton.addEventListener("click", () => imageInput.click());

imageInput.addEventListener("change", async () => {
  const [file] = imageInput.files;
  if (!file) {
    return;
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    attachmentStatus.textContent = "Choose a JPG, PNG, or WebP image.";
    imageInput.value = "";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    attachmentStatus.textContent = "That image is too large. Choose an image under 5 MB.";
    imageInput.value = "";
    return;
  }

  isPreparingImage = true;
  attachButton.disabled = true;
  cameraButton.disabled = true;
  sendButton.disabled = true;
  attachmentStatus.textContent = "Optimizing your photo for Gemini...";

  try {
    const optimizedImage = await prepareImageForVision(file);
    selectedImage = {
      name: file.name,
      dataUrl: optimizedImage.dataUrl,
      base64: optimizedImage.base64,
    };
    displaySelectedImage(file, optimizedImage.dataUrl);
    attachmentStatus.textContent =
      `Optimized to ${optimizedImage.width} × ${optimizedImage.height}. ` +
      "The latest image stays available for follow-ups; attaching a new image replaces it for the AI.";
  } catch (error) {
    imageInput.value = "";
    attachmentStatus.textContent = error.message;
  } finally {
    isPreparingImage = false;
    attachButton.disabled = isWaitingForReply;
    cameraButton.disabled = isWaitingForReply;
    sendButton.disabled = isWaitingForReply;
  }
});

micButton.addEventListener("click", async () => {
  if (mediaRecorder?.state === "recording") {
    stopRecording();
    voiceStatus.textContent = "Preparing your recording for cloud transcription...";
    return;
  }

  await startVoiceRecording();
});

voiceChatButton.addEventListener("click", async () => {
  if (handsFreeActive) {
    setHandsFreeActive(false);
    if (mediaRecorder?.state === "recording") {
      stopRecording();
    }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    activeUtterance = undefined;
    micButton.disabled = isWaitingForReply;
    return;
  }

  if (isWaitingForReply) return;
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    voiceStatus.textContent = "Spoken replies are not supported in this browser.";
    return;
  }

  setHandsFreeActive(true);
  await startVoiceRecording();
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (isPreparingImage) {
    attachmentStatus.textContent = "Wait for the image to finish optimizing.";
    return;
  }

  if (mediaRecorder?.state === "recording") {
    voiceStatus.textContent = "Stop voice recording before sending.";
    return;
  }

  if (imageGenerationMode && selectedImage) {
    attachmentStatus.textContent =
      "Remove the attached photo before using image generation.";
    return;
  }

  if (imageGenerationMode && messageInput.value.trim().length > 1000) {
    attachmentStatus.textContent =
      "Image descriptions can be up to 1,000 characters. Please shorten the prompt.";
    return;
  }

  const text = messageInput.value;
  if (text.trim() || selectedImage) {
    const image = selectedImage;
    const createImage = imageGenerationMode;
    const searchWeb = !createImage && searchWebToggle.checked;
    messageInput.value = "";
    messageInput.style.height = "auto";
    clearSelectedImage();
    searchResultStatus.textContent = searchWeb
      ? "Searching the web and preparing a sourced answer..."
      : createImage
        ? "Creating your image with Google Gemini..."
        : image
        ? "Sending the optimized image to Google Gemini for analysis."
        : "";
    sendMessage(text, image, searchWeb, {
      autoSpeak: handsFreeActive,
      createImage,
    });
  }
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 128)}px`;
});

clearButton.addEventListener("click", () => {
  if (isWaitingForReply) {
    return;
  }

  conversation.length = 0;
  clearSelectedImage();
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
  activeUtterance = undefined;
  messagesElement.replaceChildren(welcomeMessage);
  welcomeMessage.hidden = false;
  messageInput.focus();
});

window.addEventListener("pagehide", () => {
  microphoneStream?.getTracks().forEach((track) => track.stop());
  cameraStream?.getTracks().forEach((track) => track.stop());
  if ("speechSynthesis" in window) speechSynthesis.cancel();
});

document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    setChatOpen(true);
    messageInput.value = button.dataset.prompt;
    messageInput.focus();
    messageInput.dispatchEvent(new Event("input"));
  });
});

updateImageStatus();
