// TODO: video encoding


// Grabbing DOM elements for buttons, video, and timer
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const closeBtn = document.getElementById('closeBtn');
const timerDisplay = document.getElementById('timer');
const webcamVideo = document.getElementById('webcam');
const audioButton = document.getElementById('audioButton');
const audioMenu = document.getElementById('audioMenu');

// Variables for recording and audio visualization
let mediaRecorder;
let recordedChunks = [];
let startTime, timerInterval, audioContext, analyzerNode, microphoneStream, audioStream;

// Function to initialize the audio context and create a sound level visualization
async function initAudio() {
  audioStream = await getAudioStream(); // Get the audio stream

  // Set up audio context and analyzer node for visualizing the audio input
  audioContext = new AudioContext();
  microphoneStream = audioContext.createMediaStreamSource(audioStream);
  analyzerNode = audioContext.createAnalyser();
  microphoneStream.connect(analyzerNode);
  analyzerNode.fftSize = 256; // Set the FFT size for analyzing frequency data
  const bufferLength = analyzerNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  // Function to update the scale of the audio button based on sound level
  function updateSoundLevel() {
    analyzerNode.getByteFrequencyData(dataArray);
    const sum = dataArray.reduce((acc, value) => acc + value, 0);
    const average = sum / bufferLength;
    const scale = 0.9 + (average / 50) * 0.4; // Scale the button between 0.9 and 1.3
    audioButton.style.transform = `scale(${scale})`; // Update button size based on sound
    requestAnimationFrame(updateSoundLevel); // Keep updating sound level
  }

  updateSoundLevel(); // Start visualizing the sound level
}

// Function to get available audio input devices and populate the audio source menu
async function getAudioSources() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const audioSources = devices.filter(device => device.kind === 'audioinput');

  // Populate the audio menu with available audio sources
  audioMenu.innerHTML = audioSources.map(source => {
    return `<div class="audio-source" data-device-id="${source.deviceId}">${source.label || 'Microphone ' + source.deviceId}</div>`;
  }).join('');
}

// Toggle the audio source menu's visibility when the audio button is clicked
audioButton.addEventListener('click', () => {
  audioMenu.style.display = (audioMenu.style.display === '' || audioMenu.style.display === 'none') ? 'block' : 'none';
});

// Handle audio source selection and restart the audio stream with the selected device
audioMenu.addEventListener('click', async (event) => {
  if (event.target.classList.contains('audio-source')) {
    const selectedDeviceId = event.target.getAttribute('data-device-id');
    audioMenu.style.display = 'none'; // Hide the menu after selection

    // Stop the current audio stream if one is active
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
    }

    // Get the new audio stream from the selected device
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: selectedDeviceId } }
    });

    // Restart the audio visualization with the new stream
    microphoneStream = audioContext.createMediaStreamSource(audioStream);
    microphoneStream.connect(analyzerNode);
  }
});

// Function to capture the screen stream for recording
async function getScreenStream() {
  const matchingDisplay = await window.electronAPI.getMatchingScreen(); // Get the display containing the Electron window
  const sources = await window.electronAPI.getDesktopSources({ types: ['screen'] });

  // Find the correct screen source based on the matching display
  const screenSource = sources.find(source => String(source.display_id) === String(matchingDisplay.id)) || sources[0];

  // Capture the screen stream
  const screenStream = await navigator.mediaDevices.getUserMedia({
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: screenSource.id,
        maxWidth: window.screen.width,
        maxHeight: window.screen.height
      }
    }
  });

  return screenStream;
}

// Function to get the webcam stream
async function getWebcamStream() {
  const webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  webcamVideo.srcObject = webcamStream; // Display webcam stream in the video element
  return webcamStream;
}

// Function to get the audio stream based on the selected device
async function getAudioStream() {
  const selectedAudioDeviceId = audioSourceSelect.value;
  const audioStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: selectedAudioDeviceId ? { exact: selectedAudioDeviceId } : undefined
    }
  });
  return audioStream;
}

// Function to start recording the screen and audio streams
async function startRecording() {
  const screenStream = await getScreenStream();
  const audioStream = await getAudioStream();

  // Create a canvas to resize the video
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Set the canvas size to 960px width and maintain aspect ratio
  const videoWidth = 960;
  const screenVideoTrack = screenStream.getVideoTracks()[0];
  const videoSettings = screenVideoTrack.getSettings();
  const videoHeight = (videoSettings.height / videoSettings.width) * videoWidth;

  canvas.width = videoWidth;
  canvas.height = videoHeight;

  // Create a video element to play the screen stream on the canvas
  const screenVideo = document.createElement('video');
  screenVideo.srcObject = screenStream;
  screenVideo.muted = true; // Mute the video to avoid feedback
  await screenVideo.play();

  // Function to draw the video frames onto the canvas
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height); // Draw the screen video
    requestAnimationFrame(draw); // Continuously draw the video frames
  }

  draw(); // Start drawing the video

  // Capture the canvas as a video stream and add the audio stream
  const outputStream = canvas.captureStream();
  audioStream.getTracks().forEach(track => outputStream.addTrack(track));

  // Initialize the media recorder with the combined streams
  mediaRecorder = new MediaRecorder(outputStream, { mimeType: 'video/webm;codecs=vp9' });
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = saveVideo;

  mediaRecorder.start(); // Start recording

  // Reset and start the timer
  timerDisplay.textContent = "00:00";
  startBtn.style.display = 'none';
  stopBtn.style.display = 'inline-block';
  timerDisplay.style.display = 'inline-block';
  startTime = Date.now();
  timerInterval = setInterval(updateTimer, 1000);

  stopBtn.disabled = false;
}

// Function to stop the recording
function stopRecording() {
  mediaRecorder.stop();
  clearInterval(timerInterval);

  // Reset buttons and hide the timer
  stopBtn.style.display = 'none';
  startBtn.style.display = 'inline-block';
  timerDisplay.style.display = 'none';

  stopBtn.disabled = true;
}

// Function to save the recorded video to the local file system
function saveVideo() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const videoUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = videoUrl;
  a.download = 'recording.webm'; // Automatically download the video as "recording.webm"
  document.body.appendChild(a);
  a.click(); // Trigger the download
  window.URL.revokeObjectURL(videoUrl); // Clean up
  recordedChunks = [];
}

// Function to update the recording timer display
function updateTimer() {
  const elapsed = Date.now() - startTime;
  const minutes = Math.floor(elapsed / 60000).toString().padStart(2, '0');
  const seconds = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
  timerDisplay.textContent = `${minutes}:${seconds}`;
}

// Close button functionality: stops recording if active and closes the app
closeBtn.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecording();  // Stop recording if active
  }
  window.close();  // Close the app window
});

// Initialize the app by setting up webcam, audio sources, and sound visualization
getWebcamStream();
getAudioSources();  // Populate the audio sources menu
initAudio();  // Start sound level animation

// Set up button interactions for recording
stopBtn.style.display = 'none';
startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);